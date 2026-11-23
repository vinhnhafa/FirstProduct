import { useState, useMemo, useEffect } from 'react';
import {
  Play,
  Plus,
  ArrowUpCircle,
  Search,
  Radio,
  Disc3,
  SlidersHorizontal,
  Youtube,
  Music,
  Filter,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Genre, Song } from '../types/karaoke';
import { extractYouTubeId, formatTime, removeVietnameseTones } from '../utils/vietnamese';

interface BrowseCatalogPageProps {
  songs: Song[];
  blockedYoutubeIds: Set<string>;
  currentSongId: string;
  onListenAndSing: (song: Song) => void;
  onAddToQueue: (song: Song) => void;
  onPrioritizeSong: (song: Song) => void;
  onOpenRoomWithSong: (song: Song) => void;
}

const GENRES: Genre[] = ['Tất cả', 'Bolero', 'Nhạc Trẻ', 'Remix', 'Nhạc Trữ Tình'];
const TONE_FILTERS = ['Tất cả Tone', 'Tone Nam', 'Tone Nữ', 'Song ca'] as const;
type ToneFilter = (typeof TONE_FILTERS)[number];
type SortBy = 'default' | 'az' | 'duration';

function CoverThumb({ youtubeId, title }: { youtubeId: string; title: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-full aspect-video rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/70 flex items-center justify-center">
        <Disc3 className="w-9 h-9 text-amber-400/80" />
      </div>
    );
  }

  return (
    <img
      src={`https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`}
      alt={title}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-full aspect-video rounded-xl object-cover bg-slate-900 border border-slate-800"
    />
  );
}

