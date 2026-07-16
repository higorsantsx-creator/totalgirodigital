import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "./reports.documents";

export const Route = createFileRoute("/_authenticated/reports/signers")({
  component: () => <ComingSoon title="Relatório de Funcionários" />,
});
