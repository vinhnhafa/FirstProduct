import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Headphones,
  Search,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Volume2,
  VolumeX,
  Flame,
  Sparkles,
  History,
  Heart,
  ListPlus,
  Trash2,
  Loader2,
  RefreshCw,
  Mic2,
  Video,
  Clock,
  Eye,
  X,
  Share2,
  Youtube,
} from 'lucide-react';
import { ListeningHistoryItem, MusicTrack } from '../types/karaoke';
import { MUSIC_GENRES, STARTER_MUSIC_TRACKS } from '../data/musicCatalog';
import { extractYouTubeId, formatTime, removeVietnameseTones } from '../utils/vietnamese';

interface MusicListenPageProps {
  blockedYoutubeIds: Set<string>;
  onReportBrokenVideo: (youtubeId: string, title: string) => void;
  onSearchKaraokeVersion: (title: string) => void;
  onToast: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

const STORAGE_MUSIC_HISTORY_KEY = 'diepkhuc_music_history_v1';
const STORAGE_MUSIC_FAVS_KEY = 'diepkhuc_music_favs_v1';
const STORAGE_MUSIC_AUTOPLAY_KEY = 'diepkhuc_music_autoplay_v1';

function loadHistory(): ListeningHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_MUSIC_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore
  }
  return [];
}

function loadFavorites(): MusicTrack[] {
  try {
    const raw = localStorage.getItem(STORAGE_MUSIC_FAVS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore
  }
  return [];
}

function formatHistoryTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return '';
  }
}

