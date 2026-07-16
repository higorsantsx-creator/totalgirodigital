## Seção de Relatórios — Plano de Implementação

Escopo grande. Proponho entregar em **3 fases** para manter qualidade e permitir feedback intermediário. Antes de começar, algumas decisões importantes.

---

### Perguntas rápidas antes de iniciar

1. **Dados disponíveis**: O sistema hoje tem `documents`, `document_signers`, `document_history`, `audit_logs`, `profiles`, `clients`. Não vejo tabelas de "empresa/departamento/competência" separadas. Vou usar:
   - **Empresa** → `clients.name`
   - **Funcionário** → `document_signers.signer_name/email`
   - **Competência** → campo do documento (usar `documents.name` ou criar um campo `competencia`?) — **preciso confirmar**
   - **Departamento** → não existe hoje. Ignorar filtro ou criar campo em `profiles`?

2. **Agendamento por e-mail**: você quer só a **UI preparada** (botões/modais sem back-end funcional), correto? Sem cron real ainda?

3. **Acesso**: relatórios só para `admin` (via `has_role`), ou qualquer usuário autenticado vê os próprios?

---

### Arquitetura proposta

**Nova rota principal**: `/_authenticated/reports` (layout com abas)
```
/reports              → Dashboard (cards + gráficos principais)
/reports/documents    → Relatório de documentos + filtros + export
/reports/signers      → Relatório de funcionários
/reports/audit        → Relatório de auditoria
/reports/competencias → Relatório por competência
```

**Stack técnica**:
- **Gráficos**: `recharts` (já compatível, leve, SSR-safe)
- **Tabelas**: `@tanstack/react-table` (paginação, sort, filtros nativos)
- **Export PDF**: `jspdf` + `jspdf-autotable` (client-side, sem worker)
- **Export XLSX**: `xlsx` (SheetJS) client-side
- **Export CSV**: nativo
- **Impressão**: `window.print()` + CSS `@media print`
- **Data fetching**: server functions com `requireSupabaseAuth` + agregações SQL

**Componentes reutilizáveis**:
- `<KpiCard>` — card de métrica com ícone, valor, trend
- `<ReportChart>` — wrapper para gráficos recharts
- `<ReportTable>` — tabela com paginação/sort/search/export
- `<FilterBar>` — filtros combinados (período, empresa, status, etc)
- `<ExportMenu>` — dropdown PDF/XLSX/CSV/Imprimir

---

### Fase 1 — Fundação + Dashboard (esta iteração)

1. Adicionar item "Relatórios" na sidebar
2. Layout `reports.tsx` com sub-navegação em abas
3. **Dashboard `/reports`**:
   - 9 KPI cards (enviados, assinados, pendentes, recusados, expirados, taxa, tempo médio, funcionários pendentes, downloads)
   - Gráfico "Documentos por dia" (últimos 30d) — BarChart
   - Gráfico "Evolução mensal de assinaturas" — LineChart
   - Gráfico "Concluídas × Pendentes" — PieChart/Donut
   - Filtro global de período (7d/30d/90d/custom)
   - Skeleton loading em todos os blocos
4. Server function `getReportsDashboard` com agregações
5. Instalar `recharts`, `@tanstack/react-table`, `jspdf`, `jspdf-autotable`, `xlsx`, `date-fns`

### Fase 2 — Relatórios detalhados

- `/reports/documents` — tabela completa + filtros + export (PDF/XLSX/CSV/Print)
- `/reports/signers` — ranking de funcionários
- `/reports/competencias` — agrupamento por competência
- Pesquisa avançada combinada

### Fase 3 — Auditoria + agendamento

- `/reports/audit` — tabela de `audit_logs` com IP, user-agent, filtros
- Modal "Agendar relatório" (estrutura UI apenas, salva em `report_schedules` — nova tabela)
- Refinamentos de tema/dark mode

---

### Design

Inspiração **Linear/Stripe/Power BI**:
- Densidade alta mas respirável, tipografia com hierarquia clara
- Paleta já existente (Navy Trust)
- Cards com borda sutil, sem gradientes exagerados
- Gráficos com paleta consistente (accent + tons de cinza/azul)
- Empty states elegantes
- 100% responsivo (grid colapsa em mobile)

---

### Confirmar antes de eu começar

- Respostas às 3 perguntas acima
- Ok iniciar pela **Fase 1** e seguir para as próximas após você validar?