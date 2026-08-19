ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS access_code text;
GRANT ALL ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;