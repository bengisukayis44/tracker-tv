import React, { useState } from 'react';
import { Search as SearchIcon, Plus, Check, Loader2, Info, AlertCircle } from 'lucide-react';
import { tvmazeApi } from '../services/api';

export default function Search({ followedShows, pendingFollows, onToggleFollow, onSelectShow }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [error, setError] = useState(null);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError(null);
        try {
            const data = await tvmazeApi.searchShows(query);
            setResults(data);
            setSearched(true);
        } catch (err) {
            console.error(err);
            setResults([]);
            setError('Arama yapılırken bir hata oluştu. İnternet bağlantınızı kontrol edip tekrar deneyin.');
        } finally {
            setLoading(false);
        }
    };

    const stripHtml = (html) => {
        if (!html) return 'Açıklama bulunamadı.';
        return html.replace(/<\/?[^>]+(>|$)/g, "");
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white">Dizi Bul</h1>
                    <p className="text-slate-400 mt-1">Takip etmek istediğiniz yeni dizileri arayın ve kütüphanenize ekleyin.</p>
                </div>
            </div>

            {/* Search Bar Form */}
            <form onSubmit={handleSearch} className="max-w-2xl flex gap-3">
                <div className="relative flex-1">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Dizi adı yazın... (Örn: Breaking Bad, Sherlock)"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all"
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-violet-600 hover:bg-violet-700 text-white font-medium px-6 py-3 rounded-xl transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        'Ara'
                    )}
                </button>
            </form>

            {/* Results Grid */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                    <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
                    <p>Diziler aranıyor...</p>
                </div>
            ) : error ? (
                <div className="text-center py-20 text-slate-400 glass-panel rounded-2xl max-w-xl mx-auto p-8 space-y-3">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                    <p className="text-lg font-semibold text-slate-300">Arama Başarısız</p>
                    <p className="text-sm">{error}</p>
                </div>
            ) : results.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {results.map((show) => {
                        const isFollowed = !!followedShows[show.id];
                        const isPending = !!pendingFollows[show.id];

                        return (
                            <div
                                key={show.id}
                                className="glass-panel glass-panel-hover rounded-2xl overflow-hidden flex flex-col h-full group"
                            >
                                {/* Poster Container */}
                                <div className="relative aspect-[2/3] bg-slate-900 overflow-hidden cursor-pointer" onClick={() => onSelectShow(show.id)}>
                                    {show.image?.medium ? (
                                        <img
                                            src={show.image.medium}
                                            alt={show.name}
                                            loading="lazy"
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-slate-500">
                                            <span className="text-xl font-bold mb-2">Poster</span>
                                            <span>Yok</span>
                                        </div>
                                    )}

                                    {/* Top Badges */}
                                    <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-none">
                                        {show.rating?.average && (
                                            <span className="bg-black/70 backdrop-blur-md text-amber-400 font-bold px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 border border-amber-400/20">
                                                ★ {show.rating.average.toFixed(1)}
                                            </span>
                                        )}
                                        {show.status && (
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${show.status === 'Running'
                                                    ? 'bg-emerald-500/80 text-white'
                                                    : 'bg-slate-700/80 text-slate-200'
                                                }`}>
                                                {show.status === 'Running' ? 'Devam Ediyor' : 'Final Yaptı'}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Info Container */}
                                <div className="p-5 flex-1 flex flex-col justify-between">
                                    <div className="space-y-2">
                                        <h3
                                            onClick={() => onSelectShow(show.id)}
                                            className="text-lg font-bold text-white leading-snug cursor-pointer hover:text-violet-400 transition-colors"
                                        >
                                            {show.name}
                                        </h3>

                                        {/* Genres */}
                                        {show.genres && show.genres.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {show.genres.slice(0, 2).map((genre) => (
                                                    <span key={genre} className="bg-slate-800/60 text-slate-300 text-[10px] px-2 py-0.5 rounded-full border border-slate-700/30">
                                                        {genre}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Summary */}
                                        <p className="text-slate-400 text-xs line-clamp-3 leading-relaxed mt-2">
                                            {stripHtml(show.summary)}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="mt-5 pt-4 border-t border-slate-800/50 flex gap-2">
                                        <button
                                            onClick={() => onToggleFollow(show)}
                                            disabled={isPending}
                                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-60 disabled:cursor-wait ${isFollowed
                                                    ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                                                    : 'bg-violet-600 text-white hover:bg-violet-700'
                                                }`}
                                        >
                                            {isPending ? (
                                                <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    Ekleniyor...
                                                </>
                                            ) : isFollowed ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5" />
                                                    Takip Ediliyor
                                                </>
                                            ) : (
                                                <>
                                                    <Plus className="w-3.5 h-3.5" />
                                                    Takip Et
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => onSelectShow(show.id)}
                                            aria-label="Detaylar"
                                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg border border-slate-700/30"
                                        >
                                            <Info className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : searched ? (
                <div className="text-center py-20 text-slate-400 glass-panel rounded-2xl max-w-xl mx-auto p-8 space-y-3">
                    <p className="text-lg font-semibold text-slate-300">Dizi Bulunamadı</p>
                    <p className="text-sm">Girdiğiniz kelimeye uygun bir dizi bulamadık. Lütfen farklı harflerle tekrar deneyin veya dizi adının doğru olduğundan emin olun.</p>
                </div>
            ) : (
                <div className="text-center py-20 text-slate-500">
                    <SearchIcon className="w-12 h-12 mx-auto mb-4 text-slate-700" />
                    <p className="max-w-md mx-auto text-sm">Üst kısımdaki kutucuğa bir dizi ismi yazarak, kütüphanenize yeni seriler ekleyebilirsiniz.</p>
                </div>
            )}
        </div>
    );
}
