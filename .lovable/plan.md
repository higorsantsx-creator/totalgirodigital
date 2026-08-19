# Plano de Correção do Fluxo de Validação Facial e Assinatura

Corrigir a integração entre frontend e backend para validação de código de acesso e autenticação facial, garantindo segurança e usabilidade.

## Mudanças

### Backend (Banco de Dados e Servidor)

1. **Migration de Banco de Dados**: Criar a tabela `facial_auth_sessions` para armazenar tokens de uso único com hash, garantindo que a assinatura só ocorra após validação facial bem-sucedida.
2. **Implementação do `facial.server.ts`**: Adicionar métodos `createFacialAuthToken` e `validateFacialAuthToken` para gerenciar as sessões de validação.
3. **Novo Endpoint de Validação de Código**: Criar `/api/public/sign/$token/validate-code` para verificar se o código de 4 dígitos pertence ao destinatário do documento.
4. **Refatoração de Endpoints Faciais**: Atualizar `/api/public/face/register` e `/api/public/face/verify` para retornar o `facialAuthToken` real e reforçar validações de segurança.
5. **Correção do Endpoint de Confirmação**: Atualizar `/api/public/sign/$token/confirm` para exigir e validar o token facial antes de estampar a assinatura.

### Frontend (Interface do Funcionário)

1. **Validação de Código**: Impedir avanço automático no frontend; o botão "Continuar" agora chama o backend para validar o código de 4 dígitos.
2. **Normalização de Input**: Garantir que o código seja exatamente 4 dígitos numéricos (formato 0001).
3. **Fluxo Biométrico Dinâmico**: Usar o `facial_status` retornado pelo backend após a validação do código para decidir entre cadastro (`register`) ou verificação (`verify`).
4. **Melhorias na Câmera**: Adicionar verificações de prontidão da câmera e mensagens de estado ("Posicione seu rosto", "Validando...").
5. **Tratamento de Erros**: Exibir mensagens amigáveis para falhas comuns (rosto não detectado, anti-spoofing, serviço indisponível).

## Detalhes Técnicos

- **Segurança**: Tokens faciais expiram em 5 minutos e são de uso único (hash no banco).
- **Criptografia**: Embeddings faciais continuam protegidos por AES-256-GCM.
- **Biometria**: Integração com DeepFace (ArcFace) para registro e comparação.
- **Tabela `facial_auth_sessions`**:
    - `id`: uuid
    - `token_hash`: text (indexado)
    - `document_id`: uuid (FK)
    - `employee_id`: uuid (FK)
    - `expires_at`: timestamp
    - `used_at`: timestamp (null até uso)

## Passos de Verificação

1. Tentar código inválido ou de outro funcionário (deve falhar).
2. Tentar assinatura sem passar pela facial (deve falhar).
3. Realizar fluxo completo: Código válido -> Facial -> Assinatura (deve funcionar).
4. Tentar reutilizar token facial ou usar token expirado (deve falhar).
