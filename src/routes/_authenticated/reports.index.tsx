import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  TimerOff,
  Percent,
  Timer,
  UserX,
  Download,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  byDayLastN,
  byMonthLastN,
  computeKpis,
  fetchDocuments,
  formatHours,
  PERIOD_LABELS,
  type PeriodKey,
  STATUS_COLORS,
} from "@/lib/reports";
import { KpiCard, ChartCard } from "@/components/reports/kpi-card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reports/")({
  component: ReportsDashboard,
});

function ReportsDashboard() {
  const [period, setPeriod] = useState<PeriodKey>("30d");

  const { data: docs, isLoading } = useQuery({
    queryKey: ["reports", "documents", period],
    queryFn: () => fetchDocuments(period),
  });

  const { data: downloadsCount } = useQuery({
    queryKey: ["reports", "downloads", period],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("document_history")
        .select("id", { count: "exact", head: true })
        .eq("action", "assinado"); // approximation until a "download" action exists
      if (error) return 0;
      return count ?? 0;
    },
  });

  const kpis = useMemo(() => computeKpis(docs ?? [], downloadsCount ?? 0), [docs, downloadsCount]);
  const daily = useMemo(() => byDayLastN(docs ?? [], period === "7d" ? 7 : 30), [docs, period]);
  const monthly = useMemo(() => byMonthLastN(docs ?? [], 12), [docs]);

  const pieData = [
    { name: "Assinados", value: kpis.signed, color: STATUS_COLORS.assinado },
    { name: "Pendentes", value: kpis.pending, color: STATUS_COLORS.pendente },
    { name: "Recusados", value: kpis.declined, color: STATUS_COLORS.recusado },
    { name: "Expirados", value: kpis.expired, color: STATUS_COLORS.expirado },
  ].filter((d) => d.value > 0);

  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* Period selector */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Período:</span>
        <div role="tablist" className="flex flex-wrap gap-1 rounded-lg bg-secondary p-1">
          {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={period === k}
              onClick={() => setPeriod(k)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-all",
                period === k
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {PERIOD_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs — 9 tiles */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-3">
        <KpiCard label="Enviados" value={kpis.total} icon={FileText} accent="text-slate-700" bar="bg-slate-400" loading={isLoading} />
        <KpiCard label="Assinados" value={kpis.signed} icon={CheckCircle2} accent="text-emerald-600" bar="bg-emerald-400" loading={isLoading} />
        <KpiCard label="Pendentes" value={kpis.pending} icon={Clock} accent="text-amber-600" bar="bg-amber-400" loading={isLoading} />
        <KpiCard label="Recusados" value={kpis.declined} icon={XCircle} accent="text-red-600" bar="bg-red-400" loading={isLoading} />
        <KpiCard label="Expirados" value={kpis.expired} icon={TimerOff} accent="text-slate-500" bar="bg-slate-300" loading={isLoading} />
        <KpiCard label="Taxa de assinatura" value={`${(kpis.signRate * 100).toFixed(1)}%`} icon={Percent} accent="text-indigo-600" bar="bg-indigo-400" loading={isLoading} />
        <KpiCard label="Tempo médio p/ assinar" value={formatHours(kpis.avgSignHours)} icon={Timer} accent="text-sky-600" bar="bg-sky-400" loading={isLoading} />
        <KpiCard label="Ainda não assinaram" value={kpis.pendingSigners} icon={UserX} accent="text-orange-600" bar="bg-orange-400" loading={isLoading} hint="Documentos aguardando ação" />
        <KpiCard label="Downloads" value={kpis.downloads} icon={Download} accent="text-fuchsia-600" bar="bg-fuchsia-400" loading={isLoading} />
      </div>

      {/* Charts grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Documentos por dia"
          subtitle={`Envios e assinaturas — ${PERIOD_LABELS[period]}`}
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="enviados" name="Enviados" fill={STATUS_COLORS.pendente} radius={[4, 4, 0, 0]} />
                <Bar dataKey="assinados" name="Assinados" fill={STATUS_COLORS.assinado} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Distribuição por status" subtitle="Todos os documentos do período">
          <div className="h-64 w-full">
            {pieData.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard
          className="lg:col-span-3"
          title="Evolução mensal"
          subtitle="Envios × assinaturas nos últimos 12 meses"
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="enviados" name="Enviados" stroke={STATUS_COLORS.pendente} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="assinados" name="Assinados" stroke={STATUS_COLORS.assinado} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
