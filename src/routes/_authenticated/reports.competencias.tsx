import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarRange } from "lucide-react";

import { fetchDocuments, PERIOD_LABELS, type DocumentRow, type PeriodKey } from "@/lib/reports";
import { DataTable } from "@/components/reports/data-table";
import { ExportMenu } from "@/components/reports/export-menu";
import type { ExportColumn } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/reports/competencias")({
  component: CompetenciasReport,
});

type CompRow = {
  key: string;      // YYYY-MM
  label: string;    // Mmm/YYYY
  enviados: number;
  assinados: number;
  pendentes: number;
  recusados: number;
  taxa: number;
};

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const keyOf = (iso: string) => iso.slice(0, 7);
const labelOf = (key: string) => {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1]}/${y}`;
};

function CompetenciasReport() {
  const [period, setPeriod] = useState<PeriodKey>("12m");

  const { data: docs, isLoading } = useQuery({
    queryKey: ["reports", "competencias", period],
    queryFn: () => fetchDocuments(period),
  });

  const rows = useMemo<CompRow[]>(() => {
    const map = new Map<string, CompRow>();
    for (const d of (docs ?? []) as DocumentRow[]) {
      const k = keyOf(d.created_at);
      const entry = map.get(k) ?? { key: k, label: labelOf(k), enviados: 0, assinados: 0, pendentes: 0, recusados: 0, taxa: 0 };
      entry.enviados++;
      if (d.status === "assinado") entry.assinados++;
      else if (d.status === "recusado") entry.recusados++;
      else entry.pendentes++;
      map.set(k, entry);
    }
    return Array.from(map.values())
      .map((r) => ({ ...r, taxa: r.enviados ? r.assinados / r.enviados : 0 }))
      .sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [docs]);

  const columns: ColumnDef<CompRow>[] = [
    {
      accessorKey: "label",
      header: "Competência",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2 font-medium">
          <CalendarRange className="size-4 text-muted-foreground" />
          {row.original.label}
        </span>
      ),
    },
    { accessorKey: "enviados", header: "Enviados" },
    { accessorKey: "assinados", header: "Assinados" },
    { accessorKey: "pendentes", header: "Pendentes" },
    { accessorKey: "recusados", header: "Recusados" },
    {
      accessorKey: "taxa",
      header: "Taxa de assinatura",
      cell: ({ row }) => {
        const p = row.original.taxa * 100;
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${p}%` }} />
            </div>
            <span className="tabular-nums text-xs text-muted-foreground">{p.toFixed(1)}%</span>
          </div>
        );
      },
    },
  ];

  const exportCols: ExportColumn<CompRow>[] = [
    { key: "comp", header: "Competência", accessor: (r) => r.label },
    { key: "env", header: "Enviados", accessor: (r) => r.enviados },
    { key: "sig", header: "Assinados", accessor: (r) => r.assinados },
    { key: "pen", header: "Pendentes", accessor: (r) => r.pendentes },
    { key: "rec", header: "Recusados", accessor: (r) => r.recusados },
    { key: "taxa", header: "Taxa (%)", accessor: (r) => (r.taxa * 100).toFixed(1) },
  ];

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Relatório de Competências</h2>
          <p className="text-sm text-muted-foreground">Agrupado pelo mês do envio · {rows.length} competência{rows.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodKey)}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-sm shadow-sm"
          >
            {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((k) => (
              <option key={k} value={k}>{PERIOD_LABELS[k]}</option>
            ))}
          </select>
          <ExportMenu
            name="relatorio-competencias"
            title="Relatório de Competências"
            subtitle={`Período: ${PERIOD_LABELS[period]}`}
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
        searchPlaceholder="Buscar competência…"
        emptyText="Sem competências no período"
      />
    </div>
  );
}
