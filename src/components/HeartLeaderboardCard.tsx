import { Crown, Heart, Trophy, ShoppingBag, Sparkles, Medal } from 'lucide-react';
import { WeeklyGifterEntry } from '../types/karaoke';

interface HeartLeaderboardCardProps {
  entries: WeeklyGifterEntry[];
  currentUserId: string;
  currentUserName: string;
  compact?: boolean;
  onOpenHeartStore: () => void;
}

export function HeartLeaderboardCard({
  entries,
  currentUserId,
  currentUserName,
  compact = false,
  onOpenHeartStore,
}: HeartLeaderboardCardProps) {
  const topThree = entries.slice(0, 3);
  const restEntries = entries.slice(3, compact ? 8 : 12);

  const myIndex = entries.findIndex((e) => e.userId === currentUserId);
  const myEntry = myIndex !== -1 ? entries[myIndex] : null;
  const nextAbove = myIndex > 0 ? entries[myIndex - 1] : entries[entries.length - 1] || null;
  const heartsNeeded =
    myIndex === 0
      ? 0
      : myEntry && nextAbove
      ? Math.max(1, nextAbove.heartsGiven - myEntry.heartsGiven + 1)
      : nextAbove
      ? nextAbove.heartsGiven + 1
      : 1;

  return (
    <section className="rounded-2xl bg-[#111520] border border-amber-500/25 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-[#2A152E] via-[#1B1528] to-[#111520] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0">
            <Trophy className="w-5 h-5" />
          </span>
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-50 flex items-center gap-2">
              <span>Bảng Xếp Hạng Tặng Tim Tuần</span>
            </h2>
            <p className="text-xs text-slate-400">
              Vinh danh khán giả tặng nhiều tim nhất cho các ca sĩ trong phòng hát
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenHeartStore}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:brightness-110 text-white font-bold text-xs transition-all cursor-pointer shadow-md whitespace-nowrap"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Mua Tim Ủng Hộ Ca Sĩ</span>
        </button>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Top 3 Podium Showcase */}
        {topThree.length > 0 && (
          <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
            {topThree.map((entry, idx) => {
              const isMe = entry.userId === currentUserId;
              const styleMap = [
                {
                  border: 'border-amber-400/50 bg-gradient-to-b from-amber-500/15 to-slate-900/90',
                  rankText: 'text-amber-300',
                  title: 'Top 1 · Vua Tặng Tim',
                  icon: Crown,
                },
                {
                  border: 'border-slate-400/40 bg-gradient-to-b from-slate-400/10 to-slate-900/90',
                  rankText: 'text-slate-200',
                  title: 'Top 2 · Á Quân Hào Phóng',
                  icon: Medal,
                },
                {
                  border: 'border-orange-500/40 bg-gradient-to-b from-orange-500/10 to-slate-900/90',
                  rankText: 'text-orange-300',
                  title: 'Top 3 · Nhiệt Tình',
                  icon: Sparkles,
                },
              ][idx];
              const Icon = styleMap.icon;

              return (
                <div
                  key={entry.userId}
                  className={`rounded-xl border p-3.5 flex items-center justify-between gap-3 ${styleMap.border}`}
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <span
                      className={`w-9 h-9 rounded-lg bg-slate-950/70 border border-white/10 flex items-center justify-center shrink-0 ${styleMap.rankText}`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-bold uppercase tracking-wide ${styleMap.rankText}`}>
                        {styleMap.title}
                      </p>
                      <p className="font-display text-sm font-bold text-slate-50 truncate mt-0.5">
                        {entry.userName} {isMe ? '(Bạn)' : ''}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        Ca sĩ yêu thích: <span className="text-slate-200">{entry.topSingerName}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-mono text-base font-extrabold text-rose-400 tabular-nums flex items-center justify-end gap-1">
                      <Heart className="w-4 h-4 fill-rose-500" />
                      <span>{entry.heartsGiven.toLocaleString('vi-VN')}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono tabular-nums">
                      {entry.giftsCount} lượt tặng
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Remaining Ranked Users */}
        {restEntries.length > 0 && (
          <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 divide-y divide-slate-800/70">
            {restEntries.map((entry, idx) => {
              const rank = idx + 4;
              const isMe = entry.userId === currentUserId;
              return (
                <div
                  key={entry.userId}
                  className={`px-3.5 py-2.5 flex items-center justify-between gap-3 ${
                    isMe ? 'bg-amber-500/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="font-mono text-xs font-bold text-slate-400 w-6 tabular-nums shrink-0">
                      #{rank}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                        {entry.userName} {isMe ? '(Bạn)' : ''}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        Tặng {entry.topGiftLabel} cho {entry.topSingerName}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono text-xs sm:text-sm font-bold text-rose-400 tabular-nums inline-flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 fill-rose-500" />
                      {entry.heartsGiven.toLocaleString('vi-VN')} Tim
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Personal Motivation Banner */}
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 px-3.5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            {myEntry ? (
              <>
                <p className="font-semibold text-slate-100">
                  Hạng của bạn ({currentUserName}):{' '}
                  <span className="text-amber-300 font-mono">#{myIndex + 1}</span> · Đã tặng{' '}
                  <span className="text-rose-400 font-mono font-bold tabular-nums">
                    {myEntry.heartsGiven.toLocaleString('vi-VN')} Tim
                  </span>
                </p>
                {myIndex > 0 && nextAbove && (
                  <p className="text-slate-400">
                    Chỉ cần tặng thêm{' '}
                    <span className="text-emerald-400 font-semibold font-mono tabular-nums">
                      {heartsNeeded} Tim
                    </span>{' '}
                    để vượt qua <span className="text-slate-200">{nextAbove.userName}</span>!
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-semibold text-slate-100">
                  Bạn ({currentUserName}) chưa lên bảng xếp hạng tuần này
                </p>
                <p className="text-slate-400">
                  Vào phòng hát và tặng quà Tim (Hoa Hồng, Vương Miện, Pháo Hoa) để ghi danh ngay!
                </p>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenHeartStore}
            className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold cursor-pointer whitespace-nowrap"
          >
            Nạp thêm Tim ngay
          </button>
        </div>
      </div>
    </section>
  );
}
