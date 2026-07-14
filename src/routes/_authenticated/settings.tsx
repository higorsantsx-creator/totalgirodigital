import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logDiagnostic } from "@/lib/debug-diagnostics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, RotateCcw, MessageSquare } from "lucide-react";
import {
  DEFAULT_WHATSAPP_TEMPLATE,
  WHATSAPP_TEMPLATE_VARIABLES,
  whatsappMessage,
} from "@/lib/whatsapp";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [template, setTemplate] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    logDiagnostic("settings.profile.query.start", { userId: user.id });
    supabase
      .from("profiles")
      .select("full_name, whatsapp_template")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          logDiagnostic("settings.profile.query.error", { userId: user.id }, error);
          toast.error("Não foi possível carregar o perfil.");
          return;
        }
        logDiagnostic("settings.profile.query.success", { userId: user.id, hasProfile: Boolean(data) });
        setFullName(data?.full_name ?? user.user_metadata?.full_name ?? "");
        setTemplate(data?.whatsapp_template ?? "");
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("Sessão ainda não carregada.");
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
  };

  const saveTemplate = async () => {
    if (!user) return;
    setSavingTpl(true);
    const value = template.trim().length > 0 ? template : null;
    const { error } = await supabase
      .from("profiles")
      .update({ whatsapp_template: value })
      .eq("id", user.id);
    setSavingTpl(false);
    if (error) return toast.error(error.message);
    toast.success("Mensagem salva");
  };

  const resetTemplate = () => {
    setTemplate(DEFAULT_WHATSAPP_TEMPLATE);
    toast.info("Modelo padrão restaurado. Clique em salvar para aplicar.");
  };

  const insertVar = (key: string) => {
    setTemplate((prev) => (prev.length === 0 ? DEFAULT_WHATSAPP_TEMPLATE : prev) + `{{${key}}}`);
  };

  const preview = whatsappMessage({
    senderName: fullName || user?.email,
    empresa: fullName || user?.email,
    recipientName: "João da Silva",
    documentName: "Contracheque Maio/2026",
    link: `${typeof window !== "undefined" ? window.location.origin : ""}/sign/exemplo`,
    deadline: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    competencia: "Maio/2026",
    template: template || DEFAULT_WHATSAPP_TEMPLATE,
  });

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-background/80 px-8 backdrop-blur-sm">
        <h1 className="font-display text-lg font-semibold">Configurações</h1>
      </header>
      <div className="mx-auto max-w-3xl space-y-6 p-8">
        <form onSubmit={save} className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 font-semibold">Perfil</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={authLoading ? "Carregando..." : user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fn">Nome completo</Label>
              <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <Button disabled={loading || authLoading || !user}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />} Salvar alterações
            </Button>
          </div>
        </form>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <MessageSquare className="size-4" />
              </div>
              <div>
                <h2 className="font-semibold">Mensagem de envio (WhatsApp)</h2>
                <p className="text-sm text-muted-foreground">
                  Personalize o texto enviado ao funcionário com o link de assinatura.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetTemplate}
              className="shrink-0"
            >
              <RotateCcw className="mr-1.5 size-3.5" />
              Restaurar padrão
            </Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Variáveis disponíveis</Label>
              <div className="flex flex-wrap gap-1.5">
                {WHATSAPP_TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVar(v.key)}
                    className="rounded-md border border-border bg-secondary/50 px-2 py-1 text-[11px] font-mono text-foreground hover:bg-secondary"
                    title={v.label}
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Clique em uma variável para inserir no texto. Deixe em branco para usar o modelo padrão.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tpl">Modelo da mensagem</Label>
              <Textarea
                id="tpl"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder={DEFAULT_WHATSAPP_TEMPLATE}
                rows={14}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label>Pré-visualização</Label>
              <div className="whitespace-pre-wrap rounded-lg border border-border bg-secondary/30 p-4 text-xs leading-relaxed">
                {preview}
              </div>
            </div>

            <div>
              <Button type="button" onClick={saveTemplate} disabled={savingTpl || !user}>
                {savingTpl && <Loader2 className="mr-2 size-4 animate-spin" />}
                Salvar mensagem
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
