import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  UploadCloud,
  Loader2,
  FileText,
  X,
  Copy,
  Check,
  MessageCircle,
  ChevronsUpDown,
  UserPlus,
  Search,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { logDiagnostic } from "@/lib/debug-diagnostics";
import { buildWhatsappUrl, whatsappMessage } from "@/lib/whatsapp";

export const Route = createFileRoute("/_authenticated/documents/new")({
  component: NewDocumentPage,
});

const NAVY = "#1e3a5f";
const NAVY_HOVER = "#3b6fa0";
const NAVY_DEEP = "#0f1b3d";

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-slate-50/40 px-4 py-3 text-sm text-slate-800 shadow-none transition-all placeholder:text-slate-400 focus-visible:border-[#1e3a5f] focus-visible:ring-4 focus-visible:ring-[#1e3a5f]/10 focus-visible:outline-none";
const LABEL_CLASS =
  "block text-[11px] font-semibold uppercase tracking-wider text-slate-500";

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
    if (!recipientPhone.trim()) return toast.error("Informe o WhatsApp do funcionário.");
    if (authLoading) return toast.error("A sessão ainda está carregando.");
    if (!user) return toast.error("Faça login novamente para enviar documentos.");
    setLoading(true);

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
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-white px-10 py-8 shadow-xl">
            <div
              className="grid size-14 place-items-center rounded-full text-white"
              style={{ background: NAVY }}
            >
              <MessageCircle className="size-7" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-900">Preparando WhatsApp...</p>
              <p className="mt-1 text-sm text-slate-500">Você será redirecionado em instantes.</p>
            </div>
            <Loader2 className="size-5 animate-spin text-slate-400" />
          </div>
        </div>
      )}

      <div className="min-h-screen w-full bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-2xl">
          {created ? (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-200/50">
              <div className="border-b border-slate-100 px-8 pb-6 pt-8">
                <div className="flex items-center gap-3">
                  <div
                    className="grid size-11 place-items-center rounded-full text-white"
                    style={{ background: NAVY }}
                  >
                    <Check className="size-5" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                      Documento pronto para envio
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                      Envie o link para {recipientName} pelo WhatsApp.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6 p-8">
                <Button
                  onClick={openWhatsapp}
                  className="h-12 w-full rounded-xl bg-[#25D366] text-base font-semibold text-white shadow-lg shadow-emerald-200/50 transition-all hover:bg-[#20b858]"
                >
                  <MessageCircle className="mr-2 size-4" /> Abrir WhatsApp e enviar
                </Button>

                <div className="space-y-2">
                  <label className={LABEL_CLASS}>Ou copie o link</label>
                  <div className="flex gap-2">
                    <Input readOnly value={created.link} className={cn(INPUT_CLASS, "font-mono text-xs")} />
                    <Button onClick={copyLink} variant="outline" size="icon" className="rounded-lg border-slate-200">
                      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate({ to: "/documents" })}
                    className="rounded-lg border-slate-200"
                  >
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
            </div>
          ) : (
            <form
              onSubmit={submit}
              className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-200/50"
            >
              {/* Header */}
              <div className="border-b border-slate-100 px-8 pb-6 pt-8">
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: NAVY_HOVER }}>
                  Documentos
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  Novo envio de documento
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Preencha os dados abaixo para gerar o link de assinatura.
                </p>
              </div>

              <div className="space-y-8 p-8">
                {/* Dropzone */}
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
                  className={cn(
                    "group relative flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all",
                    dragOver
                      ? "border-[#1e3a5f] bg-[#1e3a5f]/5"
                      : "border-slate-200 bg-slate-50/40 hover:border-[#1e3a5f]/40 hover:bg-slate-50",
                    file && "cursor-default",
                  )}
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
                    <div className="flex w-full items-center gap-3 rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
                      <div
                        className="grid size-10 shrink-0 place-items-center rounded-lg text-white"
                        style={{ background: NAVY }}
                      >
                        <FileText className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
                        <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB · PDF</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                        }}
                        className="text-slate-400 hover:text-slate-700"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 grid size-12 place-items-center rounded-full border border-slate-100 bg-white shadow-sm">
                        <UploadCloud className="size-6" style={{ color: NAVY }} />
                      </div>
                      <p className="text-sm font-medium text-slate-700">
                        Arraste o PDF aqui ou{" "}
                        <span className="font-semibold" style={{ color: NAVY }}>
                          clique para selecionar
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-400">PDF · até 20MB</p>
                    </>
                  )}
                </div>

                {/* Form fields */}
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="name" className={LABEL_CLASS}>
                      Nome do documento
                    </Label>
                    <Input
                      id="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Contrato de Serviços"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className={LABEL_CLASS}>Funcionário</Label>
                      <Link
                        to="/clients"
                        className="text-xs font-medium hover:underline"
                        style={{ color: NAVY_HOVER }}
                      >
                        Gerenciar funcionários
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
                                "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/40 px-4 py-3 text-left text-sm transition-all hover:border-[#1e3a5f]/40 focus-visible:border-[#1e3a5f] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1e3a5f]/10 disabled:cursor-not-allowed disabled:opacity-50",
                              )}
                            >
                              {selected ? (
                                <span className="flex min-w-0 items-center gap-2.5">
                                  <span
                                    className="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold uppercase text-white"
                                    style={{ background: NAVY }}
                                  >
                                    {selected.name.slice(0, 2)}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium text-slate-800">
                                      {selected.name}
                                    </span>
                                    {selected.phone && (
                                      <span className="block truncate text-xs text-slate-500">
                                        {selected.phone}
                                      </span>
                                    )}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-400">Selecionar funcionário</span>
                              )}
                              <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="w-[var(--radix-popover-trigger-width)] rounded-lg border-slate-200 p-0 shadow-xl"
                          >
                            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                              <Search className="size-4 text-slate-400" />
                              <input
                                autoFocus
                                value={clientSearch}
                                onChange={(e) => setClientSearch(e.target.value)}
                                placeholder="Buscar funcionário..."
                                className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                              />
                            </div>
                            <div className="max-h-64 overflow-y-auto p-1">
                              {filtered.length === 0 ? (
                                <p className="px-3 py-6 text-center text-xs text-slate-400">
                                  {clientsLoading ? "Carregando..." : "Nenhum funcionário encontrado"}
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
                                        "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-slate-100",
                                        active && "bg-slate-100",
                                      )}
                                    >
                                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-bold uppercase text-slate-600">
                                        {c.name.slice(0, 2)}
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate font-medium text-slate-800">
                                          {c.name}
                                        </span>
                                        {c.phone && (
                                          <span className="block truncate text-xs text-slate-500">
                                            {c.phone}
                                          </span>
                                        )}
                                      </span>
                                      {active && <Check className="size-4" style={{ color: NAVY }} />}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                            <div className="border-t border-slate-100 p-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onClientChange("new");
                                  setClientPickerOpen(false);
                                  setClientSearch("");
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium transition-colors hover:bg-slate-100"
                                style={{ color: NAVY }}
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
                      <p className="text-xs text-red-600">
                        Não foi possível carregar os funcionários. Tente novamente.
                      </p>
                    )}
                  </div>

                  {clientId !== "new" && recipientName ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Destinatário
                      </p>
                      <p className="mt-1 font-medium text-slate-800">{recipientName}</p>
                      <p className="text-xs text-slate-500">
                        {recipientPhone || "sem WhatsApp cadastrado"}
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="rname" className={LABEL_CLASS}>
                          Nome do destinatário
                        </Label>
                        <Input
                          id="rname"
                          required
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="Nome completo"
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rphone" className={LABEL_CLASS}>
                          WhatsApp
                        </Label>
                        <Input
                          id="rphone"
                          required
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(e.target.value)}
                          placeholder="(11) 99999-9999"
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>
                  )}

                  <TooltipProvider delayDuration={150}>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Label htmlFor="msg" className={LABEL_CLASS}>
                            Competência
                          </Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label="Ajuda sobre competência"
                                className="text-slate-400 transition-colors hover:text-slate-700"
                              >
                                <HelpCircle className="size-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              Período de referência do documento. Aparece na mensagem enviada ao funcionário.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          id="msg"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Outubro/2026"
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Label htmlFor="deadline" className={LABEL_CLASS}>
                            Data limite{" "}
                            <span className="font-normal normal-case text-slate-400">(opcional)</span>
                          </Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label="Ajuda sobre data limite"
                                className="text-slate-400 transition-colors hover:text-slate-700"
                              >
                                <HelpCircle className="size-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              Prazo final para o funcionário assinar. Deixe em branco se não houver prazo.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          id="deadline"
                          type="date"
                          value={deadline}
                          onChange={(e) => setDeadline(e.target.value)}
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>
                  </TooltipProvider>
                </div>
              </div>

              {/* Action bar */}
              <div className="border-t border-slate-100 bg-slate-50/60 px-8 py-6">
                <Button
                  type="submit"
                  disabled={loading || authLoading || !file}
                  className="group h-12 w-full rounded-xl text-base font-semibold text-white shadow-lg shadow-slate-300/60 transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
                  style={{ background: NAVY }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) e.currentTarget.style.background = NAVY_HOVER;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = NAVY;
                  }}
                >
                  {loading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  <span>Gerar link e preparar WhatsApp</span>
                  <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
                <p className="mt-3 text-center text-xs text-slate-400">
                  O link será gerado e o WhatsApp abrirá em uma nova aba.
                </p>
                <p className="sr-only" aria-hidden style={{ color: NAVY_DEEP }} />
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
