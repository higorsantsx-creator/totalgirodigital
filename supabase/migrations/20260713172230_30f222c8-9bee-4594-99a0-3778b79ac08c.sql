-- Templates: dono acessa arquivos em sua pasta
CREATE POLICY "Users manage own templates" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'templates' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'templates' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Certificates: leitura pública (documento validado por código), escrita apenas dono
CREATE POLICY "Public read certificates" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'certificates');
CREATE POLICY "Auth read certificates" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'certificates');
CREATE POLICY "Users write own certificates" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificates' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own certificates" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'certificates' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Attachments: dono acessa arquivos em sua pasta
CREATE POLICY "Users manage own attachments" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Branding: dono acessa
CREATE POLICY "Users manage own branding" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text);