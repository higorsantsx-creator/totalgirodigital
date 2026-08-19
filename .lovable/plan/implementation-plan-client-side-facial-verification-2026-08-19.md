# Implementation Plan - Client-side Facial Verification

Implement a secure 1:1 facial verification flow using client-side processing (face-api.js/TensorFlow.js) to protect biometric privacy while maintaining server-side authorization.

## Proposed Changes

### 1. Client-side Biometric Processing
- Integrate `face-api.js` for browser-side face detection and embedding generation.
- Implement `src/lib/facial-client.ts` to handle model loading and face processing.
- Perform all biometric comparisons (1:1) in the browser whenever possible.

### 2. Signing Page Enhancements (src/routes/sign.$token.tsx)
- Add a clear consent screen before camera access.
- Implement local face detection to ensure a single, well-lit face is present.
- Generate facial embeddings locally for both registration and verification.
- Enforce the 4-digit access code identification before biometric steps.

### 3. Backend Security Hardening
- Update `/api/public/face/register` and `/api/public/face/verify` to accept locally generated embeddings.
- Ensure embeddings are transmitted over HTTPS and stored encrypted using existing AES-256-GCM logic.
- Maintain the `facial_auth_token` (5-minute TTL, single-use) for final signature authorization.

### 4. Privacy & UX
- Provide clear feedback for common failures (low light, multiple faces, blocked camera).
- Ensure no raw images or raw embeddings are exposed in frontend state beyond what's needed for the current transaction.

## Technical Details
- **Library:** `face-api.js` (WebAssembly/WebGL) for performance on mobile (Android/iOS).
- **Security:** Server-side decryption of stored embeddings for comparison; frontend never sees the stored embedding.
- **Workflow:** 
  1. Access Code (Identification) -> 
  2. Consent -> 
  3. Local Capture/Embedding -> 
  4. Server Verification (against encrypted reference) -> 
  5. `facial_auth_token` -> 
  6. Sign PDF.
