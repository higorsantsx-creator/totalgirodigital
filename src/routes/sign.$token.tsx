import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/signature-pad";
import { toast } from "sonner";
import { CheckCircle2, XCircle, FileSignature, Loader2, ShieldCheck, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { StatusBadge, type DocStatus } from "@/components/status-badge";

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
      { title: "Assinar Documento — SignFlow" },
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
    if (!signature) return toast.error("Desenhe sua assinatura primeiro");
    setSubmitting(true);
    const res = await fetch(`/api/public/sign/${token}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sign", signature_data_url: signature }),
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
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
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
    <div className="min-h-screen bg-secondary/40">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground">
              <FileSignature className="size-4" />
            </div>
            <span className="font-display text-lg font-bold">SignFlow</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-success" />
            Conexão segura
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-3">
        {/* PDF viewer */}
        <div className="lg:col-span-2">
          <div className="mb-3 space-y-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Documento</p>
            <h1 className="font-display text-2xl font-bold">{doc.name}</h1>
            <p className="text-sm text-muted-foreground">
              Enviado por <span className="font-medium text-foreground">{doc.sender_name}</span>
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-inner">
            {doc.pdf_url ? (
              <iframe src={doc.pdf_url} title={doc.name} className="h-[80vh] w-full" />
            ) : (
              <div className="grid h-[80vh] place-items-center text-muted-foreground">PDF indisponível</div>
            )}
          </div>
        </div>

        {/* Signature panel */}
        <div className="space-y-4">
          {alreadyFinal ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
              {finalStatus === "assinado" ? (
                <>
                  <CheckCircle2 className="mx-auto size-10 text-success" />
                  <h2 className="mt-3 font-display text-lg font-bold">Documento assinado</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Sua assinatura foi registrada com sucesso.</p>
                </>
              ) : finalStatus === "recusado" ? (
                <>
                  <XCircle className="mx-auto size-10 text-destructive" />
                  <h2 className="mt-3 font-display text-lg font-bold">Documento recusado</h2>
                  <p className="mt-1 text-sm text-muted-foreground">O remetente foi notificado da sua recusa.</p>
                </>
              ) : (
                <>
                  <Clock className="mx-auto size-10 text-muted-foreground" />
                  <h2 className="mt-3 font-display text-lg font-bold">Documento expirado</h2>
                  <p className="mt-1 text-sm text-muted-foreground">O prazo para assinatura já passou.</p>
                </>
              )}
              <div className="mt-4 flex justify-center">
                <StatusBadge status={finalStatus} />
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h3 className="font-display font-bold text-lg">Finalizar Assinatura</h3>
                <p className="mt-1 text-sm text-muted-foreground">Desenhe sua assinatura abaixo para confirmar.</p>
                {doc.message && (
                  <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Mensagem do remetente
                    </p>
                    {doc.message}
                  </div>
                )}
                <div className="mt-4">
                  <SignaturePad onChange={setSignature} />
                </div>
                <div className="mt-4 flex gap-2">
                  <Button onClick={submit} disabled={submitting || !signature} className="flex-1">
                    {submitting && <Loader2 className="mr-2 size-4 animate-spin" />} Confirmar
                  </Button>
                  <Button variant="outline" onClick={decline} disabled={submitting}>
                    Recusar
                  </Button>
                </div>
              </div>

              {doc.deadline && (
                <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs">
                  <Clock className="size-3.5 text-warning" />
                  Prazo para assinatura: <strong>{formatDateTime(doc.deadline)}</strong>
                </div>
              )}
            </>
          )}

          <p className="text-center text-[10px] text-muted-foreground">
            Assinatura eletrônica registrada com data, hora, IP e navegador para fins de auditoria.
          </p>
        </div>
      </div>
    </div>
  );
}
