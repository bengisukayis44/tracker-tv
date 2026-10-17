# Tracker.tv — Dizi & Film Takip

İzlediğin dizi ve filmleri takip ettiğin, bölümleri puanlayıp yorumladığın web uygulaması.
Geliştirme planı: `PROJE_PLANI.md` (6 faz). Tamamlanan fazlar: **Faz 1 (temel altyapı)**, **Faz 2 (içerik sayfaları)**.

## Sayfalar

| Yol | Sayfa |
|---|---|
| `/search?q=…&tur=hepsi\|dizi\|film` | Arama (film filtresi TMDB gelene kadar boş) |
| `/series/[id]?sezon=N` | Dizi detay + sezon/bölüm listesi (`id` = TVmaze kimliği) |
| `/series/[id]/season/[s]/episode/[e]` | Bölüm sayfası, önceki/sonraki bölüm |
| `/login`, `/register` | Giriş / kayıt |

## Teknolojiler

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Prisma 7 + PostgreSQL (Supabase, Frankfurt, ücretsiz plan) — `@prisma/adapter-pg`
- Auth.js (NextAuth v5): e-posta/şifre + isteğe bağlı Google
- İçerik verisi: TVmaze API (anahtarsız). TMDB + OMDb'ye ileride geçilecek.

## Kurulum

```bash
npm install
cp .env.example .env   # Supabase adreslerini ve AUTH_SECRET'i doldurun
npx prisma migrate deploy   # tabloları Supabase'e kurar (ilk kurulumda)
npm run dev            # http://localhost:3000
```

## Klasör yapısı

| Yol | İçerik |
|---|---|
| `prisma/schema.prisma` | Veri modeli |
| `src/auth.ts` | Auth.js yapılandırması |
| `src/app/(auth)/` | Giriş / kayıt sayfaları ve server action'lar |
| `src/lib/tvmaze.ts` | TVmaze API istemcisi |
| `src/lib/catalog.ts` | İçerik katmanı: TVmaze verisini veritabanına önbellekler |
| `src/app/api/search`, `src/app/api/series/[tvmazeId]` | Arama ve dizi detay JSON uçları |
| `legacy-vite/` | Eski Vite + localStorage sürümü (referans için) |

## Önbellekleme

Bir dizi ilk açıldığında TVmaze'den çekilip `Title` / `Season` / `Episode` tablolarına yazılır.
Sonraki isteklerde veritabanından okunur; devam eden diziler 1 günde, bitmiş diziler 7 günde bir yenilenir.
TVmaze'e ulaşılamazsa eski veri gösterilir.

## Veritabanı (Supabase)

- Proje: `tracker-tv` (Frankfurt, ücretsiz plan). Uygulama transaction pooler'a (`DATABASE_URL`, 6543),
  Prisma CLI session pooler'a (`DIRECT_URL`, 5432) bağlanır.
- Supabase `public` şemasını Data API (PostgREST) ile dışarı açtığı için **tüm tablolarda RLS açık ve politika yok**:
  anon/authenticated rolleri hiçbir satırı göremez. Uygulama tablo sahibi olarak bağlandığından etkilenmez.
  Yeni tablo eklerken migration'a `ALTER TABLE "..." ENABLE ROW LEVEL SECURITY;` eklemeyi unutmayın.
- Uzun dizilerin bölümleri tek tek değil, toplu SQL (`INSERT ... ON CONFLICT`) ile kaydedilir.

## Plandan sapmalar

- **JSON alanlar:** `genres` ve `emotions` SQLite döneminden kalma olarak JSON; PostgreSQL'de native
  dizilere (`String[]`, `Emotion[]`) çevrilebilir.
- **TVmaze:** TMDB/OMDb anahtarları alınana kadar. TVmaze'de film ve IMDb puanı yok; `imdbRating` alanları
  şimdilik boş kalıyor, `imdbId` ise dolduruluyor (OMDb geçişinde kullanılacak).
  Puan olarak şimdilik TVmaze kullanıcı puanı (`sourceRating`) gösteriliyor ve "TVmaze" etiketiyle işaretleniyor.
- **Auth.js modelleri:** `Account`, `Session`, `VerificationToken` ve `User` üzerinde `name`, `emailVerified`,
  `image` (avatar) ve `passwordHash` alanları eklendi.
