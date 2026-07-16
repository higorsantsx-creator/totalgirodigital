import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Calendar, Mail } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/reports/data-table";
import { ExportMenu } from "@/components/reports/export-menu";
import { formatDateTime } from "@/lib/format";
import { periodStart, PERIOD_LABELS, type PeriodKey } from "@/lib/reports";
import type { ExportColumn } from "@/lib/export";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reports/audit")({
  component: AuditReport,
});

type AuditRow = {
  id: string;
  user_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

const ACTIONS = ["login", "logout", "upload", "envio", "visualizacao", "assinatura", "download", "exclusao", "alteracao"] as const;

function parseUA(ua: string | null): { browser: string; os: string } {
  if (!ua) return { browser: "—", os: "—" };
  let browser = "Outro";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";
  let os = "Outro";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Macintosh|Mac OS/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return { browser, os };
}

function AuditReport() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [action, setAction] = useState<string>("todos");
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "audit", period],
    queryFn: async () => {
      const start = periodStart(period);
      let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(1000);
      if (start) q = q.gte("created_at", start.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const rows = useMemo(() => (data ?? []).filter((r) => action === "todos" || r.action === action), [data, action]);

  const columns: ColumnDef<AuditRow>[] = [
    {
      accessorKey: "action",
      header: "Ação",
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/80">
          {row.original.action}
        </span>
      ),
    },
    { accessorKey: "entity", header: "Entidade", cell: ({ row }) => row.original.entity || "—" },
    { accessorKey: "user_id", header: "Usuário", cell: ({ row }) => <span className="font-mono text-xs">{row.original.user_id?.slice(0, 8) ?? "—"}</span> },
    { accessorKey: "ip", header: "IP", cell: ({ row }) => <span className="font-mono text-xs">{row.original.ip || "—"}</span> },
    {
      id: "browser",
      header: "Navegador",
      accessorFn: (r) => parseUA(r.user_agent).browser,
    },
    {
      id: "os",
      header: "Sistema",
      accessorFn: (r) => parseUA(r.user_agent).os,
    },
    {
      accessorKey: "created_at",
      header: "Data e hora",
      cell: ({ row }) => <span className="tabular-nums text-xs">{formatDateTime(row.original.created_at)}</span>,
    },
  ];

  const exportCols: ExportColumn<AuditRow>[] = [
    { key: "action", header: "Ação", accessor: (r) => r.action },
    { key: "entity", header: "Entidade", accessor: (r) => r.entity ?? "" },
    { key: "user", header: "Usuário", accessor: (r) => r.user_id ?? "" },
    { key: "ip", header: "IP", accessor: (r) => r.ip ?? "" },
    { key: "browser", header: "Navegador", accessor: (r) => parseUA(r.user_agent).browser },
    { key: "os", header: "Sistema", accessor: (r) => parseUA(r.user_agent).os },
    { key: "date", header: "Data e hora", accessor: (r) => formatDateTime(r.created_at) },
  ];

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Relatório de Auditoria</h2>
          <p className="text-sm text-muted-foreground">{rows.length} evento{rows.length === 1 ? "" : "s"} · {PERIOD_LABELS[period]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodKey)}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-sm shadow-sm"
          >
            {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((k) => (
              <option key={k} value={k}>{PERIOD_LABELS[k]}</option>
            ))}
          </select>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-sm shadow-sm"
          >
            <option value="todos">Todas as ações</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button
            onClick={() => setScheduleOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-secondary"
          >
            <Calendar className="size-4" />
            Agendar
          </button>
          <ExportMenu
            name="relatorio-auditoria"
            title="Relatório de Auditoria"
            subtitle={`Período: ${PERIOD_LABELS[period]}${action !== "todos" ? ` · Ação: ${action}` : ""}`}
            columns={exportCols}
            rows={rows}
            disabled={isLoading || rows.length === 0}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        searchPlaceholder="Buscar ação, IP, entidade…"
        emptyText="Nenhum evento de auditoria no período"
      />

      {scheduleOpen && <ScheduleModal onClose={() => setScheduleOpen(false)} />}
    </div>
  );
}

function ScheduleModal({ onClose }: { onClose: () => void }) {
  const [freq, setFreq] = useState<"diario" | "semanal" | "mensal">("semanal");
  const [email, setEmail] = useState("");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <div className="border-b border-border p-4">
          <h3 className="font-display text-base font-semibold">Agendar envio automático</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Receba este relatório por e-mail na frequência escolhida</p>
        </div>
        <div className="space-y-4 p-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Frequência</span>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-secondary p-1">
              {(["diario", "semanal", "mensal"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFreq(f)}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-all",
                    freq === f ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">E-mail de destino</span>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="email@empresa.com"
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
              />
            </div>
          </label>
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-100">
            <strong>Em breve:</strong> a estrutura de agendamento está preparada; o envio automático será ativado em uma próxima atualização.
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-secondary/40 p-3">
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            Cancelar
          </button>
          <button onClick={onClose} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground shadow-sm hover:bg-accent/90">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
