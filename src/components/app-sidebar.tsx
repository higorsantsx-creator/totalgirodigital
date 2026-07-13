import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, FileText, Send, History, Settings, LogOut, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import logoAsset from "@/assets/total-giro-logo.png.asset.json";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/documents", label: "Documentos", icon: FileText },
  { to: "/documents/new", label: "Novo envio", icon: Send },
  { to: "/history", label: "Histórico", icon: History },
  { to: "/settings", label: "Configurações", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/auth", replace: true });
  };

  const initials = (user?.user_metadata?.full_name || user?.email || "U")
    .split(" ")
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="p-6">
        <Link to="/dashboard" className="mb-8 block">
          <img
            src={logoAsset.url}
            alt="Grupo Total Giro"
            className="mx-auto h-20 w-auto"
            style={{ imageRendering: "crisp-edges" }}
          />
          <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/60">
            Assinaturas Digitais
          </p>
        </Link>

        <nav className="space-y-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 rounded-md p-2">
          <div className="grid size-10 place-items-center rounded-full bg-sidebar-accent text-xs font-bold text-sidebar-accent-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.user_metadata?.full_name || user?.email}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">Administrador</p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-md p-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-primary"
            title="Sair"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
