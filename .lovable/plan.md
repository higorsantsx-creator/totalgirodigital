# Evolução do SignFlow — Plataforma de Assinaturas

Escopo enorme (24 áreas). Vou executar em **fases entregáveis**, cada uma funcional em produção. Nada existente é removido — apenas estendido.

## Diretrizes globais

- Manter Total Giro branding (vermelho/navy), tipografia Sora/Inter.
- Manter todas as tabelas/rotas atuais; novas features estendem `documents` ou adicionam tabelas.
- Backend: Lovable Cloud (Supabase) + `createServerFn`/rotas TSS. Sem edge functions.
- E-mails: Lovable Emails (managed). Assinatura ICP-Brasil fica como interface (adapter) + mock.
- Arquitetura: `src/lib/` (helpers), `src/services/` (server fns por domínio), `src/components/{feature}/`, `src/hooks/`.

## Fases

### Fase 1 — Fundação de dados & arquitetura (esta entrega)

Migração única cobrindo o schema da plataforma:

- **clients**: nome, empresa, doc (cpf/cnpj), email, telefone, endereço, notas, owner_id.
- **folders**: hierarquia (parent_id self-ref), name, color, owner_id.
- **tags** + **document_tags** (N:N).
- **templates**: name, category, file_path, fields_json, owner_id.
- **document_signers**: document_id, order_index, name, email, cpf, empresa, cargo, status, signed_at, access_token, notify_mode.
- **document_fields**: document_id, signer_id, type (signature|initial|name|cpf|company|role|date|text|checkbox), page, x, y, w, h, required, value.
- **document_comments**: document_id, author_id, body, mentions[], parent_id, edited_at.
- **document_attachments**: document_id, file_path, name, mime, size.
- **document_events** (timeline enriquecida): document_id, signer_id, type, ip, user_agent, os, browser, meta jsonb.
- **notifications**: user_id, type, title, body, doc_id, read_at.
- **email_queue_log** (só log — envio é síncrono).
- **certificates**: document_id, code, sha256, pdf_path, qr_path.
- **audit_logs**: user_id, action, entity, entity_id, ip, ua, meta.
- **app_settings**: owner_id, logo_url, primary_color, secondary_color, company_name, footer, favicon_url.
- Enum `app_role` estendido: `admin | manager | employee | viewer`.
- Extensões em `documents`: `folder_id`, `client_id`, `template_id`, `is_favorite`, `is_archived`, `deleted_at`, `signing_mode` (parallel|sequential), `certificate_id`.

Todas com GRANTs corretos + RLS por owner_id + policies para roles superiores via `has_role`.

Storage buckets adicionais: `templates`, `certificates`, `attachments`, `branding`.

### Fase 2 — Editor de campos drag-and-drop

- Página `/documents/new` ganha etapa "Preparar" após upload.
- Visualização PDF (`react-pdf`) + camada de campos absolutamente posicionados.
- Sidebar com paleta de campos (assinatura, rubrica, nome, CPF, empresa, cargo, data, texto, checkbox).
- Arrastar da paleta → cai no PDF; redimensionar; atribuir a signer via combobox colorido por assinante.
- Persiste em `document_fields` normalizado em coord relativa (0-1) por página.

### Fase 3 — Múltiplos assinantes + ordem

- CRUD de signers no wizard, toggle paralelo/sequencial, drag para reordenar.
- Envio: gera token único por signer; e-mail vai apenas ao próximo em modo sequencial.
- Progresso `n/total` em cards e detalhe.

### Fase 4 — Área do assinante (pública) renovada

- `/sign/$token` renderiza PDF + campos do signer com validação inline.
- Suporta: assinar (canvas), rubricar, digitar CPF/nome, checkboxes, recusar, comentar.
- Registra evento (open/view/start/sign) com IP/UA/OS/browser via server route.

### Fase 5 — Certificado + validação pública

- Ao concluir todas as assinaturas: gera SHA-256 do PDF final, código único, QR code (imagem PNG salva em storage), monta PDF do certificado (pdf-lib) com todos os signatários e eventos.
- Rota pública `/validate` (busca por código/hash) e `/validate/$code` exibindo autenticidade.
- QR aponta para `/validate/$code`.

### Fase 6 — Clientes, pastas, tags, favoritos, arquivar, lixeira

- CRUD de clientes em `/clients`.
- Sidebar de pastas em `/documents` (árvore).
- Tags via combobox multi-select.
- Ações em massa: favoritar / arquivar / mover para lixeira / restaurar.
- Soft-delete via `deleted_at`.

