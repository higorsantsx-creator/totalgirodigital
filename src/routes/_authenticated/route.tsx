import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { logDiagnostic } from "@/lib/debug-diagnostics";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    logDiagnostic("auth.guard.start", { route: "_authenticated" });
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      logDiagnostic("auth.guard.redirect", { route: "_authenticated", hasError: Boolean(error) }, error ?? undefined);
      throw redirect({ to: "/auth" });
    }
    logDiagnostic("auth.guard.success", { route: "_authenticated", userId: data.user.id });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
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
