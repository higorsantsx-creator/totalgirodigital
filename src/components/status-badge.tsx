import { cn } from "@/lib/utils";

export type DocStatus = "pendente" | "visualizado" | "assinado" | "recusado" | "cancelado" | "expirado";

const config: Record<DocStatus, { label: string; className: string; dot: string }> = {
  pendente: {
    label: "Pendente",
    className: "bg-warning text-warning-foreground border-warning",
    dot: "bg-warning-foreground/80",
  },
  visualizado: {
    label: "Visualizado",
    className: "bg-info text-info-foreground border-info",
    dot: "bg-info-foreground/80",
  },
  assinado: {
    label: "Assinado",
    className: "bg-success text-success-foreground border-success",
    dot: "bg-success-foreground/80",
  },
  recusado: {
    label: "Recusado",
    className: "bg-destructive text-destructive-foreground border-destructive",
    dot: "bg-destructive-foreground/80",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground/70",
  },
  expirado: {
    label: "Expirado",
    className: "bg-foreground text-background border-foreground",
    dot: "bg-background/70",
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
