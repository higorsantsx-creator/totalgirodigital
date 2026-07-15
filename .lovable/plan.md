## Objetivo

Redesenhar `/documents/new` seguindo a direção **Elegant structured card** com paleta **Navy Trust** (#0f1b3d, #1e3a5f, #3b6fa0, #e8edf3). Card único centralizado, dropzone com ícone em pílula, labels em uppercase, campos com fundo levemente cinza e foco em navy, botão principal navy. Toda a lógica atual permanece.

## Arquivo

- `src/routes/_authenticated/documents.new.tsx` — reescrita do JSX/estilos (lógica intocada).

## Estrutura

Container: `min-h-screen bg-slate-50` centralizado, card `max-w-2xl rounded-2xl border shadow-xl` branco.

1. **Header do card**: título `Novo envio de documento` (bold, 2xl) + subtítulo `Preencha os dados abaixo para gerar o link de assinatura.`; borda inferior sutil.
2. **Dropzone**: altura `h-40`, borda tracejada `border-slate-200`, hover navy suave (`hover:border-primary/40`, `hover:bg-primary/5`), círculo branco com sombra contendo ícone `UploadCloud` em cor primária navy; texto "Arraste o PDF aqui ou **clique para selecionar**" e dica `PDF (máximo 20MB)`. Quando um arquivo já está selecionado: mesma linha atual (FileText + nome + tamanho + botão remover), mas dentro de um container `rounded-xl border-slate-200 bg-slate-50/50` no lugar do dropzone.
3. **Seção formulário** (`space-y-5`):
   - Nome do documento (linha inteira)
   - Cliente (linha inteira) — mantém o Popover atual com o mesmo botão trigger, mas restilizado com `rounded-lg border-slate-200 bg-slate-50/30 py-3`. Link "Gerenciar clientes" no canto direito da label.
   - Grid 2 colunas: Nome do destinatário + WhatsApp (quando cliente = "new")
   - Card compacto do destinatário selecionado (quando cliente ≠ "new") — mantido.
   - Grid 2 colunas: Competência + Data limite (opcional), cada uma com ícone `HelpCircle` ao lado do label e tooltip do shadcn com o texto atual.
4. **Botão principal**: largura total, `py-4 rounded-xl`, bg navy `#1e3a5f`, hover `#3b6fa0`, sombra `shadow-lg shadow-slate-300/50`, ícone de seta à direita. Estado loading mantém `Loader2` giratório.
5. **Estado de sucesso** (`created`): mesmo card estrutural, ícone check em círculo navy claro, botão WhatsApp verde mantido, campo readonly do link e ações "Ver documentos" / "Enviar outro" como está — apenas restilizado com a nova borda/padding.
6. **Overlay "Preparando WhatsApp..."**: mantido, com o ícone em círculo navy claro em vez de verde-sucesso (opcional — manter verde por consistência com WhatsApp).

## Estilo dos campos

Padrão para inputs e trigger do popover:
- `w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50/30`
- Foco: `focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none`
- Placeholder: `placeholder:text-slate-400`

Labels:
- `block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2`

## Design tokens

Ajustar `src/styles.css` (`:root` e `.dark` conforme aplicável) para refletir Navy Trust nas variáveis semânticas:
- `--primary: oklch(...)` correspondente a `#1e3a5f`
- `--primary-foreground: oklch(...)` correspondente a `#e8edf3`
- `--ring` alinhado ao primário
- `--accent` = `#3b6fa0`

Isso propaga a paleta para todos os componentes shadcn sem hardcode. Onde precisar de tons finos (slate-50/200/400/500) usar as próprias classes utilitárias do Tailwind (já disponíveis).

## Detalhes técnicos

- Manter todos os imports/hook/handlers atuais (`submit`, `pickFile`, `onClientChange`, Popover de clientes, criação de novo cliente, upload para storage, insert em `documents` e `document_history`, redirecionamento).
- Header sticky superior atual (`<header class="sticky ...">Novo documento</header>`) será removido — o título passa a viver dentro do card. A rota continua dentro do layout `_authenticated`, então a sidebar permanece.
- Tooltips continuam apenas em Competência e Data limite via `Tooltip`/`TooltipProvider` já importados.
- Nenhuma mudança em rotas, queries ou schema.

## Fora do escopo

- Não mexer em outras páginas.
- Não alterar `whatsappMessage`, `buildWhatsappUrl`, `debug-diagnostics`.
- Não trocar a fonte atual do app.
