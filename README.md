# Tracker.tv — Dizi & Film Takip

İzlediğin dizi ve filmleri takip ettiğin, bölümleri puanlayıp yorumladığın web uygulaması.
Geliştirme planı: `PROJE_PLANI.md` (6 faz). Tamamlanan fazlar: **Faz 1 (temel altyapı)**, **Faz 2 (içerik sayfaları)**, **Faz 3 (izleme takibi)**, **Faz 4 (yorumlar)**, **Faz 5 (profil ve listeler)**, **Faz 6 (cilalama)**.

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
- **Sonraki bölümü izledim:** bölüm sayfasında İzledin kutusunun altında sıradaki (yayınlanmış) bölüm ve tek tıkla
  işaretleme; önceki izlenmemişler için olağan soru sorulur, bildirimdeki "Bölüme git" o bölüme götürür.
- **En sevdiğin karakterler** (profil): bölüm ve filmlerde seçilen favori karakterler dizi/film başına sayılır,
  en çok seçilen 10'u oyuncu fotoğrafıyla gösterilir. Başkası seçim yoksa bu bölümü görmez.
- **Tekrar izleme:** İzledin kutusundaki "Tekrar izledim" her seferinde tarihli bir izleme ekler
  (`rewatchedAt` listesi; toplam = 1 + liste). "Son tekrarı geri al" sonuncuyu siler. Bölüm satırında "3 kez",
  profilde "2 tekrar izleme" yazar; izleme süresine her tekrar yeniden eklenir.
- Yorumlardaki kullanıcı adları profile bağlanır.

## Bildirimler (yeni bölüm)

- Ayarlar → Bildirimler → **Bildirimleri aç**: tarayıcı izni istenir, `public/sw.js` kaydedilir ve Web Push aboneliği
  `PushSubscription` tablosuna yazılır (her tarayıcı ayrı). "Deneme bildirimi gönder" tüm zinciri dener.
- **Günlük görev** (`vercel.json` cron, her gün 07:00 UTC = 10:00 TR; Hobby planında o saat içinde herhangi bir an):
  `/api/cron/new-episodes`, `Authorization: Bearer $CRON_SECRET` ister. Bildirim açık kullanıcıların takip ettiği
  (izlediği ya da listesindeki) dizilerden eskimiş olanları (en fazla 15) TMDB'den yeniler, bugün yayınlanan bölümler
  için dizi başına bir bildirim gönderir. `?dryRun=1&userId=…` göndermeden ne gönderileceğini döndürür (testler).
- Anahtarlar: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET` (`.env` ve Vercel'de).
- iPhone/iPad'de Web Push yalnızca site ana ekrana eklenince çalışır; e-posta bildirimi henüz yok (e-posta servisi
  bekleniyor).
- Playwright'ın açtığı tarayıcılar push aboneliği alamadığı için uçtan uca testler aboneliği veritabanına yazar ve
  görevi kuru çalıştırır; gönderim ve şifreleme yerelde sahte bir push sunucusuyla doğrulandı.

## Cevaplar ve bildirimler

- Üst düzey yorumların altında **Cevapla** (tek seviye); cevaplar yorumun altında, eskiden yeniye. Yorum sayısına
  cevaplar dahil. Yorum silinince cevapları da silinir.
- **Uygulama içi bildirimler:** biri yorumuna cevap verince, yorumunu beğenince ya da seni takip edince (`Notification`
  tablosu). Beğeni/takip geri alınınca bildirimi de silinir; kişinin kendi hareketi bildirim üretmez.
- Başlıkta zil: okunmamış sayısı (9+); `/bildirimler` son 50 bildirimi gösterir, açılınca hepsi okunmuş olur. Cevap
  bildirimi konuşmanın olduğu yere (`#yorum-…`) götürür; spoiler cevaplar bildirimde "(spoiler)" görünür.

## Kendi listeler

- Dizi/film sayfasında **Listeye ekle**: listelerin işaret kutularıyla (ekle/çıkar hemen kaydolur) ve "Yeni liste
  oluştur" (ad + herkese açık/gizli). Profilde **Listelerim** sekmesi (4 afişlik kapakla kartlar, "Yeni liste").
- **Liste sayfası** (`/list/[id]`): ad, açıklama, sahibi, yapımlar; sahibi düzenler (ad, açıklama, gizlilik), yapım
  çıkarır ve listeyi siler. Gizli liste ya da gizli profilin listesi başkasına "sayfa bulunamadı" verir.
- Sınırlar: kişi başı 50 liste, liste başı 500 yapım; ad 60, açıklama 300 karakter.

## Takip ve akış

- Başkasının profilinde **Takip et**; profilde takipçi ve takip sayısı. Gizli profiller takip edilemez.
- **Akış** (`/akis`): takip edilenlerin son 60 gündeki izlemeleri (tekrarlar dahil, puanıyla) ve yorumları.
  Aynı kişinin aynı gün aynı diziden izlediği bölümler tek satırda toplanır ("3 bölüm izledi"). Gizli profile
  geçen birinin hareketleri akışa girmez; kişisel notlar hiçbir zaman gösterilmez.
