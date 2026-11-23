import { useState, useRef, useEffect } from 'react';
import {
  Mic2,
  Search,
  Maximize2,
  Minimize2,
  Plus,
  ArrowUpCircle,
  Youtube,
  X,
  Heart,
  Library,
  Radio,
  Tv,
  Gamepad2,
  Loader2,
  Filter,
  Headphones,
  LogIn,
  User as UserIcon,
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { AppView, Song } from '../types/karaoke';
import { extractYouTubeId, formatTime, removeVietnameseTones } from '../utils/vietnamese';

interface HeaderProps {
  songs: Song[];
  blockedYoutubeIds: Set<string>;
  activeView: AppView;
  isTvMode: boolean;
  heartsBalance: number;
  firebaseUser: FirebaseUser | null;
  userDisplayName: string;
  onChangeView: (view: AppView) => void;
  onToggleTvMode: () => void;
  onOpenHeartStore: () => void;
  onOpenAuthModal: () => void;
  onAddToQueue: (song: Song) => void;
  onPrioritizeSong: (song: Song) => void;
  onPlayNow: (song: Song) => void;
}

export function Header({
  songs,
  blockedYoutubeIds,
  activeView,
  isTvMode,
  heartsBalance,
  firebaseUser,
  userDisplayName,
  onChangeView,
  onToggleTvMode,
  onOpenHeartStore,
  onOpenAuthModal,
  onAddToQueue,
  onPrioritizeSong,
  onPlayNow,
}: HeaderProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customArtist, setCustomArtist] = useState('Nguồn YouTube');
  const [karaokeOnly, setKaraokeOnly] = useState(true);
  const [ytResults, setYtResults] = useState<Song[]>([]);
  const [isSearchingYt, setIsSearchingYt] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const detectedYoutubeId = extractYouTubeId(query);
  const normalizedQuery = removeVietnameseTones(query);

  const matchedLocalSongs =
    !detectedYoutubeId && normalizedQuery.length > 0
      ? songs.filter((song) => {
          if (blockedYoutubeIds.has(song.youtubeId)) return false;
          if (karaokeOnly && !song.isKaraoke) return false;
          const haystack = removeVietnameseTones(`${song.title} ${song.artist} ${song.genre}`);
          return haystack.includes(normalizedQuery);
        })
      : [];

  // Auto-resolve pasted YouTube link/ID title via keyless oEmbed
  useEffect(() => {
    if (!detectedYoutubeId) return;
    let active = true;
    fetch(`/api/youtube/oembed?id=${encodeURIComponent(detectedYoutubeId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { title?: string; artist?: string } | null) => {
        if (!active || !data) return;
        if (data.title) setCustomTitle(data.title);
        if (data.artist) setCustomArtist(data.artist);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [detectedYoutubeId]);

  // Auto-search real YouTube Karaoke videos
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || detectedYoutubeId || trimmed.length < 2) {
      setYtResults([]);
      setIsSearchingYt(false);
      return;
    }

    let active = true;
    setIsSearchingYt(true);
    const timer = window.setTimeout(() => {
      fetch(
        `/api/youtube/search?q=${encodeURIComponent(trimmed)}&karaokeOnly=${karaokeOnly}`
      )
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((data: { items?: Song[] }) => {
          if (!active) return;
          setYtResults(Array.isArray(data.items) ? data.items : []);
        })
        .catch(() => {
          if (active) setYtResults([]);
        })
        .finally(() => {
          if (active) setIsSearchingYt(false);
        });
    }, 380);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, karaokeOnly, detectedYoutubeId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const buildCustomSong = (ytId: string): Song => ({
    id: `yt-${ytId}-${Date.now()}`,
    youtubeId: ytId,
    title: customTitle.trim() || `Video YouTube (${ytId})`,
    artist: customArtist || 'Nguồn YouTube',
    genre: 'Nhạc Trẻ',
    durationSeconds: 240,
    isKaraoke: true,
    lyrics: [
      'Đang phát bài hát trực tiếp từ YouTube.',
      'Hãy bật chế độ toàn màn hình trên video để hát cùng chữ chạy trên màn hình YouTube!',
    ],
  });

  const handleSubmitYoutube = (mode: 'queue' | 'priority' | 'play') => {
    if (!detectedYoutubeId) return;
    const song = buildCustomSong(detectedYoutubeId);
    if (mode === 'play') onPlayNow(song);
    else if (mode === 'priority') onPrioritizeSong(song);
    else onAddToQueue(song);
    setQuery('');
    setCustomTitle('');
    setCustomArtist('Nguồn YouTube');
    setIsOpen(false);
  };

  // Merge local + live YouTube results deduplicating by youtubeId and filtering blocked/non-karaoke
  const combinedResults = [...matchedLocalSongs];
  const seenYt = new Set(matchedLocalSongs.map((s) => s.youtubeId));
  for (const yt of ytResults) {
    if (blockedYoutubeIds.has(yt.youtubeId)) continue;
    if (karaokeOnly && !yt.isKaraoke) continue;
    if (!seenYt.has(yt.youtubeId)) {
      seenYt.add(yt.youtubeId);
      combinedResults.push(yt);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090B10]/94 backdrop-blur-xl">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
        <button
          type="button"
          onClick={() => onChangeView('stage')}
          className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg py-1 cursor-pointer"
        >
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-400">
            <Mic2 className="w-5 h-5 mic-glow" />
          </span>
          <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-50">
            Karaoke <span className="text-amber-400">Online</span>
          </span>
        </button>

        {/* Smart Search Bar */}
        <div ref={containerRef} className="relative flex-1 max-w-2xl">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={query}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && detectedYoutubeId) {
                  e.preventDefault();
                  handleSubmitYoutube('queue');
                }
              }}
              placeholder="Tìm bài Karaoke trên YouTube hoặc dán link YouTube..."
              aria-label="Tìm bài hát hoặc dán link YouTube"
              className="w-full h-10 pl-10 pr-9 rounded-lg bg-slate-900/90 border border-slate-700/80 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCustomTitle('');
                  setYtResults([]);
                }}
                className="absolute right-2.5 text-slate-400 hover:text-slate-100 p-1 rounded"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {isOpen && query.trim().length > 0 && (
            <div className="absolute left-0 right-0 mt-2 rounded-xl bg-[#111520] border border-slate-700/90 shadow-2xl overflow-hidden z-50 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {/* Karaoke Filter Bar inside search dropdown */}
              {!detectedYoutubeId && (
                <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    {isSearchingYt && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
                    <span>{isSearchingYt ? 'Đang tìm trên YouTube...' : 'Kết quả kho & YouTube'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setKaraokeOnly((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      karaokeOnly
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    <Filter className="w-3 h-3" />
                    <span>{karaokeOnly ? 'Đang lọc chỉ nhạc Karaoke' : 'Tất cả video'}</span>
                  </button>
                </div>
              )}

              {detectedYoutubeId ? (
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-amber-400 font-medium">
                    <Youtube className="w-4 h-4 shrink-0" />
                    <span>Đã nhận diện Video YouTube ID:</span>
                    <span className="font-mono text-slate-100">{detectedYoutubeId}</span>
                  </div>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Tên bài hát (tự động lấy từ YouTube)..."
                    className="w-full h-9 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSubmitYoutube('play')}
                      className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Phát ngay
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmitYoutube('priority')}
                      className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-medium text-xs transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Ưu tiên đầu hàng chờ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmitYoutube('queue')}
                      className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors whitespace-nowrap cursor-pointer"
                    >
                      + Thêm vào chờ
                    </button>
                  </div>
                </div>
              ) : combinedResults.length > 0 ? (
                <div className="divide-y divide-slate-800/70">
                  {combinedResults.slice(0, 12).map((song) => (
                    <div
                      key={song.id}
                      className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 hover:bg-slate-800/60 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onPlayNow(song);
                          setIsOpen(false);
                          setQuery('');
                        }}
                        className="text-left min-w-0 flex-1 cursor-pointer"
                      >
                        <p className="text-sm font-semibold text-slate-100 line-clamp-2 sm:truncate">
                          {song.title}
                        </p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {song.artist} · {formatTime(song.durationSeconds)}
                          {song.viewCountText ? ` · ${song.viewCountText}` : ''}
                        </p>
                      </button>
                      <div className="flex items-center justify-end gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onPrioritizeSong(song);
                            setIsOpen(false);
                            setQuery('');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <ArrowUpCircle className="w-3.5 h-3.5" />
                          <span>Ưu tiên</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onAddToQueue(song);
                            setIsOpen(false);
                            setQuery('');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Chọn bài</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-slate-400">
                  {isSearchingYt
                    ? 'Đang tải danh sách Karaoke từ YouTube...'
                    : 'Không tìm thấy kết quả. Hãy thử từ khóa khác hoặc dán link YouTube.'}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenAuthModal}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              firebaseUser
                ? 'bg-slate-800/95 hover:bg-slate-700 text-slate-100 border border-emerald-500/40'
                : 'bg-white/95 hover:bg-white text-slate-900'
            }`}
          >
            {firebaseUser ? (
              firebaseUser.photoURL ? (
                <img
                  src={firebaseUser.photoURL}
                  alt={userDisplayName}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <UserIcon className="w-4 h-4 text-emerald-400" />
              )
            ) : (
              <LogIn className="w-4 h-4 text-slate-800" />
            )}
            <span className="max-w-[110px] truncate hidden md:inline">
              {firebaseUser ? userDisplayName : 'Đăng nhập'}
            </span>
            <span className="md:hidden">{firebaseUser ? 'Tài khoản' : 'Đăng nhập'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleTvMode}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isTvMode
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700'
            }`}
            aria-pressed={isTvMode}
          >
            {isTvMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden sm:inline">
              {isTvMode ? 'Thoát TV Mode' : 'Toàn màn hình (TV Mode)'}
            </span>
            <span className="sm:hidden">{isTvMode ? 'Thoát TV' : 'TV Mode'}</span>
          </button>
        </div>
      </div>

      {!isTvMode && (
        <div className="border-t border-slate-800/60 bg-[#0D1017]/90">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4 overflow-x-auto custom-scrollbar">
            <nav className="flex items-center gap-1.5 shrink-0" aria-label="Điều hướng chính">
              {(
                [
                  { id: 'browse', label: 'Kho Nhạc & Lọc Karaoke', icon: Library },
                  { id: 'stage', label: 'Sân Khấu Karaoke', icon: Tv },
                  { id: 'music', label: 'Nghe Nhạc YouTube', icon: Headphones },
                  { id: 'rooms', label: 'Phòng Hát Riêng (Mic Live)', icon: Radio },
                  { id: 'social', label: 'Chat Yahoo & Game', icon: Gamepad2 },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = activeView === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onChangeView(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={onOpenHeartStore}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-400" />
              <span className="font-mono tabular-nums">{heartsBalance} Tim</span>
              <span className="text-amber-300">· Mua Tim</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
