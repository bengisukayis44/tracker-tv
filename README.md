# Tracker.tv — Dizi & Film Takip

İzlediğin dizi ve filmleri takip ettiğin, bölümleri puanlayıp yorumladığın web uygulaması.
Geliştirme planı: `PROJE_PLANI.md` (6 faz). Tamamlanan fazlar: **Faz 1 (temel altyapı)**, **Faz 2 (içerik sayfaları)**, **Faz 3 (izleme takibi)**, **Faz 4 (yorumlar)**, **Faz 5 (profil ve listeler)**.

## İzleme takibi (Faz 3)

- **İzledim** (bölüm sayfası): 1–10 puan, birden fazla duygu (10 seçenek, emojili), sadece kullanıcının gördüğü kişisel not.
  Sonradan düzenlenebilir ya da "İzlenmedi olarak işaretle" ile geri alınabilir.
- Bölüm listesinde tek tıkla izlendi işareti, "Sezonun tamamını izledim" (yalnızca yayınlanmış bölümler) ve geri alma.
- Bir bölüm işaretlenince, öncesinde izlenmemiş yayınlanmış bölüm varsa "Önceki N bölümü de izledin mi?" diye sorulur.
- Dizi sayfasında ilerleme çubuğu ("5/12 bölüm izlendi"), **Favorilere ekle** ve **Daha sonra izle**.
  Diziden bir bölüm izlenince dizi "Daha sonra izle" listesinden otomatik çıkar (favoriler kalır).
- İzledim penceresinde **favori karakter** de seçilebilir (dizinin/filmin oyuncu kadrosundan, tek seçim;
  seçiliye tekrar basınca kaldırılır). Sunucu yalnızca o kadrodaki birini kabul eder.
- Giriş yapmamış ziyaretçi bu düğmelere basınca giriş sayfasına, girişten sonra aynı sayfaya döner.

## Profil ve listeler (Faz 5)

- **Profil** (`/profile/[kullanıcı adı]`, hesap menüsünde "Profilim"): dizi ve film için ayrı toplam izleme süresi
  ("3 ay 2 gün 4 saat"; 1 ay = 30 gün, sıfır birimler yazılmaz), izlenen bölüm ve film sayısı. Süresi bilinmeyen
  bölüm dizinin ortalama bölüm süresiyle sayılır.
- Sekmeler: İzlediğim Diziler (ilerlemeyle), İzlediğim Filmler, Favorilerim (Favori Diziler / Favori Filmler ayrı),
  Yorumlarım ("Sherlock — S1 B3: Büyük Oyun" bağlantısıyla), Daha Sonra İzle. Sekmeler tarayıcıda değişir,
  adres `?sekme=` ile güncellenir. Profil herkese açık (kişisel notlar hariç); başkasının profilinde spoiler'lar gizli.
- **İzleme listem** (`/watchlist`), ana sayfada da ilk 6'şar öğesi:
  - **İzlemeye devam et:** başlanan diziler (son izlenen bölüm ve tarihi, sıradaki bölüm, tek tıkla işaretleme)
    ve "Daha sonra izle" listesine eklenen diziler (ilk bölümden; Kaldır ile listeden çıkar). En son hareket üstte.
  - **Yakında:** takip edilen dizilerin (izlenen ya da listedeki) sıradaki yayınlanmamış bölümü ve listedeki vizyona
    girmemiş filmler, "Bugün / Yarın / 3 gün sonra" geri sayımıyla, en yakın üstte. Sayfa açılınca eskimiş takip
    edilen diziler (en fazla 5) arka planda TMDB'den yenilenir, böylece yeni bölüm tarihleri gelir.
  - **Daha sonra izle:** yukarıda görünmeyenler (filmler).
- Sıradaki bölüm: izlenen en ileri bölümden sonraki ilk yayınlanmış bölüm; hiç izlenmemişse ilk yayınlanmış bölüm
  (`nextEpisode`, `src/lib/watch.ts`).
- İzlenme tarihi: bölüm/film sayfasındaki İzledin kutusunda ve dizi sayfasındaki bölüm satırlarında yazar.
- **Tekrar izleme:** İzledin kutusundaki "Tekrar izledim" her seferinde tarihli bir izleme ekler
  (`rewatchedAt` listesi; toplam = 1 + liste). "Son tekrarı geri al" sonuncuyu siler. Bölüm satırında "3 kez",
  profilde "2 tekrar izleme" yazar; izleme süresine her tekrar yeniden eklenir.
- Yorumlardaki kullanıcı adları profile bağlanır.

