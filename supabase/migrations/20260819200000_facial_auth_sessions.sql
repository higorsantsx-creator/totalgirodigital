CREATE TABLE public.facial_auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT NOT NULL,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_facial_auth_sessions_token_hash ON public.facial_auth_sessions(token_hash);
CREATE INDEX idx_facial_auth_sessions_document_id ON public.facial_auth_sessions(document_id);
CREATE INDEX idx_facial_auth_sessions_employee_id ON public.facial_auth_sessions(employee_id);
CREATE INDEX idx_facial_auth_sessions_expires_at ON public.facial_auth_sessions(expires_at);

ALTER TABLE public.facial_auth_sessions ENABLE ROW LEVEL SECURITY;

-- Only server-side access via service_role (supabaseAdmin)
GRANT ALL ON public.facial_auth_sessions TO service_role;
GRANT SELECT ON public.facial_auth_sessions TO authenticated;

-- Policies: only service_role can do everything (default), 
-- but we'll add a dummy policy for authenticated if needed, though we use supabaseAdmin.
CREATE POLICY "Service role only" ON public.facial_auth_sessions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
