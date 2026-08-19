import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { unlockGate } from "@/lib/gate.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import logoAsset from "@/assets/total-giro-logo.png.asset.json";
import { useHydrated } from "@/hooks/use-hydrated";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: search,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const hydrated = useHydrated();
  const unlock = useServerFn(unlockGate);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const afterAuth = () => navigate({ to: redirect ?? "/dashboard" });

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    
    // If we're on a public signing page or have a redirect to one, don't auto-redirect to dashboard
    if (redirect?.includes("/sign/")) return;

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) afterAuth();
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, redirect]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await unlock({ data: { password } });
      if (!result.ok) {
        toast.error("Senha incorreta");
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.verifyOtp({
        token_hash: result.tokenHash,
        type: "magiclink",
      });
      if (error) {
        toast.error("Não foi possível entrar. Tente novamente.");
        setLoading(false);
        return;
      }
      toast.success("Bem-vindo!");
      afterAuth();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao acessar o sistema");
      setLoading(false);
    }
  };

  if (!hydrated) return null;

  return (
    <div
      suppressHydrationWarning
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-secondary/40 via-background to-secondary/20 p-6"
    >
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-border">
            <img src={logoAsset.url} alt="Grupo Total Giro" className="h-14 w-auto" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Assinaturas Digitais
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Lock className="size-5" />
              </div>
              <h2 className="font-display text-xl font-bold">Área restrita</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Informe a senha de acesso para continuar.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha de acesso</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoFocus
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button disabled={loading || !password} className="w-full">
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />} Entrar
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Sistema interno · Grupo Total Giro
        </p>
      </div>
    </div>
  );
}
