// Shared helpers for the Reports module.
// Client-side aggregations over Supabase queries (scoped by RLS to the owner).

import { supabase } from "@/integrations/supabase/client";

export type PeriodKey = "7d" | "30d" | "90d" | "12m" | "all";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  "12m": "Últimos 12 meses",
  all: "Desde o início",
};

export function periodStart(period: PeriodKey): Date | null {
  const now = new Date();
  const d = new Date(now);
  switch (period) {
    case "7d": d.setDate(now.getDate() - 7); return d;
    case "30d": d.setDate(now.getDate() - 30); return d;
    case "90d": d.setDate(now.getDate() - 90); return d;
    case "12m": d.setMonth(now.getMonth() - 12); return d;
    case "all": return null;
  }
}

export type DocumentRow = {
  id: string;
  name: string;
  status: string;
  recipient_name: string | null;
  recipient_email: string | null;
  created_at: string;
  signed_at: string | null;
  declined_at: string | null;
  deadline: string | null;
  viewed_at: string | null;
  cancelled_at: string | null;
  client_id: string | null;
  owner_id: string;
  clients?: { id: string; name: string } | null;
};

const sel = (s: string): string => s;

export async function fetchDocuments(period: PeriodKey): Promise<DocumentRow[]> {
  let q = supabase
    .from("documents")
    .select(sel("id, name, status, recipient_name, recipient_email, created_at, signed_at, declined_at, deadline, viewed_at, cancelled_at, client_id, owner_id, clients(id, name)"))
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const start = periodStart(period);
  if (start) q = q.gte("created_at", start.toISOString());

  const { data, error } = await q.returns<DocumentRow[]>();
  if (error) throw error;
  return data ?? [];
}

export type Kpis = {
  total: number;
  signed: number;
  pending: number;
  declined: number;
  expired: number;
  cancelled: number;
  signRate: number; // 0..1
  avgSignHours: number | null;
  pendingSigners: number;
  downloads: number;
};

export function computeKpis(docs: DocumentRow[], downloads: number): Kpis {
  const total = docs.length;
  let signed = 0, pending = 0, declined = 0, expired = 0, cancelled = 0, pendingSigners = 0;
  let sumHours = 0, hoursCount = 0;
  const now = Date.now();
  for (const d of docs) {
    switch (d.status) {
      case "assinado": signed++; break;
      case "recusado": declined++; break;
      case "cancelado": cancelled++; break;
      case "expirado": expired++; break;
      default:
        if (d.deadline && new Date(d.deadline).getTime() < now) expired++;
        else { pending++; pendingSigners++; }
    }
    if (d.signed_at) {
      const h = (new Date(d.signed_at).getTime() - new Date(d.created_at).getTime()) / 36e5;
      if (h >= 0 && h < 24 * 365) { sumHours += h; hoursCount++; }
    }
  }
  return {
    total,
    signed,
    pending,
    declined,
    expired,
    cancelled,
    signRate: total ? signed / total : 0,
    avgSignHours: hoursCount ? sumHours / hoursCount : null,
    pendingSigners,
    downloads,
  };
}

export function formatHours(h: number | null): string {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

/** Bucket by YYYY-MM-DD across the last N days including today. */
export function byDayLastN(docs: DocumentRow[], n: number) {
  const buckets = new Map<string, { day: string; enviados: number; assinados: number }>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { day: key, enviados: 0, assinados: 0 });
  }
  for (const doc of docs) {
    const created = doc.created_at.slice(0, 10);
    if (buckets.has(created)) buckets.get(created)!.enviados++;
    if (doc.signed_at) {
      const signed = doc.signed_at.slice(0, 10);
      if (buckets.has(signed)) buckets.get(signed)!.assinados++;
    }
  }
  return Array.from(buckets.values()).map(b => ({
    ...b,
    label: new Date(b.day).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
  }));
}

/** Bucket by YYYY-MM across the last N months including current. */
export function byMonthLastN(docs: DocumentRow[], n: number) {
  const buckets = new Map<string, { key: string; enviados: number; assinados: number }>();
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { key, enviados: 0, assinados: 0 });
  }
  const asKey = (iso: string) => iso.slice(0, 7);
  for (const doc of docs) {
    const c = asKey(doc.created_at);
    if (buckets.has(c)) buckets.get(c)!.enviados++;
    if (doc.signed_at) {
      const s = asKey(doc.signed_at);
      if (buckets.has(s)) buckets.get(s)!.assinados++;
    }
  }
  const monthLabels = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return Array.from(buckets.values()).map(b => {
    const [y, m] = b.key.split("-");
    return { ...b, label: `${monthLabels[Number(m) - 1]}/${y.slice(2)}` };
  });
}

export function statusLabel(s: string): string {
  switch (s) {
    case "pendente": return "Pendente";
    case "assinado": return "Assinado";
    case "recusado": return "Recusado";
    case "expirado": return "Expirado";
    case "cancelado": return "Cancelado";
    default: return s;
  }
}

export const STATUS_COLORS: Record<string, string> = {
  assinado: "hsl(152 60% 42%)",
  pendente: "hsl(38 92% 50%)",
  recusado: "hsl(0 72% 55%)",
  expirado: "hsl(220 10% 55%)",
  cancelado: "hsl(220 8% 45%)",
};
