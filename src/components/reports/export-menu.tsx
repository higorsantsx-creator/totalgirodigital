import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Printer, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportCsv, exportPdf, exportXlsx, printReport, type ExportColumn } from "@/lib/export";

export function ExportMenu<T>({
  name,
  title,
  subtitle,
  columns,
  rows,
  disabled,
}: {
  name: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const items = [
    { label: "PDF", icon: FileText, on: () => exportPdf(name, title, columns, rows, subtitle) },
    { label: "Excel (.xlsx)", icon: FileSpreadsheet, on: () => exportXlsx(name, columns, rows) },
    { label: "CSV", icon: FileText, on: () => exportCsv(name, columns, rows) },
    { label: "Imprimir", icon: Printer, on: () => printReport() },
  ];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-colors",
          "hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <Download className="size-4" />
        Exportar
        <ChevronDown className="size-3.5 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            {items.map((it) => (
              <button
                key={it.label}
                onClick={() => { it.on(); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
              >
                <it.icon className="size-4 text-muted-foreground" />
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
