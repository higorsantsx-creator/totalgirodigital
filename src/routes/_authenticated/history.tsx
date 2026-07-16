import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, relativeDate } from "@/lib/format";
import { logDiagnostic } from "@/lib/debug-diagnostics";
import { cn } from "@/lib/utils";
import {
  Clock,
  Eye,
  PenLine,
  XCircle,
  TimerOff,
  FilePlus,
  Send,
  Search,
  History as HistoryIcon,
  FileText,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

type HistoryRow = {
  id: string;
  action: string;
  actor: string | null;
  created_at: string;
  documents?: { id?: string; name?: string } | { id?: string; name?: string }[] | null;
};

const ACTION_META: Record<
  string,
  { icon: ComponentType<{ className?: string }>; label: string; ring: string; iconBg: string; iconColor: string; chip: string }
> = {
  criado:      { icon: FilePlus, label: "Criado",      ring: "ring-slate-200",  iconBg: "bg-slate-100",   iconColor: "text-slate-700",   chip: "bg-slate-100 text-slate-700" },
  enviado:     { icon: Send,     label: "Enviado",     ring: "ring-sky-100",    iconBg: "bg-sky-50",      iconColor: "text-sky-600",     chip: "bg-sky-50 text-sky-700" },
  reenviado:   { icon: Clock,    label: "Reenviado",   ring: "ring-amber-100",  iconBg: "bg-amber-50",    iconColor: "text-amber-600",   chip: "bg-amber-50 text-amber-700" },
  visualizado: { icon: Eye,      label: "Visualizado", ring: "ring-indigo-100", iconBg: "bg-indigo-50",   iconColor: "text-indigo-600",  chip: "bg-indigo-50 text-indigo-700" },
  assinado:    { icon: PenLine,  label: "Assinado",    ring: "ring-emerald-100",iconBg: "bg-emerald-50",  iconColor: "text-emerald-600", chip: "bg-emerald-50 text-emerald-700" },
  recusado:    { icon: XCircle,  label: "Recusado",    ring: "ring-red-100",    iconBg: "bg-red-50",      iconColor: "text-red-600",     chip: "bg-red-50 text-red-700" },
  expirado:    { icon: TimerOff, label: "Expirado",    ring: "ring-slate-200",  iconBg: "bg-slate-100",   iconColor: "text-slate-500",   chip: "bg-slate-100 text-slate-600" },
  cancelado:   { icon: XCircle,  label: "Cancelado",   ring: "ring-slate-200",  iconBg: "bg-slate-100",   iconColor: "text-slate-500",   chip: "bg-slate-100 text-slate-600" },
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "criado", label: "Criados" },
  { key: "enviado", label: "Enviados" },
  { key: "visualizado", label: "Visualizados" },
  { key: "assinado", label: "Assinados" },
  { key: "recusado", label: "Recusados" },
];

