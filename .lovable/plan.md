# Plano de Implementação: Reconhecimento Facial Local (Browser-side)

Substituiremos a dependência do serviço externo Python/DeepFace por processamento local no navegador do funcionário, utilizando a biblioteca `face-api.js` (baseada em TensorFlow.js).

## Alterações Técnicas

### Frontend (Browser)
- **Biblioteca**: `@vladmandic/face-api` (versão otimizada do face-api.js).
- **Modelos**: `tiny_face_detector` (performance em mobile), `face_landmark_68` (alinhamento) e `face_recognition` (geração de embedding).
- **Processamento**: O navegador carregará os modelos via WebAssembly/WebGPU, detectará o rosto, gerará o embedding (vetor de 128 números) e enviará apenas o embedding para o backend durante o cadastro ou validação.
- **Segurança**: O frontend não decide se o usuário está autenticado; ele apenas fornece o embedding para o backend validar contra o banco de dados.

### Backend (Server Functions)
- **Endpoints API**:
  - `/api/public/face/register`: Receberá o embedding gerado pelo browser, criptografará e salvará no banco.
  - `/api/public/face/verify`: Receberá o embedding gerado pelo browser, comparará com o embedding salvo (1:1) usando distância euclidiana e retornará o `facial_auth_token` se o threshold for respeitado.
- **Segurança**: Mantida a proteção via `facial_auth_sessions` para a assinatura final.

## Passos da Implementação

1.  **Instalação de Dependências**: Adicionar `@vladmandic/face-api` e `@tensorflow/tfjs-*`. (Concluído)
2.  **Distribuição de Modelos**: Colocar os arquivos binários dos modelos na pasta `public/models` para acesso direto pelo browser. (Concluído)
3.  **Utilitário de Biometria Client-side**: Criar `src/lib/face-api.client.ts` para abstrair o carregamento de modelos e geração de embeddings. (Concluído)
4.  **Refatoração da Interface de Assinatura**:
    - Atualizar `src/routes/sign.$token.tsx` para carregar modelos de forma lazy.
    - Implementar captura de vídeo e processamento local.
    - Substituir chamadas ao backend que enviavam imagens brutas por chamadas que enviam embeddings.
5.  **Refatoração dos Endpoints de Backend**:
    - Ajustar `/api/public/face/register` e `/api/public/face/verify` para aceitar `embedding` (array de numbers) em vez de `image` (base64).
    - Implementar a lógica de comparação 1:1 no servidor (para segurança) usando os embeddings.
6.  **Validação de Qualidade e Anti-spoofing**:
    - Implementar verificações de: exatamente um rosto, enquadramento central, distância adequada e iluminação.
    - Como o processamento é local, usaremos `landmarks` para garantir que o usuário não está usando uma foto estática (verificando pequenas variações se necessário, embora anti-spoofing completo no browser tenha limitações).

## Bibliotecas Escolhidas
- **@vladmandic/face-api**: Escolhida por ser a implementação mais estável e performática de reconhecimento facial para o navegador, com suporte a WebGL e WASM, ideal para rodar em dispositivos móveis Android e iOS (Safari) sem necessidade de app externo.
- **Threshold**: Utilizaremos o padrão de `0.6` (distância euclidiana) para o modelo ArcFace/FaceRecognition, que oferece um excelente equilíbrio entre segurança e usabilidade.

## Limpeza
- O diretório `/deepface-service` será mantido mas desativado.
- Nenhuma alteração será feita na lógica de `access_code`.
