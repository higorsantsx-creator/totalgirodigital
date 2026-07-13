const SENSITIVE_KEY_PATTERN = /token|password|secret|authorization|apikey|refresh|access/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[MaxDepth]";
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : sanitize(item, depth + 1),
    ]),
  );
}

export function logDiagnostic(event: string, payload: Record<string, unknown> = {}, error?: unknown) {
  const entry = {
    event,
    route: typeof window !== "undefined" ? window.location.pathname + window.location.search : "server",
    at: new Date().toISOString(),
    ...payload,
    ...(error ? { error: sanitize(error) } : {}),
  };

  if (error) {
    console.error("[navigation-diagnostics]", sanitize(entry));
    return;
  }

  console.info("[navigation-diagnostics]", sanitize(entry));
}