import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logDiagnostic } from "@/lib/debug-diagnostics";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: Error | null;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    logDiagnostic("auth.provider.mount");

    const { data } = supabase.auth.onAuthStateChange((event, sess) => {
      logDiagnostic("auth.state-change", {
        event,
        hasSession: Boolean(sess),
        userId: sess?.user?.id ?? null,
      });
      if (!mounted) return;
      setSession(sess);
      setUser(sess?.user ?? null);
      setLoading(false);
      setError(null);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        logDiagnostic("auth.session-restored", {
          hasSession: Boolean(session),
          userId: session?.user?.id ?? null,
        });
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        setError(null);
      })
      .catch((unknownError) => {
        if (!mounted) return;
        const authError = unknownError instanceof Error ? unknownError : new Error(String(unknownError));
        logDiagnostic("auth.session-restore-failed", {}, authError);
        setError(authError);
        setLoading(false);
      });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
      logDiagnostic("auth.provider.unmount");
    };
  }, []);

  return createElement(AuthContext.Provider, { value: { session, user, loading, error } }, children);
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) {
    const error = new Error("useAuth must be used within AuthProvider");
    logDiagnostic("auth.context-missing", {}, error);
    throw error;
  }
  return auth;
}
