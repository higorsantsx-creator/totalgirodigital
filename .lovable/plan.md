## Objetivo

Manter dicas de ajuda apenas em **Competência** e **Data limite (opcional)**, e transformá-las em um ícone de interrogação (?) ao lado do label, exibindo o texto num tooltip ao passar o mouse / tocar.

## Alterações

Arquivo: `src/routes/_authenticated/documents.new.tsx`

1. Remover os `<p className="text-xs text-muted-foreground">…</p>` de:
   - Nome do documento
   - Cliente
   - Nome do destinatário
   - WhatsApp
2. Nos campos **Competência** e **Data limite (opcional)**:
   - Remover o `<p>` de ajuda atual.
   - Ao lado do `<Label>`, adicionar um botão com ícone `HelpCircle` (lucide-react) dentro de um `Tooltip` do shadcn (`@/components/ui/tooltip`).
   - Conteúdo dos tooltips:
     - Competência → "Período de referência do documento. Aparece na mensagem enviada ao cliente."
     - Data limite → "Prazo final para o cliente assinar. Deixe em branco se não houver prazo."

## Detalhes técnicos

- Importar `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider` de `@/components/ui/tooltip` e `HelpCircle` de `lucide-react`.
- Envolver o formulário (ou o par label+ícone) com `<TooltipProvider delayDuration={150}>`.
- Estrutura por campo:
  ```tsx
  <div className="flex items-center gap-1.5">
    <Label htmlFor="msg">Competência (ex: Outubro/2026)</Label>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label="Ajuda" className="text-muted-foreground hover:text-foreground">
          <HelpCircle className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">…texto…</TooltipContent>
    </Tooltip>
  </div>
  ```
- Sem mudanças de lógica, validação ou layout dos inputs.
