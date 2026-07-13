import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge, type DocStatus } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { logDiagnostic } from "@/lib/debug-diagnostics";
import { toast } from "sonner";
import { ArrowLeft, Copy, Download, Clock, Eye, PenLine, XCircle, TimerOff, FilePlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents/$id")({
  component: DocumentDetailPage,
});

function DocumentDetailPage() {
  const { id } = Route.useParams();

  const { data: doc } = useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      logDiagnostic("document.detail.query.start", { id });
      const { data, error } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
      if (error) {
        logDiagnostic("document.detail.query.error", { id }, error);
        throw error;
      }
      if (!data) {
        const notFoundError = new Error("Documento não encontrado ou sem permissão de acesso.");
        logDiagnostic("document.detail.query.empty", { id }, notFoundError);
        throw notFoundError;
      }
      logDiagnostic("document.detail.query.success", { id, status: data.status });
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["document-history", id],
    queryFn: async () => {
      logDiagnostic("document.history.query.start", { id });
      const { data, error } = await supabase
        .from("document_history")
        .select("*")
        .eq("document_id", id)
        .order("created_at", { ascending: false });
      if (error) {
        logDiagnostic("document.history.query.error", { id }, error);
        throw error;
      }
      logDiagnostic("document.history.query.success", { id, count: data?.length ?? 0 });
      return data ?? [];
    },
  });

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!doc) return;
    let mounted = true;
    setPdfUrl(null);
    setSignatureUrl(null);
    const filePath = doc.signed_file_path ?? doc.file_path;
    logDiagnostic("document.signed-url.start", { id: doc.id, hasSignedFile: Boolean(doc.signed_file_path) });
    supabase.storage.from("documents").createSignedUrl(filePath, 3600).then(({ data, error }) => {
      if (!mounted) return;
      if (error || !data) {
        logDiagnostic("document.signed-url.error", { id: doc.id }, error ?? new Error("Missing document signed URL"));
        return;
      }
      setPdfUrl(data.signedUrl);
    });
    if (doc.signature_path) {
      supabase.storage.from("signatures").createSignedUrl(doc.signature_path, 3600).then(({ data, error }) => {
        if (!mounted) return;
        if (error || !data) {
          logDiagnostic("document.signature-url.error", { id: doc.id }, error ?? new Error("Missing signature signed URL"));
          return;
        }
        setSignatureUrl(data.signedUrl);
      });
    }
    return () => {
      mounted = false;
    };
  }, [doc]);

  if (!doc) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">Carregando...</div>
    );
  }

  const copyLink = async () => {
    const url = `${window.location.origin}/sign/${doc.access_token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch (error) {
      logDiagnostic("document.copy-link.error", { id: doc.id }, error);
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/80 px-8 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/documents">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-display font-semibold">{doc.name || "Documento sem nome"}</h1>
            <p className="text-xs text-muted-foreground">
              Para {doc.recipient_name || "—"} · {doc.recipient_email || "—"}
            </p>
          </div>
        </div>
        <StatusBadge status={doc.status as DocStatus} />
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 p-8 lg:grid-cols-3">
        {/* PDF viewer */}
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {pdfUrl ? (
              <iframe src={pdfUrl} title={doc.name} className="h-[720px] w-full" />
            ) : (
              <div className="grid h-[720px] place-items-center text-muted-foreground">
                Carregando PDF...
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-3 font-semibold">Ações</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={copyLink}>
                <Copy className="mr-2 size-4" /> Copiar link de assinatura
              </Button>
              {pdfUrl && (
                <Button asChild variant="outline" className="w-full justify-start">
                  <a href={pdfUrl} target="_blank" rel="noreferrer">
                    <Download className="mr-2 size-4" /> Baixar PDF
                  </a>
                </Button>
              )}
            </div>
          </div>

          {signatureUrl && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h3 className="mb-3 font-semibold">Assinatura coletada</h3>
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <img src={signatureUrl} alt="Assinatura" className="mx-auto max-h-32" />
              </div>
              <dl className="mt-4 space-y-1 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Data</dt>
                  <dd>{formatDateTime(doc.signed_at)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">IP</dt>
                  <dd className="font-mono">{doc.signer_ip ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Navegador</dt>
                  <dd className="truncate text-right" title={doc.signer_user_agent ?? ""}>
                    {doc.signer_user_agent?.split(" ")[0] ?? "—"}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-3 font-semibold">Detalhes</h3>
            <dl className="space-y-2 text-xs">
              <Row label="Enviado em" value={formatDateTime(doc.created_at)} />
              <Row label="Prazo" value={doc.deadline ? formatDateTime(doc.deadline) : "—"} />
              <Row label="Visualizado" value={formatDateTime(doc.viewed_at)} />
              <Row label="Assinado" value={formatDateTime(doc.signed_at)} />
              {doc.message && (
                <div className="pt-2">
                  <dt className="mb-1 text-muted-foreground">Mensagem</dt>
                  <dd className="rounded bg-secondary/40 p-2 text-foreground">{doc.message}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-3 font-semibold">Histórico</h3>
            <ol className="space-y-3">
              {(history ?? []).map((h) => (
                <li key={h.id} className="flex gap-3">
                  <HistoryIcon action={h.action} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize">{h.action}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</p>
                    {h.actor && <p className="text-[10px] text-muted-foreground">por {h.actor}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}

function HistoryIcon({ action }: { action: string }) {
  const map: Record<string, { icon: ComponentType<{ className?: string }>; color: string }> = {
    criado: { icon: FilePlus, color: "text-muted-foreground" },
    enviado: { icon: Clock, color: "text-info" },
    visualizado: { icon: Eye, color: "text-info" },
    assinado: { icon: PenLine, color: "text-success" },
    recusado: { icon: XCircle, color: "text-destructive" },
    expirado: { icon: TimerOff, color: "text-muted-foreground" },
    reenviado: { icon: Clock, color: "text-warning" },
    cancelado: { icon: XCircle, color: "text-muted-foreground" },
  };
  const { icon: Icon, color } = map[action] ?? map.criado;
  return (
    <div className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-secondary ${color}`}>
      <Icon className="size-3" />
    </div>
  );
}