- Akışta son 30 günde en çok izleme yapan herkese açık kullanıcılar önerilir; arama sayfası kullanıcı adlarını da
  bulur. `@e2e.test` test hesapları öneri ve aramada gösterilmez.

## Faz 6: kabul kriterleri, hata ekranları, hız, erişilebilirlik

- **Kabul kriterleri** (PROJE_PLANI.md §7): dokuzu da uçtan uca testlerle doğrulanıyor:
  | Kriter | Test |
  |---|---|
  | 1. Arama → bölüm sayfası, puan ve açıklama | `acceptance.spec.ts` "1:" |
  | 2. İzledim: puan, birden fazla duygu, not; düzenleme | `watch.spec.ts` "İzledim: puan, duygular ve not…" |
  | 3. Bölüme spoiler yorum başkasına gizli, tıklayınca açılır | `acceptance.spec.ts` "3:", `comments.spec.ts` |
  | 4. Dizi ve film süreleri ayrı, "X ay Y gün Z saat" | `profile.spec.ts`, birim: `format.test.ts` |
  | 5. Favori diziler ve filmler ayrı başlıklarda | `profile.spec.ts` |
  | 6. Yorumlar hangi dizinin hangi bölümüne yazıldığıyla | `profile.spec.ts` ("Sherlock — S1 B3: …") |
  | 7. İzlemeye devam et: kaldığın ve sıradaki bölüm | `profile.spec.ts`, birim: `watch.test.ts` |
  | 8. Daha sonra izle ekle/çıkar | `watch.spec.ts`, `profile.spec.ts` |
  | 9. Mobilde düzgün görünüm | tüm testler masaüstü ve Pixel 7'de; `acceptance.spec.ts` "9:" sayfa taraması |
- **Erişilebilirlik:** `acceptance.spec.ts` ana sayfaları (ziyaretçi ve üye) axe ile WCAG 2.1 A/AA'ya göre tarar ve
  yatay taşmayı kontrol eder. Düzeltilenler: mor tonu ikiye ayrıldı (`--primary` yazı/çizgi için, `--primary-strong`
  beyaz yazılı düğmeler için; ikisi de en az 4.5:1), yana kayan listeler klavyeyle kaydırılabilir, telefonda logo
  bağlantısının adı var.
- **Hata ekranları:** `error.tsx` "Tekrar dene" sayfayı sunucudan yeniden ister; site çerçevesi de çökerse
  (ör. veritabanına ulaşılamıyor) `global-error.tsx` Türkçe bir sayfa gösterir.
- **Yana kaydırılan satırlar** (keşfet, oyuncular, en sevilen karakterler, sezon ve profil sekmeleri) kaydırma
  çubuğu göstermez; geniş ekranda kaydırılacak yön varsa başta/sonda ok çıkar (`components/scroll-row.tsx`),
  telefonda parmakla kaydırılır.
- **Yükleniyor:** sayfa değişirken en üstte ince bir ilerleme çubuğu (`navigation-progress.tsx`,
  `instrumentation-client.ts`); sayfalara `loading.tsx` eklemeden (Next.js 15.5 sorunu).
- **Hız (23 Ekim, canlı):** en ağır profil (527 bölüm) ~0,3 sn, 890 bölümlük dizi ~0,4 sn, diğer sayfalar
  0,3–0,5 sn (soğuk başlangıçta ilk istek 1–3 sn). Ek iyileştirme gerekmedi.
- Yerel test sunucusu en fazla 5 veritabanı bağlantısı açar (`DATABASE_POOL_MAX`), session pooler'ın 15 sınırı için.

## Ayarlar (`/settings`)

- **Profil fotoğrafı:** tarayıcıda küçültülür (512 px), sunucuda `sharp` ile 256×256 WebP'ye çevrilir (konum gibi
  bilgiler silinir) ve Supabase Storage'ın herkese açık `avatars` kovasına `<kullanıcı id>/<zaman>.webp` olarak
  yüklenir. Kova kuralları herkesin yalnızca kendi klasörüne yazmasına izin verir (migration `profile_settings`).
- **Profil kapağı:** profilde (kendi profilinde "Kapak ekle") ya da ayarlarda: önce izlenen diziler/filmler (en son
  izlenen başta), sonra iki sekme: **Dizi görselleri** (TMDB'deki tüm geniş görseller; yazısızlar ve en beğenilenler
  önce) ve **Bölüm kareleri** (veritabanındaki her bölümün karesi, izleme sırasıyla). İlk 10 görünür, "Daha fazla
  göster" her seferinde 20 ekler. Kapak bilgisayarda 3:1, telefonda 2:1 oranındadır; sahibi
  **Konumu ayarla** ile görseli yukarı aşağı sürükleyip (ya da ok düğmeleriyle) görünen kısmı seçer
  (`User.coverPositionY`, 0 = üstü, 100 = altı). Kapak TMDB'nin özgün boyutuyla gösterilir.
