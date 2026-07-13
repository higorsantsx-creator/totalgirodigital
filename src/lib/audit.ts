import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "login"
  | "logout"
  | "upload"
  | "download"
  | "view"
  | "edit"
  | "sign"
  | "delete"
  | "restore"
  | "permission_change"
  | "export"
  | "share"
  | "settings_update";

/**
 * Client-side audit logger. Writes a row into `audit_logs` for the current user.
 * Silently ignores failures — auditing must never break UX.
 */
export async function logAudit(
  action: AuditAction,
  opts: { entity?: string; entityId?: string; metadata?: Record<string, unknown> } = {},
) {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("audit_logs").insert({
      user_id: data.user.id,
      action,
      entity: opts.entity ?? null,
      entity_id: opts.entityId ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      metadata: (opts.metadata as never) ?? {},
    });
  } catch {
    /* noop */
  }
}
