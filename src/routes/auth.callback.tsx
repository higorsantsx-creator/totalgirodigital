import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallbackPage,
});

function getSafeRedirect() {
  const fallback = "/dashboard";
  const stored = sessionStorage.getItem("auth:redirect") ?? fallback;
  if (!stored.startsWith("/") || stored.startsWith("//")) return fallback;
  return stored;
}

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const finish = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        const redirectTo = getSafeRedirect();
        sessionStorage.removeItem("auth:redirect");
        navigate({ to: redirectTo, replace: true });
        return;
      }
      navigate({ to: "/auth", replace: true });
    };

    const timeout = window.setTimeout(finish, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  );
}