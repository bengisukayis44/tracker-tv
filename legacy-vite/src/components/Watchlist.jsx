import React from 'react';
import { Check, ClipboardList, Calendar, Bookmark, PlaySquare } from 'lucide-react';

export default function Watchlist({ followedShows, watchedEpisodes, onToggleWatch, onSelectShow }) {
    const showsList = Object.values(followedShows);
    const now = new Date();

    // Collect all unwatched and aired episodes
    const toWatchEpisodes = [];

    showsList.forEach(show => {
        const episodes = show.episodesList || [];
        episodes.forEach(ep => {
            // Check if episode is aired (airdate <= today)
            let isAired = false;
            if (ep.airdate) {
                const airDate = new Date(`${ep.airdate}T${ep.airtime || '12:00'}:00`);
                isAired = airDate <= now;
            }

            // If it has aired and is NOT watched, add to watchlist
            if (isAired && !watchedEpisodes[ep.id]) {
                toWatchEpisodes.push({
                    episode: ep,
                    show: {
                        id: show.id,
                        name: show.name,
                        image: show.image,
                        averageRuntime: show.averageRuntime
                    }
                });
            }
        });
    });

    // Sort episodes by airdate ascending (oldest first) so user watches chronologically
    toWatchEpisodes.sort((a, b) => {
        const dateA = new Date(`${a.episode.airdate}T${a.episode.airtime || '00:00'}`);
        const dateB = new Date(`${b.episode.airdate}T${b.episode.airtime || '00:00'}`);
        return dateA - dateB;
    });

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white">İzlenecekler</h1>
                <p className="text-slate-400 mt-1">Yayınlanmış ama henüz izlemediğiniz bölümler. Kronolojik olarak sıralanmıştır.</p>
            </div>

            {toWatchEpisodes.length === 0 ? (
                <div className="text-center py-20 text-slate-400 glass-panel rounded-2xl max-w-xl mx-auto p-8 space-y-4">
                    <PlaySquare className="w-16 h-16 text-slate-700 mx-auto" />
                    <p className="text-lg font-semibold text-slate-300">Harika! İzlenecek bölüm kalmadı</p>
                    <p className="text-sm text-slate-500 max-w-md mx-auto">
                        Takip ettiğiniz tüm dizilerin güncel bölümlerini bitirdiniz. Yeni bölümler yayınlandığında burada görünecektir.
                    </p>
                </div>
            ) : (
                <div className="space-y-4 max-w-4xl">
                    {/* Watchlist Counter */}
                    <div className="text-sm text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-violet-500" />
                        Toplam {toWatchEpisodes.length} bölüm bekliyor
                    </div>

                    {/* List of episodes */}
                    <div className="flex flex-col gap-3">
                        {toWatchEpisodes.map(({ episode, show }) => (
                            <div
                                key={episode.id}
                                className="glass-panel p-4 rounded-xl flex items-center justify-between gap-4 border border-slate-800/40 hover:border-slate-800 transition-all duration-200 group"
                            >
                                {/* Left side: Show details & Episode Details */}
                                <div className="flex items-center gap-4 min-w-0">
                                    {/* Poster Thumbnail */}
                                    <div
                                        onClick={() => onSelectShow(show.id)}
                                        className="w-12 h-16 shrink-0 bg-slate-900 rounded-lg overflow-hidden border border-slate-800/50 cursor-pointer hidden sm:block relative"
                                    >
                                        {show.image?.medium ? (
                                            <img
                                                src={show.image.medium}
                                                alt={show.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-600 bg-slate-950 font-bold">
                                                Dizi
                                            </div>
                                        )}
                                    </div>

                                    {/* Text Details */}
                                    <div className="min-w-0">
                                        <h3
                                            onClick={() => onSelectShow(show.id)}
                                            className="font-bold text-white text-sm sm:text-base hover:text-violet-400 transition-colors truncate cursor-pointer leading-tight"
                                        >
                                            {show.name}
                                        </h3>

                                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                                            <span className="bg-violet-950/40 text-violet-400 border border-violet-900/30 px-1.5 py-0.5 rounded font-black text-[10px] tracking-wide shrink-0">
                                                S{String(episode.season).padStart(2, '0')}E{String(episode.number).padStart(2, '0')}
                                            </span>
                                            <span className="font-semibold text-slate-300 truncate">
                                                {episode.name}
                                            </span>
                                        </div>

                                        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-500">
                                            <span className="flex items-center gap-1 shrink-0">
                                                <Calendar className="w-3 h-3" />
                                                {episode.airdate ? episode.airdate.split('-').reverse().join('.') : 'Bilinmiyor'}
                                            </span>
                                            {episode.runtime && (
                                                <span className="shrink-0">&bull; {episode.runtime} dk</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right side: Watch action button */}
                                <div className="flex items-center gap-2">
                                    {/* Show Detail Quick Link */}
                                    <button
                                        onClick={() => onSelectShow(show.id)}
                                        className="bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs px-3 py-2 rounded-lg border border-slate-800 transition-all font-semibold active:scale-95 whitespace-nowrap cursor-pointer hidden md:block"
                                    >
                                        Diziye Git
                                    </button>

                                    {/* Mark Watched Toggle */}
                                    <button
                                        onClick={() => onToggleWatch(show.id, episode.id, true, episode.runtime)}
                                        className="bg-emerald-600/10 hover:bg-emerald-600/25 border border-emerald-500/20 text-emerald-400 p-2.5 rounded-xl transition-all active:scale-90 flex items-center justify-center cursor-pointer"
                                        title="İzlendi Olarak İşaretle"
                                    >
                                        <Check className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
