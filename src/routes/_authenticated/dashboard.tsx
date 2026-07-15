import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge, type DocStatus } from "@/components/status-badge";
import { relativeDate } from "@/lib/format";
import { logDiagnostic } from "@/lib/debug-diagnostics";
import { Plus, FileText, Clock, CheckCircle2, XCircle, TimerOff, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: docs } = useQuery({
    queryKey: ["documents-all"],
    queryFn: async () => {
      logDiagnostic("dashboard.documents.query.start");
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, status, recipient_name, created_at, signed_at")
        .order("created_at", { ascending: false });
      if (error) {
        logDiagnostic("dashboard.documents.query.error", {}, error);
        throw error;
      }
      logDiagnostic("dashboard.documents.query.success", { count: data?.length ?? 0 });
      return data ?? [];
    },
  });

  const documents = docs ?? [];

  const total = documents.length;
  const pendentes = documents.filter((d) => d.status === "pendente" || d.status === "visualizado").length;
  const assinados = documents.filter((d) => d.status === "assinado").length;
  const recusados = documents.filter((d) => d.status === "recusado").length;
  const expirados = documents.filter((d) => d.status === "expirado").length;

  // last 7 days chart
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const day = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    const count = documents.filter((doc) => (doc.created_at ?? "").slice(0, 10) === day).length;
    return { day: label, count };
  });

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/80 px-8 backdrop-blur-sm">
        <h1 className="font-display text-lg font-semibold">Visão Geral</h1>
        <Button asChild>
          <Link to="/documents/new">
            <Plus className="mr-1.5 size-4" /> Novo Documento
          </Link>
        </Button>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 p-8">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <KpiCard label="Total" value={total} icon={FileText} accent="text-foreground" to="/documents" />
          <KpiCard label="Pendentes" value={pendentes} icon={Clock} accent="text-warning" pulse to="/documents" search={{ status: "pendente" }} />
          <KpiCard label="Assinados" value={assinados} icon={CheckCircle2} accent="text-success" to="/documents" search={{ status: "assinado" }} />
          <KpiCard label="Recusados" value={recusados} icon={XCircle} accent="text-destructive" to="/documents" search={{ status: "recusado" }} />
          <KpiCard label="Expirados" value={expirados} icon={TimerOff} accent="text-muted-foreground" to="/documents" search={{ status: "expirado" }} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Chart */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Envios recentes</h2>
                <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
              </div>
              <TrendingUp className="size-4 text-muted-foreground" />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick upload */}
          <Link
            to="/documents/new"
            className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-accent/20 bg-accent/5 p-6 transition-all hover:border-accent/40 hover:shadow-md"
          >
            <div>
              <h4 className="mb-1 text-sm font-bold text-accent">Novo envio</h4>
              <p className="text-xs text-accent/80">
                Arraste seu PDF ou clique para selecionar e enviar para assinatura.
              </p>
            </div>
            <div className="grid size-12 place-items-center rounded-full bg-card text-accent shadow-sm transition-transform group-hover:scale-110">
              <Plus className="size-5" />
            </div>
          </Link>
        </div>

        {/* Recent Documents */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border p-6">
            <h2 className="font-semibold">Documentos recentes</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/documents">Ver todos</Link>
            </Button>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3">Documento</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Enviado</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {documents.slice(0, 5).map((d) => (
                <tr key={d.id} className="transition-colors hover:bg-secondary/40">
                  <td className="px-6 py-4">
                    <p className="font-medium text-foreground">{d.name || "Documento sem nome"}</p>
                    <p className="text-xs text-muted-foreground">Para: {d.recipient_name || "—"}</p>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={d.status as DocStatus} />
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{relativeDate(d.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <Link to="/documents/$id" params={{ id: d.id }} className="font-medium text-accent hover:underline">
                      Visualizar
                    </Link>
                  </td>
                </tr>
              ))}
              {docs && documents.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-sm text-muted-foreground">
                    Nenhum documento ainda.{" "}
                    <Link to="/documents/new" className="font-medium text-accent hover:underline">
                      Enviar o primeiro
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  pulse,
  to,
  search,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  accent: string;
  pulse?: boolean;
  to?: string;
  search?: { status?: string };
}) {
  const content = (
    <div className="group relative h-full overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-accent/40 hover:shadow-md">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className={`size-4 ${accent}`} />
      </div>
      <div className="flex items-center gap-2">
        <p className={`font-display text-3xl font-bold ${accent}`}>{value}</p>
        {pulse && value > 0 && <span className="size-2 animate-pulse rounded-full bg-warning" />}
      </div>
      {to && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-accent/10 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground shadow-sm">
            Ver
          </span>
        </div>
      )}
    </div>
  );
  if (!to) return content;
  return (
    <Link to={to} search={search as never} className="block">
      {content}
    </Link>
  );
}
