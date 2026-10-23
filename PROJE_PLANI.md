# Dizi & Film Takip Uygulaması — Proje Planı

> Bu doküman Claude Code için hazırlanmıştır. Projeyi aşağıdaki fazlara göre adım adım geliştir. Her fazın sonunda çalışır durumda bir uygulama olmalı. Belirsiz bir nokta olursa önce sor, sonra kodla.

---

## 1. Proje Özeti

Kullanıcıların izledikleri dizi ve filmleri takip ettiği, bölüm bazında puan/duygu/yorum bıraktığı, diğer kullanıcıların yorumlarını (spoiler korumalı) okuyabildiği ve profilinde toplam izleme süresini görebildiği bir web uygulaması.

**Temel özellikler:**
- Dizi ve film detay sayfaları
- Bölüm sayfası: IMDb puanı, açıklama, "İzledim" butonu
- İzledikten sonra: kişisel puan + duygu seçimi + kişisel not
- Bölüm/film yorumları (spoiler işaretleme ile)
- Profil: toplam izleme süresi, izlenenler, favoriler, tüm yorumlarım
- "İzlemeye devam et" (kaldığın bölüm) ve "Daha sonra izle" listesi

---

## 2. Teknoloji Seçimi (önerilen)

| Katman | Teknoloji |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Stil | Tailwind CSS + shadcn/ui |
| Veritabanı | PostgreSQL |
| ORM | Prisma |
| Kimlik doğrulama | Auth.js (NextAuth) — e-posta/şifre + Google |
| Veri kaynağı | TMDB API (dizi/film/sezon/bölüm bilgileri, görseller, süreler) |
| IMDb puanları | OMDb API (IMDb ID ile bölüm/film puanı çeker) |
| Form/doğrulama | React Hook Form + Zod |

**Not:** IMDb'nin ücretsiz resmi API'si yok. Bu yüzden içerik verisi TMDB'den, IMDb puanı ise TMDB'nin verdiği `imdb_id` üzerinden OMDb'den alınacak. API anahtarları `.env` dosyasında tutulacak:
```
DATABASE_URL=
TMDB_API_KEY=
OMDB_API_KEY=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

**Önbellekleme:** TMDB/OMDb verileri her istekte çekilmesin. İlk istekte veritabanına kaydedilsin (Title, Season, Episode tabloları) ve belli aralıklarla (ör. 7 gün) güncellensin. OMDb'nin günlük istek limiti var, buna dikkat et.

---

## 3. Veri Modeli (Prisma taslağı)

```prisma
enum TitleType { MOVIE SERIES }

model User {
  id          String   @id @default(cuid())
  username    String   @unique
  email       String   @unique
  avatarUrl   String?
  createdAt   DateTime @default(now())
  watchedEpisodes WatchedEpisode[]
  watchedMovies   WatchedMovie[]
  comments        Comment[]
  favorites       Favorite[]
  watchlist       WatchlistItem[]
}

model Title {               // dizi veya film
  id          String    @id @default(cuid())
  tmdbId      Int
  imdbId      String?
  type        TitleType
  name        String
  overview    String?
  posterUrl   String?
  backdropUrl String?
  imdbRating  Float?
  runtime     Int?        // film için dakika
  releaseDate DateTime?
  genres      String[]
  lastSyncedAt DateTime?
  seasons     Season[]
  @@unique([tmdbId, type])
}

model Season {
  id           String   @id @default(cuid())
  titleId      String
  seasonNumber Int
  name         String?
  posterUrl    String?
  title        Title    @relation(fields: [titleId], references: [id])
  episodes     Episode[]
  @@unique([titleId, seasonNumber])
}

model Episode {
  id            String   @id @default(cuid())
  seasonId      String
  episodeNumber Int
  name          String
  overview      String?
  imdbId        String?
  imdbRating    Float?
  runtime       Int?       // dakika
  airDate       DateTime?
  stillUrl      String?
  season        Season   @relation(fields: [seasonId], references: [id])
  @@unique([seasonId, episodeNumber])
}

model WatchedEpisode {
  id         String   @id @default(cuid())
  userId     String
  episodeId  String
  rating     Int?      // 1-10
  emotions   Emotion[]
  note       String?   // kişisel ekstra yorum (sadece kullanıcı görür)
  watchedAt  DateTime @default(now())
  @@unique([userId, episodeId])
}

model WatchedMovie {
  id        String   @id @default(cuid())
  userId    String
  titleId   String
  rating    Int?
  emotions  Emotion[]
  note      String?
  watchedAt DateTime @default(now())
  @@unique([userId, titleId])
}

