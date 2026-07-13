-- =========================================================
-- Enums novos
-- =========================================================
CREATE TYPE public.signer_status AS ENUM ('aguardando','visualizado','assinado','recusado','expirado');
CREATE TYPE public.field_type AS ENUM ('signature','initial','name','cpf','company','role','date','text','checkbox');
CREATE TYPE public.signing_mode AS ENUM ('parallel','sequential');
CREATE TYPE public.event_type AS ENUM (
  'created','uploaded','sent','email_delivered','opened','viewed','signing_started',
  'signed','declined','expired','cancelled','downloaded','certificate_generated','reminder_sent'
);
CREATE TYPE public.notification_type AS ENUM (
  'document_sent','document_viewed','document_signed','document_declined',
  'document_expired','document_cancelled','reminder','system'
);

-- =========================================================
-- CLIENTS
-- =========================================================
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  company text,
  document text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage clients" ON public.clients FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- FOLDERS
-- =========================================================
CREATE TABLE public.folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#E30613',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folders TO authenticated;
GRANT ALL ON public.folders TO service_role;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage folders" ON public.folders FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_folders_updated BEFORE UPDATE ON public.folders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- TAGS + DOCUMENT_TAGS
-- =========================================================
CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#1E3A8A',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT ALL ON public.tags TO service_role;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage tags" ON public.tags FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.document_tags (
  document_id uuid NOT NULL,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_tags TO authenticated;
GRANT ALL ON public.document_tags TO service_role;
ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doc-tag via owner" ON public.document_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- =========================================================
-- TEMPLATES
-- =========================================================
CREATE TABLE public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  file_path text NOT NULL,
  fields_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  signers_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT ALL ON public.templates TO service_role;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage templates" ON public.templates FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Extensões em DOCUMENTS
-- =========================================================
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS signing_mode public.signing_mode NOT NULL DEFAULT 'parallel',
  ADD COLUMN IF NOT EXISTS certificate_id uuid;

-- =========================================================
-- DOCUMENT_SIGNERS
-- =========================================================
CREATE TABLE public.document_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  name text NOT NULL,
  email text NOT NULL,
  cpf text,
  company text,
  role text,
  status public.signer_status NOT NULL DEFAULT 'aguardando',
  access_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32),'hex') UNIQUE,
  signature_path text,
  signed_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  viewed_at timestamptz,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_signers TO authenticated;
GRANT ALL ON public.document_signers TO service_role;
ALTER TABLE public.document_signers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signers via doc owner" ON public.document_signers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE TRIGGER trg_signers_updated BEFORE UPDATE ON public.document_signers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_signers_document ON public.document_signers(document_id);

-- =========================================================
-- DOCUMENT_FIELDS
-- =========================================================
CREATE TABLE public.document_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  signer_id uuid REFERENCES public.document_signers(id) ON DELETE CASCADE,
  type public.field_type NOT NULL,
  page int NOT NULL DEFAULT 1,
  x numeric NOT NULL,
  y numeric NOT NULL,
  w numeric NOT NULL DEFAULT 0.2,
  h numeric NOT NULL DEFAULT 0.05,
  required boolean NOT NULL DEFAULT true,
  label text,
  value text,
  filled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_fields TO authenticated;
GRANT ALL ON public.document_fields TO service_role;
ALTER TABLE public.document_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fields via doc owner" ON public.document_fields FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE INDEX idx_fields_document ON public.document_fields(document_id);

-- =========================================================
-- DOCUMENT_COMMENTS
-- =========================================================
CREATE TABLE public.document_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.document_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  mentions uuid[] DEFAULT '{}',
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_comments TO authenticated;
GRANT ALL ON public.document_comments TO service_role;
ALTER TABLE public.document_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments via doc owner" ON public.document_comments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))) AND author_id = auth.uid());

-- =========================================================
-- DOCUMENT_ATTACHMENTS
-- =========================================================
CREATE TABLE public.document_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  file_path text NOT NULL,
  name text NOT NULL,
  mime text,
  size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_attachments TO authenticated;
GRANT ALL ON public.document_attachments TO service_role;
ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attachments via doc owner" ON public.document_attachments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- =========================================================
-- DOCUMENT_EVENTS
-- =========================================================
CREATE TABLE public.document_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  signer_id uuid REFERENCES public.document_signers(id) ON DELETE SET NULL,
  type public.event_type NOT NULL,
  actor text,
  ip text,
  user_agent text,
  os text,
  browser text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.document_events TO authenticated;
GRANT ALL ON public.document_events TO service_role;
ALTER TABLE public.document_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events read via doc owner" ON public.document_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Events insert via doc owner" ON public.document_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE INDEX idx_events_document ON public.document_events(document_id, created_at DESC);

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  body text,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- =========================================================
-- EMAIL_LOG
-- =========================================================
CREATE TABLE public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  signer_id uuid REFERENCES public.document_signers(id) ON DELETE SET NULL,
  template text NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.email_log TO authenticated;
GRANT ALL ON public.email_log TO service_role;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Email log via doc owner" ON public.email_log FOR SELECT TO authenticated
  USING (document_id IS NULL OR EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- =========================================================
-- CERTIFICATES
-- =========================================================
CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL UNIQUE REFERENCES public.documents(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE DEFAULT upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,16)),
  sha256 text NOT NULL,
  pdf_path text,
  qr_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.certificates TO anon;
GRANT SELECT, INSERT, UPDATE ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read cert" ON public.certificates FOR SELECT TO anon USING (true);
CREATE POLICY "Auth read cert" ON public.certificates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners manage cert" ON public.certificates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

ALTER TABLE public.documents
  ADD CONSTRAINT documents_certificate_fk
  FOREIGN KEY (certificate_id) REFERENCES public.certificates(id) ON DELETE SET NULL;

-- =========================================================
-- AUDIT_LOGS
-- =========================================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  ip text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Users insert own audit" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_audit_user_time ON public.audit_logs(user_id, created_at DESC);

-- =========================================================
-- APP_SETTINGS
-- =========================================================
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text DEFAULT 'Grupo Total Giro',
  logo_url text,
  favicon_url text,
  primary_color text DEFAULT '#1E3A8A',
  secondary_color text DEFAULT '#E30613',
  footer text,
  email_templates jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own settings" ON public.app_settings FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Índices adicionais em documents
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_documents_owner_status ON public.documents(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON public.documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_client ON public.documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_deleted ON public.documents(deleted_at);