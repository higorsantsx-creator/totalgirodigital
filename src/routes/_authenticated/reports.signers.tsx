import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { fetchDocuments, formatHours, PERIOD_LABELS, type PeriodKey } from "@/lib/reports";
import { DataTable } from "@/components/reports/data-table";
import { ExportMenu } from "@/components/reports/export-menu";
import { formatDate } from "@/lib/format";
import type { ExportColumn } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/reports/signers")({
  component: SignersReport,
});

type SignerAgg = {
  name: string;
  email: string;
  empresa: string;
  received: number;
  signed: number;
  pending: number;
  declined: number;
  lastSignedAt: string | null;
  avgHours: number | null;
};

function SignersReport() {
  const [period, setPeriod] = useState<PeriodKey>("90d");

  const { data: docs, isLoading } = useQuery({
    queryKey: ["reports", "signers-agg", period],
    queryFn: () => fetchDocuments(period),
  });

  const rows = useMemo<SignerAgg[]>(() => {
    const map = new Map<string, SignerAgg & { _sumH: number; _cH: number }>();
    for (const d of docs ?? []) {
      const key = (d.recipient_email || d.recipient_name || "—").toLowerCase();
      const entry = map.get(key) ?? {
        name: d.recipient_name || "—",
        email: d.recipient_email || "",
        empresa: d.clients?.name || "",
        received: 0, signed: 0, pending: 0, declined: 0,
        lastSignedAt: null, avgHours: null, _sumH: 0, _cH: 0,
      };
      entry.received++;
      if (d.status === "assinado") {
        entry.signed++;
        if (d.signed_at && (!entry.lastSignedAt || d.signed_at > entry.lastSignedAt)) entry.lastSignedAt = d.signed_at;
        if (d.signed_at) {
          const h = (new Date(d.signed_at).getTime() - new Date(d.created_at).getTime()) / 36e5;
          if (h >= 0 && h < 24 * 365) { entry._sumH += h; entry._cH++; }
        }
      } else if (d.status === "recusado") entry.declined++;
      else entry.pending++;
      map.set(key, entry);
    }
    return Array.from(map.values())
      .map((e) => ({ ...e, avgHours: e._cH ? e._sumH / e._cH : null }))
      .sort((a, b) => b.received - a.received);
  }, [docs]);

  const columns: ColumnDef<SignerAgg>[] = [
    { accessorKey: "name", header: "Funcionário" },
    { accessorKey: "empresa", header: "Empresa", cell: ({ row }) => row.original.empresa || "—" },
    { accessorKey: "received", header: "Recebidos" },
    { accessorKey: "signed", header: "Assinados" },
    { accessorKey: "pending", header: "Pendentes" },
    { accessorKey: "declined", header: "Recusados" },
    {
      accessorKey: "lastSignedAt",
      header: "Última assinatura",
      cell: ({ row }) => formatDate(row.original.lastSignedAt),
    },
    {
      accessorKey: "avgHours",
      header: "Tempo médio",
      cell: ({ row }) => formatHours(row.original.avgHours),
    },
  ];

  const exportCols: ExportColumn<SignerAgg>[] = [
    { key: "name", header: "Funcionário", accessor: (r) => r.name },
    { key: "empresa", header: "Empresa", accessor: (r) => r.empresa },
    { key: "email", header: "E-mail", accessor: (r) => r.email },
    { key: "received", header: "Recebidos", accessor: (r) => r.received },
    { key: "signed", header: "Assinados", accessor: (r) => r.signed },
    { key: "pending", header: "Pendentes", accessor: (r) => r.pending },
    { key: "declined", header: "Recusados", accessor: (r) => r.declined },
    { key: "last", header: "Última assinatura", accessor: (r) => formatDate(r.lastSignedAt) },
    { key: "avg", header: "Tempo médio", accessor: (r) => formatHours(r.avgHours) },
  ];

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Relatório de Funcionários</h2>
          <p className="text-sm text-muted-foreground">{rows.length} funcionário{rows.length === 1 ? "" : "s"} · {PERIOD_LABELS[period]}</p>
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
            name="relatorio-funcionarios"
            title="Relatório de Funcionários"
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
        searchPlaceholder="Buscar funcionário ou empresa…"
        emptyText="Sem dados no período selecionado"
      />
    </div>
  );
}
