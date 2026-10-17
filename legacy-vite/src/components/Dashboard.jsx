import React from 'react';
import { Film, CheckSquare, Clock, ArrowRight, PlayCircle, BarChart3 } from 'lucide-react';

export default function Dashboard({ followedShows, watchedEpisodes, onSelectShow, onNavigateToSearch }) {
    const showsList = Object.values(followedShows);

    // Statistics calculations
    const totalShows = showsList.length;

    // Calculate total watched episodes across followed shows
    let totalWatched = 0;
    let totalWatchedTime = 0; // in minutes

    showsList.forEach(show => {
        const showEps = show.episodesList || [];
        showEps.forEach(ep => {
            if (watchedEpisodes[ep.id]) {
                totalWatched++;
                totalWatchedTime += ep.runtime || show.averageRuntime || 45;
            }
        });
    });

    // Format time to hours/days
    const formatTime = (minutes) => {
        if (minutes < 60) return `${minutes} dk`;
        const hours = Math.round(minutes / 60);
        if (hours < 24) return `${hours} saat`;
        const days = (minutes / (60 * 24)).toFixed(1);
        return `${days} gün`;
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Welcome & Stats Row */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white">Kütüphanem</h1>
                    <p className="text-slate-400 mt-1">Takip ettiğiniz diziler ve izleme istatistikleriniz.</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Shows Count Card */}
                <div className="glass-panel p-6 rounded-2xl flex items-center gap-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-violet-500/5 blur-2xl pointer-events-none" />
                    <div className="p-4 bg-violet-600/10 text-violet-400 rounded-2xl border border-violet-500/10">
                        <Film className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Takip Edilen</span>
                        <span className="text-2xl font-black text-white mt-1 block">{totalShows} Dizi</span>
                    </div>
                </div>

                {/* Watched Episodes Card */}
                <div className="glass-panel p-6 rounded-2xl flex items-center gap-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-emerald-500/5 blur-2xl pointer-events-none" />
                    <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/10">
                        <CheckSquare className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">İzlenen Bölüm</span>
                        <span className="text-2xl font-black text-white mt-1 block">{totalWatched} Bölüm</span>
                    </div>
                </div>

                {/* Time Spent Card */}
                <div className="glass-panel p-6 rounded-2xl flex items-center gap-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-amber-500/5 blur-2xl pointer-events-none" />
                    <div className="p-4 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/10">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Harcanan Süre</span>
                        <span className="text-2xl font-black text-white mt-1 block">{formatTime(totalWatchedTime)}</span>
                    </div>
                </div>
            </div>

            {/* Followed Shows List */}
            <div>
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-violet-500" />
                    Dizi İlerlemelerim
                </h2>

                {showsList.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 glass-panel rounded-2xl max-w-xl mx-auto p-8 space-y-4">
                        <PlayCircle className="w-16 h-16 text-slate-700 mx-auto" />
                        <p className="text-lg font-semibold text-slate-300">Henüz kütüphanenizde dizi yok</p>
                        <p className="text-sm text-slate-500 max-w-md mx-auto">
                            İzlediğiniz dizileri ve bölümleri takip etmek için arama sayfasından dizileri kütüphanenize ekleyin.
                        </p>
                        <button
                            onClick={onNavigateToSearch}
                            className="bg-violet-600 hover:bg-violet-700 text-white font-medium px-5 py-2.5 rounded-xl transition-all inline-flex items-center gap-2 active:scale-95 cursor-pointer mt-2"
                        >
                            Dizi Ara
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {showsList.map(show => {
                            const showEps = show.episodesList || [];
                            const showWatched = showEps.filter(ep => watchedEpisodes[ep.id]).length;
                            const totalEps = show.totalEpisodes || showEps.length;
                            const percentage = totalEps > 0 ? Math.round((showWatched / totalEps) * 100) : 0;

                            return (
                                <div
                                    key={show.id}
                                    onClick={() => onSelectShow(show.id)}
                                    className="glass-panel glass-panel-hover rounded-2xl overflow-hidden cursor-pointer flex flex-col h-full group"
                                >
                                    {/* Poster Thumbnail */}
                                    <div className="relative aspect-[2/3] bg-slate-900 overflow-hidden">
                                        {show.image?.medium ? (
                                            <img
                                                src={show.image.medium}
                                                alt={show.name}
                                                loading="lazy"
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-slate-600 font-bold bg-slate-950 text-center">
                                                Poster Yok
                                            </div>
                                        )}

                                        {/* Progress overlay bottom */}
                                        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex flex-col justify-end">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                İlerleme
                                            </span>
                                            <div className="flex items-center justify-between text-xs font-bold text-white mt-1">
                                                <span>{showWatched} / {totalEps} Bölüm</span>
                                                <span>{percentage}%</span>
                                            </div>
                                            <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden border border-slate-700/35 mt-1.5">
                                                <div
                                                    className="bg-violet-500 h-full rounded-full transition-all duration-350"
                                                    style={{ width: `${percentage}%`, backgroundColor: '#8B5CF6' }}
                                                />
                                            </div>
                                        </div>

                                        {/* Rating Top Badge */}
                                        {show.rating?.average && (
                                            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-amber-400 font-bold px-2 py-0.5 rounded-lg text-[10px] flex items-center gap-1 border border-amber-400/20 pointer-events-none">
                                                ★ {show.rating.average.toFixed(1)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Show Info */}
                                    <div className="p-4 flex-1 flex flex-col justify-between">
                                        <div>
                                            <h3 className="font-bold text-white group-hover:text-violet-400 transition-colors leading-snug">
                                                {show.name}
                                            </h3>
                                            <span className="text-[11px] text-slate-500 mt-1 block">
                                                {show.network?.name || show.webChannel?.name || 'Dijital'} &bull; {show.status === 'Running' ? 'Devam Ediyor' : 'Sonlandı'}
                                            </span>
                                        </div>

                                        <div className="mt-4 pt-3 border-t border-slate-800/50 flex justify-between items-center text-xs text-slate-400">
                                            <span>Sezon Sayısı: {[...new Set(showEps.map(e => e.season))].length}</span>
                                            <span className="text-violet-400 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                                                Bölümler
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
