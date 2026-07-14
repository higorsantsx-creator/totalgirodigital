import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/signature-pad";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, Clock, FileText, User, Send, CalendarClock } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { StatusBadge, type DocStatus } from "@/components/status-badge";
import logoAsset from "@/assets/total-giro-logo.png.asset.json";

type DocData = {
  id: string;
  name: string;
  status: DocStatus;
  recipient_name: string;
  message: string | null;
  deadline: string | null;
  sender_name: string;
  pdf_url: string | null;
};

export const Route = createFileRoute("/sign/$token")({
  ssr: false,
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signature, setSignature] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<"assinado" | "recusado" | null>(null);

  useEffect(() => {
    fetch(`/api/public/sign/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "Erro ao carregar");
        }
        return res.json();
      })
      .then(setDoc)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async () => {
    const parts = typedName.trim().split(/\s+/).filter((p) => p.length >= 2);
    if (parts.length < 2) return toast.error("Digite seu nome completo (nome e sobrenome)");
    if (!signature) return toast.error("Desenhe sua assinatura primeiro");
    setSubmitting(true);
    const res = await fetch(`/api/public/sign/${token}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sign", signature_data_url: signature, signer_name: typedName.trim() }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return toast.error(j.error ?? "Erro ao assinar");
    }
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/40">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
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
                    Preencha seu nome e desenhe sua assinatura para confirmar.
                  </p>
                </div>
                <div className="space-y-4 p-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="signer-name">Seu nome completo</Label>
                    <Input
                      id="signer-name"
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      placeholder="Digite seu nome"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sua assinatura</Label>
                    <SignaturePad onChange={setSignature} />
                  </div>
                  <div className="flex flex-col gap-2 pt-1">
                    <Button
                      onClick={submit}
                      disabled={submitting || !signature || !typedName.trim()}
                      className="h-11 w-full font-semibold"
                    >
                      {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Confirmar assinatura
                    </Button>
                    <Button variant="ghost" onClick={decline} disabled={submitting} className="w-full">
                      Recusar documento
                    </Button>
                  </div>
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

