-- Enable vector extension if not present
CREATE EXTENSION IF NOT EXISTS vector;

-- Update clients table with facial validation fields
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS facial_status text DEFAULT 'pending' CHECK (facial_status IN ('pending', 'registered')),
ADD COLUMN IF NOT EXISTS facial_embedding vector(512),
ADD COLUMN IF NOT EXISTS facial_model text DEFAULT 'ArcFace',
ADD COLUMN IF NOT EXISTS facial_registered_at timestamptz;

-- Facial validation logs table
CREATE TABLE IF NOT EXISTS public.facial_validation_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
    success boolean NOT NULL,
    failure_reason text,
    metadata jsonb,
    created_at timestamptz DEFAULT now()
);

-- RLS for logs
ALTER TABLE public.facial_validation_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.facial_validation_logs TO authenticated;
GRANT ALL ON public.facial_validation_logs TO service_role;

CREATE POLICY "Users can view logs for their employees" ON public.facial_validation_logs
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.clients 
            WHERE clients.id = facial_validation_logs.employee_id 
            AND clients.owner_id = auth.uid()
        )
    );
