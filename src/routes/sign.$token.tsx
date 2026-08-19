import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/signature-pad";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, Clock, FileText, User, Send, CalendarClock, Camera, Fingerprint, Lock, Info, Check, AlertTriangle, MonitorOff } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { StatusBadge, type DocStatus } from "@/components/status-badge";
import logoAsset from "@/assets/total-giro-logo.png.asset.json";
import { getFaceEmbedding, loadModels } from "@/lib/facial-client";
import { Checkbox } from "@/components/ui/checkbox";



type DocData = {
  id: string;
  name: string;
  status: DocStatus;
  recipient_name: string;
  recipient_id: string | null;
  message: string | null;
  deadline: string | null;
  sender_name: string;
  pdf_url: string | null;
  facial_status: string | null;
};


export const Route = createFileRoute("/sign/$token")({
  ssr: false,
  beforeLoad: async ({ params }) => {
    // We allow public access to this specific signing route
    return { token: params.token };
  },
  head: () => ({
    meta: [
      { title: "Assinar Documento — Total Giro" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignPage,
});


function SignPage() {
  const { token } = Route.useParams();
  const [doc, setDoc] = useState<DocData | null>(null);
  const [employee, setEmployee] = useState<{ id: string; name: string; facial_status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signature, setSignature] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<"assinado" | "recusado" | null>(null);
  const [step, setStep] = useState<"code" | "consent" | "precheck" | "face" | "sign">("code");
  const [accessCode, setAccessCode] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [verifyingFace, setVerifyingFace] = useState(false);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(false);
  const [facialAuthToken, setFacialAuthToken] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<{ type: 'blocked' | 'incompatible' | 'error', message: string } | null>(null);
  const [faceFeedback, setFaceFeedback] = useState<string | null>(null);
  const [faceMetrics, setFaceMetrics] = useState<{
    position: 'center' | 'left' | 'right' | 'too-close' | 'too-far' | 'none';
    distance: 'ok' | 'close' | 'far';
    lighting: 'ok' | 'dim' | 'bright';
  }>({ position: 'none', distance: 'ok', lighting: 'ok' });
  const [precheckStatus, setPrecheckStatus] = useState<{
    permission: 'pending' | 'ok' | 'fail';
    camera: 'pending' | 'ok' | 'fail';
    models: 'pending' | 'ok' | 'fail';
  }>({ permission: 'pending', camera: 'pending', models: 'pending' });
  const [checkingHardware, setCheckingHardware] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);



  useEffect(() => {
    fetch(`/api/public/sign/${token}`)
      .then(async (res) => {
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error("Failed to parse response:", text);
          throw new Error("Resposta inválida do servidor");
        }
        
        if (!res.ok) {
          throw new Error(data.error ?? "Erro ao carregar");
        }
        return data;
      })
      .then((data) => {
        setDoc(data);
        // Pre-fill name if available
        if (data.recipient_name) setTypedName(data.recipient_name);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (step === "face" && !capturedImage) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError({ 
          type: 'incompatible', 
          message: "Seu navegador não suporta acesso à câmera ou a conexão não é segura (HTTPS)." 
        });
        return;
      }

      const constraints = { 
        video: { 
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 640 }
        } 
      };

      navigator.mediaDevices.getUserMedia(constraints)
        .then((stream) => {
          setCameraError(null);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // Ensure video plays and metadata is loaded
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().catch(console.error);
            };
          }
        })
        .catch((err) => {
          console.error("Erro ao acessar câmera:", err);
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setCameraError({ 
              type: 'blocked', 
              message: "Acesso à câmera bloqueado. Por favor, habilite a permissão nas configurações do seu navegador ou do celular." 
            });
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            setCameraError({ 
              type: 'error', 
              message: "Nenhuma câmera encontrada no dispositivo." 
            });
          } else {
            setCameraError({ 
              type: 'error', 
              message: `Erro ao acessar câmera: ${err.message || 'Verifique se ela está sendo usada por outro app.'}` 
            });
          }
        });

      return () => {
        const stream = videoRef.current?.srcObject as MediaStream;
        stream?.getTracks().forEach((track) => track.stop());
      };
    }
  }, [step, capturedImage]);

  // Monitor face feedback in real-time
  useEffect(() => {
    let interval: any;
    let loadingToastShown = false;

    if (step === 'face' && !capturedImage && !cameraError && videoRef.current) {
      interval = setInterval(async () => {
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended || verifyingFace) return;
        
        try {
          // Use Tiny detector for real-time mobile feedback
          const result = await getFaceEmbedding(videoRef.current, true);
          
          if (!result) {
            setFaceFeedback("Rosto não detectado. Aproxime-se mais.");
            setFaceMetrics(prev => ({ ...prev, position: 'none' }));
          } else {
            // Calculate metrics for real-time guidance
            const box = result.box;
            const videoWidth = videoRef.current.videoWidth;
            const videoHeight = videoRef.current.videoHeight;
            
            // 1. Position Check (Horizontal)
            const faceCenterX = box.x + box.width / 2;
            const relX = faceCenterX / videoWidth;
            let pos: any = 'center';
            if (relX < 0.35) pos = 'right'; // Mirrored video
            else if (relX > 0.65) pos = 'left';
            
            // 2. Distance Check (Size relative to container)
            const faceArea = (box.width * box.height) / (videoWidth * videoHeight);
            let dist: any = 'ok';
            if (faceArea < 0.05) { dist = 'far'; pos = 'too-far'; }
            else if (faceArea > 0.45) { dist = 'close'; pos = 'too-close'; }

            // 3. Simple Lighting Check
            // Lighting is assumed ok if detection is confident, 
            // but we can add more logic here if needed.
            
            setFaceMetrics({
              position: pos,
              distance: dist,
              lighting: 'ok'
            });

            if (result.faceCount > 1) {
              setFaceFeedback("Múltiplos rostos detectados. Fique sozinho na câmera.");
            } else if (pos === 'too-far') {
              setFaceFeedback("Aproxime-se mais da câmera.");
            } else if (pos === 'too-close') {
              setFaceFeedback("Afaste-se um pouco da câmera.");
            } else if (pos === 'left' || pos === 'right') {
              setFaceFeedback("Centralize seu rosto.");
            } else {
              setFaceFeedback(null);
              
              // AUTO-CAPTURE LOGIC
              // If position, distance and lighting are all OK, trigger capture
              if (pos === 'center' && dist === 'ok' && !verifyingFace) {
                const captureButton = document.getElementById('capture-photo-btn');
                if (captureButton) {
                  captureButton.click();
                }
              }
            }
          }
        } catch (e: any) {
          console.error("Erro no feedback facial:", e);
          if (e.message?.includes("Não foi possível carregar") && !loadingToastShown) {
            toast.error(e.message);
            loadingToastShown = true;
          }
        }
      }, 800); // Slightly faster polling for auto-capture
    }
    return () => clearInterval(interval);
  }, [step, capturedImage, cameraError, verifyingFace]);


  const submit = async () => {
    const parts = typedName.trim().split(/\s+/).filter((p) => p.length >= 2);
    if (parts.length < 2) return toast.error("Digite seu nome completo (nome e sobrenome)");
    if (!signature) return toast.error("Desenhe sua assinatura primeiro");
    if (!facialAuthToken) return toast.error("Validação facial obrigatória");

    setSubmitting(true);
    const res = await fetch(`/api/public/sign/${token}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        action: "sign", 
        signature_data_url: signature, 
        signer_name: typedName.trim(),
        facial_auth_token: facialAuthToken
      }),
    });
    if (!res.ok) {
      setSubmitting(false);
      const j = await res.json().catch(() => ({}));
      return toast.error(j.error ?? "Erro ao assinar");
    }
    // Reload document to display the newly signed PDF
    try {
      const refreshed = await fetch(`/api/public/sign/${token}`).then((r) => r.json());
      if (refreshed && !refreshed.error) setDoc(refreshed);
    } catch { /* ignore */ }
    setSubmitting(false);
    setDone("assinado");
  };


  const decline = async () => {
    const reason = window.prompt("Deseja informar o motivo da recusa? (opcional)");
    if (reason === null) return;
    setSubmitting(true);
    const res = await fetch(`/api/public/sign/${token}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline", reason }),
    });
    setSubmitting(false);
    if (!res.ok) return toast.error("Erro ao recusar");
    setDone("recusado");
  };

  const runPrecheck = async () => {
    setCheckingHardware(true);
    setPrecheckStatus({ permission: 'pending', camera: 'pending', models: 'pending' });

    try {
      // 1. Models check
      try {
        await loadModels();
        setPrecheckStatus(prev => ({ ...prev, models: 'ok' }));
      } catch (e) {
        setPrecheckStatus(prev => ({ ...prev, models: 'fail' }));
        toast.error("Erro ao carregar modelos de IA");
      }

      // 2. Camera/Permission check
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPrecheckStatus(prev => ({ ...prev, permission: 'fail', camera: 'fail' }));
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user" } 
        });
        
        setPrecheckStatus(prev => ({ ...prev, permission: 'ok' }));

        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        
        // Basic check for resolution or at least existence of stream
        if (settings.width && settings.height) {
          setPrecheckStatus(prev => ({ ...prev, camera: 'ok' }));
        } else {
          setPrecheckStatus(prev => ({ ...prev, camera: 'fail' }));
        }

        // Clean up check stream
        stream.getTracks().forEach(t => t.stop());
      } catch (err: any) {
        console.error("Precheck camera error:", err);
        setPrecheckStatus(prev => ({ ...prev, permission: 'fail', camera: 'fail' }));
      }

    } finally {
      setCheckingHardware(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/40">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando documento...</p>
        </div>
      </div>
    );
  }
  if (error || !doc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <XCircle className="mx-auto size-10 text-destructive" />
          <h1 className="mt-4 font-display text-xl font-bold">Link inválido</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error ?? "Este documento não está disponível."}</p>
          <Button variant="outline" className="mt-6" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  const alreadyFinal = doc.status === "assinado" || doc.status === "recusado" || doc.status === "expirado" || done;
  const finalStatus: DocStatus = done ?? doc.status;

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/60 via-background to-secondary/40">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/70 bg-card/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <img src={logoAsset.url} alt="Total Giro" className="h-9 w-auto" />
            <div className="hidden h-6 w-px bg-border sm:block" />
            <div className="hidden text-xs text-muted-foreground sm:block">
              Assinatura digital de documentos
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
            <ShieldCheck className="size-3.5" />
            Conexão segura
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-3">
        {/* PDF viewer */}
        <div className="space-y-4 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="relative border-b border-border bg-gradient-to-r from-accent to-accent/85 p-6 text-accent-foreground">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-foreground/70">
                    Documento para assinatura
                  </p>
                  <h1 className="mt-1.5 break-words font-display text-2xl font-bold leading-tight">
                    {doc.name}
                  </h1>
                </div>
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md">
                  <FileText className="size-5" />
                </div>
              </div>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <InfoRow icon={<Send className="size-3.5" />} label="Enviado por" value={doc.sender_name} />
              <InfoRow icon={<User className="size-3.5" />} label="Destinatário" value={doc.recipient_name} />
              {doc.deadline && (
                <InfoRow
                  icon={<CalendarClock className="size-3.5" />}
                  label="Prazo"
                  value={formatDateTime(doc.deadline)}
                />
              )}
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Status
                </p>
                <StatusBadge status={doc.status} />
              </div>
            </div>
            {doc.message && (
              <div className="mx-6 mb-6 rounded-xl border-l-4 border-primary bg-secondary/50 p-4 text-sm">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Mensagem do remetente
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">{doc.message}</p>
              </div>
            )}
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {doc.pdf_url ? (
              <iframe src={doc.pdf_url} title={doc.name} className="h-[80vh] w-full" />
            ) : (
              <div className="grid h-[80vh] place-items-center text-muted-foreground">PDF indisponível</div>
            )}
          </div>
        </div>

        {/* Signature panel */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          {alreadyFinal ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
              {finalStatus === "assinado" ? (
                <>
                  <div className="mx-auto grid size-14 place-items-center rounded-full bg-success/15 text-success">
                    <CheckCircle2 className="size-7" />
                  </div>
                  <h2 className="mt-4 font-display text-xl font-bold">Documento assinado</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Sua assinatura foi registrada com sucesso.
                  </p>
                </>
              ) : finalStatus === "recusado" ? (
                <>
                  <div className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/15 text-destructive">
                    <XCircle className="size-7" />
                  </div>
                  <h2 className="mt-4 font-display text-xl font-bold">Documento recusado</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    O remetente foi notificado da sua recusa.
                  </p>
                </>
              ) : (
                <>
                  <div className="mx-auto grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Clock className="size-7" />
                  </div>
                  <h2 className="mt-4 font-display text-xl font-bold">Documento expirado</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">O prazo para assinatura já passou.</p>
                </>
              )}
              <div className="mt-5 flex justify-center">
                <StatusBadge status={finalStatus} />
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="border-b border-border bg-secondary/50 px-6 py-4">
                  <h3 className="font-display text-lg font-bold">Finalizar assinatura</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Siga os passos abaixo para confirmar sua identidade e assinar.
                  </p>
                </div>
                <div className="p-6">
                  {step === "code" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex justify-center">
                        <div className="rounded-full bg-primary/10 p-3 text-primary">
                          <Lock className="size-6" />
                        </div>
                      </div>
                      <div className="text-center">
                        <h4 className="font-semibold">Código de Acesso</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Informe o código único recebido via WhatsApp.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="access-code">Código Único (4 dígitos)</Label>
                        <Input
                          id="access-code"
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          value={accessCode}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            setAccessCode(val);
                          }}
                          placeholder="0001"
                          className="text-center font-mono text-lg tracking-widest"
                        />
                      </div>
                      <Button 
                        className="w-full" 
                        disabled={accessCode.length !== 4 || verifyingFace}
                        onClick={async () => {
                          setVerifyingFace(true);
                          try {
                            const res = await fetch(`/api/public/sign/${token}/validate-code`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ access_code: accessCode })
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || "Código inválido");
                            
                            // Use the facial_status returned by backend for THIS employee
                            toast.success(`Bem-vindo, ${data.employee.name}`);
                            setEmployee(data.employee);
                            setStep(data.employee.facial_status === "registered" ? "face" : "consent");

                          } catch (err: any) {
                            toast.error(err.message);
                          } finally {
                            setVerifyingFace(false);
                          }
                        }}
                      >
                        {verifyingFace ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Validando...
                          </>
                        ) : (
                          "Continuar para Validação Facial"
                        )}
                      </Button>
                    </div>
                  )}

                  {step === "consent" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex justify-center">
                        <div className="rounded-full bg-primary/10 p-3 text-primary">
                          <Info className="size-6" />
                        </div>
                      </div>
                      <div className="text-center">
                        <h4 className="font-semibold text-lg">Termo de Consentimento</h4>
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                          Para garantir a segurança desta assinatura, utilizaremos validação facial.
                        </p>
                      </div>
                      
                      <div className="rounded-xl bg-secondary/30 p-4 space-y-3 text-[11px] leading-relaxed text-muted-foreground border border-border/50">
                        <div className="flex gap-2">
                          <Check className="size-3 text-primary shrink-0 mt-0.5" />
                          <p>A câmera será utilizada apenas durante este processo para capturar seu rosto.</p>
                        </div>
                        <div className="flex gap-2">
                          <Check className="size-3 text-primary shrink-0 mt-0.5" />
                          <p>Uma representação matemática do seu rosto (não a foto real) será armazenada de forma segura.</p>
                        </div>
                        <div className="flex gap-2">
                          <Check className="size-3 text-primary shrink-0 mt-0.5" />
                          <p>Estes dados serão usados exclusivamente para autenticar sua identidade nesta e em futuras assinaturas.</p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-2 p-1">
                        <Checkbox 
                          id="consent" 
                          checked={consentGiven}
                          onCheckedChange={(checked) => setConsentGiven(!!checked)}
                          className="mt-1"
                        />
                        <label
                          htmlFor="consent"
                          className="text-xs leading-tight font-medium cursor-pointer"
                        >
                          Eu li e autorizo o uso da minha biometria facial para fins de assinatura digital.
                        </label>
                      </div>

                      <Button 
                        className="w-full" 
                        disabled={!consentGiven}
                        onClick={() => setStep("precheck")}
                      >
                        Próximo Passo
                      </Button>
                    </div>
                  )}

                  {step === "precheck" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex justify-center">
                        <div className="rounded-full bg-primary/10 p-3 text-primary">
                          <ShieldCheck className="size-6" />
                        </div>
                      </div>
                      <div className="text-center">
                        <h4 className="font-semibold text-lg">Verificação do Sistema</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Vamos garantir que tudo está pronto para a validação.
                        </p>
                      </div>

                      <div className="space-y-3 py-2">
                        <div className="flex items-center justify-between rounded-lg border border-border p-3">
                          <div className="flex items-center gap-3">
                            {precheckStatus.permission === 'ok' ? <CheckCircle2 className="size-5 text-success" /> : 
                             precheckStatus.permission === 'fail' ? <XCircle className="size-5 text-destructive" /> : 
                             <div className="size-5 rounded-full border-2 border-primary/20" />}
                            <span className="text-sm font-medium">Permissão da Câmera</span>
                          </div>
                          {precheckStatus.permission === 'fail' && <AlertTriangle className="size-4 text-warning" />}
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-border p-3">
                          <div className="flex items-center gap-3">
                            {precheckStatus.camera === 'ok' ? <CheckCircle2 className="size-5 text-success" /> : 
                             precheckStatus.camera === 'fail' ? <XCircle className="size-5 text-destructive" /> : 
                             <div className="size-5 rounded-full border-2 border-primary/20" />}
                            <span className="text-sm font-medium">Hardware de Vídeo</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-border p-3">
                          <div className="flex items-center gap-3">
                            {precheckStatus.models === 'ok' ? <CheckCircle2 className="size-5 text-success" /> : 
                             precheckStatus.models === 'fail' ? <XCircle className="size-5 text-destructive" /> : 
                             <div className="size-5 rounded-full border-2 border-primary/20" />}
                            <span className="text-sm font-medium">Recursos de Inteligência</span>
                          </div>
                        </div>
                      </div>

                      {precheckStatus.permission === 'fail' && (
                        <div className="rounded-lg bg-destructive/10 p-3 text-[11px] text-destructive flex gap-2">
                          <Info className="size-4 shrink-0" />
                          <p>Acesso negado. Por favor, autorize o uso da câmera no cadeado ao lado da URL do navegador ou nas configurações do seu celular.</p>
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        {precheckStatus.permission === 'ok' && precheckStatus.camera === 'ok' && precheckStatus.models === 'ok' ? (
                          <Button className="w-full" onClick={() => setStep("face")}>
                            Iniciar Validação Facial
                          </Button>
                        ) : (
                          <Button 
                            className="w-full" 
                            variant={precheckStatus.permission === 'fail' ? 'destructive' : 'default'}
                            onClick={runPrecheck}
                            disabled={checkingHardware}
                          >
                            {checkingHardware ? (
                              <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Verificando...
                              </>
                            ) : "Testar Requisitos"}
                          </Button>
                        )}
                        <Button variant="ghost" className="w-full text-xs" onClick={() => setStep("consent")}>
                          Voltar ao consentimento
                        </Button>
                      </div>
                    </div>
                  )}

                  {step === "face" && (

                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex justify-center">
                        <div className="rounded-full bg-primary/10 p-3 text-primary">
                          <Camera className="size-6" />
                        </div>
                      </div>
                      <div className="text-center">
                        <h4 className="font-semibold">Validação Facial</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Posicione seu rosto no centro da câmera.
                        </p>
                      </div>
                      
                      <div className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-full border-4 border-muted bg-black shadow-inner">
                        {cameraError ? (
                          <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-white bg-slate-900">
                            {cameraError.type === 'incompatible' ? (
                              <MonitorOff className="mb-2 size-8 text-warning" />
                            ) : (
                              <Lock className="mb-2 size-8 text-destructive" />
                            )}
                            <p className="text-xs font-medium leading-relaxed">
                              {cameraError.message}
                            </p>
                          </div>
                        ) : !capturedImage ? (
                          <>
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              muted
                              className="h-full w-full object-cover scale-x-[-1]"
                              onCanPlay={() => {
                                videoRef.current?.play().catch(console.error);
                              }}
                            />
                            <div className="pointer-events-none absolute inset-0 border-[16px] border-black/20 rounded-full" />
                            
                            {/* Real-time Framing Guide */}
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                              {/* Central Oval Guide */}
                              <div className={`
                                w-[70%] h-[80%] rounded-[50%] border-2 border-dashed transition-colors duration-300
                                ${faceMetrics.position === 'center' ? 'border-success/60 bg-success/5' : 'border-white/30'}
                              `} />
                              
                              {/* Feedback indicators */}
                              <div className="absolute top-8 flex gap-2">
                                <GuideBadge active={faceMetrics.position === 'center'} label="Posição" />
                                <GuideBadge active={faceMetrics.distance === 'ok'} label="Distância" />
                                <GuideBadge active={faceMetrics.lighting === 'ok'} label="Luz" />
                              </div>
                            </div>

                            {faceFeedback && (
                              <div className="absolute inset-x-0 bottom-4 mx-auto w-fit max-w-[80%] rounded-full bg-black/60 px-3 py-1 text-center text-[10px] font-medium text-white backdrop-blur-sm animate-in fade-in zoom-in duration-200">
                                {faceFeedback}
                              </div>
                            )}
                          </>
                        ) : (
                          <img src={capturedImage} className="h-full w-full object-cover scale-x-[-1]" alt="Captura" />
                        )}
                      </div>

                      {verifyingFace && (
                        <div className="flex items-center justify-center gap-2 text-sm text-primary animate-pulse">
                          <Loader2 className="size-4 animate-spin" />
                          <span>Processando biometria localmente...</span>
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        {!capturedImage ? (
                          <Button 
                            id="capture-photo-btn"
                            className="w-full" 
                            disabled={verifyingFace || !!cameraError}
                            onClick={async () => {
                              if (!videoRef.current || videoRef.current.videoWidth === 0) {
                                toast.error("Câmera ainda carregando...");
                                return;
                              }
                              
                              setVerifyingFace(true);
                              try {
                                // Double check if models are loaded just in case
                                await loadModels();

                                if (!videoRef.current || videoRef.current.readyState < 2) {
                                  throw new Error("Câmera não está pronta para captura. Tente novamente em instantes.");
                                }

                                const faceResult = await getFaceEmbedding(videoRef.current);
                                if (!faceResult) {
                                  toast.error("Nenhum rosto detectado. Posicione-se bem em frente à câmera, verifique a iluminação e remova acessórios como óculos escuros.");
                                  setVerifyingFace(false);
                                  return;
                                }

                                if (faceResult.faceCount > 1) {
                                  toast.error("Múltiplos rostos detectados. Certifique-se de estar sozinho na imagem.");
                                  setVerifyingFace(false);
                                  return;
                                }

                                const embedding = faceResult.embedding;

                                const canvas = document.createElement("canvas");
                                canvas.width = 160; // Standardize capture size
                                canvas.height = 160;
                                const ctx = canvas.getContext("2d");
                                if (ctx) {
                                  ctx.drawImage(videoRef.current, 0, 0, 160, 160);
                                  setCapturedImage(canvas.toDataURL("image/jpeg", 0.8));
                                }
                                
                                const currentFacialStatus = employee?.facial_status || doc.facial_status;
                                const endpoint = currentFacialStatus === "registered" ? "verify" : "register";
                                
                                const res = await fetch(`/api/public/face/${endpoint}`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ 
                                    embedding, 
                                    access_token: token, 
                                    access_code: accessCode 
                                  }),
                                });
                                const result = await res.json();
                                if (!res.ok) throw new Error(result.error || "Falha na validação facial");

                                setFacialAuthToken(result.facialAuthToken);
                                const displayStatus = employee?.facial_status || doc.facial_status;
                                toast.success(displayStatus === "registered" ? "Identidade confirmada!" : "Biometria cadastrada!");
                                setStep("sign");
                              } catch (err: any) {
                                toast.error(err.message);
                                setCapturedImage(null);
                              } finally {
                                setVerifyingFace(false);
                              }
                            }}

                          >
                            {verifyingFace ? "Validando..." : "Capturar foto"}
                          </Button>
                        ) : (
                          <Button variant="outline" className="w-full" onClick={() => { setCapturedImage(null); setFaceFeedback(null); }} disabled={verifyingFace}>
                            Tentar Novamente
                          </Button>
                        )}
                        
                        <canvas ref={canvasRef} className="hidden" />
                      </div>
                    </div>
                  )}

                  {step === "sign" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="signer-name">Seu nome completo</Label>
                        <Input
                          id="signer-name"
                          value={typedName}
                          onChange={(e) => setTypedName(e.target.value)}
                          placeholder="Nome e sobrenome"
                        />
                        <p className="text-[11px] text-muted-foreground">Informe seu nome completo (nome e sobrenome).</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Sua assinatura</Label>
                        <SignaturePad onChange={setSignature} />
                      </div>
                      <div className="flex flex-col gap-2 pt-1">
                        <Button
                          onClick={submit}
                          disabled={submitting || !signature || typedName.trim().split(/\s+/).filter((p) => p.length >= 2).length < 2}
                          className="h-11 w-full font-semibold"
                        >
                          {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                          Confirmar assinatura
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {!submitting && (
                    <Button variant="ghost" onClick={decline} disabled={submitting} className="w-full mt-4 text-xs text-muted-foreground">
                      Recusar documento
                    </Button>
                  )}
                </div>
              </div>


              {doc.deadline && (
                <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs">
                  <Clock className="size-3.5 shrink-0 text-warning" />
                  <span>
                    Prazo para assinatura:{" "}
                    <strong className="font-semibold text-foreground">{formatDateTime(doc.deadline)}</strong>
                  </span>
                </div>
              )}
            </>
          )}

          <p className="px-2 text-center text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mr-1 inline size-3 text-success" />
            Assinatura eletrônica registrada com data, hora, IP e navegador para fins de auditoria.
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <span className="text-accent">{icon}</span>
        {label}
      </p>
      <p className="truncate font-medium">{value}</p>
    </div>
  );
}

function GuideBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <div className={`
      px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-tighter transition-all duration-300
      ${active ? 'bg-success text-success-foreground shadow-sm' : 'bg-black/40 text-white/50 border border-white/10'}
    `}>
      {label}
    </div>
  );
}

