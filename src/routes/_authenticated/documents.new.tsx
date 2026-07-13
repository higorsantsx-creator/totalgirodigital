import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { UploadCloud, Loader2, FileText, X, Copy, Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { logDiagnostic } from "@/lib/debug-diagnostics";

export const Route = createFileRoute("/_authenticated/documents/new")({
  component: NewDocumentPage,
});

function NewDocumentPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [name, setName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  
  const [message, setMessage] = useState("");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const pickFile = (f: File) => {
    if (f.type !== "application/pdf") {
      toast.error("Envie apenas arquivos PDF.");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("PDF muito grande (máximo 20MB).");
      return;
    }
    setFile(f);
    if (!name) setName(f.name.replace(/\.pdf$/i, ""));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Selecione um PDF antes de enviar.");
    if (authLoading) return toast.error("A sessão ainda está carregando.");
    if (!user) return toast.error("Faça login novamente para enviar documentos.");
    setLoading(true);

    // upload PDF
    const path = `${user.id}/${crypto.randomUUID()}/${file.name}`;
    logDiagnostic("documents.new.upload.start", { path, size: file.size, type: file.type });
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (upErr) {
      setLoading(false);
      logDiagnostic("documents.new.upload.error", { path }, upErr);
      return toast.error(upErr.message);
    }

    // insert document
    logDiagnostic("documents.new.insert.start", { path });
    const { data: doc, error: insErr } = await supabase
      .from("documents")
      .insert({
        owner_id: user.id,
        name,
        recipient_name: recipientName,
        recipient_email: "",
        message: message || null,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        file_path: path,
        status: "pendente",
      })
      .select("id, access_token")
      .single();

    if (insErr || !doc) {
      setLoading(false);
      logDiagnostic("documents.new.insert.error", { path }, insErr ?? new Error("Insert returned no document"));
      return toast.error(insErr?.message ?? "Erro ao criar documento");
    }

    // history
    const { error: historyError } = await supabase.from("document_history").insert([
      { document_id: doc.id, action: "criado", actor: user.email },
      { document_id: doc.id, action: "link_gerado", actor: user.email },
    ]);
    if (historyError) {
      logDiagnostic("documents.new.history.error", { documentId: doc.id }, historyError);
    }

    setLoading(false);
    const link = `${window.location.origin}/sign/${doc.access_token}`;
    setCreatedLink(link);
    toast.success("Documento enviado. Compartilhe o link abaixo.");
  };

  const copyLink = async () => {
    if (!createdLink) return;
    try {
      await navigator.clipboard.writeText(createdLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      logDiagnostic("documents.new.copy-link.error", {}, error);
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-background/80 px-8 backdrop-blur-sm">
        <h1 className="font-display text-lg font-semibold">Novo documento</h1>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 p-8">
        {createdLink ? (
          <div className="space-y-4 rounded-xl border border-success/30 bg-success/5 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-full bg-success text-success-foreground">
                <Check className="size-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">Pronto para assinar!</h2>
                <p className="text-sm text-muted-foreground">
                  Compartilhe o link abaixo com {recipientName}.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Input readOnly value={createdLink} className="font-mono text-xs" />
              <Button onClick={copyLink} variant="outline">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => navigate({ to: "/documents" })}>
                Ver documentos
              </Button>
              <Button
                onClick={() => {
                  setCreatedLink(null);
                  setFile(null);
                  setName("");
                  setRecipientName("");
                  setRecipientEmail("");
                  setMessage("");
                  setDeadline("");
                }}
              >
                Enviar outro
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
            {/* File upload */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) pickFile(f);
              }}
              onClick={() => !file && inputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors ${
                dragOver ? "border-accent bg-accent/5" : "border-border bg-secondary/40"
              } ${!file ? "cursor-pointer hover:border-accent/60" : ""}`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickFile(f);
                }}
              />
              {file ? (
                <div className="flex w-full items-center gap-3 rounded-lg bg-card p-3 shadow-sm">
                  <FileText className="size-8 text-accent" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setFile(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <UploadCloud className="size-10 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">Arraste o PDF aqui</p>
                  <p className="text-xs text-muted-foreground">ou clique para selecionar</p>
                </>
              )}
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do documento</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Contrato de Serviços" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rname">Nome do destinatário</Label>
                  <Input id="rname" required value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="remail">E-mail do destinatário</Label>
                  <Input id="remail" type="email" required value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="msg">Mensagem personalizada (opcional)</Label>
                <Textarea id="msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Data limite (opcional)</Label>
                <Input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
            </div>

            <Button type="submit" disabled={loading || authLoading || !file} className="w-full">
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />} Enviar para assinatura
            </Button>
          </form>
        )}
      </div>
    </>
  );
}
