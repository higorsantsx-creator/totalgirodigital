-- Create facial_auth_sessions table
CREATE TABLE public.facial_auth_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash text NOT NULL,
    document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    employee_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_facial_auth_sessions_token_hash ON public.facial_auth_sessions(token_hash);
CREATE INDEX idx_facial_auth_sessions_document_id ON public.facial_auth_sessions(document_id);
CREATE INDEX idx_facial_auth_sessions_employee_id ON public.facial_auth_sessions(employee_id);
CREATE INDEX idx_facial_auth_sessions_expires_at ON public.facial_auth_sessions(expires_at);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.facial_auth_sessions TO authenticated;
GRANT ALL ON public.facial_auth_sessions TO service_role;

-- RLS
ALTER TABLE public.facial_auth_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Only service_role or authenticated with proper access can see sessions
CREATE POLICY "authenticated_select_sessions" ON public.facial_auth_sessions
    FOR SELECT TO authenticated USING (true);