function HistoryPage() {
  const [filter, setFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["global-history"],
    queryFn: async () => {
      logDiagnostic("history.query.start");
      const { data, error } = await supabase
        .from("document_history")
        .select("*, documents!inner(id, name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        logDiagnostic("history.query.error", {}, error);
        throw error;
      }
      logDiagnostic("history.query.success", { count: data?.length ?? 0 });
      return (data ?? []) as HistoryRow[];
    },
  });

  const history = data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter((h) => {
      if (filter !== "todos" && h.action !== filter) return false;
      if (!q) return true;
      const rel = Array.isArray(h.documents) ? h.documents[0] : h.documents;
      const docName = rel?.name?.toLowerCase() ?? "";
      const actor = h.actor?.toLowerCase() ?? "";
      return docName.includes(q) || actor.includes(q) || h.action.toLowerCase().includes(q);
    });
  }, [history, filter, search]);

  const stats = useMemo(() => {
    const s: Record<string, number> = {};
    for (const h of history) s[h.action] = (s[h.action] ?? 0) + 1;
    return s;
  }, [history]);

  const lastEventAt = history[0]?.created_at;
  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-background/80 px-8 backdrop-blur-sm">
        <h1 className="font-display text-lg font-semibold">Histórico de auditoria</h1>
      </header>

      <div className="mx-auto max-w-5xl p-8">
        {/* Hero */}
        <div className="relative mb-8 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-accent via-accent to-[oklch(0.22_0.05_265)] p-6 text-accent-foreground shadow-lg">
          <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 right-24 size-56 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ring-white/15 backdrop-blur">
                <Sparkles className="size-3.5" />
                Auditoria em tempo real
              </div>
              <h2 className="mt-3 font-display text-3xl font-semibold leading-tight">
                Tudo que acontece nos seus documentos.
              </h2>
              <p className="mt-1 max-w-xl text-sm text-accent-foreground/70">
                Rastreie envios, aberturas, assinaturas e recusas em uma linha do tempo unificada.
              </p>
            </div>
            <div className="flex items-center gap-6 text-right">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-foreground/60">Eventos</p>
                <p className="font-display text-3xl font-semibold">{history.length}</p>
              </div>
              <div className="hidden h-10 w-px bg-white/15 sm:block" />
              <div className="hidden sm:block">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-foreground/60">Último</p>
                <p className="text-sm font-medium">{lastEventAt ? relativeDate(lastEventAt) : "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Criados" value={stats.criado ?? 0} icon={FilePlus} accent="text-slate-700" bar="bg-slate-400" />
          <MetricCard label="Enviados" value={stats.enviado ?? 0} icon={Send} accent="text-sky-600" bar="bg-sky-400" />
          <MetricCard label="Visualizados" value={stats.visualizado ?? 0} icon={Eye} accent="text-indigo-600" bar="bg-indigo-400" />
          <MetricCard label="Assinados" value={stats.assinado ?? 0} icon={PenLine} accent="text-emerald-600" bar="bg-emerald-400" />
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar documento, ator ou ação"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-accent focus:ring-4 focus:ring-accent/10"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const count = f.key === "todos" ? history.length : stats[f.key] ?? 0;
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", active ? "bg-white/15" : "bg-secondary text-foreground/70")}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Timeline */}
        {isLoading && (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
            Carregando…
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
              <HistoryIcon className="size-5" />
            </div>
            <p className="mt-3 text-sm font-medium">Nenhum evento encontrado</p>
            <p className="text-xs text-muted-foreground">Ajuste os filtros ou aguarde novas atividades.</p>
          </div>
        )}

        {!isLoading && groups.map((g) => (
          <section key={g.key} className="mb-6">
            {/* Day header */}
            <div className="mb-3 flex items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 shadow-sm">
                <span className="size-1.5 rounded-full bg-accent" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{g.label}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">{g.items.length} evento{g.items.length === 1 ? "" : "s"}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Timeline rows */}
            <div className="relative">
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" aria-hidden />
              <ol className="space-y-2">
                {g.items.map((h) => {
                  const rel = Array.isArray(h.documents) ? h.documents[0] : h.documents;
                  const meta = ACTION_META[h.action] ?? ACTION_META.criado;
                  const Icon = meta.icon;
                  return (
                    <li key={h.id} className="relative">
                      <div className="group flex items-stretch gap-4">
                        <div className={cn("relative z-[1] mt-2 grid size-10 shrink-0 place-items-center rounded-full ring-4 ring-background", meta.iconBg)}>
                          <div className={cn("absolute inset-0 rounded-full ring-1", meta.ring)} />
                          <Icon className={cn("size-4", meta.iconColor)} />
                        </div>
                        <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", meta.chip)}>
                              {meta.label}
                            </span>
                            {rel?.id ? (
                              <Link
                                to="/documents/$id"
                                params={{ id: rel.id }}
                                className="inline-flex items-center gap-1.5 truncate text-sm font-semibold text-foreground hover:text-accent"
                              >
                                <FileText className="size-3.5 text-muted-foreground" />
                                <span className="truncate">{rel.name || "Documento sem nome"}</span>
                                <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                              </Link>
                            ) : (
                              <span className="text-sm text-muted-foreground">Documento indisponível</span>
                            )}
                            <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                              {new Date(h.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span>{formatDateTime(h.created_at)}</span>
                            {h.actor && (
                              <>
                                <span className="text-border">•</span>
                                <span className="truncate">{h.actor}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
  bar,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: string;
  bar: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className={cn("absolute inset-x-0 top-0 h-0.5", bar)} />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={cn("size-4", accent)} />
      </div>
      <p className={cn("mt-2 font-display text-3xl font-semibold", accent)}>{value}</p>
    </div>
  );
}

function groupByDay(rows: HistoryRow[]) {
  const map = new Map<string, HistoryRow[]>();
  for (const r of rows) {
    const d = new Date(r.created_at);
    const key = d.toISOString().slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return Array.from(map.entries()).map(([key, items]) => {
    let label: string;
    if (key === iso(today)) label = "Hoje";
    else if (key === iso(yesterday)) label = "Ontem";
    else
      label = new Date(key).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    return { key, label, items };
  });
}
