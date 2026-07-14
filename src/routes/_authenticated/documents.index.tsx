import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, type DocStatus } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";
import { logDiagnostic } from "@/lib/debug-diagnostics";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreHorizontal, Copy, Download, XOctagon, Trash2, Send, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { buildWhatsappUrl, whatsappMessage } from "@/lib/whatsapp";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/documents/")({
  component: DocumentsPage,
});

function DocumentsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocStatus | "all">("all");

  const { data: docs, isLoading } = useQuery({
    queryKey: ["documents", { q, statusFilter }],
    queryFn: async () => {
      logDiagnostic("documents.list.query.start", { q, statusFilter });
      let query = supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) {
        logDiagnostic("documents.list.query.error", { q, statusFilter }, error);
        throw error;
      }
      const filtered = (data ?? []).filter((d) => {
        if (!q) return true;
        const s = q.toLowerCase();
        return (
          (d.name ?? "").toLowerCase().includes(s) ||
          (d.recipient_name ?? "").toLowerCase().includes(s) ||
          (d.recipient_email ?? "").toLowerCase().includes(s)
        );
      });
      logDiagnostic("documents.list.query.success", { total: data?.length ?? 0, filtered: filtered.length });
      return filtered;
    },
  });

  const { data: profileTpl } = useQuery({
    queryKey: ["profile-whatsapp-template", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("whatsapp_template")
        .eq("id", user!.id)
        .maybeSingle();
      return data?.whatsapp_template ?? null;
    },
  });

  const documents = docs ?? [];

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/sign/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch (error) {
      logDiagnostic("documents.copy-link.error", {}, error);
      toast.error("Não foi possível copiar o link.");
    }
  };

  const sendWhatsapp = (d: { access_token: string; name: string; recipient_name: string; recipient_phone: string | null; deadline: string | null }) => {
    if (!d.recipient_phone) {
      toast.error("Este documento não tem WhatsApp cadastrado.");
      return;
    }
    const link = `${window.location.origin}/sign/${d.access_token}`;
    const msg = whatsappMessage({
      senderName: user?.user_metadata?.full_name || user?.email,
      recipientName: d.recipient_name,
      documentName: d.name,
      link,
      deadline: d.deadline,
    });
    window.open(buildWhatsappUrl(d.recipient_phone, msg), "_blank");
  };

  const cancelDoc = async (id: string) => {
    const { error } = await supabase
      .from("documents")
      .update({ status: "expirado", cancelled_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      logDiagnostic("documents.cancel.error", { id }, error);
      return toast.error(error.message);
    }
    await supabase.from("document_history").insert({ document_id: id, action: "cancelado" });
    toast.success("Documento cancelado");
    qc.invalidateQueries({ queryKey: ["documents"] });
    qc.invalidateQueries({ queryKey: ["documents-all"] });
  };

  const deleteDoc = async (id: string) => {
    if (!confirm("Excluir este documento permanentemente?")) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) {
      logDiagnostic("documents.delete.error", { id }, error);
      return toast.error(error.message);
    }
    toast.success("Documento excluído");
    qc.invalidateQueries({ queryKey: ["documents"] });
    qc.invalidateQueries({ queryKey: ["documents-all"] });
  };

  const downloadFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (error || !data) {
      logDiagnostic("documents.download-url.error", { path }, error ?? new Error("Missing signed URL"));
      return toast.error("Falha ao gerar link");
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/80 px-8 backdrop-blur-sm">
        <h1 className="font-display text-lg font-semibold">Documentos</h1>
        <Button asChild>
          <Link to="/documents/new">
            <Plus className="mr-1.5 size-4" /> Novo Documento
          </Link>
        </Button>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 p-8">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por documento, nome ou e-mail..."
                className="w-80 pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DocStatus | "all")}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="visualizado">Visualizado</SelectItem>
                <SelectItem value="assinado">Assinado</SelectItem>
                <SelectItem value="recusado">Recusado</SelectItem>
                <SelectItem value="expirado">Expirado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3">Documento</th>
                <th className="px-6 py-3">Destinatário</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Enviado</th>
                <th className="px-6 py-3">Assinado</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoading &&
                documents.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-secondary/40">
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">{d.name || "Documento sem nome"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-foreground">{d.recipient_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.recipient_phone || d.recipient_email || "—"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={d.status as DocStatus} />
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{formatDateTime(d.created_at)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{formatDateTime(d.signed_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {d.recipient_phone && d.status !== "assinado" && d.status !== "recusado" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => sendWhatsapp(d)}
                            className="text-[#25D366] hover:bg-[#25D366]/10 hover:text-[#20b858]"
                          >
                            <MessageCircle className="mr-1 size-4" /> WhatsApp
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to="/documents/$id" params={{ id: d.id }}>
                                Visualizar
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => sendWhatsapp(d)} disabled={!d.recipient_phone}>
                              <MessageCircle className="mr-2 size-3.5" /> Enviar via WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyLink(d.access_token)} disabled={!d.access_token}>
                              <Copy className="mr-2 size-3.5" /> Copiar link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyLink(d.access_token)} disabled={!d.access_token}>
                              <Send className="mr-2 size-3.5" /> Reenviar link
                            </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => downloadFile(d.signed_file_path ?? d.file_path)}>
                            <Download className="mr-2 size-3.5" /> Baixar PDF
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => cancelDoc(d.id)}>
                            <XOctagon className="mr-2 size-3.5" /> Cancelar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteDoc(d.id)}>
                            <Trash2 className="mr-2 size-3.5" /> Excluir
                          </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              {!isLoading && docs && documents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm text-muted-foreground">
                    Nenhum documento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
