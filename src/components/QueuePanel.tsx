import { useState } from 'react';
import {
  ListMusic,
  Library,
  ArrowUpCircle,
  Trash2,
  GripVertical,
  Plus,
  Play,
  ChevronUp,
  ChevronDown,
  Disc3,
} from 'lucide-react';
import { Genre, QueueItem, Song } from '../types/karaoke';
import { formatTime, removeVietnameseTones } from '../utils/vietnamese';

interface QueuePanelProps {
  queue: QueueItem[];
  catalog: Song[];
  currentSongId: string;
  onPlayNow: (song: Song) => void;
  onAddToQueue: (song: Song) => void;
  onPrioritizeSong: (song: Song) => void;
  onPrioritizeQueueItem: (queueId: string) => void;
  onRemoveFromQueue: (queueId: string) => void;
  onReorderQueue: (fromIndex: number, toIndex: number) => void;
  onClearQueue: () => void;
}

const GENRES: Genre[] = ['Tất cả', 'Bolero', 'Nhạc Trẻ', 'Remix', 'Nhạc Trữ Tình'];

function SongArtwork({ youtubeId, title }: { youtubeId: string; title: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-14 h-10 rounded-md bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/70 flex items-center justify-center shrink-0">
        <Disc3 className="w-5 h-5 text-amber-400/80" />
      </div>
    );
  }

  return (
    <img
      src={`https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`}
      alt={title}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-14 h-10 rounded-md object-cover bg-slate-900 border border-slate-800 shrink-0"
    />
  );
}

