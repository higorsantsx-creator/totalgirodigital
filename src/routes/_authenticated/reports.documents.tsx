import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, Filter, X } from "lucide-react";

import { fetchDocuments, PERIOD_LABELS, statusLabel, type DocumentRow, type PeriodKey } from "@/lib/reports";
import { DataTable } from "@/components/reports/data-table";
import { ExportMenu } from "@/components/reports/export-menu";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ExportColumn } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/reports/documents")({
  component: DocumentsReport,
});

const STATUSES = ["pendente", "assinado", "recusado", "expirado", "cancelado"] as const;

function competenciaOf(d: DocumentRow): string {
  const iso = d.created_at.slice(0, 7);
  const [y, m] = iso.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[Number(m) - 1]}/${y}`;
}

function DocumentsReport() {
  const [period, setPeriod] = useState<PeriodKey>("90d");
  const [status, setStatus] = useState<string>("todos");
  const [empresa, setEmpresa] = useState<string>("todas");
  const [funcionario, setFuncionario] = useState<string>("todos");
  const [competencia, setCompetencia] = useState<string>("todas");

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "documents-full", period],
    queryFn: () => fetchDocuments(period),
  });

  const rows = data ?? [];

  const empresas = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.clients?.name && s.add(r.clients.name));
    return Array.from(s).sort();
  }, [rows]);

  const funcionarios = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.recipient_name && s.add(r.recipient_name));
    return Array.from(s).sort();
  }, [rows]);

  const competencias = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(competenciaOf(r)));
    return Array.from(s).sort().reverse();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (status !== "todos" && r.status !== status) return false;
      if (empresa !== "todas" && r.clients?.name !== empresa) return false;
      if (funcionario !== "todos" && r.recipient_name !== funcionario) return false;
      if (competencia !== "todas" && competenciaOf(r) !== competencia) return false;
      return true;
    });
  }, [rows, status, empresa, funcionario, competencia]);

  const columns: ColumnDef<DocumentRow>[] = [
    {
      accessorKey: "name",
      header: "Documento",
      cell: ({ row }) => (
        <Link
          to="/documents/$id"
          params={{ id: row.original.id }}
          className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-accent"
        >
          <span className="max-w-[280px] truncate">{row.original.name}</span>
          <ExternalLink className="size-3 opacity-40" />
        </Link>
      ),
    },
    {
      accessorKey: "recipient_name",
      header: "Funcionário",
      cell: ({ row }) => row.original.recipient_name || "—",
    },
    {
      id: "empresa",
      header: "Empresa",
      accessorFn: (r) => r.clients?.name ?? "",
      cell: ({ row }) => row.original.clients?.name || "—",
    },
    {
      id: "competencia",
      header: "Competência",
      accessorFn: (r) => competenciaOf(r),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "created_at",
      header: "Envio",
      cell: ({ row }) => formatDate(row.original.created_at),
    },
    {
      accessorKey: "signed_at",
      header: "Assinatura",
      cell: ({ row }) => formatDate(row.original.signed_at),
    },
    {
      accessorKey: "deadline",
      header: "Vencimento",
      cell: ({ row }) => formatDate(row.original.deadline),
    },
  ];

  const exportCols: ExportColumn<DocumentRow>[] = [
    { key: "name", header: "Documento", accessor: (r) => r.name },
    { key: "recipient", header: "Funcionário", accessor: (r) => r.recipient_name ?? "" },
    { key: "email", header: "E-mail", accessor: (r) => r.recipient_email ?? "" },
    { key: "empresa", header: "Empresa", accessor: (r) => r.clients?.name ?? "" },
    { key: "competencia", header: "Competência", accessor: (r) => competenciaOf(r) },
    { key: "status", header: "Status", accessor: (r) => statusLabel(r.status) },
    { key: "created", header: "Data de envio", accessor: (r) => formatDate(r.created_at) },
    { key: "signed", header: "Data de assinatura", accessor: (r) => formatDate(r.signed_at) },
    { key: "deadline", header: "Vencimento", accessor: (r) => formatDate(r.deadline) },
  ];

  const hasFilter = status !== "todos" || empresa !== "todas" || funcionario !== "todos" || competencia !== "todas";
  const clearFilters = () => {
    setStatus("todos"); setEmpresa("todas"); setFuncionario("todos"); setCompetencia("todas");
  };

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Relatório de Documentos</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} de {rows.length} documento{rows.length === 1 ? "" : "s"} no período</p>
        </div>
        <ExportMenu
          name="relatorio-documentos"
          title="Relatório de Documentos"
          subtitle={`Período: ${PERIOD_LABELS[period]} · Filtros aplicados: ${hasFilter ? "sim" : "não"}`}
          columns={exportCols}
          rows={filtered}
          disabled={isLoading || filtered.length === 0}
        />
      </div>

      {/* Filter bar */}
      <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtros</span>
          {hasFilter && (
            <button onClick={clearFilters} className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <X className="size-3" /> Limpar
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <FilterSelect label="Período" value={period} onChange={(v) => setPeriod(v as PeriodKey)}
            options={(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((k) => ({ value: k, label: PERIOD_LABELS[k] }))} />
          <FilterSelect label="Status" value={status} onChange={setStatus}
            options={[{ value: "todos", label: "Todos" }, ...STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))]} />
          <FilterSelect label="Empresa" value={empresa} onChange={setEmpresa}
            options={[{ value: "todas", label: "Todas" }, ...empresas.map((e) => ({ value: e, label: e }))]} />
          <FilterSelect label="Funcionário" value={funcionario} onChange={setFuncionario}
            options={[{ value: "todos", label: "Todos" }, ...funcionarios.map((f) => ({ value: f, label: f }))]} />
          <FilterSelect label="Competência" value={competencia} onChange={setCompetencia}
            options={[{ value: "todas", label: "Todas" }, ...competencias.map((c) => ({ value: c, label: c }))]} />
        </div>
      </div>

      <div className="print-area">
        <DataTable
          columns={columns}
          data={filtered}
          loading={isLoading}
          searchPlaceholder="Buscar por nome, funcionário, empresa…"
          emptyText="Nenhum documento encontrado com os filtros atuais"
        />
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

const STATUS_CHIP: Record<string, string> = {
  assinado: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  pendente: "bg-amber-50 text-amber-700 ring-amber-100",
  recusado: "bg-red-50 text-red-700 ring-red-100",
  expirado: "bg-slate-100 text-slate-600 ring-slate-200",
  cancelado: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1", STATUS_CHIP[status] ?? STATUS_CHIP.pendente)}>
      {statusLabel(status)}
    </span>
  );
}