## Takip ve akış

- Başkasının profilinde **Takip et**; profilde takipçi ve takip sayısı. Gizli profiller takip edilemez.
- **Akış** (`/akis`): takip edilenlerin son 60 gündeki izlemeleri (tekrarlar dahil, puanıyla) ve yorumları.
  Aynı kişinin aynı gün aynı diziden izlediği bölümler tek satırda toplanır ("3 bölüm izledi"). Gizli profile
  geçen birinin hareketleri akışa girmez; kişisel notlar hiçbir zaman gösterilmez.
- Akışta son 30 günde en çok izleme yapan herkese açık kullanıcılar önerilir; arama sayfası kullanıcı adlarını da
  bulur. `@e2e.test` test hesapları öneri ve aramada gösterilmez.

## Ayarlar (`/settings`)

- **Profil fotoğrafı:** tarayıcıda küçültülür (512 px), sunucuda `sharp` ile 256×256 WebP'ye çevrilir (konum gibi
  bilgiler silinir) ve Supabase Storage'ın herkese açık `avatars` kovasına `<kullanıcı id>/<zaman>.webp` olarak
  yüklenir. Kova kuralları herkesin yalnızca kendi klasörüne yazmasına izin verir (migration `profile_settings`).
- **Kullanıcı adı** değiştirilebilir (aynı kurallar, benzersiz); profil adresi ve girişte kullanılan ad değişir.
- **Gizli profil:** profil sayfası başkalarına yalnızca adı ve "Bu profil gizli" yazısıyla görünür. Bölüm/film
  sayfalarındaki yorumlar ve topluluk istatistiklerine katkı (isimsiz) görünmeye devam eder.
- Test hesaplarının yüklediği fotoğraflar tur sonunda silinir.

## Keşfet, topluluk ve nerede izlenir

- **Ana sayfa (herkese):** "En çok konuşulanlar" (son 30 günde en çok yorum alan bölüm/filmler), TMDB'den
  "Bu hafta popüler diziler / filmler" ve "Vizyonda" (Türkiye). TMDB listeleri Next.js önbelleğinde 6 saat tutulur;
  TMDB 4 sn'de yanıt vermezse bu satırlar gizlenir ve sonraki ziyarette tekrar denenir.
- **Topluluk** (bölüm ve film sayfası): kaç kişinin izlediği, ortalama puan, duyguların izleyenlere oranı ve en sevilen
  5 karakter. Kişisel notlar okunmaz.
- **Nerede izlenir** (dizi ve film sayfası): Türkiye'deki platformlar (abonelik, ücretsiz, kiralama, satın alma),
  TMDB'nin JustWatch verisiyle; `Title.watchProviders` sütununda içerikle birlikte saklanıp yenilenir.
  JustWatch atfı TMDB şartıdır, kaldırılmamalı.

## Oyuncular

- Dizi ve film sayfalarında **Oyuncular**: oyuncu fotoğrafı, adı ve oynadığı karakter (en fazla 20 kişi).
- TMDB'den içerikle birlikte çekilir (dizide `aggregate_credits`, filmde `credits`) ve `Title.castMembers`
  sütununda saklanır; içerik yenilendikçe güncellenir. Kadrosu hiç çekilmemiş içerik ilk ziyarette arka planda yenilenir.

## Yorumlar (Faz 4)

- Bölüm ve film sayfalarının altında. Giriş yapan herkes yazabilir; yazar kendi yorumunu düzenleyip silebilir
  (silmeden önce onay sorulur), düzenlenen yorumda "(düzenlendi)" yazar.
- **Spoiler içerir** işaretli yorumların metni gizli gelir, "Spoiler'ı göster" ile açılır. O bölümü/filmi
  izlemiş olarak işaretleyen kullanıcıya ve yazarın kendisine spoiler'lar doğrudan açık gösterilir.
- Başkalarının yorumları beğenilir (kendi yorumun beğenilemez). Sıralama: **En yeni** / **En beğenilen**
  (tarayıcıda yapılır, sayfa yenilenmez).
- Yetki kuralları sunucuda (`src/app/actions/comments.ts`) kontrol edilir ve birim testleriyle doğrulanır.

## Filmler

- Arama dizi ve filmleri birlikte getirir; **Hepsi / Dizi / Film** filtreleriyle daraltılır, kartlarda tür yazar.
- Film sayfası (`/movie/[id]`): afiş, özet, süre, türler, IMDb puanı ve bağlantısı. Dizi sayfasıyla aynı üst bölümü
  kullanır (`src/components/title-hero.tsx`).
