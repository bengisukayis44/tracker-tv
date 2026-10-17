import React, { useState, useEffect } from 'react';
import { X, Star, MessageSquare, Send, Trash2, User, AlertTriangle, Loader2 } from 'lucide-react';
import { tvmazeApi } from '../services/api';

export default function EpisodeDetailsModal({ episode, showId, onClose }) {
    const [cast, setCast] = useState([]);
    const [loadingCast, setLoadingCast] = useState(true);
    const [castError, setCastError] = useState(false);

    // Local storage state
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [mood, setMood] = useState('');
    const [votedCharacter, setVotedCharacter] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [isSpoiler, setIsSpoiler] = useState(false);

    // Cast member search filter
    const [castFilter, setCastFilter] = useState('');

    // Mood options definitions
    const moodOptions = [
        { key: 'sad', emoji: '😭', label: 'Duygulandım' },
        { key: 'funny', emoji: '😂', label: 'Komik' },
        { key: 'scary', emoji: '😱', label: 'Gerilimli' },
        { key: 'epic', emoji: '🔥', label: 'Efsane!' },
        { key: 'boring', emoji: '🥱', label: 'Sıkıcı' },
    ];

    // Fetch cast on mount
    useEffect(() => {
        let active = true;
        const fetchCast = async () => {
            setLoadingCast(true);
            setCastError(false);
            try {
                const castData = await tvmazeApi.getShowCast(showId);
                if (active) {
                    // TVmaze returns array: [{ person: {...}, character: {...} }]
                    setCast(castData || []);
                }
            } catch (err) {
                console.error('Oyuncu listesi yüklenemedi:', err);
                if (active) {
                    setCastError(true);
                }
            } finally {
                if (active) {
                    setLoadingCast(false);
                }
            }
        };

        if (showId) {
            fetchCast();
        }

        return () => {
            active = false;
        };
    }, [showId]);

    // Close on Escape and keep the page behind the modal from scrolling
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    // Load existing episode features data from LocalStorage
    useEffect(() => {
        try {
            const storedData = localStorage.getItem('tv-tracker-episode-data');
            if (storedData) {
                const parsed = JSON.parse(storedData);
                const epData = parsed[episode.id] || {};

                setRating(epData.rating || 0);
                setMood(epData.mood || '');
                setVotedCharacter(epData.votedCharacter || null);
                setComments(epData.comments || []);
            }
        } catch (e) {
            console.error('LocalStorage veri okuma hatası:', e);
        }
    }, [episode.id]);

    // Helper to save all data to LocalStorage
    const saveData = (updatedFields) => {
        try {
            const storedData = localStorage.getItem('tv-tracker-episode-data') || '{}';
            const parsed = JSON.parse(storedData);

            parsed[episode.id] = {
                rating: updatedFields.hasOwnProperty('rating') ? updatedFields.rating : rating,
                mood: updatedFields.hasOwnProperty('mood') ? updatedFields.mood : mood,
                votedCharacter: updatedFields.hasOwnProperty('votedCharacter') ? updatedFields.votedCharacter : votedCharacter,
                comments: updatedFields.hasOwnProperty('comments') ? updatedFields.comments : comments,
            };

            localStorage.setItem('tv-tracker-episode-data', JSON.stringify(parsed));
        } catch (e) {
            console.error('LocalStorage yazma hatası:', e);
        }
    };

    const handleRatingChange = (newVal) => {
        setRating(newVal);
        saveData({ rating: newVal });
    };

    const handleMoodChange = (selectedMood) => {
        const newVal = mood === selectedMood ? '' : selectedMood; // toggle mood
        setMood(newVal);
        saveData({ mood: newVal });
    };

    const handleVote = (characterData) => {
        // If clicking already voted, toggle off, otherwise set it
        const newVal = votedCharacter && votedCharacter.id === characterData.id ? null : characterData;
        setVotedCharacter(newVal);
        saveData({ votedCharacter: newVal });
    };

    const handleAddComment = (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        const newCommentObj = {
            id: Date.now(),
            text: newComment.trim(),
            spoiler: isSpoiler,
            timestamp: new Date().toLocaleString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            }),
        };

        const updatedComments = [newCommentObj, ...comments];
        setComments(updatedComments);
        setNewComment('');
        setIsSpoiler(false);
        saveData({ comments: updatedComments });
    };

    const handleDeleteComment = (commentId) => {
        const updatedComments = comments.filter((c) => c.id !== commentId);
        setComments(updatedComments);
        saveData({ comments: updatedComments });
    };

    const stripHtml = (html) => {
        if (!html) return 'Açıklama mevcut değil.';
        return html.replace(/<\/?[^>]+(>|$)/g, "");
    };

    // Filtered cast members list
    const filteredCast = cast.filter((item) => {
        const charName = item.character?.name?.toLowerCase() || '';
        const actorName = item.person?.name?.toLowerCase() || '';
        const filter = castFilter.toLowerCase();
        return charName.includes(filter) || actorName.includes(filter);
    });

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="w-full max-w-4xl bg-[#0B0F17]/95 border border-slate-800/80 rounded-3xl overflow-hidden glass-panel flex flex-col max-h-[90vh] shadow-[0_15px_40px_-15px_rgba(0,0,0,0.5)]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-800/60 flex items-center justify-between bg-slate-900/30">
                    <div>
                        <div className="text-[10px] uppercase tracking-wider text-violet-400 font-extrabold mb-1">
                            Sezon {episode.season} &bull; Bölüm {episode.number}
                        </div>
                        <h2 className="text-xl md:text-2xl font-black text-white leading-tight">{episode.name}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Kapat"
                        className="p-2 hover:bg-slate-800 hover:text-white rounded-xl text-slate-400 transition-all cursor-pointer border border-transparent hover:border-slate-800/50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 select-text">
                    {/* Episode Info Banner */}
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                        <div className="w-full md:w-72 shrink-0 aspect-video md:aspect-[16/10] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 relative shadow-inner">
                            {episode.image?.original || episode.image?.medium ? (
                                <img
                                    src={episode.image.original || episode.image.medium}
                                    alt={episode.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 font-bold bg-slate-950/65">
                                    Bölüm Görseli Bulunamadı
                                </div>
                            )}
                        </div>
                        <div className="flex-1 space-y-4">
                            <span className="inline-block text-[11px] font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md">
                                Yayın Tarihi: {episode.airdate ? episode.airdate.split('-').reverse().join('.') : 'Bilinmiyor'}
                                {episode.runtime ? ` • ${episode.runtime} Dk` : ''}
                            </span>
                            <p className="text-slate-300 text-sm md:text-base leading-relaxed font-normal">
                                {stripHtml(episode.summary)}
                            </p>
                        </div>
                    </div>

                    {/* Interactive Actions Grid: Puanlama / Tepki */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-800/50">
                        {/* Rating Section */}
                        <div className="glass-panel p-5 rounded-2xl bg-slate-900/20 flex flex-col justify-between space-y-4">
                            <div>
                                <h3 className="font-extrabold text-sm text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                    <Star className="w-4 h-4 text-violet-400 fill-violet-400/10" />
                                    Bölüm Puanı
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">Bu bölümü 5 yıldız üzerinden değerlendirin.</p>
                            </div>
                            <div className="flex items-center gap-2 py-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => handleRatingChange(star)}
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                        className="p-1 text-slate-600 hover:scale-110 transition-transform cursor-pointer"
                                    >
                                        <Star
                                            className={`w-8 h-8 transition-colors ${star <= (hoverRating || rating)
                                                    ? 'text-amber-400 fill-amber-400'
                                                    : 'text-slate-700 fill-transparent'
                                                }`}
                                        />
                                    </button>
                                ))}
                            </div>
                            <div className="text-xs text-slate-400 font-bold">
                                {rating > 0 ? `${rating} / 5 Yıldız verdiniz.` : 'Henüz puan verilmedi.'}
                            </div>
                        </div>

                        {/* Mood Selector Section */}
                        <div className="glass-panel p-5 rounded-2xl bg-slate-900/20 flex flex-col justify-between space-y-4">
                            <div>
                                <h3 className="font-extrabold text-sm text-slate-200 uppercase tracking-wider">
                                    Bölüm Hissi / Tepki
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">Bölümü izlerken ne hissettiniz?</p>
                            </div>
                            <div className="flex flex-wrap gap-2 py-1">
                                {moodOptions.map((opt) => {
                                    const isSelected = mood === opt.key;
                                    return (
                                        <button
                                            key={opt.key}
                                            onClick={() => handleMoodChange(opt.key)}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${isSelected
                                                    ? 'bg-violet-600/15 border-violet-500/50 text-white'
                                                    : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                                                }`}
                                        >
                                            <span className="text-lg">{opt.emoji}</span>
                                            <span>{opt.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="text-xs text-slate-400 font-bold">
                                {mood
                                    ? `Şu tepkiyi verdiniz: ${moodOptions.find(m => m.key === mood)?.emoji} ${moodOptions.find(m => m.key === mood)?.label}`
                                    : 'Henüz bir his seçilmedi.'}
                            </div>
                        </div>
                    </div>

                    {/* Character Poll (Bu bölümün yıldızı kimdi?) */}
                    <div className="pt-6 border-t border-slate-800/50">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <div>
                                <h3 className="font-black text-base text-white">Bu Bölümün Yıldızı Kimdi?</h3>
                                <p className="text-xs text-slate-500 mt-0.5">En sevdiğiniz karakter için 1 adet oy kullanabilirsiniz.</p>
                            </div>

                            {/* Optional Simple Search Box if cast is larger */}
                            {cast.length > 5 && (
                                <input
                                    type="text"
                                    placeholder="Karakter ara..."
                                    value={castFilter}
                                    onChange={(e) => setCastFilter(e.target.value)}
                                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-all font-medium"
                                />
                            )}
                        </div>

                        {loadingCast ? (
                            <div className="flex items-center gap-2 text-slate-500 py-6 text-xs font-medium justify-center">
                                <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                                Oyuncular yükleniyor...
                            </div>
                        ) : castError ? (
                            <div className="text-slate-500 py-4 text-xs font-medium text-center">
                                Oyuncu kadrosu API servisinden çekilemedi.
                            </div>
                        ) : cast.length === 0 ? (
                            <div className="text-slate-500 py-4 text-xs font-medium text-center">
                                Bu dizinin oyuncu kadrosu mevcut değil.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[220px] overflow-y-auto pr-1">
                                {filteredCast.map((item) => {
                                    const charId = item.character.id;
                                    const charName = item.character.name;
                                    const actorName = item.person.name;
                                    const imgUrl = item.character.image?.medium || item.person.image?.medium;

                                    const isVoted = votedCharacter && votedCharacter.id === charId;

                                    return (
                                        <button
                                            key={charId}
                                            onClick={() => handleVote({ id: charId, name: charName, image: imgUrl })}
                                            className={`flex items-center gap-3 p-2 rounded-xl text-left border transition-all cursor-pointer ${isVoted
                                                    ? 'bg-violet-950/20 border-violet-500/60 shadow-[0_0_12px_rgba(139,92,246,0.1)]'
                                                    : 'bg-slate-900/30 border-slate-800/60 hover:bg-slate-900/50 hover:border-slate-800'
                                                }`}
                                        >
                                            <div className="w-10 h-10 shrink-0 bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
                                                {imgUrl ? (
                                                    <img src={imgUrl} alt={charName} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-600 font-bold bg-slate-950">
                                                        Yok
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 pr-1">
                                                <div className="text-xs font-extrabold text-white truncate leading-tight">{charName}</div>
                                                <div className="text-[10px] text-slate-500 truncate mt-0.5">{actorName}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {votedCharacter && (
                            <div className="mt-3 bg-violet-600/5 border border-violet-500/20 rounded-xl p-3 text-xs flex items-center gap-3">
                                <div className="p-1 px-2.5 bg-violet-600/10 text-violet-400 font-extrabold rounded-lg border border-violet-500/30">Seçildi</div>
                                <div className="text-slate-300 font-bold">
                                    Bu bölümün yıldızı olarak <span className="text-neutral-100 underline decoration-violet-500 decoration-2">{votedCharacter.name}</span> karakterine oy verdiniz.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Comments Section */}
                    <div className="pt-6 border-t border-slate-800/50 space-y-5">
                        <h3 className="font-black text-base text-white flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-slate-400" />
                            Bölüm Yorumları
                        </h3>

                        {/* Comment Form */}
                        <form onSubmit={handleAddComment} className="space-y-3">
                            <textarea
                                placeholder="Bu bölüm hakkında yorum yapın..."
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                maxLength={400}
                                required
                                className="w-full bg-[#080B11] border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all min-h-[90px] resize-none leading-relaxed"
                            />

                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <label className="flex items-center gap-2 text-xs text-slate-400 font-bold cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={isSpoiler}
                                        onChange={(e) => setIsSpoiler(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-800 text-violet-600 focus:ring-violet-500 focus:ring-offset-slate-900 bg-slate-900 accent-violet-600 cursor-pointer"
                                    />
                                    <span>Spoiler içeriyor</span>
                                </label>

                                <button
                                    type="submit"
                                    disabled={!newComment.trim()}
                                    className="bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/40 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-950/20 active:scale-95"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    Gönder
                                </button>
                            </div>
                        </form>

                        {/* Comment List */}
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                            {comments.length === 0 ? (
                                <p className="text-slate-500 text-xs py-4 text-center font-medium">Bu bölüme henüz yorum yapılmamış.</p>
                            ) : (
                                comments.map((comment) => (
                                    <CommentItem
                                        key={comment.id}
                                        comment={comment}
                                        onDelete={handleDeleteComment}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Inner helper component for spoiler management and comment design
function CommentItem({ comment, onDelete }) {
    const [showSpoiler, setShowSpoiler] = useState(!comment.spoiler);

    return (
        <div className="bg-slate-900/25 border border-slate-800/50 rounded-2xl p-4 flex gap-3 relative transition-all group">
            <div className="p-2.5 bg-slate-800 rounded-xl h-10 w-10 shrink-0 flex items-center justify-center border border-slate-700/55 self-start text-slate-500">
                <User className="w-5 h-5" />
            </div>

            <div className="flex-1 space-y-1.5 min-w-0">
                <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-extrabold text-slate-300">Kullanıcı</span>
                    <span className="text-[10px] text-slate-500 font-bold">{comment.timestamp}</span>
                </div>

                {comment.spoiler && !showSpoiler ? (
                    <div
                        onClick={() => setShowSpoiler(true)}
                        className="flex items-center gap-2 p-3 bg-red-950/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl cursor-pointer hover:bg-red-950/20 transition-all animate-pulse"
                    >
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Bu yorum spoiler içermektedir. Görmek için tıklayın.</span>
                    </div>
                ) : (
                    <p className="text-slate-300 text-xs leading-relaxed break-words font-medium whitespace-pre-wrap">
                        {comment.text}
                    </p>
                )}

                {comment.spoiler && showSpoiler && (
                    <span className="inline-block text-[9px] uppercase tracking-wider bg-red-500/10 border border-red-500/25 text-red-400 font-extrabold px-1.5 py-0.5 rounded">
                        Spoiler
                    </span>
                )}
            </div>

            {/* Delete button (displays on hover) */}
            <button
                onClick={() => onDelete(comment.id)}
                className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-all absolute top-2 right-2 cursor-pointer border border-transparent hover:border-red-500/20"
                title="Yorumu sil"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    );
}
