import { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Headphones,
  Mic2,
  Radio,
  ShieldCheck,
  Sparkles,
  Music,
  ExternalLink,
} from 'lucide-react';
import { KARAOKE_SONGS } from '../data/songs';
import { AppView, Song } from '../types/karaoke';
import { buildSongUrlPath } from '../utils/vietnamese';

interface SeoContentSectionProps {
  onNavigateView: (view: AppView) => void;
  onPlaySong?: (song: Song) => void;
}

const FAQ_ITEMS = [
  {
    q: 'Làm thế nào để hát karaoke không quảng cáo làm phiền ngay trên trình duyệt?',
    a: 'Karaoke Online thiết kế sân khấu hát karaoke sạch, không chèn banner hay pop-up quảng cáo che lời bài hát. Trình phát YouTube được nhúng trực tiếp ngay trong trang kèm chế độ khóa chạm chống nhảy sang ứng dụng ngoài, giúp bạn hát karaoke không quảng cáo liên tục các bản Bolero, Nhạc Trẻ, Remix, Nhạc Trữ Tình cùng chữ chạy đồng bộ.',
  },
  {
    q: 'Cách nghe nhạc YouTube MP3 và nghe nhạc không quảng cáo trên điện thoại mà vẫn đọc được nội dung web?',
    a: 'Tại mục Nghe Nhạc YouTube MP3, trình phát được cố định gọn ngay trong trang web với thuộc tính phát nội tuyến (playsinline) và lớp bảo vệ chống nhảy ứng dụng YouTube. Bạn có thể vừa nghe nhạc không quảng cáo pop-up vừa cuộn xem danh sách thể loại, lưu lịch sử đã nghe và điều khiển qua thanh mini-player hoặc màn hình khóa.',
  },
  {
    q: 'Màn hình điện thoại tắt có tiếp tục nghe nhạc YouTube MP3 được không?',
    a: 'Trang nghe nhạc tích hợp Media Session chuẩn trình duyệt di động và nút kích hoạt giữ phiên phát nền, hiển thị tên bài hát cùng nút Phát/Tạm dừng/Qua bài ngay trên màn hình khóa điện thoại.',
  },
  {
    q: 'Có thể hát karaoke cùng bạn bè trong phòng riêng và đua bảng xếp hạng tuần/tháng không?',
    a: 'Có. Ở mục Phòng Hát Riêng (Mic Live), ca sĩ có thể chọn chế độ Hát + Trộn Nhạc YouTube để truyền cả giọng hát lẫn nhạc nền mượt mà, nhận tim cổ vũ và ghi danh trên Bảng Xếp Hạng Tặng Tim theo Tuần và Tháng.',
  },
];

