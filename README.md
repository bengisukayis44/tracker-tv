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
- Prisma 7 + SQLite (libSQL sürücüsü) — PostgreSQL'e geçiş için bkz. aşağısı
- Auth.js (NextAuth v5): e-posta/şifre + isteğe bağlı Google
- İçerik verisi: TVmaze API (anahtarsız). TMDB + OMDb'ye ileride geçilecek.

## Kurulum

```bash
npm install
cp .env.example .env   # ardından AUTH_SECRET'i doldurun: openssl rand -base64 32
npm run db:migrate     # veritabanını oluşturur
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

## Plandan sapmalar

- **SQLite:** Yerelde kurulum gerektirmemesi için. SQLite liste alanlarını desteklemediğinden `genres` ve
  `emotions` JSON olarak saklanıyor. PostgreSQL'e geçmek için `schema.prisma`'da `provider = "postgresql"`,
  `src/lib/prisma.ts`'te `@prisma/adapter-pg` kullanın ve `DATABASE_URL`'i değiştirin.
- **TVmaze:** TMDB/OMDb anahtarları alınana kadar. TVmaze'de film ve IMDb puanı yok; `imdbRating` alanları
  şimdilik boş kalıyor, `imdbId` ise dolduruluyor (OMDb geçişinde kullanılacak).
  Puan olarak şimdilik TVmaze kullanıcı puanı (`sourceRating`) gösteriliyor ve "TVmaze" etiketiyle işaretleniyor.
- **Auth.js modelleri:** `Account`, `Session`, `VerificationToken` ve `User` üzerinde `name`, `emailVerified`,
  `image` (avatar) ve `passwordHash` alanları eklendi.
