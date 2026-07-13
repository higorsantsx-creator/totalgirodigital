import { createFileRoute, isRedirect, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { logDiagnostic } from "@/lib/debug-diagnostics";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    logDiagnostic("auth.guard.start", { route: "_authenticated" });
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        logDiagnostic("auth.guard.redirect", { route: "_authenticated", hasError: Boolean(error) }, error ?? undefined);
        throw redirect({ to: "/auth" });
      }
      logDiagnostic("auth.guard.success", { route: "_authenticated", userId: data.user.id });
      return { user: data.user };
    } catch (error) {
      if (isRedirect(error)) throw error;
      logDiagnostic("auth.guard.failed", { route: "_authenticated" }, error);
      throw redirect({ to: "/auth" });
    }
  },
  component: AuthenticatedLayout,
  errorComponent: AuthenticatedError,
});

function AuthenticatedLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

function AuthenticatedError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  logDiagnostic("authenticated.error-boundary", { component: "AuthenticatedError" }, error);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="font-display text-xl font-semibold">Esta página não carregou</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Registramos os detalhes técnicos no console para diagnóstico.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button
              onClick={() => {
                router.invalidate();
                reset();
              }}
            >
              Tentar novamente
            </Button>
            <Button variant="outline" onClick={() => router.navigate({ to: "/dashboard" })}>
              Ir para Dashboard
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