- **Kapak karakteri:** kapak iki sayfa olabilir: sahne ve seçilen karakter (oyuncunun fotoğrafı büyük yuvarlak
  ikon, "Sherlock Holmes · Sherlock dizisinden · Benedict Cumberbatch", arkada dizinin bulanık görseli). Karakter
  izlenen ya da "Daha sonra izle" listesindeki dizi/filmlerin kadrosundan seçilir (`User.coverCharacterTitleId`,
  `coverCharacterCastId`). Sayfalar telefonda kaydırılır; oklar, noktalar ve klavye de çalışır. Konum ayarlanırken
  kaydırma kilitlenir; bir sayfa değişince o sayfa gösterilir. Küçük önizlemeler ve kapak doğrudan TMDB'den yüklenir (Vercel'in görsel
  optimizasyon kotasını harcamamak için). Yalnızca görselin TMDB yolu `User.coverPath`'te saklanır; sunucu görselin gerçekten o dizi/filme ait
  ve kullanıcının izlediği bir içerik olduğunu doğrular. Gizli profilde kapak başkalarına görünmez.
- **Kullanıcı adı** değiştirilebilir (aynı kurallar, benzersiz); profil adresi ve girişte kullanılan ad değişir.
- **Gizli profil:** profil sayfası başkalarına yalnızca adı ve "Bu profil gizli" yazısıyla görünür. Bölüm/film
  sayfalarındaki yorumlar ve topluluk istatistiklerine katkı (isimsiz) görünmeye devam eder.
- Test hesaplarının yüklediği fotoğraflar tur sonunda silinir.

## Keşfet, topluluk ve nerede izlenir

- **Ana sayfa (herkese):** "En çok konuşulanlar" (son 30 günde en çok yorum alan bölüm/filmler), TMDB'den
  "Bu hafta popüler diziler / filmler" ve "Vizyonda" (Türkiye). TMDB listeleri Next.js önbelleğinde 6 saat tutulur;
  TMDB 4 sn'de yanıt vermezse bu satırlar gizlenir ve sonraki ziyarette tekrar denenir.
- **Sana özel öneriler** (ana sayfa, giriş yapınca; `src/lib/recommendations.ts`, kurallar `src/lib/recommend.ts`):
  - *Sana özel:* izlenenlerin türleri ağırlıklı sayılır (çok bölüm ve yüksek puan daha ağır), en sevilen 3 türde TMDB
    discover'dan popüler dizi ve filmler ("Dram, Gizem ve Suç sevdiğin için"). Dizi/film tür adları eşlenir.
  - *"X izleyenler bunları da sevdi":* yüksek puanlı (≥8) ya da son izlenen 5 yapımdan biri (her gün farklısı) için
    TMDB önerileri.
  - *"Oyuncu başka nerelerde oynadı?":* en çok seçilen favori karakterin oyuncusunun diğer işleri (sohbet/haber
    programları ve "kendisi" rolleri hariç, en bilinenler önce), kartta oynadığı karakter.
  - *Arkadaşların izliyor:* takip edilen herkese açık kişilerin son 30 günde izledikleri, "N arkadaşın izledi".
  - İzlenen ve listedekiler önerilmez; TMDB yanıtları 6 saat önbellekte; yanıt gelmeyen ya da boş kalan satır gizlenir.
- **Topluluk** (bölüm ve film sayfası): kaç kişinin izlediği, ortalama puan, duyguların izleyenlere oranı ve en sevilen
  5 karakter. Kişisel notlar okunmaz.
- **Nerede izlenir** (dizi ve film sayfası): Türkiye'deki platformlar (abonelik, ücretsiz, kiralama, satın alma),
  TMDB'nin JustWatch verisiyle; `Title.watchProviders` sütununda içerikle birlikte saklanıp yenilenir.
  JustWatch atfı TMDB şartıdır, kaldırılmamalı.

## Oyuncular

- **Oyuncu sayfası** (`/person/[id]`, TMDB kişi kimliği): fotoğraf, doğum bilgisi, Türkçe (yoksa İngilizce) biyografi,
  IMDb bağlantısı; diziler (rol aldığı bölüm sayısına göre) ve filmler (bilinirliğe göre) ayrı, oynadığı karakterle;
  ilk 12'si görünür, "Tümünü göster" ile hepsi. Dizi kartının altında rolün özeti: en fazla 3 bölümse bölümler
  bağlantı olarak ("S24E12 · Bölüm adı"), daha uzunsa sezonlar ("Sezon 1–4 + özel bölümler · 12 bölüm"; TMDB
  `/credit/{id}`, kurallar `src/lib/appearance.ts`). Giriş yapana "N tanesini izledin" ve kartlarda "İzledin" işareti.
  TMDB yanıtı bir gün önbellekte. Oyuncu kartları, favori karakterler, topluluk ve kapaktaki oyuncu adları buraya bağlanır.

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
Vercel ortam değişkenleri: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `OMDB_API_KEY`, `TMDB_API_KEY`,
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`
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