export function SeoContentSection({ onNavigateView, onPlaySong }: SeoContentSectionProps) {
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const featuredSongs = KARAOKE_SONGS.slice(0, 12);

  const handleRouteClick = (e: React.MouseEvent<HTMLAnchorElement>, view: AppView) => {
    e.preventDefault();
    onNavigateView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section
      aria-label="Cẩm nang hát karaoke không quảng cáo và nghe nhạc YouTube MP3 chuẩn SEO"
      className="pt-8 border-t border-slate-800/80 space-y-6"
    >
      {/* Main SEO Hub Header + Internal Crawl Links */}
      <div className="rounded-2xl bg-[#111520] border border-slate-800/90 p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <BookOpen className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-slate-50">
                Hát Karaoke Không Quảng Cáo &amp; Nghe Nhạc YouTube MP3 Trực Tuyến
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Nền tảng hát karaoke, nghe nhạc không quảng cáo pop-up trên trình duyệt điện thoại &amp; TV · Đầy đủ Bolero, Nhạc Trẻ, Remix, Nhạc Trữ Tình
              </p>
            </div>
          </div>

          <nav aria-label="Liên kết chuyên mục chuẩn SEO" className="flex flex-wrap items-center gap-2">
            <a
              href="/hat-karaoke-khong-quang-cao"
              onClick={(e) => handleRouteClick(e, 'browse')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-xs font-semibold transition-colors"
            >
              <Mic2 className="w-3.5 h-3.5" />
              <span>Hát Karaoke Không Quảng Cáo</span>
            </a>
            <a
              href="/nghe-nhac-youtube-mp3"
              onClick={(e) => handleRouteClick(e, 'music')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/35 text-purple-300 text-xs font-semibold transition-colors"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Nghe Nhạc YouTube MP3</span>
            </a>
            <a
              href="/phong-hat-karaoke-truc-tuyen"
              onClick={(e) => handleRouteClick(e, 'rooms')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-xs font-semibold transition-colors"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Phòng Hát Karaoke Live</span>
            </a>
          </nav>
        </div>

        {/* 4 Structured Keyword-Rich Editorial Posts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <article className="rounded-xl bg-slate-900/75 border border-slate-800 p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
              <Mic2 className="w-4 h-4 shrink-0" />
              <span>Bài viết 1 · Hát Karaoke Online Miễn Phí</span>
            </div>
            <h3 className="font-display text-base sm:text-lg font-bold text-slate-100">
              Cách Hát Karaoke Không Quảng Cáo Mượt Mà Trên Điện Thoại &amp; Smart TV
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Nếu bạn muốn <strong>hát karaoke</strong> giải trí tại nhà cùng gia đình mà không bị pop-up che lời,{' '}
              <strong>Karaoke Online</strong> cung cấp không gian <strong>hát karaoke không quảng cáo</strong> sạch sẽ
              ngay trên trình duyệt. Hệ thống tự động lọc các bản beat chuẩn chữ chạy đồng bộ theo tone Nam, tone Nữ,
              Song ca và ẩn video bị chặn nhúng để trải nghiệm <strong>hát karaoke</strong> luôn liền mạch từ bài đầu đến
              cuối danh sách chờ.
            </p>
          </article>

          <article className="rounded-xl bg-slate-900/75 border border-slate-800 p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-purple-300 text-xs font-semibold">
              <Headphones className="w-4 h-4 shrink-0" />
              <span>Bài viết 2 · Nghe Nhạc YouTube MP3 Chuẩn Âm Thanh</span>
            </div>
            <h3 className="font-display text-base sm:text-lg font-bold text-slate-100">
              Nghe Nhạc YouTube MP3 &amp; Nghe Nhạc Không Quảng Cáo Ngay Trong Trang Web
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Chuyên mục{' '}
              <a
                href="/nghe-nhac-youtube-mp3"
                onClick={(e) => handleRouteClick(e, 'music')}
                className="text-purple-300 underline decoration-purple-400/50 hover:text-purple-200 font-semibold"
              >
                nghe nhạc YouTube MP3
              </a>{' '}
              giúp bạn thưởng thức hàng nghìn liên khúc Nhạc Trẻ Hot, Bolero, Nhạc Vàng Xưa, Nhạc Trữ Tình và Nhạc Sống
              với trải nghiệm <strong>nghe nhạc không quảng cáo</strong> bật cửa sổ làm phiền. Trình phát nhúng nội
              tuyến giữ bạn ở lại trang web trên điện thoại, thoải mái cuộn đọc danh sách bài hát và tự động lưu lịch
              sử đã nghe.
            </p>
          </article>

          <article className="rounded-xl bg-slate-900/75 border border-slate-800 p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Bài viết 3 · Trình Phát Di Động Tắt Màn Hình</span>
            </div>
            <h3 className="font-display text-base sm:text-lg font-bold text-slate-100">
              Nhúng Trình Phát Không Nhảy App, Hỗ Trợ Tắt Màn Hình Khi Nghe Nhạc YouTube MP3
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Khác với các trang web tự động chuyển hướng sang ứng dụng ngoài khiến bạn không thể tương tác tiếp,
              trình phát trên Karaoke Online giữ nguyên chế độ <strong>nghe nhạc không quảng cáo</strong> pop-up và{' '}
              <strong>nghe nhạc YouTube MP3</strong> ngay trong một tab duy nhất. Kết hợp Media Session trên màn hình
              khóa, bạn có thể tắt màn hình tiết kiệm pin mà vẫn điều khiển chuyển bài, tạm dừng và phát lại dễ dàng.
            </p>
          </article>

          <article className="rounded-xl bg-slate-900/75 border border-slate-800 p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold">
              <Radio className="w-4 h-4 shrink-0" />
              <span>Bài viết 4 · Phòng Hát Live, Chat 34 Tỉnh Thành Mới &amp; Đua Top Tim</span>
            </div>
            <h3 className="font-display text-base sm:text-lg font-bold text-slate-100">
              Phòng Hát Karaoke Trực Tuyến Mic Live &amp; Cộng Đồng Hát Karaoke Toàn Quốc
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Không chỉ dừng ở việc <strong>hát karaoke</strong> cá nhân, bạn có thể mở Phòng Hát Riêng có mật khẩu để
              trộn giọng mic có hiệu ứng Echo cùng beat YouTube, nhận tim cổ vũ để leo{' '}
              <strong>Bảng Xếp Hạng Tuần &amp; Tháng</strong>, hoặc ghé{' '}
              <a
                href="/phong-chat-va-game"
                onClick={(e) => handleRouteClick(e, 'social')}
                className="text-sky-300 underline decoration-sky-400/50 hover:text-sky-200 font-semibold"
              >
                Phòng Chat 34 Tỉnh Thành Mới Việt Nam
              </a>{' '}
              để chat chung, chat riêng 1-1 và chơi Tiến Lên, Cờ Caro cùng bạn bè.
            </p>
          </article>
        </div>

        {/* Crawlable Popular Karaoke Songs Directory (matches dynamic sitemap.xml) */}
        <div className="pt-3 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
              <Music className="w-4 h-4 text-amber-400" />
              <span>Danh Mục Bài Hát Karaoke Không Quảng Cáo Được Tìm Nhiều</span>
            </h3>
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-300 transition-colors"
            >
              <span>Sitemap XML</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {featuredSongs.map((song) => {
              const songHref = buildSongUrlPath(song.title, song.youtubeId, 'karaoke');
              return (
                <a
                  key={song.id}
                  href={songHref}
                  onClick={(e) => {
                    if (onPlaySong) {
                      e.preventDefault();
                      onPlaySong(song);
                    }
                  }}
                  className="px-3 py-2 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/40 flex items-center justify-between gap-2 text-xs transition-colors"
                >
                  <span className="text-slate-200 font-medium truncate">{song.title}</span>
                  <span className="text-[11px] text-amber-400/90 shrink-0">{song.genre}</span>
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {/* FAQ Accordion matching FAQPage JSON-LD */}
      <div className="rounded-2xl bg-[#111520] border border-slate-800/90 p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h2>Câu Hỏi Thường Gặp Về Hát Karaoke &amp; Nghe Nhạc YouTube MP3</h2>
        </div>

        <div className="divide-y divide-slate-800/80">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openFaqIdx === idx;
            return (
              <div key={item.q} className="py-2.5">
                <button
                  type="button"
                  onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-3 text-left py-1 text-xs sm:text-sm font-semibold text-slate-100 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${
                      isOpen ? 'rotate-180 text-amber-400' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-400 leading-relaxed pr-6">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