enum Emotion {
  HUZUNLU MUTLU HEYECANLI GERGIN KORKMUS SASKIN SINIRLI DUYGULANMIS SIKILMIS EGLENMIS
}

model Comment {
  id         String   @id @default(cuid())
  userId     String
  episodeId  String?   // bölüm yorumu
  titleId    String?   // film yorumu (veya dizi geneli)
  content    String
  isSpoiler  Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  likes      CommentLike[]
}

model CommentLike {
  userId    String
  commentId String
  @@id([userId, commentId])
}

model Favorite {
  userId  String
  titleId String
  createdAt DateTime @default(now())
  @@id([userId, titleId])
}

model WatchlistItem {        // "Daha sonra izle"
  userId    String
  titleId   String
  addedAt   DateTime @default(now())
  @@id([userId, titleId])
}
```
İlişkileri (relation alanlarını) eksiksiz tamamla.

---

## 4. Sayfalar ve Özellikler

### 4.1 Ana Sayfa (`/`)
- **İzlemeye devam et:** Kullanıcının izlemekte olduğu diziler; her kartta "S2 B5'te kaldın → Sıradaki: S2 B6" ve tek tıkla sıradaki bölüme gitme.
- **Daha sonra izle** listesinden birkaç öğe.
- Popüler / trend diziler ve filmler (TMDB'den).

### 4.2 Arama (`/search`)
- Dizi ve film araması (TMDB search). Filtre: Dizi / Film / Hepsi.

### 4.3 Dizi Detay (`/series/[id]`)
- Poster, arka plan, açıklama, IMDb puanı, türler.
- Butonlar: **Favorilere ekle**, **Daha sonra izle**.
- Sezon listesi → her sezonda bölüm listesi; izlenen bölümler işaretli.
- İlerleme çubuğu (ör. "42/60 bölüm izlendi").
- "Sezonun tamamını izledim olarak işaretle" seçeneği.

### 4.4 Bölüm Sayfası (`/series/[id]/season/[s]/episode/[e]`)
- Bölüm adı, görsel, yayın tarihi, süre, **IMDb puanı**, açıklama.
- Önceki / sonraki bölüm gezinmesi.
- **"İzledim" butonu** → tıklanınca bir panel/modal açılır:
  - Puan: 1–10 (yıldız ya da sayı seçici)
  - Duygular: çoklu seçilebilir etiketler (Hüzünlü, Mutlu, Heyecanlı, Gergin, Korkmuş, Şaşkın, Sinirli, Duygulanmış, Sıkılmış, Eğlenmiş) — emoji ile
  - Ekstra kişisel not (opsiyonel, metin alanı)
  - Kaydet. Sonradan düzenlenebilir veya "izlenmedi" olarak geri alınabilir.
- İzlendikten sonra sayfada kullanıcının kendi puanı/duyguları görünür.
- Topluluk istatistikleri (opsiyonel): kullanıcıların ortalama puanı, en çok seçilen duygular.
- **Yorumlar bölümü** (bkz. 4.6).

### 4.5 Film Detay (`/movie/[id]`)
- Bölüm sayfasıyla aynı mantık: IMDb puanı, açıklama, süre, "İzledim" → puan + duygu + not, favori, daha sonra izle, yorumlar.

### 4.6 Yorum Sistemi
- Giriş yapmış kullanıcı yorum yazabilir.
- **"Spoiler içerir" kutucuğu.** İşaretli yorumlar bulanık/gizli gösterilir; "Spoiler'ı göster" tıklanınca açılır.
- Ek kural (öneri): Kullanıcı o bölümü henüz izlemediyse spoiler yorumlar varsayılan olarak gizli; izlediyse otomatik açık gösterilebilir.
- Sıralama: En yeni / En beğenilen.
- Beğeni, kendi yorumunu düzenleme ve silme.
- Yorumda kullanıcı adı ve avatar, profil sayfasına link.

### 4.7 Profil (`/profile/[username]`)
- **Toplam izleme süresi**, ayrı ayrı:
  - Diziler: ör. "3 ay 2 gün 4 saat"
  - Filmler: ör. "12 gün 7 saat"
  - Hesaplama: izlenen bölümlerin `runtime` toplamı / izlenen filmlerin `runtime` toplamı (dakika). Format: 1 ay = 30 gün, 1 gün = 24 saat. Sıfır olan birimler gösterilmesin.
  - Ek: toplam izlenen bölüm sayısı, film sayısı.
- **Sekmeler:**
  - **İzlediğim Diziler** (ilerleme yüzdesiyle)
  - **İzlediğim Filmler**
  - **Favorilerim** — "Favori Diziler" ve "Favori Filmler" ayrı başlıklar altında
  - **Yorumlarım** — her yorum için: "*Dizi Adı* — S2 B5: *Bölüm Adı*" başlığı, yorum metni, tarih ve bölüme link. Filmler için film adı.
  - **Daha Sonra İzle**
- Başka kullanıcının profiline bakılabilir (kişisel notlar hariç her şey herkese açık; gizlilik ayarı ileride eklenebilir).

### 4.8 İzleme Listeleri (`/watchlist`)
- **İzlemeye devam et:** Başlamış ama bitmemiş diziler. Her dizi için son izlenen bölüm ve sıradaki bölüm. Sıralama: en son izlenen en üstte.
- **Daha sonra izle:** Kullanıcının eklediği dizi/filmler. Kaldır butonu.
- **Yeni bölüm geldi** (opsiyonel): Takip edilen dizide yeni bölüm yayınlandıysa işaretle.

---

## 5. "Kaldığın yer" mantığı
- Bir dizide en az bir bölüm izlendiyse ve izlenmemiş yayınlanmış bölüm varsa dizi "İzlemeye devam et" listesindedir.
- Sıradaki bölüm = izlenen en yüksek (sezon, bölüm) çiftinden sonraki ilk yayınlanmış bölüm.
- Bir bölüm "izledim" işaretlenince, önceki izlenmemiş bölümler için "Önceki bölümleri de izlendi olarak işaretle?" sorusu gösterilsin.
- Kullanıcı bir diziden bölüm izlediğinde dizi "Daha sonra izle" listesindeyse otomatik çıkarılabilir (ayar olarak).

---

## 6. Geliştirme Fazları

**Faz 1 — Temel altyapı**
- Next.js + TypeScript + Tailwind + shadcn/ui kurulumu
- Prisma + PostgreSQL, şema ve migration
- Auth (kayıt/giriş/çıkış)
- TMDB ve OMDb servis katmanı (`lib/tmdb.ts`, `lib/omdb.ts`) + veritabanına önbellekleme

**Faz 2 — İçerik sayfaları**
- Arama, dizi detay, sezon/bölüm listesi, bölüm sayfası, film detay
- IMDb puanlarının gösterimi

**Faz 3 — İzleme takibi**
- "İzledim" akışı: puan + duygular + not
- Düzenleme / geri alma, toplu sezon işaretleme
- Favoriler ve Daha sonra izle

**Faz 4 — Yorumlar**
- Yorum CRUD, spoiler işaretleme ve gizleme, beğeni, sıralama

**Faz 5 — Profil ve listeler**
- Toplam süre hesaplama ve formatlama (birim testleri yaz)
- Profil sekmeleri, Yorumlarım
- İzlemeye devam et ve ana sayfa

**Faz 6 — Cilalama**
- Mobil uyumluluk, karanlık mod, yükleniyor/boş durum ekranları
- Hata yönetimi, API limit koruması
- Temel testler (süre hesaplama, sıradaki bölüm mantığı, yorum yetkileri)

---

## 7. Kabul Kriterleri (kontrol listesi)
- [x] Bir diziyi arayıp bölüm sayfasına gidebiliyorum; IMDb puanı ve açıklama görünüyor.
- [x] "İzledim"e basınca puan, birden fazla duygu ve not girip kaydedebiliyorum; sonra düzenleyebiliyorum.
- [x] Bölüme spoiler işaretli yorum yazınca başkalarına gizli görünüyor, tıklayınca açılıyor.
- [x] Profilimde dizi ve film toplam süreleri "X ay Y gün Z saat" formatında ayrı ayrı görünüyor.
- [x] Profilimde favori diziler ve favori filmler ayrı başlıklarda listeleniyor.
- [x] Profilimde tüm yorumlarım hangi dizinin hangi bölümüne yapıldığıyla birlikte listeleniyor.
- [x] "İzlemeye devam et" kaldığım bölümü ve sıradakini doğru gösteriyor.
- [x] "Daha sonra izle" listesine ekleyip çıkarabiliyorum.
- [x] Uygulama mobilde düzgün görünüyor.

> 23 Ekim 2026: hepsi uçtan uca testlerle doğrulandı (masaüstü ve mobil); `tests/e2e/acceptance.spec.ts` ve README "Faz 6".

---

## 8. Claude Code'a Notlar
- Önce Faz 1'den başla, her fazın sonunda ne yaptığını özetle.
- Kod Türkçe arayüz metinleri içersin; kod içi isimlendirme İngilizce olsun.
- Ortak UI bileşenleri: `PosterCard`, `EpisodeRow`, `RatingInput`, `EmotionPicker`, `CommentItem`, `SpoilerBlur`, `WatchTimeStat`.
- API anahtarlarını asla koda gömme; `.env.example` oluştur.
