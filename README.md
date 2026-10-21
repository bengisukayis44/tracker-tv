# Tracker.tv — Dizi & Film Takip

İzlediğin dizi ve filmleri takip ettiğin, bölümleri puanlayıp yorumladığın web uygulaması.
Geliştirme planı: `PROJE_PLANI.md` (6 faz). Tamamlanan fazlar: **Faz 1 (temel altyapı)**, **Faz 2 (içerik sayfaları)**, **Faz 3 (izleme takibi)**.

## İzleme takibi (Faz 3)

- **İzledim** (bölüm sayfası): 1–10 puan, birden fazla duygu (10 seçenek, emojili), sadece kullanıcının gördüğü kişisel not.
  Sonradan düzenlenebilir ya da "İzlenmedi olarak işaretle" ile geri alınabilir.
- Bölüm listesinde tek tıkla izlendi işareti, "Sezonun tamamını izledim" (yalnızca yayınlanmış bölümler) ve geri alma.
- Bir bölüm işaretlenince, öncesinde izlenmemiş yayınlanmış bölüm varsa "Önceki N bölümü de izledin mi?" diye sorulur.
- Dizi sayfasında ilerleme çubuğu ("5/12 bölüm izlendi"), **Favorilere ekle** ve **Daha sonra izle**.
  Diziden bir bölüm izlenince dizi "Daha sonra izle" listesinden otomatik çıkar (favoriler kalır).
- Giriş yapmamış ziyaretçi bu düğmelere basınca giriş sayfasına, girişten sonra aynı sayfaya döner.

## Canlı site

**https://tracker-tv-seven.vercel.app** — Vercel (Hobby plan), sunucu bölgesi Frankfurt (`vercel.json`, veritabanının yanında).
Elle yayın: `vercel deploy --prod`. Canlı siteye karşı test: `E2E_BASE_URL=https://tracker-tv-seven.vercel.app npm run test:e2e`.
Vercel ortam değişkenleri: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `OMDB_API_KEY`
(`DIRECT_URL` ve `SUPABASE_SECRET_KEY` canlıda gerekmez, eklenmemeli).

## Sayfalar

| Yol | Sayfa |
|---|---|
| `/search?q=…&tur=hepsi\|dizi\|film` | Arama (film filtresi, film kaynağı eklenene kadar boş) |
| `/series/[id]` | Dizi detay + ilk sezonun bölümleri (`id` = TMDB dizi kimliği) |
| `/series/[id]/season/[s]` | Aynı sayfa, seçili sezonla (eski `?sezon=N` adresleri buraya yönlenir) |
| `/series/[id]/season/[s]/episode/[e]` | Bölüm sayfası, önceki/sonraki bölüm |
| `/login`, `/register` | Giriş (e-posta veya kullanıcı adı) / kayıt |

## Teknolojiler

- Next.js 15 (App Router) + TypeScript, Tailwind CSS 4 + shadcn/ui
- Supabase: PostgreSQL (Frankfurt, ücretsiz plan) + Supabase Auth (e-posta/şifre, e-posta doğrulaması kapalı)
- Prisma 7 (`@prisma/adapter-pg`)
- İçerik: TMDB API (`TMDB_API_KEY`, Türkçe; çevirisi olmayan bölümlerde İngilizce) · IMDb puanları: OMDb API (`OMDB_API_KEY`)
- Testler: Vitest (birim) + Playwright (uçtan uca, masaüstü ve mobil)

## Kurulum

```bash
npm install
cp .env.example .env        # Supabase adresleri/anahtarları ve OMDb anahtarını doldurun
npx prisma migrate deploy   # tabloları Supabase'e kurar (ilk kurulumda)
npm run dev                 # http://localhost:3000
```

## Testler

```bash
npm test             # birim testleri (Vitest) — saniyeler sürer, ağ gerektirmez
npm run test:e2e     # uçtan uca testler (Playwright) — üretim derlemesi alıp 3100 portunda çalıştırır
```

