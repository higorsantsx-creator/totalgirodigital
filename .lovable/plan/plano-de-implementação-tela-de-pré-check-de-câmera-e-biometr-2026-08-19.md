# Plano de Implementação: Tela de Pré-Check de Câmera e Biometria

O objetivo é implementar uma etapa intermediária obrigatória que valida as condições técnicas (permissão, resolução, disponibilidade da câmera e carregamento dos modelos de IA) antes de permitir que o funcionário prossiga para a captura facial propriamente dita. Isso melhora a experiência do usuário, fornecendo feedback claro sobre o que precisa ser corrigido antes da tentativa de assinatura.

## Alterações Propostas

### 1. Novo Passo no Fluxo de Assinatura
*   Adicionar um novo estado `"precheck"` ao fluxo `step` em `src/routes/sign.$token.tsx`.
*   O fluxo passará a ser: `code` -> `consent` -> `precheck` -> `face` -> `sign`.

### 2. Tela de Pré-Check (`precheck`)
*   Interface com status visual para:
    *   **Permissão de Câmera:** Verifica se o navegador tem acesso ao hardware.
    *   **Resolução Mínima:** Valida se a câmera atende aos requisitos do modelo de IA.
    *   **Modelos de IA:** Confirma se os modelos do `face-api.js` foram baixados com sucesso.
*   Botão de "Testar Câmera" para iniciar as verificações.
*   Feedback detalhado em caso de falha (ex: link para configurações de permissão).

### 3. Lógica de Validação
*   Implementar função de diagnóstico que tenta um `getUserMedia` silencioso e verifica as propriedades do stream.
*   Garantir que os modelos de IA estejam em cache via `loadModels()`.

## Detalhes Técnicos

### Componente Frontend (`src/routes/sign.$token.tsx`)
*   Atualizar o tipo `step` para incluir `precheck`.
*   Implementar o componente visual do pré-check usando ícones de status (Lucide-React).
*   Adicionar estados locais para acompanhar o progresso de cada item do check.

### Lógica de Câmera
*   Reutilizar as melhorias de restrições (`ideal: 640x640`) já implementadas.
*   Adicionar verificação de `MediaDevices.enumerateDevices()` para identificar disponibilidade.

## Segurança e Privacidade
*   Nenhuma imagem será armazenada ou enviada durante o pré-check.
*   A validação é puramente técnica e local no navegador do usuário.
