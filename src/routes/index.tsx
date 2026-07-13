import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHydrated } from "@/hooks/use-hydrated";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      navigate({ to: data.session ? "/dashboard" : "/auth", replace: true });
    }).catch(() => {
      if (cancelled) return;
      navigate({ to: "/auth", replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate, hydrated]);

  if (!hydrated) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  );
}