### Fase 7 — Modelos

- `/templates` lista/CRUD; ao criar novo doc pode partir de modelo (copia file_path e fields).

### Fase 8 — Dashboard avançado + filtros temporais

- Cards KPI: enviados, assinados, pendentes, expirados, recusados, tempo médio até assinatura, taxa de conversão.
- Gráficos (recharts): docs/mês, docs/cliente, funil de status.
- Filtros: dia / semana / mês / ano + range custom.

### Fase 9 — Timeline enriquecida

- Componente `DocumentTimeline` com ícones e agrupamento por dia.
- Cada evento mostra data, hora, IP, navegador, OS (parse do UA via lib pequena).

### Fase 10 — Notificações in-app

- Sino no topbar com contador não-lidas; popover com últimas 20.
- Realtime via Supabase channel na tabela `notifications`.

### Fase 11 — E-mails automáticos + lembretes

- Templates React Email: novo doc, assinado, recusado, expirado, lembretes 24h/3d/7d.
- Envio síncrono no evento; lembretes via `pg_cron` chamando rota `/api/public/hooks/reminders` (apikey anon).
- Configurações de template editáveis por admin (`app_settings`).

### Fase 12 — Comentários + anexos

- Painel lateral no detalhe do doc.
- Menções `@usuário` (autocomplete de membros da conta).
- Upload de anexos (PDF/DOCX/img/ZIP) em `attachments` bucket.

### Fase 13 — Relatórios & exportação

- `/reports` com filtros (cliente, período, status, signatário, empresa).
- Export PDF (server fn com pdf-lib), Excel (xlsx via `xlsx` lib), CSV.

### Fase 14 — Permissões (RBAC)

- `app_role` estendido; tabela `user_roles` alimenta `has_role`.
- Guards por rota (`_authenticated/_admin`, etc.) + hide/show de ações.
- Página `/settings/team` para convites e mudança de papel (admin only).

### Fase 15 — Personalização (white-label)

- `/settings/branding`: logo, favicon (upload), cores, nome, rodapé, templates de e-mail.
- Injeta variáveis CSS em runtime no layout autenticado.

### Fase 16 — Pesquisa global

- `Cmd+K` command palette (cmdk) buscando documentos, clientes, signatários, pastas, tags, modelos.

### Fase 17 — Logs de auditoria

- Helper `logAudit()` chamado em toda mutação sensível (login/logout via authState, upload, download, view, edit, sign, delete, permission, export).
- Página `/audit` filtrada, exportável.

### Fase 18 — Polimento UX/perf

- Skeletons em listas/detalhes, toasts, transições Framer Motion sutis, tema claro/escuro toggle, responsividade completa.
- Code-splitting por rota (já default TanStack), memoização em listas grandes, paginação server-side, upload com progresso, tratamento global de erro (errorComponent).

## Detalhes técnicos-chave

- **PDF**: `pdf-lib` (worker-safe) para renderizar campos preenchidos e gerar certificado; `react-pdf` (client-only, via lazy) para preview no editor.
- **QR**: `qrcode` (pure JS, worker-safe).
- **UA parsing**: `ua-parser-js`.
- **Command palette**: `cmdk` (já shadcn).
- **Rich date filters**: `date-fns` (já instalado).
- **Excel**: `xlsx`.
- **ICP-Brasil**: interface `SignatureProvider` em `src/services/signature/` com `LocalDrawProvider` (atual) e `ICPBrasilProvider` (stub throw NotImplemented).

## Ordem de implementação

Vou executar as fases sequencialmente, mas **agrupando entregas em blocos** para evitar mensagens gigantes:

- **Bloco A**: Fase 1 (migration completa) + Fase 14 (roles) + Fase 17 (audit helpers) + Fase 15 (settings estrutura).
- **Bloco B**: Fases 2 + 3 + 4 (editor + signers + área do assinante).
- **Bloco C**: Fases 5 + 10 (certificado, QR, validação pública, notificações).
- **Bloco D**: Fases 6 + 7 + 16 (clientes, pastas, tags, modelos, busca global).
- **Bloco E**: Fases 8 + 9 + 12 + 13 (dashboard, timeline, comentários, relatórios).
- **Bloco F**: Fases 11 + 18 (e-mails/lembretes, polimento).

Após cada bloco resumo o que ficou pronto e sigo.

## Confirmação

Este plano requer 6 blocos de implementação e ~15–20 tabelas novas. Confirma que devo prosseguir começando pelo **Bloco A** (fundação de dados, roles estendidas, audit e settings)?