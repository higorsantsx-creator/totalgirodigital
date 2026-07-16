import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/documents")({
  component: () => <ComingSoon title="Relatório de Documentos" />,
});

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
          <Construction className="size-5" />
        </div>
        <h2 className="mt-3 font-display text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Em breve — este relatório será liberado na próxima etapa com tabela completa, filtros avançados e exportação em PDF, Excel e CSV.
        </p>
      </div>
    </div>
  );
}
