
-- 1) Certificates table: remove blanket auth + anon SELECT policies.
DROP POLICY IF EXISTS "Auth read cert" ON public.certificates;
DROP POLICY IF EXISTS "Public read cert" ON public.certificates;
-- Owners/admins can still read via the existing "Owners manage cert" (FOR ALL) policy.

-- 2) Storage: certificates bucket — remove blanket SELECT policies.
DROP POLICY IF EXISTS "Auth read certificates" ON storage.objects;
DROP POLICY IF EXISTS "Public read certificates" ON storage.objects;

-- Owner-scoped read: only the uploader (folder prefix = auth.uid()) can read.
CREATE POLICY "Users read own certificates"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'certificates'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- 3) document_signers / documents: make anon access explicitly denied via RLS
-- so signer-facing flows must go through server code (service role) with token checks.
CREATE POLICY "Anon denied signers"
ON public.document_signers FOR SELECT TO anon
USING (false);

CREATE POLICY "Anon denied documents"
ON public.documents FOR SELECT TO anon
USING (false);

-- 4) has_role SECURITY DEFINER function: revoke direct EXECUTE from authenticated.
-- RLS policies referencing public.has_role continue to work because the function is
-- SECURITY DEFINER owned by postgres; direct RPC calls from signed-in clients are blocked.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
