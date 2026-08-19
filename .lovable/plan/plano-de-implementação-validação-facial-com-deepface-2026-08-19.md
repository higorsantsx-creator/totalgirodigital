# Plano de Implementação: Validação Facial com DeepFace

Implementação do fluxo completo de identificação por código e validação biométrica facial para assinatura de documentos.

## Alterações no Banco de Dados
- **Tabela `clients`**: Adição de campos `facial_status`, `facial_embedding`, `facial_model` e `facial_registered_at`.
- **Tabela `facial_validation_logs`**: Criação para auditoria de tentativas de validação.
- **Segurança**: Políticas RLS para proteger dados biométricos.

## Integração Backend (DeepFace)
- **Serviço Externo**: Criação de um utilitário em `src/lib/facial.server.ts` para comunicação com a API DeepFace.
- **Novos Endpoints**:
  - `POST /api/public/face/register`: Registro inicial da face.
  - `POST /api/public/face/verify`: Verificação da identidade antes da assinatura.
- **Segurança**: Armazenamento apenas de embeddings, validação de anti-spoofing e tokens de sessão.

## Interface do Usuário (Frontend)
- **Painel Administrativo (`clients.tsx`)**:
  - Exibição do Código de Acesso e status facial.
  - Filtros por status facial (Pendente/Cadastrado).
  - Opção para resetar biometria.
- **Fluxo de Assinatura (`sign.$token.tsx`)**:
  - Nova etapa de identificação por código.
  - Interface de captura de câmera com guia visual e feedback em tempo real.
  - Integração com o processo de assinatura existente após validação.

## Detalhes Técnicos
- **DeepFace**: Utilização do modelo ArcFace (512 dimensões).
- **Anti-spoofing**: Verificação de vivacidade ativada no backend.
- **Responsividade**: Mobile-first para garantir funcionamento em smartphones.