export function BrowseCatalogPage({
  songs,
  blockedYoutubeIds,
  currentSongId,
  onListenAndSing,
  onAddToQueue,
  onPrioritizeSong,
  onOpenRoomWithSong,
}: BrowseCatalogPageProps) {
  const [selectedGenre, setSelectedGenre] = useState<Genre>('Tất cả');
  const [selectedTone, setSelectedTone] = useState<ToneFilter>('Tất cả Tone');
  const [sortBy, setSortBy] = useState<SortBy>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [customTitle, setCustomTitle] = useState('');

  // Keyless Live YouTube Auto-Loader + Karaoke-Only Filter
  const [karaokeOnly, setKaraokeOnly] = useState(true);
  const [autoLoadYoutube, setAutoLoadYoutube] = useState(true);
  const [ytSongs, setYtSongs] = useState<Song[]>([]);
  const [isLoadingYt, setIsLoadingYt] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const detectedYoutubeId = extractYouTubeId(searchQuery);

  // Auto-resolve oEmbed title when pasting a YouTube URL
  useEffect(() => {
    if (!detectedYoutubeId) return;
    let active = true;
    fetch(`/api/youtube/oembed?id=${encodeURIComponent(detectedYoutubeId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { title?: string } | null) => {
        if (active && d?.title) setCustomTitle(d.title);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [detectedYoutubeId]);

  // Automatically load Karaoke data from YouTube when genre, filter, or search changes
  useEffect(() => {
    if (!autoLoadYoutube || detectedYoutubeId) {
      setYtSongs([]);
      return;
    }

    let active = true;
    setIsLoadingYt(true);
    const timer = window.setTimeout(() => {
      const q = searchQuery.trim();
      fetch(
        `/api/youtube/search?q=${encodeURIComponent(q)}&genre=${encodeURIComponent(
          selectedGenre
        )}&karaokeOnly=${karaokeOnly}`
      )
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((data: { items?: Song[] }) => {
          if (!active) return;
          setYtSongs(Array.isArray(data.items) ? data.items : []);
        })
        .catch(() => {
          if (active) setYtSongs([]);
        })
        .finally(() => {
          if (active) setIsLoadingYt(false);
        });
    }, searchQuery ? 380 : 60);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [autoLoadYoutube, selectedGenre, karaokeOnly, searchQuery, detectedYoutubeId, reloadNonce]);

  const combinedCatalog = useMemo(() => {
    const q = removeVietnameseTones(searchQuery);
    const localFiltered = songs.filter((s) => {
      if (blockedYoutubeIds.has(s.youtubeId)) return false;
      if (selectedGenre !== 'Tất cả' && s.genre !== selectedGenre) return false;
      if (!q || detectedYoutubeId) return true;
      return removeVietnameseTones(`${s.title} ${s.artist} ${s.genre}`).includes(q);
    });

    const merged = [...localFiltered];
    const seen = new Set(localFiltered.map((s) => s.youtubeId));
    for (const y of ytSongs) {
      if (!seen.has(y.youtubeId) && !blockedYoutubeIds.has(y.youtubeId)) {
        seen.add(y.youtubeId);
        merged.push(y);
      }
    }

    let final = merged.filter((song) => {
      if (blockedYoutubeIds.has(song.youtubeId)) return false;
      if (karaokeOnly && !song.isKaraoke) return false;
      if (selectedTone !== 'Tất cả Tone') {
        const toneText = removeVietnameseTones(`${song.tone || ''} ${song.title}`);
        if (selectedTone === 'Tone Nam' && !toneText.includes('nam')) return false;
        if (selectedTone === 'Tone Nữ' && !toneText.includes('nu')) return false;
        if (selectedTone === 'Song ca' && !toneText.includes('song ca')) return false;
      }
      return true;
    });

    if (sortBy === 'az') {
      final = [...final].sort((a, b) => a.title.localeCompare(b.title, 'vi'));
    } else if (sortBy === 'duration') {
      final = [...final].sort((a, b) => a.durationSeconds - b.durationSeconds);
    }
    return final;
  }, [songs, ytSongs, blockedYoutubeIds, selectedGenre, selectedTone, sortBy, searchQuery, detectedYoutubeId, karaokeOnly]);

  const handlePlayCustomYoutube = (mode: 'listen' | 'room') => {
    if (!detectedYoutubeId) return;
    const customSong: Song = {
      id: `yt-${detectedYoutubeId}-${Date.now()}`,
      youtubeId: detectedYoutubeId,
      title: customTitle.trim() || `Bài hát YouTube (${detectedYoutubeId})`,
      artist: 'Nguồn YouTube',
      genre: 'Nhạc Trẻ',
      durationSeconds: 240,
      isKaraoke: true,
      lyrics: [
        'Đang phát karaoke trực tiếp từ video YouTube bạn vừa chọn.',
        'Hãy hát theo chữ chạy trên màn hình video YouTube!',
      ],
    };
    setSearchQuery('');
    setCustomTitle('');
    if (mode === 'room') onOpenRoomWithSong(customSong);
    else onListenAndSing(customSong);
  };

  return (
    <div className="space-y-6">
      {/* Page Intro & Quick Search Bar */}
      <div className="rounded-2xl bg-[#111520] border border-slate-800/90 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
              Kho Nhạc Karaoke YouTube — Lọc & Nghe Ngay
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Kho nhạc Karaoke trực tuyến tuyển chọn từ YouTube — lọc riêng bản Karaoke theo thể loại & tone giọng.
            </p>
          </div>

          <div className="w-full lg:w-96 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên bài trên YouTube hoặc dán link..."
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Detected YouTube Link Banner */}
        {detectedYoutubeId && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                <Youtube className="w-4 h-4" />
                <span>Đã nhận diện video YouTube: {detectedYoutubeId}</span>
              </div>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Đặt tên bài hát (tùy chọn)..."
                className="w-full sm:max-w-md h-9 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handlePlayCustomYoutube('listen')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Nghe & Hát Ngay</span>
              </button>
              <button
                type="button"
                onClick={() => handlePlayCustomYoutube('room')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Mở Phòng Hát Live</span>
              </button>
            </div>
          </div>
        )}

        {/* Genre Selection + Karaoke Only Filter + YouTube Auto-Load */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pt-3 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            {GENRES.map((genre) => {
              const active = selectedGenre === genre;
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => setSelectedGenre(genre)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span>{genre}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Karaoke Only Filter Toggle */}
            <button
              type="button"
              onClick={() => setKaraokeOnly((v) => !v)}
              aria-pressed={karaokeOnly}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                karaokeOnly
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Chỉ lọc nhạc Karaoke</span>
            </button>

            {/* Auto-Load YouTube Toggle */}
            <button
              type="button"
              onClick={() => setAutoLoadYoutube((v) => !v)}
              aria-pressed={autoLoadYoutube}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                autoLoadYoutube
                  ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Youtube className="w-3.5 h-3.5" />
              <span>Tải từ YouTube</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <select
                value={selectedTone}
                onChange={(e) => setSelectedTone(e.target.value as ToneFilter)}
                aria-label="Lọc theo tone giọng"
                className="h-9 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {TONE_FILTERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              aria-label="Sắp xếp bài hát"
              className="h-9 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="default">Sắp xếp: Phổ biến</option>
              <option value="az">Tên bài A → Z</option>
              <option value="duration">Thời lượng ngắn → dài</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2.5 text-sm text-slate-400">
          <span>
            Hiển thị{' '}
            <span className="font-mono font-semibold text-amber-400 tabular-nums">
              {combinedCatalog.length}
            </span>{' '}
            bài hát {karaokeOnly ? '(đã lọc chuẩn Karaoke)' : ''}
          </span>
          {isLoadingYt && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Đang tải thêm từ YouTube...</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {autoLoadYoutube && (
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-amber-400 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Làm mới YouTube</span>
            </button>
          )}
          {(selectedGenre !== 'Tất cả' || selectedTone !== 'Tất cả Tone' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedGenre('Tất cả');
                setSelectedTone('Tất cả Tone');
                setSearchQuery('');
              }}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Song Grid */}
      {combinedCatalog.length === 0 && !isLoadingYt ? (
        <div className="rounded-2xl bg-[#111520] border border-slate-800 p-12 text-center space-y-3">
          <Music className="w-10 h-10 text-slate-500 mx-auto" />
          <p className="text-base font-semibold text-slate-200">
            Không tìm thấy bài hát phù hợp với bộ lọc hiện tại
          </p>
          <p className="text-sm text-slate-400">
            Hãy thử đổi thể loại, tắt lọc Tone hoặc dán trực tiếp đường dẫn YouTube ở ô tìm kiếm.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {combinedCatalog.map((song) => {
            const isPlayingNow = song.id === currentSongId;
            return (
              <article
                key={song.id}
                className={`rounded-2xl bg-[#111520] border p-3.5 flex flex-col gap-3 transition-colors ${
                  isPlayingNow
                    ? 'border-amber-500/60 bg-amber-500/5'
                    : 'border-slate-800/90 hover:border-slate-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onListenAndSing(song)}
                  className="relative group block w-full text-left cursor-pointer"
                >
                  <CoverThumb youtubeId={song.youtubeId} title={song.title} />
                  <div className="absolute inset-0 rounded-xl bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs shadow-lg">
                      <Play className="w-3.5 h-3.5 fill-slate-950" />
                      <span>Nghe & Hát Ngay</span>
                    </span>
                  </div>
                </button>

                <div className="flex-1 min-w-0 space-y-1">
                  <button
                    type="button"
                    onClick={() => onListenAndSing(song)}
                    className="text-left w-full cursor-pointer"
                  >
                    <h3 className="font-display text-base font-bold text-slate-100 hover:text-amber-400 line-clamp-2 transition-colors">
                      {song.title}
                    </h3>
                  </button>
                  <p className="text-xs text-slate-400 truncate">
                    {song.artist} · {song.genre} · {formatTime(song.durationSeconds)}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {song.tone || (song.isKaraoke ? 'Karaoke Beat' : 'YouTube')}
                    {song.viewCountText ? ` · ${song.viewCountText}` : ''}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-800/70">
                  <button
                    type="button"
                    onClick={() => onListenAndSing(song)}
                    className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Nghe & Hát</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenRoomWithSong(song)}
                    className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/30 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Phòng Live</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddToQueue(song)}
                    className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>+ Hàng chờ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onPrioritizeSong(song)}
                    className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                    <span>Ưu tiên</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
