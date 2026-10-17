import React, { useState, useEffect, useRef } from 'react';
import { Film, Search, ClipboardList, Tv, Menu, X, AlertCircle } from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import Dashboard from './components/Dashboard';
import Watchlist from './components/Watchlist';
import SearchComponent from './components/Search';
import ShowDetails from './components/ShowDetails';
import { tvmazeApi } from './services/api';

// Followed shows that are still airing get their episode list refreshed after this long
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Build the LocalStorage entry for a followed show from TVmaze details with embedded episodes
function buildFollowedEntry(show) {
  const episodesList = show._embedded?.episodes || [];
  return {
    id: show.id,
    name: show.name,
    image: show.image,
    status: show.status,
    rating: show.rating,
    genres: show.genres,
    network: show.network,
    webChannel: show.webChannel,
    summary: show.summary,
    totalEpisodes: episodesList.length,
    averageRuntime: show.averageRuntime || 45,
    syncedAt: Date.now(),
    episodesList: episodesList.map(ep => ({
      id: ep.id,
      name: ep.name,
      season: ep.season,
      number: ep.number,
      airdate: ep.airdate,
      airtime: ep.airtime,
      runtime: ep.runtime
    }))
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | watchlist | search | details
  const [selectedShowId, setSelectedShowId] = useState(null);

  // Sidebar visibility on mobile
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // LocalStorage state management
  const [followedShows, setFollowedShows] = useLocalStorage('tv-tracker-shows', {});
  const [watchedEpisodes, setWatchedEpisodes] = useLocalStorage('tv-tracker-watched', {});

  // Navigation history stacks for detail views
  const [prevTab, setPrevTab] = useState('dashboard');

  // Show ids whose follow request is in flight, and the last follow error message
  const [pendingFollows, setPendingFollows] = useState({});
  const [followError, setFollowError] = useState(null);

  // Refresh episode lists of running shows once per app load so new episodes show up
  const syncStartedRef = useRef(false);
  useEffect(() => {
    if (syncStartedRef.current) return;
    syncStartedRef.current = true;

    const staleShows = Object.values(followedShows).filter(show =>
      show.status !== 'Ended' && Date.now() - (show.syncedAt || 0) > SYNC_INTERVAL_MS
    );
    staleShows.forEach(async (show) => {
      try {
        const fullDetails = await tvmazeApi.getShowDetails(show.id);
        setFollowedShows(prev => (prev[show.id] ? { ...prev, [show.id]: buildFollowedEntry(fullDetails) } : prev));
      } catch (err) {
        console.error(`"${show.name}" bölümleri güncellenemedi:`, err);
      }
    });
  }, [followedShows, setFollowedShows]);

  useEffect(() => {
    if (!followError) return;
    const timer = setTimeout(() => setFollowError(null), 5000);
    return () => clearTimeout(timer);
  }, [followError]);

  const handleToggleFollow = async (show) => {
    // If show is already followed, remove it
    if (followedShows[show.id]) {
      setFollowedShows(prev => {
        const updated = { ...prev };
        delete updated[show.id];
        return updated;
      });
      return;
    }

    if (pendingFollows[show.id]) return;

    // Fetch full details with episodes to store all episodes in LocalStorage
    setPendingFollows(prev => ({ ...prev, [show.id]: true }));
    setFollowError(null);
    try {
      const fullDetails = await tvmazeApi.getShowDetails(show.id);
      setFollowedShows(prev => ({ ...prev, [show.id]: buildFollowedEntry(fullDetails) }));
    } catch (err) {
      console.error('Kütüphaneye eklenirken bir hata oluştu:', err);
      setFollowError(`"${show.name}" kütüphaneye eklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.`);
    } finally {
      setPendingFollows(prev => {
        const updated = { ...prev };
        delete updated[show.id];
        return updated;
      });
    }
  };

  const handleToggleWatch = (showId, episodeId, isWatched, runtime) => {
    setWatchedEpisodes(prev => {
      const updated = { ...prev };
      if (isWatched) {
        updated[episodeId] = true;
      } else {
        delete updated[episodeId];
      }
      return updated;
    });
  };

  const handleToggleWatchBatch = (showId, episodeIds, isWatched) => {
    setWatchedEpisodes(prev => {
      const updated = { ...prev };
      episodeIds.forEach(id => {
        if (isWatched) {
          updated[id] = true;
        } else {
          delete updated[id];
        }
      });
      return updated;
    });
  };

  const handleSelectShow = (showId) => {
    setPrevTab(activeTab === 'details' ? 'dashboard' : activeTab);
    setSelectedShowId(showId);
    setActiveTab('details');
  };

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            followedShows={followedShows}
            watchedEpisodes={watchedEpisodes}
            onSelectShow={handleSelectShow}
            onNavigateToSearch={() => setActiveTab('search')}
          />
        );
      case 'watchlist':
        return (
          <Watchlist
            followedShows={followedShows}
            watchedEpisodes={watchedEpisodes}
            onToggleWatch={handleToggleWatch}
            onSelectShow={handleSelectShow}
          />
        );
      case 'search':
        return (
          <SearchComponent
            followedShows={followedShows}
            pendingFollows={pendingFollows}
            onToggleFollow={handleToggleFollow}
            onSelectShow={handleSelectShow}
          />
        );
      case 'details':
        return (
          <ShowDetails
            showId={selectedShowId}
            watchedEpisodes={watchedEpisodes}
            onToggleWatch={handleToggleWatch}
            onToggleWatchBatch={handleToggleWatchBatch}
            followedShows={followedShows}
            pendingFollows={pendingFollows}
            onToggleFollow={handleToggleFollow}
            onBack={() => setActiveTab(prevTab)}
          />
        );
      default:
        return (
          <Dashboard
            followedShows={followedShows}
            watchedEpisodes={watchedEpisodes}
            onSelectShow={handleSelectShow}
            onNavigateToSearch={() => setActiveTab('search')}
          />
        );
    }
  };

  const navItems = [
    { id: 'dashboard', name: 'Kütüphanem', icon: Film },
    { id: 'watchlist', name: 'İzlenecekler', icon: ClipboardList },
    { id: 'search', name: 'Dizi Ara', icon: Search }
  ];

  return (
    <div className="min-h-screen flex bg-[#080B11] text-slate-100">

      {/* Sidebar - Desktop */}
      <aside className="w-64 bg-[#0B0F17] border-r border-[#1E293B]/40 hidden md:flex flex-col shrink-0">
        <div className="p-6 border-b border-[#1E293B]/50 flex items-center gap-3">
          <div className="p-2.5 bg-violet-600/10 text-violet-500 rounded-xl border border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.1)]">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-white text-base tracking-wide block">Tracker.tv</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">Dizi Takip</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (activeTab === 'details' && prevTab === item.id);
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setPrevTab(item.id);
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${isActive
                  ? 'bg-violet-600 text-white shadow-[0_4px_12px_rgba(139,92,246,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                style={isActive ? { backgroundColor: '#8B5CF6' } : {}}
              >
                <Icon className="w-4.5 h-4.5" />
                {item.name}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#1E293B]/40 text-center text-[10px] text-slate-600 font-medium">
          Dizi & Bölüm Takip &copy; 2026
        </div>
      </aside>

      {/* Header - Mobile */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-[#0B0F17] border-b border-[#1E293B]/40 flex items-center justify-between px-6 md:hidden z-20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-600/10 text-violet-500 rounded-lg border border-violet-500/20">
              <Tv className="w-4.5 h-4.5" />
            </div>
            <span className="font-black text-white tracking-wide">Tracker.tv</span>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 top-16 bg-[#080B11]/95 backdrop-blur-md z-30 md:hidden flex flex-col border-b border-[#1E293B]/40 animate-fade-in">
            <nav className="p-6 space-y-2">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id || (activeTab === 'details' && prevTab === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setPrevTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl text-base font-bold transition-all cursor-pointer ${isActive
                      ? 'bg-violet-600 text-white shadow-[0_4px_12px_rgba(139,92,246,0.2)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.name}
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 max-w-7xl w-full mx-auto">
          {renderActiveComponent()}
        </main>

        {/* Follow error toast */}
        {followError && (
          <div
            role="alert"
            className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 flex items-start gap-3 bg-[#0B0F17] border border-red-500/30 text-red-300 text-sm font-medium rounded-xl p-4 shadow-lg animate-fade-in"
          >
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <span className="flex-1">{followError}</span>
            <button
              onClick={() => setFollowError(null)}
              aria-label="Kapat"
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
