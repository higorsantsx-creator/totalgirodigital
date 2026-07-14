
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE ALL ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- clients
DROP POLICY IF EXISTS "Owners manage clients" ON public.clients;
CREATE POLICY "Owners manage clients" ON public.clients
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR app_private.has_role(auth.uid(), 'admin'::public.app_role) OR app_private.has_role(auth.uid(), 'manager'::public.app_role))
  WITH CHECK (auth.uid() = owner_id OR app_private.has_role(auth.uid(), 'admin'::public.app_role) OR app_private.has_role(auth.uid(), 'manager'::public.app_role));

-- folders
DROP POLICY IF EXISTS "Owners manage folders" ON public.folders;
CREATE POLICY "Owners manage folders" ON public.folders
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR app_private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (auth.uid() = owner_id OR app_private.has_role(auth.uid(), 'admin'::public.app_role));

-- tags
DROP POLICY IF EXISTS "Owners manage tags" ON public.tags;
CREATE POLICY "Owners manage tags" ON public.tags
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR app_private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (auth.uid() = owner_id OR app_private.has_role(auth.uid(), 'admin'::public.app_role));

-- document_tags
DROP POLICY IF EXISTS "Doc-tag via owner" ON public.document_tags;
CREATE POLICY "Doc-tag via owner" ON public.document_tags
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_tags.document_id AND (d.owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::public.app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_tags.document_id AND (d.owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::public.app_role))));

-- templates
DROP POLICY IF EXISTS "Owners manage templates" ON public.templates;
CREATE POLICY "Owners manage templates" ON public.templates
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR app_private.has_role(auth.uid(), 'admin'::public.app_role) OR app_private.has_role(auth.uid(), 'manager'::public.app_role))
  WITH CHECK (auth.uid() = owner_id OR app_private.has_role(auth.uid(), 'admin'::public.app_role) OR app_private.has_role(auth.uid(), 'manager'::public.app_role));

-- document_signers
DROP POLICY IF EXISTS "Signers via doc owner" ON public.document_signers;
CREATE POLICY "Signers via doc owner" ON public.document_signers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_signers.document_id AND (d.owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::public.app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_signers.document_id AND (d.owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::public.app_role))));

-- document_fields
DROP POLICY IF EXISTS "Fields via doc owner" ON public.document_fields;
CREATE POLICY "Fields via doc owner" ON public.document_fields
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_fields.document_id AND (d.owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::public.app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_fields.document_id AND (d.owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::public.app_role))));

-- document_comments
DROP POLICY IF EXISTS "Comments via doc owner" ON public.document_comments;
CREATE POLICY "Comments via doc owner" ON public.document_comments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_comments.document_id AND (d.owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::public.app_role))))
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_comments.document_id AND (d.owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::public.app_role)))
    AND author_id = auth.uid()
  );

-- document_attachments
DROP POLICY IF EXISTS "Attachments via doc owner" ON public.document_attachments;
CREATE POLICY "Attachments via doc owner" ON public.document_attachments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_attachments.document_id AND (d.owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::public.app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_attachments.document_id AND (d.owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::public.app_role))));

-- document_events
DROP POLICY IF EXISTS "Events read via doc owner" ON public.document_events;
CREATE POLICY "Events read via doc owner" ON public.document_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_events.document_id AND (d.owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::public.app_role))));

DROP POLICY IF EXISTS "Events insert via doc owner" ON public.document_events;
CREATE POLICY "Events insert via doc owner" ON public.document_events
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_events.document_id AND (d.owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::public.app_role))));

-- email_log
DROP POLICY IF EXISTS "Email log via doc owner" ON public.email_log;
CREATE POLICY "Email log via doc owner" ON public.email_log
  FOR SELECT TO authenticated
  USING (document_id IS NULL OR EXISTS (SELECT 1 FROM public.documents d WHERE d.id = email_log.document_id AND (d.owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::public.app_role))));

-- certificates
DROP POLICY IF EXISTS "Owners manage cert" ON public.certificates;
CREATE POLICY "Owners manage cert" ON public.certificates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = certificates.document_id AND (d.owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::public.app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = certificates.document_id AND (d.owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::public.app_role))));

-- audit_logs
DROP POLICY IF EXISTS "Users see own audit" ON public.audit_logs;
CREATE POLICY "Users see own audit" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::public.app_role) OR app_private.has_role(auth.uid(), 'manager'::public.app_role));

-- Now safe to drop the old helper
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- Lock down handle_new_user
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