Uçtan uca testler gerçek Supabase veritabanını ve TMDB'yi kullanır. Her test işçisi `@e2e.test` ile biten
hesaplarını Supabase Admin API ile bir kez açar (`SUPABASE_SECRET_KEY` gerekir, yalnızca `.env`'de durur),
her testten önce o hesabın izleme verisini sıfırlar ve tur bitince hesapları siler. İlk kez çalıştırmadan önce: `npx playwright install chromium`.
GitHub'da her push'ta lint, tip kontrolü, birim testleri ve derleme otomatik çalışır (`.github/workflows/ci.yml`);
uçtan uca testler gizli anahtar gerektirdiği için şimdilik yalnızca yerelde çalışır.

## Klasör yapısı

| Yol | İçerik |
|---|---|
| `prisma/schema.prisma` | Veri modeli |
| `prisma/migrations/` | Migration'lar (RLS ve Supabase Auth tetikleyicileri dahil) |
| `supabase/config.toml` | Supabase Auth ayarları (`supabase config push` ile uygulanır) |
| `src/middleware.ts`, `src/lib/supabase/`, `src/lib/auth.ts` | Oturum yenileme ve oturumdaki kullanıcı |
| `src/app/(auth)/` | Giriş / kayıt sayfaları ve server action'lar |
| `src/lib/tmdb.ts`, `src/lib/omdb.ts` | Dış API istemcileri |
| `src/lib/catalog.ts` | İçerik katmanı: TMDB ve OMDb verisini veritabanına önbellekler |
| `tests/unit/`, `tests/e2e/` | Birim ve uçtan uca testler |
| `legacy-vite/` | Eski Vite + localStorage sürümü (referans için) |

## Kimlik doğrulama (Supabase Auth)

- Şifreler ve oturumlar Supabase Auth'ta (`auth.users`). Uygulamanın `User` tablosu profil tablosudur;
  `auth.users`'a eklenen/silinen her kullanıcı için veritabanı tetikleyicisi profili oluşturur/siler.
- Kayıtta seçilen kullanıcı adı Supabase'e metadata olarak gider; tetikleyici onu profile yazar.
- E-posta doğrulaması kapalı: Supabase'in hazır e-posta servisi yalnızca ekip üyelerine, saatte 2 e-posta
  gönderebiliyor. Şifre sıfırlama gibi e-postalar için ileride özel bir SMTP (ör. Resend) bağlanmalı.
- Ücretsiz plan: ayda 50.000 aktif kullanıcı.
- Giriş/kayıt istekleri Supabase'e sunucudan (Vercel) gittiği için Supabase'in IP başına sınırı fiilen site geneli
  bir sınırdır; `supabase/config.toml` içinde 5 dakikada 150 olarak ayarlandı. Trafik artarsa yeniden değerlendirin.
- Çıkış yalnızca o tarayıcıdaki oturumu kapatır (diğer cihazlar açık kalır).

## Veritabanı (Supabase)

- Uygulama transaction pooler'a (`DATABASE_URL`, 6543), Prisma CLI session pooler'a (`DIRECT_URL`, 5432) bağlanır.
- Supabase `public` şemasını Data API ile dışarı açtığı için **tüm tablolarda RLS açık ve politika yok**:
  anon/authenticated rolleri hiçbir satırı göremez. Uygulama tablo sahibi olarak bağlandığından etkilenmez.
  Yeni tablo eklerken migration'a `ALTER TABLE "..." ENABLE ROW LEVEL SECURITY;` eklemeyi unutmayın.
- Ücretsiz plan: 500 MB veritabanı, 5 GB trafik; proje 1 hafta kullanılmazsa duraklatılır (panelden açılır).

## Önbellekleme

- Bir dizi ilk açıldığında TMDB'den çekilip `Title` / `Season` / `Episode` tablolarına toplu SQL ile yazılır
  (sezonlar 20'şerli tek istekle). Kayıtlı dizi her zaman anında gösterilir; devam edenler 1 günde, bitmiş/iptal
  edilenler 7 günde bir arka planda yenilenir. Hiç açılmamış dizi 10 sn'de gelmezse "Dizi hazırlanıyor" sayfası çıkar.
- Bölümler (sezon, bölüm no) ile eşleşir; kaynakta artık olmayan bölümler yalnızca kimse izlememişse silinir.
- IMDb puanları sayfa gönderildikten sonra arka planda OMDb'den çekilir (dizi başına 1 + sezon sayısı istek)
  ve 7 gün saklanır. OMDb ücretsiz anahtarı günde 1.000 istek verir; limit dolarsa ertesi gün tekrar denenir.
- Arama sonuçları veritabanında 24 saat tutulur; kaynak 4 sn'de yanıt vermezse kayıtlı diziler gösterilir ve arama
  arka planda tamamlanır. IMDb puanı yoksa TMDB puanı gösterilir; kaynak her zaman yazılır.

## Plandan sapmalar

- **Veri kaynağı:** İlk sürüm TVmaze kullanıyordu; 21 Ekim 2026'da TMDB'ye taşındı (`npm run migrate:tmdb`,
  izleme geçmişi korunarak). Film sayfaları henüz yok. Sayfa altında TMDB'nin istediği logo ve atıf yer alır.
- **Sezon adresi:** `/series/[id]/season/[s]` (planda yoktu). Next.js 15.5'te yalnızca `?sezon=` değişen
  gezinmeler ekrana gelmiyordu. Aynı nedenle dizi/sezon sayfalarında `loading.tsx` ya da `Suspense` yok: ikisi de
  sekme geçişlerini ve "izledim" sonrası ilerleme güncellemesini ekrana yansıtmıyordu.
- **Filmler:** `WatchedMovie` tablosu hazır, film kaynağı eklenince kullanılacak.
