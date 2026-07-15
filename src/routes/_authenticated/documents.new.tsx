import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { UploadCloud, Loader2, FileText, X, Copy, Check, MessageCircle, ChevronsUpDown, UserPlus, Search, HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [message, setMessage] = useState("");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ link: string; phone: string; docName: string; deadline: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [preparingWhatsapp, setPreparingWhatsapp] = useState(false);

  const { data: clients, isLoading: clientsLoading, error: clientsError } = useQuery({
    queryKey: ["clients", user?.id],
    enabled: !authLoading && Boolean(user),
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
    const phone = recipientPhone.trim();

    const msg = whatsappMessage({
      senderName: user?.user_metadata?.full_name || user?.email,
      empresa: user?.user_metadata?.full_name || user?.email,
      recipientName,
      documentName: name,
      link,
      deadline: doc.deadline,
      competencia: message || null,
    });

    setPreparingWhatsapp(true);
    setTimeout(() => {
      window.open(buildWhatsappUrl(phone, msg), "_blank");
      setPreparingWhatsapp(false);
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Link de assinatura enviado com sucesso!");
      navigate({ to: "/documents" });
    }, 800);
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
      empresa: user?.user_metadata?.full_name || user?.email,
      recipientName,
      documentName: created.docName,
      link: created.link,
      deadline: created.deadline,
      competencia: message || null,
    });
    window.open(buildWhatsappUrl(created.phone, msg), "_blank");
  };

  return (
    <>
      {preparingWhatsapp && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-10 py-8 shadow-xl">
            <div className="grid size-14 place-items-center rounded-full bg-success/15 text-success">
              <MessageCircle className="size-7" />
            </div>
            <div className="text-center">
              <p className="font-display text-lg font-semibold">Preparando WhatsApp...</p>
              <p className="mt-1 text-sm text-muted-foreground">Você será redirecionado em instantes.</p>
            </div>
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        </div>
      )}
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



                {(() => {
                  const selected = clients?.find((c) => c.id === clientId);
                  const filtered = (clients ?? []).filter((c) => {
                    const q = clientSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      c.name.toLowerCase().includes(q) ||
                      (c.phone ?? "").toLowerCase().includes(q)
                    );
                  });
                  return (
                    <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          disabled={authLoading || clientsLoading}
                          className={cn(
                            "flex h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-sm transition-colors hover:border-accent/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                          )}
                        >
                          {selected ? (
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] font-bold uppercase text-accent">
                                {selected.name.slice(0, 2)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{selected.name}</span>
                                {selected.phone && (
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {selected.phone}
                                  </span>
                                )}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Selecionar funcionário</span>
                          )}
                          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-[var(--radix-popover-trigger-width)] p-0"
                      >
                        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                          <Search className="size-4 text-muted-foreground" />
                          <input
                            autoFocus
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            placeholder="Buscar cliente..."
                            className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          />
                        </div>
                        <div className="max-h-64 overflow-y-auto p-1">
                          {filtered.length === 0 ? (
                            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                              {clientsLoading ? "Carregando..." : "Nenhum cliente encontrado"}
                            </p>
                          ) : (
                            filtered.map((c) => {
                              const active = c.id === clientId;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    onClientChange(c.id);
                                    setClientPickerOpen(false);
                                    setClientSearch("");
                                  }}
                                  className={cn(
                                    "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent/10",
                                    active && "bg-accent/10",
                                  )}
                                >
                                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-bold uppercase text-foreground/70">
                                    {c.name.slice(0, 2)}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium">{c.name}</span>
                                    {c.phone && (
                                      <span className="block truncate text-xs text-muted-foreground">
                                        {c.phone}
                                      </span>
                                    )}
                                  </span>
                                  {active && <Check className="size-4 text-accent" />}
                                </button>
                              );
                            })
                          )}
                        </div>
                        <div className="border-t border-border p-1">
                          <button
                            type="button"
                            onClick={() => {
                              onClientChange("new");
                              setClientPickerOpen(false);
                              setClientSearch("");
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-accent transition-colors hover:bg-accent/10"
                          >
                            <UserPlus className="size-4" />
                            Cadastrar novo destinatário
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })()}
                {clientsError && (
                  <p className="text-xs text-destructive">Não foi possível carregar os clientes. Tente novamente.</p>
                )}
              </div>

              {clientId !== "new" && recipientName ? (
                <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Destinatário</p>
                  <p className="mt-0.5 font-medium">{recipientName}</p>
                  <p className="text-xs text-muted-foreground">{recipientPhone || "sem WhatsApp cadastrado"}</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="rname">Nome do destinatário</Label>
                    <p className="text-xs text-muted-foreground">
                      Nome completo de quem vai receber e assinar o documento.
                    </p>
                    <Input id="rname" required value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Nome completo" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rphone">WhatsApp</Label>
                    <p className="text-xs text-muted-foreground">
                      Número com DDD que receberá o link de assinatura pelo WhatsApp.
                    </p>
                    <Input
                      id="rphone"
                      required
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="msg">Competência (ex: Outubro/2026)</Label>
                <p className="text-xs text-muted-foreground">
                  Período de referência do documento. Aparece na mensagem enviada ao cliente.
                </p>
                <Input id="msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Outubro/2026" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Data limite (opcional)</Label>
                <p className="text-xs text-muted-foreground">
                  Prazo final para o cliente assinar. Deixe em branco se não houver prazo.
                </p>
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