export function MusicListenPage({
  blockedYoutubeIds,
  onReportBrokenVideo,
  onSearchKaraokeVersion,
  onToast,
}: MusicListenPageProps) {
  const [selectedGenre, setSelectedGenre] = useState<string>('Tất cả thể loại');
  const [sortMode, setSortMode] = useState<'all' | 'hot' | 'new'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');

  // Dynamic YouTube tracks + current player state
  const [liveTracks, setLiveTracks] = useState<MusicTrack[]>([]);
  const [isLoadingYt, setIsLoadingYt] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack>(STARTER_MUSIC_TRACKS[0]);
  const [upNextQueue, setUpNextQueue] = useState<MusicTrack[]>([]);
  const [autoplayNext, setAutoplayNext] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_MUSIC_AUTOPLAY_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const [repeatOne, setRepeatOne] = useState(false);
  const [expandVideo, setExpandVideo] = useState(false);

  // Listening History & Favorites
  const [history, setHistory] = useState<ListeningHistoryItem[]>(loadHistory);
  const [favorites, setFavorites] = useState<MusicTrack[]>(loadFavorites);
  const [rightTab, setRightTab] = useState<'chart' | 'history' | 'favorites'>('chart');
  const [chartTab, setChartTab] = useState<'hot' | 'new'>('hot');

  // Player playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(STARTER_MUSIC_TRACKS[0].durationSeconds);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);

  // YouTube IFrame refs
  const ytHostRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<{
    loadVideoById: (id: string) => void;
    playVideo: () => void;
    pauseVideo: () => void;
    seekTo: (s: number, allow?: boolean) => void;
    setVolume: (v: number) => void;
    mute: () => void;
    unMute: () => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    destroy: () => void;
  } | null>(null);
  const ytReadyRef = useRef(false);
  const currentTrackRef = useRef<MusicTrack>(currentTrack);
  const repeatOneRef = useRef(repeatOne);
  const autoplayNextRef = useRef(autoplayNext);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    repeatOneRef.current = repeatOne;
  }, [repeatOne]);

  useEffect(() => {
    autoplayNextRef.current = autoplayNext;
    try {
      localStorage.setItem(STORAGE_MUSIC_AUTOPLAY_KEY, String(autoplayNext));
    } catch {
      // Ignore
    }
  }, [autoplayNext]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MUSIC_HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Ignore
    }
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MUSIC_FAVS_KEY, JSON.stringify(favorites));
    } catch {
      // Ignore
    }
  }, [favorites]);

  const recordHistory = useCallback((track: MusicTrack) => {
    setHistory((prev) => {
      const existing = prev.find((h) => h.youtubeId === track.youtubeId);
      const nextEntry: ListeningHistoryItem = {
        youtubeId: track.youtubeId,
        title: track.title,
        artist: track.artist,
        genre: track.genre,
        durationSeconds: track.durationSeconds,
        viewCountText: track.viewCountText,
        listenedAt: Date.now(),
        playCount: (existing?.playCount || 0) + 1,
      };
      const filtered = prev.filter((h) => h.youtubeId !== track.youtubeId);
      return [nextEntry, ...filtered].slice(0, 80);
    });
  }, []);

  // Load YouTube tracks automatically when genre, sortMode, or search query changes
  const fetchLiveMusicFromYouTube = useCallback(
    (queryStr: string, genreStr: string, sortStr: 'all' | 'hot' | 'new') => {
      setIsLoadingYt(true);
      const apiGenre = genreStr === 'Tất cả thể loại' ? 'Tất cả' : genreStr;
      fetch(
        `/api/youtube/search?q=${encodeURIComponent(queryStr)}&genre=${encodeURIComponent(
          apiGenre
        )}&karaokeOnly=false&sort=${sortStr}`
      )
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((data: { items?: MusicTrack[] }) => {
          const items = Array.isArray(data.items) ? data.items : [];
          setLiveTracks(
            items.map((item) => ({
              id: item.id,
              youtubeId: item.youtubeId,
              title: item.title,
              artist: item.artist,
              genre: item.genre || (genreStr === 'Tất cả thể loại' ? 'Nhạc Trẻ Hot' : genreStr),
              durationSeconds: item.durationSeconds || 240,
              viewCountText: item.viewCountText,
              publishedTimeText: item.publishedTimeText,
              isHot: sortStr === 'hot',
              isNew: sortStr === 'new',
            }))
          );
        })
        .catch(() => {
          setLiveTracks([]);
        })
        .finally(() => {
          setIsLoadingYt(false);
        });
    },
    []
  );

  useEffect(() => {
    fetchLiveMusicFromYouTube(activeSearchQuery, selectedGenre, sortMode);
  }, [activeSearchQuery, selectedGenre, sortMode, fetchLiveMusicFromYouTube]);

  // Combined unblocked catalog for current filter
  const filteredTracks = useMemo(() => {
    const normalizedSearch = removeVietnameseTones(activeSearchQuery);
    const starterFiltered = STARTER_MUSIC_TRACKS.filter((t) => {
      if (blockedYoutubeIds.has(t.youtubeId)) return false;
      if (selectedGenre !== 'Tất cả thể loại' && t.genre !== selectedGenre) return false;
      if (sortMode === 'hot' && !t.isHot) return false;
      if (sortMode === 'new' && !t.isNew) return false;
      if (normalizedSearch) {
        const hay = removeVietnameseTones(`${t.title} ${t.artist} ${t.genre}`);
        if (!hay.includes(normalizedSearch)) return false;
      }
      return true;
    });

    const merged = [...liveTracks.filter((t) => !blockedYoutubeIds.has(t.youtubeId))];
    const seen = new Set(merged.map((t) => t.youtubeId));
    for (const s of starterFiltered) {
      if (!seen.has(s.youtubeId)) {
        seen.add(s.youtubeId);
        merged.push(s);
      }
    }
    return merged;
  }, [liveTracks, blockedYoutubeIds, selectedGenre, sortMode, activeSearchQuery]);

  // Top Hot & New lists for right sidebar chart
  const chartTracks = useMemo(() => {
    const pool = [...STARTER_MUSIC_TRACKS, ...liveTracks].filter(
      (t) => !blockedYoutubeIds.has(t.youtubeId)
    );
    const deduped: MusicTrack[] = [];
    const seen = new Set<string>();
    for (const item of pool) {
      if (!seen.has(item.youtubeId)) {
        seen.add(item.youtubeId);
        deduped.push(item);
      }
    }
    if (chartTab === 'new') {
      const news = deduped.filter((t) => t.isNew || (t.publishedTimeText || '').includes('2026') || (t.publishedTimeText || '').includes('trước'));
      return (news.length >= 4 ? news : deduped).slice(0, 10);
    }
    const hots = deduped.filter((t) => t.isHot || (t.viewCountText || '').includes('Tr'));
    return (hots.length >= 4 ? hots : deduped).slice(0, 10);
  }, [liveTracks, blockedYoutubeIds, chartTab]);

  // Next track helper
  const nextAutoTrack = useMemo(() => {
    if (upNextQueue.length > 0) return upNextQueue[0];
    const idx = filteredTracks.findIndex((t) => t.youtubeId === currentTrack.youtubeId);
    if (idx !== -1 && idx + 1 < filteredTracks.length) {
      return filteredTracks[idx + 1];
    }
    return filteredTracks.find((t) => t.youtubeId !== currentTrack.youtubeId) || null;
  }, [upNextQueue, filteredTracks, currentTrack.youtubeId]);

  const playTrack = useCallback(
    (track: MusicTrack, shouldRecord = true) => {
      if (blockedYoutubeIds.has(track.youtubeId)) {
        onToast('Video này không khả dụng để phát nhúng.', 'warning');
        return;
      }
      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(track.durationSeconds || 240);
      if (shouldRecord) {
        recordHistory(track);
      }
      if (ytReadyRef.current && ytPlayerRef.current) {
        ytPlayerRef.current.loadVideoById(track.youtubeId);
        ytPlayerRef.current.playVideo();
      }
    },
    [blockedYoutubeIds, onToast, recordHistory]
  );

  const handleNextTrack = useCallback(() => {
    if (upNextQueue.length > 0) {
      const [first, ...rest] = upNextQueue;
      setUpNextQueue(rest);
      playTrack(first);
      return;
    }
    if (nextAutoTrack) {
      playTrack(nextAutoTrack);
    }
  }, [upNextQueue, nextAutoTrack, playTrack]);

  const handlePrevTrack = useCallback(() => {
    if (history.length > 1) {
      const prevHist = history[1];
      playTrack(
        {
          id: `hist-${prevHist.youtubeId}`,
          youtubeId: prevHist.youtubeId,
          title: prevHist.title,
          artist: prevHist.artist,
          genre: prevHist.genre,
          durationSeconds: prevHist.durationSeconds,
          viewCountText: prevHist.viewCountText,
        },
        false
      );
      return;
    }
    const idx = filteredTracks.findIndex((t) => t.youtubeId === currentTrack.youtubeId);
    if (idx > 0) {
      playTrack(filteredTracks[idx - 1]);
    }
  }, [history, filteredTracks, currentTrack.youtubeId, playTrack]);

  const handleNextTrackRef = useRef(handleNextTrack);
  useEffect(() => {
    handleNextTrackRef.current = handleNextTrack;
  }, [handleNextTrack]);

  const onReportBrokenRef = useRef(onReportBrokenVideo);
  useEffect(() => {
    onReportBrokenRef.current = onReportBrokenVideo;
  }, [onReportBrokenVideo]);

  // Mount YouTube IFrame Player once for Music Listen Page
  useEffect(() => {
    if (!ytHostRef.current) return;
    let mounted = true;

    const setupPlayer = () => {
      if (!mounted || !ytHostRef.current || !window.YT?.Player) return;
      const target = document.createElement('div');
      target.className = 'w-full h-full';
      ytHostRef.current.innerHTML = '';
      ytHostRef.current.appendChild(target);

      ytPlayerRef.current = new window.YT.Player(target, {
        videoId: currentTrackRef.current.youtubeId,
        playerVars: {
          autoplay: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (e) => {
            if (!mounted) return;
            ytReadyRef.current = true;
            e.target.setVolume(volume);
            const d = e.target.getDuration?.();
            if (d && d > 0) setDuration(d);
          },
          onStateChange: (e) => {
            if (!mounted) return;
            if (e.data === 1) {
              setIsPlaying(true);
              const d = e.target.getDuration?.();
              if (d && d > 0) setDuration(d);
            } else if (e.data === 2) {
              setIsPlaying(false);
            } else if (e.data === 0) {
              setIsPlaying(false);
              if (repeatOneRef.current) {
                e.target.seekTo(0, true);
                e.target.playVideo();
              } else if (autoplayNextRef.current) {
                handleNextTrackRef.current();
              }
            }
          },
          onError: () => {
            if (!mounted) return;
            const broken = currentTrackRef.current;
            onReportBrokenRef.current(broken.youtubeId, broken.title);
            handleNextTrackRef.current();
          },
        },
      }) as unknown as typeof ytPlayerRef.current;
    };

    if (window.YT?.Player) {
      setupPlayer();
    } else {
      const prevCb = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevCb?.();
        setupPlayer();
      };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        s.async = true;
        document.head.appendChild(s);
      }
    }

    const timer = window.setInterval(() => {
      if (!ytReadyRef.current || !ytPlayerRef.current) return;
      try {
        const t = ytPlayerRef.current.getCurrentTime?.() || 0;
        const d = ytPlayerRef.current.getDuration?.() || 0;
        setCurrentTime(t);
        if (d > 0) setDuration(d);
      } catch {
        // Ignore
      }
    }, 500);

    return () => {
      mounted = false;
      ytReadyRef.current = false;
      window.clearInterval(timer);
      try {
        ytPlayerRef.current?.destroy();
      } catch {
        // Ignore
      }
      ytPlayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTogglePlay = () => {
    if (!ytReadyRef.current || !ytPlayerRef.current) return;
    if (isPlaying) {
      ytPlayerRef.current.pauseVideo();
    } else {
      // Ensure first play also logs into listening history if not yet recorded in this session
      if (history.length === 0 || history[0].youtubeId !== currentTrack.youtubeId) {
        recordHistory(currentTrack);
      }
      ytPlayerRef.current.playVideo();
    }
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    if (ytReadyRef.current && ytPlayerRef.current) {
      ytPlayerRef.current.setVolume(val);
      if (val > 0 && isMuted) {
        ytPlayerRef.current.unMute();
        setIsMuted(false);
      }
    }
  };

  const handleToggleMute = () => {
    if (!ytReadyRef.current || !ytPlayerRef.current) return;
    if (isMuted) {
      ytPlayerRef.current.unMute();
      setIsMuted(false);
    } else {
      ytPlayerRef.current.mute();
      setIsMuted(true);
    }
  };

  const handleSeek = (sec: number) => {
    setCurrentTime(sec);
    if (ytReadyRef.current && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(sec, true);
    }
  };

  const handleSearchSubmit = async () => {
    const trimmed = searchInput.trim();
    const ytId = extractYouTubeId(trimmed);
    if (ytId) {
      if (blockedYoutubeIds.has(ytId)) {
        onToast('Video YouTube này không hỗ trợ phát nhúng.', 'warning');
        return;
      }
      let title = `Video YouTube (${ytId})`;
      let artist = 'YouTube Music';
      try {
        const r = await fetch(`/api/youtube/oembed?id=${encodeURIComponent(ytId)}`);
        if (!r.ok) {
          onReportBrokenVideo(ytId, title);
          return;
        }
        const d = (await r.json()) as { title?: string; artist?: string };
        if (d.title) title = d.title;
        if (d.artist) artist = d.artist;
      } catch {
        // Use fallback
      }
      playTrack({
        id: `yt-${ytId}`,
        youtubeId: ytId,
        title,
        artist,
        genre: selectedGenre === 'Tất cả thể loại' ? 'Nhạc Trẻ Hot' : selectedGenre,
        durationSeconds: 240,
      });
      setSearchInput('');
      return;
    }
    setActiveSearchQuery(trimmed);
  };

  const isFavorite = favorites.some((f) => f.youtubeId === currentTrack.youtubeId);

  const toggleFavorite = (track: MusicTrack) => {
    const exists = favorites.some((f) => f.youtubeId === track.youtubeId);
    if (exists) {
      setFavorites((prev) => prev.filter((f) => f.youtubeId !== track.youtubeId));
      onToast(`Đã bỏ "${track.title}" khỏi Yêu thích.`, 'info');
    } else {
      setFavorites((prev) => [track, ...prev.filter((f) => f.youtubeId !== track.youtubeId)].slice(0, 60));
      onToast(`Đã lưu "${track.title}" vào danh sách Yêu thích!`, 'success');
    }
  };

  const featuredTrack = filteredTracks[0] || currentTrack;
  const listTracks = filteredTracks.slice(1);

  return (
    <div className="space-y-5">
      {/* Top All-Genres Navigation Bar (inspired by classic Vietnamese music portals) */}
      <div className="rounded-2xl overflow-hidden border border-purple-500/30 bg-[#111520] shadow-xl">
        <div className="bg-gradient-to-r from-[#311259] via-[#211345] to-[#131728] px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-purple-500/25">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Headphones className="w-4 h-4" />
            </span>
            <div>
              <h1 className="font-display text-base sm:text-lg font-bold tracking-tight text-amber-300 uppercase">
                Nghe Nhạc YouTube Tuyển Chọn
              </h1>
              <p className="text-[11px] text-purple-200/80">
                Đầy đủ thể loại · Chọn Nhạc Hot & Mới · Tự lưu lịch sử đã nghe
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRightTab('history')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-amber-300" />
              <span>Lịch sử ({history.length})</span>
            </button>
          </div>
        </div>

        {/* All Genres Row */}
        <div className="px-3 py-2.5 bg-[#151926] flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
          {MUSIC_GENRES.map((genre) => {
            const active = selectedGenre === genre;
            return (
              <button
                key={genre}
                type="button"
                onClick={() => {
                  setSelectedGenre(genre);
                  setActiveSearchQuery('');
                  setSearchInput('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Hot / New Filter Bar */}
      <div className="rounded-2xl bg-[#111520] border border-slate-800/90 p-3.5 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
              placeholder="Nhập từ khóa tìm kiếm bài hát, liên khúc, ca sĩ hoặc dán link YouTube..."
              className="w-full h-10 pl-10 pr-8 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
            />
            {(searchInput || activeSearchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setActiveSearchQuery('');
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                aria-label="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSearchSubmit}
            className="h-10 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-semibold whitespace-nowrap cursor-pointer"
          >
            Tìm Kiếm
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              { id: 'all', label: 'Tất cả', icon: Youtube },
              { id: 'hot', label: 'Nhạc Hot', icon: Flame },
              { id: 'new', label: 'Nhạc Mới', icon: Sparkles },
            ] as const
          ).map((mode) => {
            const Icon = mode.icon;
            const active = sortMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setSortMode(mode.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? mode.id === 'hot'
                      ? 'bg-rose-500 text-white'
                      : mode.id === 'new'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{mode.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => fetchLiveMusicFromYouTube(activeSearchQuery, selectedGenre, sortMode)}
            disabled={isLoadingYt}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 cursor-pointer"
            title="Tải mới danh sách từ YouTube"
          >
            {isLoadingYt ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
            )}
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Content (70% Player + Genre Catalog | 30% Up Next + Top Chart & History) */}
      <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-6 items-start">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Now Playing Music Deck (with embedded live YouTube Player) */}
          <div className="rounded-2xl bg-[#111520] border border-slate-800/90 overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-b border-slate-800/80">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-purple-500/60 shrink-0 bg-slate-900">
                  <img
                    src={`https://i.ytimg.com/vi/${currentTrack.youtubeId}/hqdefault.jpg`}
                    alt={currentTrack.title}
                    className={`w-full h-full object-cover ${isPlaying ? 'animate-[spin_14s_linear_infinite]' : ''}`}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-base sm:text-xl font-bold text-slate-50 line-clamp-2">
                    {currentTrack.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                    <span className="text-purple-300 font-medium">
                      Thể loại: {currentTrack.genre}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Kênh: {currentTrack.artist}</span>
                    {currentTrack.viewCountText && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          {currentTrack.viewCountText}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExpandVideo((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 shrink-0 cursor-pointer"
              >
                <Video className="w-3.5 h-3.5 text-purple-400" />
                <span>{expandVideo ? 'Thu gọn Video' : 'Xem Video lớn'}</span>
              </button>
            </div>

            {/* Embedded YouTube Player (kept visible so browser never blocks/throttles YT audio) */}
            <div className="bg-black/95 border-b border-slate-800/80 flex justify-center">
              <div
                className={
                  expandVideo
                    ? 'w-full aspect-video'
                    : 'w-full max-w-md aspect-video sm:h-40 sm:w-72 my-2 rounded-xl overflow-hidden border border-slate-800'
                }
              >
                <div ref={ytHostRef} className="w-full h-full" />
              </div>
            </div>

            {/* Custom Audio Transport Bar (mirroring the screenshot player strip) */}
            <div className="bg-gradient-to-r from-[#23123D] via-[#171929] to-[#131826] px-4 py-3 space-y-2.5">
              <input
                type="range"
                min={0}
                max={Math.max(duration, 1)}
                value={Math.min(currentTime, duration)}
                onChange={(e) => handleSeek(Number(e.target.value))}
                aria-label="Tua thời gian bài hát"
                className="karaoke-range w-full"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevTrack}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-100 cursor-pointer"
                    title="Bài trước"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className="w-11 h-11 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center text-white shadow-lg cursor-pointer"
                    title={isPlaying ? 'Tạm dừng' : 'Phát nhạc'}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleNextTrack}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-100 cursor-pointer"
                    title="Bài tiếp theo"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRepeatOne((v) => !v);
                      onToast(repeatOne ? 'Đã tắt lặp lại 1 bài.' : 'Đang lặp lại bài này.', 'info');
                    }}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                      repeatOne
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-white/10 hover:bg-white/20 text-slate-200'
                    }`}
                    title="Lặp lại bài này"
                  >
                    <Repeat className="w-4 h-4" />
                  </button>

                  <span className="ml-2 font-mono text-xs sm:text-sm text-slate-200 tabular-nums">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className="text-slate-200 hover:text-amber-300 cursor-pointer"
                    aria-label="Tắt/Bật âm thanh"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-purple-300" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="karaoke-range w-24"
                    aria-label="Âm lượng"
                  />
                </div>
              </div>
            </div>

            {/* Action strip below deck */}
            <div className="px-4 py-2.5 bg-slate-900/70 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleFavorite(currentTrack)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium border cursor-pointer ${
                    isFavorite
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                      : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-rose-500 text-rose-400' : ''}`} />
                  <span>{isFavorite ? 'Đã thích' : 'Yêu thích'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const shareText = `Đang nghe "${currentTrack.title}" trên Điệp Khúc Online: https://youtu.be/${currentTrack.youtubeId}`;
                    navigator.clipboard?.writeText(shareText).catch(() => {});
                    onToast('Đã sao chép link bài hát để chia sẻ!', 'success');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-sky-400" />
                  <span>Chia sẻ</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => onSearchKaraokeVersion(currentTrack.title)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 font-semibold cursor-pointer"
              >
                <Mic2 className="w-3.5 h-3.5" />
                <span>Tìm bản Karaoke để hát bài này</span>
              </button>
            </div>
          </div>

          {/* Section: Same Genre / Search Music List */}
          <div className="rounded-2xl bg-[#111520] border border-slate-800/90 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-50 uppercase">
                  {activeSearchQuery
                    ? `Kết quả tìm kiếm: "${activeSearchQuery}"`
                    : `${selectedGenre} — ${
                        sortMode === 'hot'
                          ? 'Nhạc Hot Nghe Nhiều'
                          : sortMode === 'new'
                          ? 'Tuyển Chọn Mới Nhất'
                          : 'Cùng Thể Loại'
                      }`}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tự động tải từ YouTube · Đã ẩn các video lỗi hoặc chặn nhúng ({filteredTracks.length} bài)
                </p>
              </div>
              {isLoadingYt && (
                <span className="inline-flex items-center gap-1.5 text-xs text-purple-300">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang tải thêm từ YouTube...
                </span>
              )}
            </div>

            {filteredTracks.length === 0 && !isLoadingYt ? (
              <div className="py-10 text-center text-sm text-slate-400">
                Không tìm thấy bài hát phù hợp. Hãy thử chọn thể loại khác hoặc nhập từ khóa mới.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Featured Top Track (like the big top card in screenshot) */}
                {featuredTrack && (
                  <div className="flex flex-col sm:flex-row gap-4 p-3 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-purple-500/40 transition-colors">
                    <button
                      type="button"
                      onClick={() => playTrack(featuredTrack)}
                      className="relative w-full sm:w-52 aspect-video rounded-lg overflow-hidden bg-black shrink-0 group cursor-pointer"
                    >
                      <img
                        src={`https://i.ytimg.com/vi/${featuredTrack.youtubeId}/hqdefault.jpg`}
                        alt={featuredTrack.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <span className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-80 group-hover:opacity-100">
                        <span className="w-11 h-11 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg">
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </span>
                      </span>
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[11px] text-slate-100 tabular-nums">
                        {formatTime(featuredTrack.durationSeconds)}
                      </span>
                    </button>

                    <div className="min-w-0 flex-1 flex flex-col justify-between gap-2">
                      <div>
                        <button
                          type="button"
                          onClick={() => playTrack(featuredTrack)}
                          className="text-left font-display text-base font-bold text-slate-100 hover:text-amber-300 transition-colors line-clamp-2 cursor-pointer"
                        >
                          {featuredTrack.title}
                        </button>
                        <p className="text-xs text-slate-400 mt-1">
                          Thể loại: <span className="text-purple-300">{featuredTrack.genre}</span> ·{' '}
                          {featuredTrack.artist}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {featuredTrack.viewCountText || 'Đề xuất nghe nhiều'}
                          {featuredTrack.publishedTimeText
                            ? ` · ${featuredTrack.publishedTimeText}`
                            : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => playTrack(featuredTrack)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Nghe ngay</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUpNextQueue((prev) => [...prev, featuredTrack]);
                            onToast(`Đã thêm "${featuredTrack.title}" vào Bài hát tiếp theo.`, 'success');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
                        >
                          <ListPlus className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Phát tiếp</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Track List Rows */}
                <div className="divide-y divide-slate-800/80">
                  {listTracks.map((track) => {
                    const isCurrent = track.youtubeId === currentTrack.youtubeId;
                    const fav = favorites.some((f) => f.youtubeId === track.youtubeId);
                    return (
                      <div
                        key={track.id}
                        className={`py-3 flex items-center justify-between gap-3 px-2 rounded-lg transition-colors ${
                          isCurrent ? 'bg-purple-500/10' : 'hover:bg-slate-900/60'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => playTrack(track)}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group"
                        >
                          <div className="relative w-20 h-12 rounded-md overflow-hidden bg-slate-900 shrink-0">
                            <img
                              src={`https://i.ytimg.com/vi/${track.youtubeId}/mqdefault.jpg`}
                              alt={track.title}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/80 font-mono text-[10px] text-slate-100 tabular-nums">
                              {formatTime(track.durationSeconds)}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-semibold line-clamp-1 group-hover:text-amber-300 transition-colors ${
                                isCurrent ? 'text-amber-300' : 'text-slate-100'
                              }`}
                            >
                              {track.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-400 mt-0.5">
                              <span className="truncate max-w-[160px]">{track.artist}</span>
                              {track.viewCountText && (
                                <span className="inline-flex items-center gap-1 tabular-nums">
                                  <Eye className="w-3 h-3" />
                                  {track.viewCountText}
                                </span>
                              )}
                              <span className="text-purple-300">{track.genre}</span>
                              {track.isHot && <span className="text-rose-400 font-semibold">Hot</span>}
                              {track.isNew && <span className="text-emerald-400 font-semibold">Mới</span>}
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleFavorite(track)}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 cursor-pointer"
                            title="Lưu Yêu thích"
                          >
                            <Heart className={`w-3.5 h-3.5 ${fav ? 'fill-rose-500 text-rose-400' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setUpNextQueue((prev) => [...prev, track]);
                              onToast(`Đã thêm "${track.title}" vào phát tiếp.`, 'success');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
                            title="Thêm vào Bài hát tiếp theo"
                          >
                            <ListPlus className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="hidden sm:inline">Phát tiếp</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Up Next + Autoplay Toggle + Top Chart / Listening History / Favorites */}
        <aside className="space-y-5 lg:sticky lg:top-20">
          {/* Up Next Card (mirrors screenshot's "BÀI HÁT TIẾP THEO" + green toggle) */}
          <div className="rounded-2xl bg-[#111520] border border-slate-800/90 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-slate-100 uppercase tracking-wide">
                Bài Hát Tiếp Theo
              </h3>
              <div className="inline-flex items-center gap-2 select-none">
                <span
                  onClick={() => setAutoplayNext((v) => !v)}
                  className="text-[11px] text-slate-400 cursor-pointer"
                >
                  Tự phát
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-label="Tự động phát bài tiếp theo"
                  aria-checked={autoplayNext}
                  onClick={() => setAutoplayNext((v) => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                    autoplayNext ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      autoplayNext ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {nextAutoTrack ? (
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={handleNextTrack}
                  className="text-left min-w-0 flex-1 cursor-pointer group"
                >
                  <p className="text-xs font-semibold text-sky-300 group-hover:text-amber-300 line-clamp-2">
                    {nextAutoTrack.title}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {nextAutoTrack.artist} · {formatTime(nextAutoTrack.durationSeconds)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={handleNextTrack}
                  className="p-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white shrink-0 cursor-pointer"
                  title="Phát bài tiếp theo ngay"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Chưa có bài hát kế tiếp.</p>
            )}

            {upNextQueue.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Hàng chờ riêng ({upNextQueue.length})</span>
                  <button
                    type="button"
                    onClick={() => setUpNextQueue([])}
                    className="text-rose-400 hover:underline cursor-pointer"
                  >
                    Xóa hàng chờ
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-1">
                  {upNextQueue.map((item, idx) => (
                    <div
                      key={`${item.youtubeId}-${idx}`}
                      className="flex items-center justify-between gap-2 text-xs py-1 px-2 rounded bg-slate-900/60"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setUpNextQueue((prev) => prev.filter((_, i) => i !== idx));
                          playTrack(item);
                        }}
                        className="truncate text-left text-slate-200 hover:text-amber-300 flex-1 cursor-pointer"
                      >
                        {idx + 1}. {item.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => setUpNextQueue((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-slate-500 hover:text-rose-400 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar Tabs: Top Chart | Listening History | Favorites */}
          <div className="rounded-2xl bg-[#111520] border border-slate-800/90 overflow-hidden">
            <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-900/70">
              <button
                type="button"
                onClick={() => setRightTab('chart')}
                className={`py-2.5 px-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  rightTab === 'chart'
                    ? 'border-purple-500 text-purple-300 bg-purple-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Nghe nhiều
              </button>
              <button
                type="button"
                onClick={() => setRightTab('history')}
                className={`py-2.5 px-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  rightTab === 'history'
                    ? 'border-amber-500 text-amber-300 bg-amber-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Lịch sử ({history.length})
              </button>
              <button
                type="button"
                onClick={() => setRightTab('favorites')}
                className={`py-2.5 px-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  rightTab === 'favorites'
                    ? 'border-rose-500 text-rose-300 bg-rose-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Đã thích ({favorites.length})
              </button>
            </div>

            {rightTab === 'chart' && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-200 uppercase">
                    {chartTab === 'hot' ? 'Nghe Nhiều Nhất' : 'Tuyển Chọn Mới'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setChartTab('hot')}
                      className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                        chartTab === 'hot'
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Hot
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartTab('new')}
                      className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                        chartTab === 'new'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Mới
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-800/70">
                  {chartTracks.map((track, idx) => (
                    <button
                      key={`chart-${track.youtubeId}`}
                      type="button"
                      onClick={() => playTrack(track)}
                      className="w-full py-2.5 text-left flex items-start gap-2.5 hover:bg-slate-900/60 px-1.5 rounded transition-colors cursor-pointer group"
                    >
                      <span
                        className={`font-mono text-sm font-bold tabular-nums shrink-0 w-5 ${
                          idx === 0
                            ? 'text-rose-400'
                            : idx === 1
                            ? 'text-amber-400'
                            : idx === 2
                            ? 'text-emerald-400'
                            : 'text-slate-500'
                        }`}
                      >
                        {idx + 1}.
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-200 group-hover:text-amber-300 line-clamp-2">
                          {track.title}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {track.genre}
                          {track.viewCountText ? ` · ${track.viewCountText}` : ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {rightTab === 'history' && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-200 uppercase">
                    Lịch Sử Đã Nghe
                  </span>
                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setHistory([]);
                        onToast('Đã xóa toàn bộ lịch sử nghe nhạc.', 'warning');
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Xóa hết</span>
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">
                    Bạn chưa nghe bài hát nào. Hãy bấm vào một bài hát bất kỳ để tự động lưu vào lịch sử!
                  </p>
                ) : (
                  <div className="max-h-[460px] overflow-y-auto custom-scrollbar divide-y divide-slate-800/70">
                    {history.map((item) => (
                      <div
                        key={item.youtubeId}
                        className="py-2.5 flex items-start justify-between gap-2 group"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            playTrack({
                              id: `hist-${item.youtubeId}`,
                              youtubeId: item.youtubeId,
                              title: item.title,
                              artist: item.artist,
                              genre: item.genre,
                              durationSeconds: item.durationSeconds,
                              viewCountText: item.viewCountText,
                            })
                          }
                          className="text-left min-w-0 flex-1 cursor-pointer"
                        >
                          <p className="text-xs font-semibold text-slate-100 group-hover:text-amber-300 line-clamp-2">
                            {item.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="text-purple-300">{item.genre}</span>
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Clock className="w-3 h-3" />
                              {formatHistoryTime(item.listenedAt)}
                            </span>
                            <span className="text-amber-300 font-mono tabular-nums">
                              {item.playCount} lượt
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setHistory((prev) =>
                              prev.filter((h) => h.youtubeId !== item.youtubeId)
                            )
                          }
                          className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer shrink-0"
                          title="Xóa khỏi lịch sử"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {rightTab === 'favorites' && (
              <div className="p-4 space-y-3">
                <span className="text-xs font-bold text-slate-200 uppercase block">
                  Bài Hát Yêu Thích
                </span>
                {favorites.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">
                    Bấm biểu tượng Trái tim ở bất kỳ bài hát nào để lưu vào danh sách Yêu thích.
                  </p>
                ) : (
                  <div className="max-h-[460px] overflow-y-auto custom-scrollbar divide-y divide-slate-800/70">
                    {favorites.map((fav) => (
                      <div
                        key={`fav-${fav.youtubeId}`}
                        className="py-2.5 flex items-center justify-between gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => playTrack(fav)}
                          className="text-left min-w-0 flex-1 cursor-pointer group"
                        >
                          <p className="text-xs font-semibold text-slate-100 group-hover:text-amber-300 line-clamp-2">
                            {fav.title}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {fav.genre} · {formatTime(fav.durationSeconds)}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(fav)}
                          className="p-1 text-rose-400 hover:text-slate-400 cursor-pointer"
                          title="Bỏ thích"
                        >
                          <Heart className="w-3.5 h-3.5 fill-rose-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