export function QueuePanel({
  queue,
  catalog,
  currentSongId,
  onPlayNow,
  onAddToQueue,
  onPrioritizeSong,
  onPrioritizeQueueItem,
  onRemoveFromQueue,
  onReorderQueue,
  onClearQueue,
}: QueuePanelProps) {
  const [activeTab, setActiveTab] = useState<'queue' | 'catalog'>('catalog');
  const [selectedGenre, setSelectedGenre] = useState<Genre>('Tất cả');
  const [catalogFilter, setCatalogFilter] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const normalizedFilter = removeVietnameseTones(catalogFilter);
  const filteredCatalog = catalog.filter((song) => {
    const genreMatch = selectedGenre === 'Tất cả' || song.genre === selectedGenre;
    if (!genreMatch) return false;
    if (!normalizedFilter) return true;
    const text = removeVietnameseTones(`${song.title} ${song.artist} ${song.genre}`);
    return text.includes(normalizedFilter);
  });

  return (
    <aside className="rounded-2xl bg-[#111520] border border-slate-800/90 flex flex-col h-[580px] lg:h-[760px] overflow-hidden">
      {/* Top Tab Switcher */}
      <div className="p-2 border-b border-slate-800/80 bg-slate-900/50 grid grid-cols-2 gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('queue')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'queue'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-300 hover:text-slate-50 hover:bg-slate-800/70'
          }`}
        >
          <ListMusic className="w-4 h-4 shrink-0" />
          <span>Danh sách chờ</span>
          <span
            className={`font-mono text-xs tabular-nums px-1.5 py-0.5 rounded ${
              activeTab === 'queue' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-amber-400'
            }`}
          >
            {queue.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'catalog'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-300 hover:text-slate-50 hover:bg-slate-800/70'
          }`}
        >
          <Library className="w-4 h-4 shrink-0" />
          <span>Kho nhạc gợi ý</span>
          <span
            className={`font-mono text-xs tabular-nums px-1.5 py-0.5 rounded ${
              activeTab === 'catalog' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {catalog.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Queue */}
      {activeTab === 'queue' ? (
        <div className="flex flex-col flex-1 min-h-0">
          {queue.length > 0 && (
            <div className="px-4 py-2.5 border-b border-slate-800/70 flex items-center justify-between text-xs text-slate-400 shrink-0">
              <span>Kéo thả để sắp xếp thứ tự bài hát</span>
              <button
                type="button"
                onClick={onClearQueue}
                className="text-rose-400 hover:text-rose-300 font-medium transition-colors cursor-pointer"
              >
                Xóa tất cả
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-800/60">
            {queue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
                  <ListMusic className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-200">
                    Danh sách chờ đang trống
                  </p>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Chọn bài hát từ Kho nhạc gợi ý hoặc dán link YouTube ở thanh tìm kiếm để lên lịch hát tiếp theo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('catalog')}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Mở kho nhạc gợi ý
                </button>
              </div>
            ) : (
              queue.map((item, idx) => {
                const isDragging = dragIndex === idx;
                const isDragOver = dragOverIndex === idx && dragIndex !== idx;
                return (
                  <div
                    key={item.queueId}
                    draggable
                    onDragStart={() => setDragIndex(idx)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverIndex(idx);
                    }}
                    onDragLeave={() => {
                      if (dragOverIndex === idx) setDragOverIndex(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIndex !== null && dragIndex !== idx) {
                        onReorderQueue(dragIndex, idx);
                      }
                      setDragIndex(null);
                      setDragOverIndex(null);
                    }}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setDragOverIndex(null);
                    }}
                    className={`px-3 py-3 flex flex-col gap-2 transition-colors ${
                      isDragging
                        ? 'opacity-50 bg-slate-800/60'
                        : isDragOver
                          ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-500/50'
                          : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className="text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing pt-1 shrink-0"
                        title="Kéo để đổi vị trí"
                      >
                        <GripVertical className="w-4 h-4" />
                      </span>

                      <span className="font-mono text-xs text-slate-500 tabular-nums w-4 text-center pt-1 shrink-0">
                        {idx + 1}
                      </span>

                      <SongArtwork youtubeId={item.song.youtubeId} title={item.song.title} />

                      <button
                        type="button"
                        onClick={() => onPlayNow(item.song)}
                        className="flex-1 min-w-0 text-left group cursor-pointer"
                        title="Phát bài này ngay"
                      >
                        <p className="text-sm font-semibold text-slate-100 group-hover:text-amber-400 line-clamp-2 leading-snug transition-colors">
                          {item.song.title}
                        </p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {item.song.artist} · {formatTime(item.song.durationSeconds)}
                        </p>
                      </button>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pl-10">
                      <button
                        type="button"
                        onClick={() => idx > 0 && onReorderQueue(idx, idx - 1)}
                        disabled={idx === 0}
                        className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                        aria-label="Di chuyển lên"
                        title="Đẩy lên 1 bậc"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => idx < queue.length - 1 && onReorderQueue(idx, idx + 1)}
                        disabled={idx === queue.length - 1}
                        className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                        aria-label="Di chuyển xuống"
                        title="Đẩy xuống 1 bậc"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onPrioritizeQueueItem(item.queueId)}
                        disabled={idx === 0}
                        className="px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-35 text-amber-300 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                        title="Ưu tiên lên đầu hàng đợi"
                      >
                        Ưu tiên
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveFromQueue(item.queueId)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        aria-label={`Xóa ${item.song.title}`}
                        title="Xóa khỏi danh sách"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Tab 2: Suggested Catalog */
        <div className="flex flex-col flex-1 min-h-0">
          {/* Genre Filter Pills & Quick Filter Input */}
          <div className="p-3 border-b border-slate-800/80 space-y-2.5 bg-slate-900/30 shrink-0">
            <div className="flex flex-wrap gap-1.5">
              {GENRES.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => setSelectedGenre(genre)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    selectedGenre === genre
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'bg-slate-800/80 text-slate-300 hover:text-slate-100 hover:bg-slate-700/80'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={catalogFilter}
              onChange={(e) => setCatalogFilter(e.target.value)}
              placeholder="Lọc nhanh trong kho nhạc (vd: le quyen, bolero)..."
              className="w-full h-9 px-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-800/60">
            {filteredCatalog.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                Không có bài hát nào khớp bộ lọc hiện tại.
              </div>
            ) : (
              filteredCatalog.map((song) => {
                const isCurrent = song.id === currentSongId;
                return (
                  <div
                    key={song.id}
                    className={`px-3.5 py-3 flex flex-col gap-2 transition-colors ${
                      isCurrent ? 'bg-amber-500/10' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => onPlayNow(song)}
                        className="relative group shrink-0 cursor-pointer mt-0.5"
                        title="Phát bài này ngay"
                      >
                        <SongArtwork youtubeId={song.youtubeId} title={song.title} />
                        <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-md flex items-center justify-center transition-opacity">
                          <Play className="w-4 h-4 text-amber-400 fill-amber-400" />
                        </span>
                      </button>

                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => onPlayNow(song)}
                          className="text-left w-full cursor-pointer"
                        >
                          <p
                            className={`text-sm font-semibold line-clamp-2 leading-snug ${
                              isCurrent ? 'text-amber-400' : 'text-slate-100 hover:text-amber-300'
                            }`}
                          >
                            {song.title}
                          </p>
                        </button>
                        <p className="text-xs text-slate-400 truncate mt-1">
                          {song.artist} · {song.genre} · {formatTime(song.durationSeconds)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pl-[68px]">
                      <button
                        type="button"
                        onClick={() => onPlayNow(song)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Play className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span>Hát ngay</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onAddToQueue(song)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Chọn bài</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onPrioritizeSong(song)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                        title="Đẩy lên đầu hàng chờ"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                        <span>Ưu tiên</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
