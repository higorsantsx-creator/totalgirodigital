import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "text-foreground",
  bar = "bg-accent",
  loading,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  accent?: string;
  bar?: string;
  loading?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className={cn("absolute inset-x-0 top-0 h-0.5", bar)} />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={cn("size-4", accent)} />
      </div>
      {loading ? (
        <div className="mt-3 h-8 w-20 animate-pulse rounded bg-secondary" />
      ) : (
        <p className={cn("mt-2 font-display text-3xl font-semibold tabular-nums", accent)}>{value}</p>
      )}
      {hint && !loading && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  children,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5 shadow-sm", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}
