ALTER TABLE public.documents ALTER COLUMN recipient_email DROP NOT NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS signer_typed_name text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS recipient_phone text;