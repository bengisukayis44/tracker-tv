// TMDB requires its logo and this notice wherever its data is used (https://www.themoviedb.org/api-terms-of-use)
const TMDB_LOGO =
  "https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg";

export function SiteFooter() {
  return (
    <footer className="text-muted-foreground border-t">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-6 text-center text-xs sm:flex-row sm:px-6 sm:text-left">
        <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- external SVG logo, no optimisation needed */}
          <img src={TMDB_LOGO} alt="The Movie Database (TMDB)" width={110} height={14} />
        </a>
        <p>
          Bu ürün TMDB API&apos;sini kullanır ancak TMDB tarafından onaylanmamış veya sertifikalandırılmamıştır. IMDb
          puanları OMDb API&apos;sinden alınır.
        </p>
      </div>
    </footer>
  );
}
