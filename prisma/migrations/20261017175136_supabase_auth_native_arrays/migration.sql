-- Auth.js -> Supabase Auth: drop Auth.js tables, slim down the User profile table
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";
DROP TABLE "Account";
DROP TABLE "Session";
DROP TABLE "VerificationToken";

ALTER TABLE "User" DROP COLUMN "emailVerified",
DROP COLUMN "image",
DROP COLUMN "name",
DROP COLUMN "passwordHash",
ADD COLUMN     "avatarUrl" TEXT;

-- JSON arrays -> native arrays, keeping existing values (USING cannot contain a subquery)
ALTER TABLE "Title" ADD COLUMN "genres_new" TEXT[] DEFAULT ARRAY[]::TEXT[];
UPDATE "Title" SET "genres_new" = ARRAY(SELECT jsonb_array_elements_text("genres"))
  WHERE jsonb_typeof("genres") = 'array';
ALTER TABLE "Title" DROP COLUMN "genres";
ALTER TABLE "Title" RENAME COLUMN "genres_new" TO "genres";
ALTER TABLE "Title" ADD COLUMN "imdbSyncedAt" TIMESTAMP(3);

-- No emotions are stored yet (izleme takibi Faz 3), so these columns are simply recreated
ALTER TABLE "WatchedEpisode" DROP COLUMN "emotions",
ADD COLUMN     "emotions" "Emotion"[] DEFAULT ARRAY[]::"Emotion"[];
ALTER TABLE "WatchedMovie" DROP COLUMN "emotions",
ADD COLUMN     "emotions" "Emotion"[] DEFAULT ARRAY[]::"Emotion"[];

-- Keep public."User" in sync with Supabase Auth (auth.users).
-- Guarded because Prisma's shadow database (used by `migrate dev`) has no auth schema.
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    RETURN;
  END IF;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
    AS $body$
    DECLARE
      wanted text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
    BEGIN
      -- Fall back to a generated name if the requested one is invalid or already taken
      IF wanted !~ '^[a-z0-9_]{3,20}$'
         OR EXISTS (SELECT 1 FROM public."User" u WHERE u.username = wanted) THEN
        wanted := 'kullanici_' || substr(replace(new.id::text, '-', ''), 1, 8);
      END IF;
      INSERT INTO public."User" (id, email, username) VALUES (new.id::text, new.email, wanted);
      RETURN new;
    END;
    $body$;
  $fn$;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.handle_updated_auth_user()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
    AS $body$
    BEGIN
      UPDATE public."User" SET email = new.email WHERE id = new.id::text;
      RETURN new;
    END;
    $body$;
  $fn$;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.handle_deleted_auth_user()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
    AS $body$
    BEGIN
      DELETE FROM public."User" WHERE id = old.id::text;
      RETURN old;
    END;
    $body$;
  $fn$;

  -- Only the auth triggers may call these
  EXECUTE 'REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated';
  EXECUTE 'REVOKE ALL ON FUNCTION public.handle_updated_auth_user() FROM PUBLIC, anon, authenticated';
  EXECUTE 'REVOKE ALL ON FUNCTION public.handle_deleted_auth_user() FROM PUBLIC, anon, authenticated';

  EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users';
  EXECUTE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
           FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user()';
  EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users';
  EXECUTE 'CREATE TRIGGER on_auth_user_email_updated AFTER UPDATE OF email ON auth.users
           FOR EACH ROW EXECUTE FUNCTION public.handle_updated_auth_user()';
  EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users';
  EXECUTE 'CREATE TRIGGER on_auth_user_deleted AFTER DELETE ON auth.users
           FOR EACH ROW EXECUTE FUNCTION public.handle_deleted_auth_user()';
END
$migration$;
