## Objetivo

Adicionar uma breve descrição (texto de ajuda) abaixo de cada label no formulário de envio de documento, deixando claro para que serve cada campo na hora de gerar o link.

## Arquivo alterado

- `src/routes/_authenticated/documents.new.tsx`

## Textos de ajuda propostos

- **Nome do documento** — "Como o documento vai aparecer para o cliente e na sua lista (ex: Holerite Outubro/2026)."
- **Cliente** — "Selecione um cliente já cadastrado ou cadastre um novo destinatário."
- **Nome do destinatário** (quando cadastrando novo) — "Nome completo de quem vai receber e assinar o documento."
- **WhatsApp** (quando cadastrando novo) — "Número com DDD que receberá o link de assinatura pelo WhatsApp."
- **Competência** — "Período de referência do documento. Aparece na mensagem enviada ao cliente."
- **Data limite (opcional)** — "Prazo final para o cliente assinar. Deixe em branco se não houver prazo."

## Como será exibido

Cada texto entra como um `<p>` pequeno, cinza (`text-xs text-muted-foreground`), logo abaixo do `Label` correspondente e acima do `Input`. Sem mudanças de layout, cores ou lógica — apenas conteúdo informativo.
