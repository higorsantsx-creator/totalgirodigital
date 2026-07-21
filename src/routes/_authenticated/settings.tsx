import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logDiagnostic } from "@/lib/debug-diagnostics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    logDiagnostic("settings.profile.query.start", { userId: user.id });
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          logDiagnostic("settings.profile.query.error", { userId: user.id }, error);
          toast.error("Não foi possível carregar o perfil.");
          return;
        }
        setFullName(data?.full_name ?? user.user_metadata?.full_name ?? "");
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
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    const { error: authError } = await supabase.auth.updateUser({
      data: { full_name: fullName, name: fullName },
    });
    setLoading(false);
    if (authError) return toast.error(authError.message);
    toast.success("Perfil atualizado");
  };

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
      </div>
    </>
  );
}
