import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { BarChart3, FileText, Users, ShieldCheck, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsLayout,
});

const TABS: Array<{ to: string; label: string; icon: typeof BarChart3; exact?: boolean }> = [
  { to: "/reports", label: "Visão geral", icon: BarChart3, exact: true },
  { to: "/reports/documents", label: "Documentos", icon: FileText },
  { to: "/reports/signers", label: "Funcionários", icon: Users },
  { to: "/reports/competencias", label: "Competências", icon: CalendarRange },
  { to: "/reports/audit", label: "Auditoria", icon: ShieldCheck },
];

function ReportsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-8 backdrop-blur-sm">
        <div>
          <h1 className="font-display text-lg font-semibold">Relatórios</h1>
          <p className="text-xs text-muted-foreground">Indicadores, análises e exportações</p>
        </div>
      </header>

      <div className="border-b border-border bg-background/60 px-8">
        <nav className="flex flex-wrap gap-1 py-2">
          {TABS.map((t) => {
            const active = t.exact ? pathname === t.to : pathname === t.to || pathname.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <Outlet />
    </>
  );
}
