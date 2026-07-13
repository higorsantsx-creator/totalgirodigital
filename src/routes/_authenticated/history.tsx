import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { Clock, Eye, PenLine, XCircle, TimerOff, FilePlus, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { data } = useQuery({
    queryKey: ["global-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_history")
        .select("*, documents!inner(id, name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-background/80 px-8 backdrop-blur-sm">
        <h1 className="font-display text-lg font-semibold">Histórico de auditoria</h1>
      </header>
      <div className="mx-auto max-w-4xl p-8">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <ol className="space-y-4">
            {(data ?? []).map((h) => {
              const doc = (h as unknown as { documents: { id: string; name: string } }).documents;
              return (
                <li key={h.id} className="flex gap-3 border-b border-border pb-3 last:border-0">
                  <ActionIcon action={h.action} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-semibold capitalize">{h.action}</span>
                      {" · "}
                      <Link to="/documents/$id" params={{ id: doc.id }} className="text-accent hover:underline">
                        {doc.name}
                      </Link>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(h.created_at)} {h.actor && `· ${h.actor}`}
                    </p>
                  </div>
                </li>
              );
            })}
            {data && data.length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground">Sem eventos ainda.</li>
            )}
          </ol>
        </div>
      </div>
    </>
  );
}

function ActionIcon({ action }: { action: string }) {
  const map: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
    criado: { icon: FilePlus, color: "text-muted-foreground" },
    enviado: { icon: Send, color: "text-info" },
    visualizado: { icon: Eye, color: "text-info" },
    assinado: { icon: PenLine, color: "text-success" },
    recusado: { icon: XCircle, color: "text-destructive" },
    expirado: { icon: TimerOff, color: "text-muted-foreground" },
    reenviado: { icon: Clock, color: "text-warning" },
    cancelado: { icon: XCircle, color: "text-muted-foreground" },
  };
  const { icon: Icon, color } = map[action] ?? map.criado;
  return (
    <div className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-secondary ${color}`}>
      <Icon className="size-4" />
    </div>
  );
}
