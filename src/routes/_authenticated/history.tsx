import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
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
  { icon: ComponentType<{ className?: string }>; label: string; tone: string; iconBg: string; iconColor: string }
> = {
  criado:      { icon: FilePlus, label: "Criado",      tone: "text-slate-700",  iconBg: "bg-slate-100",   iconColor: "text-slate-600" },
  enviado:     { icon: Send,     label: "Enviado",     tone: "text-sky-700",    iconBg: "bg-sky-50",      iconColor: "text-sky-600" },
  reenviado:   { icon: Clock,    label: "Reenviado",   tone: "text-amber-700",  iconBg: "bg-amber-50",    iconColor: "text-amber-600" },
  visualizado: { icon: Eye,      label: "Visualizado", tone: "text-indigo-700", iconBg: "bg-indigo-50",   iconColor: "text-indigo-600" },
  assinado:    { icon: PenLine,  label: "Assinado",    tone: "text-emerald-700",iconBg: "bg-emerald-50",  iconColor: "text-emerald-600" },
  recusado:    { icon: XCircle,  label: "Recusado",    tone: "text-red-700",    iconBg: "bg-red-50",      iconColor: "text-red-600" },
  expirado:    { icon: TimerOff, label: "Expirado",    tone: "text-slate-700",  iconBg: "bg-slate-100",   iconColor: "text-slate-500" },
  cancelado:   { icon: XCircle,  label: "Cancelado",   tone: "text-slate-700",  iconBg: "bg-slate-100",   iconColor: "text-slate-500" },
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

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-background/80 px-8 backdrop-blur-sm">
        <h1 className="font-display text-lg font-semibold">Histórico de auditoria</h1>
      </header>

      <div className="mx-auto max-w-5xl p-8">
        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard icon={HistoryIcon} label="Eventos" value={history.length} tone="text-foreground" />
          <SummaryCard icon={FilePlus} label="Criados" value={stats.criado ?? 0} tone="text-slate-700" />
          <SummaryCard icon={Eye} label="Visualizados" value={stats.visualizado ?? 0} tone="text-indigo-600" />
          <SummaryCard icon={PenLine} label="Assinados" value={stats.assinado ?? 0} tone="text-emerald-600" />
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar documento, ator ou ação"
              className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-accent focus:ring-4 focus:ring-accent/10"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filter === f.key
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          {isLoading && (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="p-12 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
                <HistoryIcon className="size-5" />
              </div>
              <p className="mt-3 text-sm font-medium">Nenhum evento encontrado</p>
              <p className="text-xs text-muted-foreground">Ajuste os filtros ou aguarde novas atividades.</p>
            </div>
          )}

          {groups.map((g) => (
            <div key={g.key} className="border-b border-border last:border-0">
              <div className="sticky top-16 z-[1] flex items-center justify-between border-b border-border bg-card/95 px-5 py-2 backdrop-blur">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.label}
                </span>
                <span className="text-[11px] text-muted-foreground">{g.items.length} eventos</span>
              </div>
              <ol className="divide-y divide-border">
                {g.items.map((h) => {
                  const rel = Array.isArray(h.documents) ? h.documents[0] : h.documents;
                  const meta = ACTION_META[h.action] ?? ACTION_META.criado;
                  const Icon = meta.icon;
                  return (
                    <li key={h.id} className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-secondary/40">
                      <div className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-full", meta.iconBg)}>
                        <Icon className={cn("size-4", meta.iconColor)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className={cn("text-sm font-semibold", meta.tone)}>{meta.label}</span>
                          <span className="text-muted-foreground">·</span>
                          {rel?.id ? (
                            <Link
                              to="/documents/$id"
                              params={{ id: rel.id }}
                              className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                            >
                              <FileText className="size-3.5" />
                              {rel.name || "Documento sem nome"}
                            </Link>
                          ) : (
                            <span className="text-sm text-muted-foreground">Documento indisponível</span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>{formatDateTime(h.created_at)}</span>
                          {h.actor && (
                            <>
                              <span className="text-border">•</span>
                              <span className="truncate">{h.actor}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={cn("size-4", tone)} />
      </div>
      <p className={cn("mt-2 font-display text-2xl font-semibold", tone)}>{value}</p>
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
