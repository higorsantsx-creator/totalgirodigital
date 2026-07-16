// Export helpers for the Reports module. Client-side, no server round-trip.
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";

export type ExportColumn<T> = {
  key: string;
  header: string;
  accessor: (row: T) => string | number | null | undefined;
};

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normalize<T>(rows: T[], cols: ExportColumn<T>[]): (string | number)[][] {
  return rows.map((r) =>
    cols.map((c) => {
      const v = c.accessor(r);
      return v == null ? "" : v;
    })
  );
}

export function exportCsv<T>(name: string, cols: ExportColumn<T>[], rows: T[]) {
  const header = cols.map((c) => c.header);
  const data = normalize(rows, cols);
  const csv = [header, ...data]
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? "");
          return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(";")
    )
    .join("\n");
  download(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `${name}_${stamp()}.csv`);
}

export function exportXlsx<T>(name: string, cols: ExportColumn<T>[], rows: T[]) {
  const header = cols.map((c) => c.header);
  const data = normalize(rows, cols);
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  ws["!cols"] = cols.map((c) => ({ wch: Math.max(c.header.length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  XLSX.writeFile(wb, `${name}_${stamp()}.xlsx`);
}

export function exportPdf<T>(name: string, title: string, cols: ExportColumn<T>[], rows: T[], subtitle?: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(title, 40, 40);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(subtitle, 40, 58);
    doc.setTextColor(0);
  }
  doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 40, subtitle ? 74 : 58);

  autoTable(doc, {
    startY: subtitle ? 90 : 74,
    head: [cols.map((c) => c.header)],
    body: normalize(rows, cols) as RowInput[],
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 80, left: 40, right: 40 },
  });
  doc.save(`${name}_${stamp()}.pdf`);
}

export function printReport() {
  window.print();
}
