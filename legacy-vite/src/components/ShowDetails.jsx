import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Check, Eye, EyeOff, Calendar, Clock, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { tvmazeApi } from '../services/api';
import EpisodeDetailsModal from './EpisodeDetailsModal';

export default function ShowDetails({ showId, watchedEpisodes, onToggleWatch, onToggleWatchBatch, followedShows, pendingFollows, onToggleFollow, onBack }) {
    const [show, setShow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [error, setError] = useState(null);
    const [selectedEpisode, setSelectedEpisode] = useState(null);

    useEffect(() => {
        let active = true;
        const fetchShowDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await tvmazeApi.getShowDetails(showId);
                if (active) {
                    setShow(data);

                    // Determine available seasons and set initial to season 1 (or first available)
                    const episodes = data._embedded?.episodes || [];
                    if (episodes.length > 0) {
                        const uniqueSeasons = [...new Set(episodes.map(ep => ep.season))].sort((a, b) => a - b);
                        setSelectedSeason(uniqueSeasons[0] || 1);
                    }
                }
            } catch (err) {
                console.error(err);
                if (active) {
                    setError('Dizi detayları yüklenirken bir hata oluştu.');
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        fetchShowDetails();

        return () => {
            active = false;
        };
    }, [showId]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400 gap-3">
                <Loader2 className="w-12 h-12 animate-spin text-violet-500" />
                <p className="text-sm">Bölümler ve sezon rehberi yükleniyor...</p>
            </div>
        );
    }

    if (error || !show) {
        return (
            <div className="text-center py-20 text-slate-400 glass-panel rounded-2xl max-w-xl mx-auto p-8 space-y-4">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                <p className="text-lg font-semibold text-slate-300">{error || 'Dizi bulunamadı.'}</p>
                <button onClick={onBack} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl transition-all">
                    Geri Dön
                </button>
            </div>
        );
    }

    const isFollowed = !!followedShows[show.id];
    const isFollowPending = !!pendingFollows[show.id];
    const episodes = show._embedded?.episodes || [];

    // Group episodes by season
    const seasonsMap = {};
    episodes.forEach(ep => {
        if (!seasonsMap[ep.season]) {
            seasonsMap[ep.season] = [];
        }
        seasonsMap[ep.season].push(ep);
    });

    const seasonsList = Object.keys(seasonsMap).map(Number).sort((a, b) => a - b);
    const activeSeasonEpisodes = seasonsMap[selectedSeason] || [];

    // Calculate statistics
    const totalEpisodesCount = episodes.length;

    // Aired status check helper
    const now = new Date();
    const getEpisodeStatus = (episode) => {
        if (!episode.airdate) return 'unaired';
        const airDate = new Date(`${episode.airdate}T${episode.airtime || '12:00'}:00`);
        return airDate <= now ? 'aired' : 'unaired';
    };

    const airedEpisodes = episodes.filter(ep => getEpisodeStatus(ep) === 'aired');
    const totalAiredCount = airedEpisodes.length;

    const watchedCount = episodes.filter(ep => !!watchedEpisodes[ep.id]).length;
    const watchPercentage = totalEpisodesCount > 0 ? Math.round((watchedCount / totalEpisodesCount) * 100) : 0;

    // Season statistics
    const seasonTotalCount = activeSeasonEpisodes.length;
    const seasonAiredCount = activeSeasonEpisodes.filter(ep => getEpisodeStatus(ep) === 'aired').length;
    const seasonWatchedCount = activeSeasonEpisodes.filter(ep => !!watchedEpisodes[ep.id]).length;
    const seasonPercentage = seasonTotalCount > 0 ? Math.round((seasonWatchedCount / seasonTotalCount) * 100) : 0;

    const stripHtml = (html) => {
        if (!html) return 'Açıklama mevcut değil.';
        return html.replace(/<\/?[^>]+(>|$)/g, "");
    };

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            {/* Back Button */}
            <button
                onClick={onBack}
                className="inline-flex items-center gap-2 text-slate-400 hover:text-white font-medium text-sm transition-colors cursor-pointer group"
            >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Kütüphaneye Dön
            </button>

            {/* Show Header Info Banner */}
            <div className="relative glass-panel rounded-3xl overflow-hidden p-6 md:p-8 flex flex-col md:flex-row gap-8">
                {/* Background glow decoration */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-violet-600/10 blur-[80px] pointer-events-none" />

                {/* Poster */}
                <div className="w-full md:w-64 shrink-0 aspect-[2/3] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
                    {show.image?.original || show.image?.medium ? (
                        <img
                            src={show.image.original || show.image.medium}
                            alt={show.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600 font-semibold p-4">
                            Poster Yok
                        </div>
                    )}
                </div>

                {/* Details text */}
                <div className="flex-1 flex flex-col justify-between space-y-6">
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                            {show.rating?.average && (
                                <span className="bg-amber-500/10 text-amber-400 font-bold px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 border border-amber-500/20">
                                    ★ {show.rating.average.toFixed(1)}
                                </span>
                            )}
                            {show.genres?.map(genre => (
                                <span key={genre} className="bg-slate-800/60 text-slate-300 text-xs px-2.5 py-1 rounded-lg border border-slate-800">
                                    {genre}
                                </span>
                            ))}
                            {show.network?.name && (
                                <span className="text-xs text-slate-400 font-medium bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                                    {show.network.name}
                                </span>
                            )}
                        </div>

                        <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">{show.name}</h1>

                        <p className="text-slate-300 text-sm md:text-base leading-relaxed max-w-3xl">
                            {stripHtml(show.summary)}
                        </p>
                    </div>

                    {/* Stats and Action Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-4 border-t border-slate-800/60">
                        {/* Read-only stats */}
                        <div className="flex flex-wrap gap-6 items-center">
                            <div>
                                <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold">Toplam İlerleme</span>
                                <div className="flex items-center gap-3 mt-1.5">
                                    <div className="w-32 bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                                        <div className="bg-violet-600 h-full rounded-full transition-all duration-500" style={{ width: `${watchPercentage}%` }} />
                                    </div>
                                    <span className="text-sm font-bold text-white">{watchPercentage}%</span>
                                </div>
                                <span className="text-[11px] text-slate-400 mt-1 block">
                                    {totalEpisodesCount} Bölümden {watchedCount} tanesi izlendi
                                </span>
                            </div>

                            <div className="hidden sm:block border-l border-slate-800 h-10 mx-1" />

                            <div>
                                <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold">Yayın Bilgisi</span>
                                <span className="text-sm font-bold text-slate-200 mt-1 block">
                                    {show.status === 'Running' ? (
                                        <span className="text-emerald-400 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            Yayınlanıyor
                                        </span>
                                    ) : (
                                        'Sonlandı'
                                    )}
                                </span>
                                {show.premiered && (
                                    <span className="text-[10px] text-slate-400 block mt-0.5">
                                        {show.premiered.slice(0, 4)} {show.ended ? ` - ${show.ended.slice(0, 4)}` : ''}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Follow Toggle */}
                        <button
                            onClick={() => onToggleFollow(show)}
                            disabled={isFollowPending}
                            className={`px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-wait ${isFollowed
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                                : 'bg-violet-600 text-white hover:bg-violet-700'
                                }`}
                        >
                            {isFollowPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Ekleniyor...
                                </>
                            ) : isFollowed ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Kütüphaneden Kaldır
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4" />
                                    Kütüphaneye Ekle
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Season Selection Tabs */}
            {seasonsList.length > 0 && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-px">
                        {seasonsList.map(seasonNum => {
                            const isActive = selectedSeason === seasonNum;
                            const seasonEps = seasonsMap[seasonNum] || [];
                            const seasonWatched = seasonEps.filter(ep => !!watchedEpisodes[ep.id]).length;
                            const seasonPercentageCalculated = seasonEps.length > 0 ? Math.round((seasonWatched / seasonEps.length) * 100) : 0;

                            return (
                                <button
                                    key={seasonNum}
                                    onClick={() => setSelectedSeason(seasonNum)}
                                    className={`px-4 py-2 border-b-2 font-bold text-sm transition-all relative pb-3 cursor-pointer ${isActive
                                        ? 'border-violet-500 text-white'
                                        : 'border-transparent text-slate-400 hover:text-slate-200'
                                        }`}
                                >
                                    Sezon {seasonNum}
                                    {seasonPercentageCalculated > 0 && (
                                        <span className="ml-2 text-[10px] bg-slate-900 border border-slate-800 text-violet-400 px-1.5 py-0.5 rounded-md font-bold">
                                            {seasonPercentageCalculated}%
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Season summary and quick controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800/40 p-4 rounded-xl">
                        <div className="text-sm text-slate-300">
                            <span className="font-semibold text-white">Sezon {selectedSeason}</span> &bull; {seasonTotalCount} Bölüm ({seasonAiredCount} yayınlandı, {seasonWatchedCount} izlendi)
                        </div>

                        {/* Quick Watch/Unwatch all aired episodes in this season */}
                        {isFollowed && seasonAiredCount > 0 && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        const activeAired = activeSeasonEpisodes.filter(ep => getEpisodeStatus(ep) === 'aired');
                                        const allWatched = activeAired.every(ep => !!watchedEpisodes[ep.id]);
                                        onToggleWatchBatch(show.id, activeAired.map(ep => ep.id), !allWatched);
                                    }}
                                    className="bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-800 transition-all flex items-center gap-1.5 active:scale-95"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                    {activeSeasonEpisodes.filter(ep => getEpisodeStatus(ep) === 'aired').every(ep => !!watchedEpisodes[ep.id])
                                        ? 'Tümünü İzlendi İşaretini Kaldır'
                                        : 'Tümünü İzlendi İşaretle'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Episode List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeSeasonEpisodes.map((episode) => {
                            const isWatched = !!watchedEpisodes[episode.id];
                            const epStatus = getEpisodeStatus(episode);
                            const isAired = epStatus === 'aired';

                            return (
                                <div
                                    key={episode.id}
                                    onClick={() => setSelectedEpisode(episode)}
                                    className={`glass-panel p-5 rounded-2xl flex gap-4 transition-all duration-300 relative border cursor-pointer hover:bg-slate-900/40 hover:border-slate-700/60 ${isWatched
                                        ? 'border-violet-900/35 bg-violet-950/5'
                                        : 'border-slate-800/60'
                                        }`}
                                >
                                    {/* Episode thumbnail or placeholder */}
                                    <div className="w-24 h-16 sm:w-28 sm:h-20 shrink-0 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 relative self-start">
                                        {episode.image?.medium ? (
                                            <img
                                                src={episode.image.medium}
                                                alt={episode.name}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-600 font-bold p-1 text-center bg-slate-950">
                                                Görsel Yok
                                            </div>
                                        )}

                                        {/* Floating Code tag (S01E03) */}
                                        <span className="absolute bottom-1 right-1 bg-black/85 text-slate-300 text-[9px] px-1 py-0.5 rounded font-black tracking-wider">
                                            S{String(episode.season).padStart(2, '0')}E{String(episode.number).padStart(2, '0')}
                                        </span>
                                    </div>

                                    {/* Episode Metadata */}
                                    <div className="flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start gap-2">
                                                <h4 className="text-sm font-bold text-white line-clamp-1 group-hover:text-violet-400 leading-snug">
                                                    {episode.name}
                                                </h4>

                                                {/* Watch toggle checkbox / eye button */}
                                                {isFollowed && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (isAired) {
                                                                onToggleWatch(show.id, episode.id, !isWatched, episode.runtime);
                                                            }
                                                        }}
                                                        disabled={!isAired}
                                                        title={isAired ? (isWatched ? 'İzlenmedi olarak işaretle' : 'İzlendi olarak işaretle') : 'Bölüm henüz yayınlanmadı'}
                                                        className={`p-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${!isAired
                                                            ? 'bg-slate-900 text-slate-600 border-slate-800/30 cursor-not-allowed opacity-50'
                                                            : isWatched
                                                                ? 'bg-violet-600/15 border-violet-500/35 text-violet-400 hover:bg-violet-600/25'
                                                                : 'bg-slate-800/60 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-200'
                                                            }`}
                                                    >
                                                        {isWatched ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Episode summary */}
                                            <p className="text-slate-400 text-[11px] line-clamp-2 mt-1.5 leading-normal">
                                                {stripHtml(episode.summary)}
                                            </p>
                                        </div>

                                        {/* Air date / Runtime row */}
                                        <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-800/40">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {episode.airdate ? episode.airdate.split('-').reverse().join('.') : 'Bilinmiyor'}
                                            </span>
                                            {episode.runtime && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {episode.runtime} dk
                                                </span>
                                            )}
                                            {!isAired && (
                                                <span className="ml-auto text-[9px] bg-slate-900 border border-slate-800 text-orange-400 font-bold px-1.5 py-0.5 rounded">
                                                    Bekleniyor
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Episode details modal */}
            {selectedEpisode && (
                <EpisodeDetailsModal
                    episode={selectedEpisode}
                    showId={show.id}
                    onClose={() => setSelectedEpisode(null)}
                />
            )}
        </div>
    );
}
