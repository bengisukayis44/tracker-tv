-- Private profiles
ALTER TABLE "User" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- Profile photos in Supabase Storage: a public "avatars" bucket where each signed-in user may only write
-- inside a folder named after their own id. Skipped outside Supabase (no storage schema).
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('avatars', 'avatars', true, 1048576, ARRAY['image/webp'])
  ON CONFLICT (id) DO NOTHING;

  EXECUTE $p$
    CREATE POLICY "avatars: kendi klasörüne yükle" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  $p$;
  EXECUTE $p$
    CREATE POLICY "avatars: kendi dosyasını güncelle" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  $p$;
  EXECUTE $p$
    CREATE POLICY "avatars: kendi dosyasını sil" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  $p$;
  -- Listing one's own folder (to remove old photos)
  EXECUTE $p$
    CREATE POLICY "avatars: kendi klasörünü listele" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  $p$;
END
$migration$;
