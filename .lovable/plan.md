# Plan - Fix Public Signing API Routes

The system is experiencing a critical error on the document signing page because the corresponding public API routes are missing from the file system, even though they are referenced in the client code and the route tree. I will restore these API routes to handle document loading, code validation, and signature confirmation.

## User Review Required

> [!IMPORTANT]
> The document signing workflow relies on these API endpoints to verify employee identity via a unique code and facial biometrics. Restoring them will re-enable the public signing link functionality.

- **No critical questions at this stage.** The missing files are a clear regression that needs fixing to restore application functionality.

## Proposed Changes

### Backend (API Routes)

#### [Restoration] API Endpoints
- Create `src/routes/api/public/sign.$token.ts`: Handles GET requests to fetch document metadata for the signer.
- Create `src/routes/api/public/sign.$token.validate-code.ts`: Handles POST requests to verify the employee's 4-digit access code.
- Create `src/routes/api/public/sign.$token.confirm.ts`: Handles POST requests to finalize the signature or record a refusal, including facial validation token verification.

### Technical Details
- All routes will use `createFileRoute` with a `server` handler block.
- **GET `/api/public/sign/$token`**:
    - Fetches document by access token using `supabaseAdmin` to bypass RLS for public access.
    - Joins with `clients` to provide context.
- **POST `/api/public/sign/$token/validate-code`**:
    - Validates that the provided `access_code` matches the one stored for the employee associated with the document.
    - Returns minimal employee info needed for the facial step.
- **POST `/api/public/sign/$token/confirm`**:
    - Verifies the `facial_auth_token` using `facialService.validateFacialAuthToken`.
    - Handles PDF stamping via `src/lib/pdf-sign.server.ts`.
    - Updates document status and records audit logs.

## Verification Plan

### Automated Tests
- Run `bun run build` to ensure the new routes are correctly picked up by the TanStack Router generator and the build succeeds.

### Manual Verification
- Navigate to the `/sign/$token` route in the preview.
- Verify the document loads (GET endpoint).
- Enter a valid 4-digit code and verify it proceeds to the facial step (validate-code endpoint).
- Complete the signing process and verify the success state (confirm endpoint).