- Filmler de bölümler gibi **İzledim** ile işaretlenir: puan, duygular, kişisel not (`WatchedMovie` tablosu).

## Canlı site

**https://tracker-tv-seven.vercel.app** — Vercel (Hobby plan), sunucu bölgesi Frankfurt (`vercel.json`, veritabanının yanında).
Elle yayın: `vercel deploy --prod`. Canlı siteye karşı test: `E2E_BASE_URL=https://tracker-tv-seven.vercel.app npm run test:e2e`.
Vercel ortam değişkenleri: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `OMDB_API_KEY`, `TMDB_API_KEY`
(`DIRECT_URL` ve `SUPABASE_SECRET_KEY` canlıda gerekmez, eklenmemeli).

## Sayfalar

Üstte beş sekme var: **Keşfet** (`/`), **Akış** (`/akis`), **İzleme listem** (`/watchlist`), **Ara** (`/search`), **Profilim**. Geniş
ekranda başlık çubuğunda, daha dar ekranlarda çubuğun altında ayrı bir satırda durur. Giriş yapmamış ziyaretçi
kişisel sekmelere basınca giriş sayfasına gider. Hesap menüsünde Ayarlar ve Çıkış var.

| Yol | Sayfa |
|---|---|
| `/search?q=…&tur=hepsi\|dizi\|film` | Arama (dizi ve film birlikte ya da filtreli) |
| `/series/[id]` | Dizi detay + ilk sezonun bölümleri (`id` = TMDB dizi kimliği) |
| `/series/[id]/season/[s]` | Aynı sayfa, seçili sezonla (eski `?sezon=N` adresleri buraya yönlenir) |
| `/series/[id]/season/[s]/episode/[e]` | Bölüm sayfası, önceki/sonraki bölüm |
| `/movie/[id]` | Film detay ve İzledim (`id` = TMDB film kimliği) |
| `/profile/[username]` | Profil: izleme süreleri ve sekmeler |
| `/watchlist` | İzleme listem (giriş gerekir) |
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

Uçtan uca testler gerçek Supabase veritabanını ve TMDB'yi kullanır. Yerel test sunucusu veritabanına session
pooler (`DIRECT_URL`, 5432) ile bağlanır: yerel makineden transaction pooler (6543) bazen bir sorguyu bir dakika
bekletiyor (canlıda, Vercel'de bu sorun yok). Session pooler en fazla 15 bağlantıya izin verdiği için testlerin kendi
kısa veritabanı işleri (hesap sıfırlama, test verisi) transaction pooler'dan gider. Her test işçisi `@e2e.test` ile biten
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
| `src/app/actions/`, `src/components/comments/` | İzleme ve yorum işlemleri, yorum arayüzü |
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
- Filmler de ilk açılışta `Title` tablosuna yazılır ve aynı kurallarla arka planda yenilenir.
- Bölümler (sezon, bölüm no) ile eşleşir; kaynakta artık olmayan bölümler yalnızca kimse izlememişse silinir.
- IMDb puanları sayfa gönderildikten sonra arka planda OMDb'den çekilir (dizi başına 1 + sezon sayısı istek)
  ve 7 gün saklanır. OMDb ücretsiz anahtarı günde 1.000 istek verir; limit dolarsa ertesi gün tekrar denenir.
- Arama sonuçları veritabanında 24 saat tutulur; kaynak 4 sn'de yanıt vermezse kayıtlı diziler gösterilir ve arama
  arka planda tamamlanır. IMDb puanı yoksa TMDB puanı gösterilir; kaynak her zaman yazılır.

## Plandan sapmalar

- **Veri kaynağı:** İlk sürüm TVmaze kullanıyordu; 21 Ekim 2026'da TMDB'ye taşındı (`npm run migrate:tmdb`,
  izleme geçmişi korunarak). Sayfa altında TMDB'nin istediği logo ve atıf yer alır.
- **Sezon adresi:** `/series/[id]/season/[s]` (planda yoktu). Next.js 15.5'te yalnızca `?sezon=` değişen
  gezinmeler ekrana gelmiyordu. Aynı nedenle dizi/sezon sayfalarında `loading.tsx` ya da `Suspense` yok: ikisi de
  sekme geçişlerini ve "izledim" sonrası ilerleme güncellemesini ekrana yansıtmıyordu. Arama sayfasındaki
  `loading.tsx` de aynı nedenle kaldırıldı (masaüstünde Hepsi/Dizi/Film filtrelerine tıklamak sayfayı değiştirmiyordu).
