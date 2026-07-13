import { cn } from "@/lib/utils";

export type DocStatus = "pendente" | "visualizado" | "assinado" | "recusado" | "expirado";

const config: Record<DocStatus, { label: string; className: string; dot: string }> = {
  pendente: {
    label: "Pendente",
    className: "bg-warning/10 text-warning-foreground border-warning/30",
    dot: "bg-warning",
  },
  visualizado: {
    label: "Visualizado",
    className: "bg-info/10 text-info-foreground border-info/30",
    dot: "bg-info",
  },
  assinado: {
    label: "Assinado",
    className: "bg-success/10 text-success-foreground border-success/30",
    dot: "bg-success",
  },
  recusado: {
    label: "Recusado",
    className: "bg-destructive/10 text-destructive-foreground border-destructive/30",
    dot: "bg-destructive",
  },
  expirado: {
    label: "Expirado",
    className: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
};

export function StatusBadge({ status }: { status: DocStatus }) {
  const c = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        c.className
      )}
    >
      <span className={cn("size-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}
