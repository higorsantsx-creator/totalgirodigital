import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UploadCloud, Loader2, FileText, X, Copy, Check, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { logDiagnostic } from "@/lib/debug-diagnostics";
import { buildWhatsappUrl, whatsappMessage } from "@/lib/whatsapp";

export const Route = createFileRoute("/_authenticated/documents/new")({
  component: NewDocumentPage,
});

function NewDocumentPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState<string>("new");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [message, setMessage] = useState("");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ link: string; phone: string; docName: string; deadline: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, phone")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const onClientChange = (v: string) => {
    setClientId(v);
    if (v === "new") {
      setRecipientName("");
      setRecipientPhone("");
      return;
    }
    const c = clients?.find((x) => x.id === v);
    if (c) {
      setRecipientName(c.name);
      setRecipientPhone(c.phone ?? "");
    }
  };

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
    if (!recipientPhone.trim()) return toast.error("Informe o WhatsApp do cliente.");
    if (authLoading) return toast.error("A sessão ainda está carregando.");
    if (!user) return toast.error("Faça login novamente para enviar documentos.");
    setLoading(true);

    // If new client, create it so it shows in list later
    let finalClientId: string | null = clientId !== "new" ? clientId : null;
    if (clientId === "new" && recipientName.trim()) {
      const { data: newClient } = await supabase
        .from("clients")
        .insert({
          owner_id: user.id,
          name: recipientName.trim(),
          phone: recipientPhone.trim(),
        })
        .select("id")
        .maybeSingle();
      if (newClient) {
        finalClientId = newClient.id;
        qc.invalidateQueries({ queryKey: ["clients"] });
      }
    }

    const path = `${user.id}/${crypto.randomUUID()}/${file.name}`;
    logDiagnostic("documents.new.upload.start", { path, size: file.size });
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (upErr) {
      setLoading(false);
      return toast.error(upErr.message);
    }

    const { data: doc, error: insErr } = await supabase
      .from("documents")
      .insert({
        owner_id: user.id,
        name,
        recipient_name: recipientName,
        recipient_email: null,
        recipient_phone: recipientPhone.trim(),
        client_id: finalClientId,
        message: message || null,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        file_path: path,
        status: "pendente",
      })
      .select("id, access_token, deadline")
      .single();

    if (insErr || !doc) {
      setLoading(false);
      return toast.error(insErr?.message ?? "Erro ao criar documento");
    }

    await supabase.from("document_history").insert([
      { document_id: doc.id, action: "criado", actor: user.email },
      { document_id: doc.id, action: "enviado", actor: user.email },
    ]);

    setLoading(false);
    const link = `${window.location.origin}/sign/${doc.access_token}`;
    setCreated({ link, phone: recipientPhone.trim(), docName: name, deadline: doc.deadline });
    toast.success("Documento pronto! Envie via WhatsApp abaixo.");
  };

  const copyLink = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const openWhatsapp = () => {
    if (!created) return;
    const msg = whatsappMessage({
      senderName: user?.user_metadata?.full_name || user?.email,
      recipientName,
      documentName: created.docName,
      link: created.link,
      deadline: created.deadline,
    });
    window.open(buildWhatsappUrl(created.phone, msg), "_blank");
  };

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-background/80 px-8 backdrop-blur-sm">
        <h1 className="font-display text-lg font-semibold">Novo documento</h1>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 p-8">
        {created ? (
          <div className="space-y-5 rounded-xl border border-success/30 bg-success/5 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-full bg-success text-success-foreground">
                <Check className="size-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">Documento pronto para envio!</h2>
                <p className="text-sm text-muted-foreground">
                  Envie o link para {recipientName} pelo WhatsApp.
                </p>
              </div>
            </div>

            <Button onClick={openWhatsapp} className="w-full bg-[#25D366] text-white hover:bg-[#20b858]">
              <MessageCircle className="mr-2 size-4" /> Abrir WhatsApp e enviar
            </Button>

            <div className="space-y-1.5">
              <Label className="text-xs">Ou copie o link</Label>
              <div className="flex gap-2">
                <Input readOnly value={created.link} className="font-mono text-xs" />
                <Button onClick={copyLink} variant="outline" size="icon">
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => navigate({ to: "/documents" })}>
                Ver documentos
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setCreated(null);
                  setFile(null);
                  setName("");
                  setClientId("new");
                  setRecipientName("");
                  setRecipientPhone("");
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Cliente</Label>
                  <Link to="/clients" className="text-xs text-accent hover:underline">
                    Gerenciar clientes
                  </Link>
                </div>
                <Select value={clientId} onValueChange={onClientChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">+ Novo destinatário</SelectItem>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.phone ? ` — ${c.phone}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rname">Nome do destinatário</Label>
                  <Input id="rname" required value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Nome completo" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rphone">WhatsApp</Label>
                  <Input
                    id="rphone"
                    required
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
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
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />} Gerar link e preparar WhatsApp
            </Button>
          </form>
        )}
      </div>
    </>
  );
}
