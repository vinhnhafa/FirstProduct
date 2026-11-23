import { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Headphones,
  Mic2,
  Radio,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AppView } from '../types/karaoke';

interface SeoContentSectionProps {
  onNavigateView: (view: AppView) => void;
}

const FAQ_ITEMS = [
  {
    q: 'Làm thế nào để hát karaoke không quảng cáo làm phiền ngay trên trình duyệt?',
    a: 'Karaoke Online thiết kế sân khấu hát karaoke sạch, không chèn banner hay pop-up quảng cáo che lời bài hát. Trình phát YouTube được nhúng trực tiếp ngay trong trang kèm chế độ khóa chạm chống nhảy sang ứng dụng ngoài, giúp bạn hát liên tục các bản Bolero, Nhạc Trẻ, Remix cùng chữ chạy đồng bộ.',
  },
  {
    q: 'Cách nghe nhạc YouTube MP3 và nghe nhạc không quảng cáo trên điện thoại mà vẫn đọc được nội dung web?',
    a: 'Tại mục Nghe Nhạc YouTube MP3, trình phát được cố định gọn ngay trong trang web với thuộc tính phát nội tuyến (playsinline) và lớp bảo vệ chống nhảy ứng dụng YouTube. Bạn có thể vừa nghe nhạc không quảng cáo pop-up vừa cuộn xem danh sách thể loại, lưu lịch sử đã nghe và điều khiển qua thanh mini-player hoặc màn hình khóa.',
  },
  {
    q: 'Mạng di động tắt màn hình có tiếp tục nghe nhạc YouTube MP3 được không?',
    a: 'Trang nghe nhạc tích hợp Media Session chuẩn trình duyệt di động và nút kích hoạt giữ phiên phát nền, hiển thị tên bài hát và nút Phát/Tạm dừng/Qua bài ngay trên màn hình khóa điện thoại.',
  },
  {
    q: 'Có thể hát karaoke cùng bạn bè trong phòng riêng và truyền cả nhạc lẫn giọng hát không?',
    a: 'Có. Ở mục Phòng Hát Riêng (Mic Live), ca sĩ có thể chọn chế độ Hát + Trộn Nhạc YouTube để trộn giọng hát có Echo cùng nhạc nền thành một luồng âm thanh mượt mà truyền tới tất cả thành viên trong phòng.',
  },
];

export function SeoContentSection({ onNavigateView }: SeoContentSectionProps) {
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  return (
    <section
      aria-label="Cẩm nang hát karaoke và nghe nhạc YouTube MP3 chuẩn SEO"
      className="pt-8 border-t border-slate-800/80 space-y-6"
    >
      {/* Internal SEO Navigation Strip */}
      <div className="rounded-2xl bg-[#111520] border border-slate-800/90 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400">
              <BookOpen className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-slate-50">
                Hát Karaoke Không Quảng Cáo &amp; Nghe Nhạc YouTube MP3 Trực Tuyến
              </h2>
              <p className="text-xs text-slate-400">
                Trình phát nhúng mượt trên trình duyệt điện thoại · Không nhảy sang app ngoài · Đầy đủ thể loại
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onNavigateView('browse');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-xs font-semibold cursor-pointer"
            >
              <Mic2 className="w-3.5 h-3.5" />
              <span>Kho Hát Karaoke</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onNavigateView('music');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/35 text-purple-300 text-xs font-semibold cursor-pointer"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Nghe Nhạc YouTube MP3</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onNavigateView('rooms');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-xs font-semibold cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Phòng Hát Live</span>
            </button>
          </div>
        </div>

        {/* 3 Keyword-Rich Editorial Articles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <article className="rounded-xl bg-slate-900/70 border border-slate-800 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
              <Mic2 className="w-4 h-4 shrink-0" />
              <span>Cẩm nang Hát Karaoke Online</span>
            </div>
            <h3 className="font-display text-base font-bold text-slate-100">
              Hát Karaoke Không Quảng Cáo Mượt Mà Trên Điện Thoại &amp; TV
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Nếu bạn đang tìm nơi <strong>hát karaoke</strong> tiện lợi tại nhà, Karaoke Online mang đến trải nghiệm{' '}
              <strong>hát karaoke không quảng cáo</strong> pop-up chen ngang màn hình. Kho bài hát lọc sẵn các video beat
              chuẩn karaoke Bolero, Nhạc Trẻ, Nhạc Vàng, Remix, tự động ẩn video lỗi và hỗ trợ bảng lời bài hát chữ lớn
              dễ đọc trên cả màn hình điện thoại lẫn chế độ TV Mode.
            </p>
          </article>

          <article className="rounded-xl bg-slate-900/70 border border-slate-800 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-purple-300 text-xs font-semibold">
              <Headphones className="w-4 h-4 shrink-0" />
              <span>Trình phát YouTube MP3 Nội Tuyến</span>
            </div>
            <h3 className="font-display text-base font-bold text-slate-100">
              Nghe Nhạc YouTube MP3 &amp; Nghe Nhạc Không Quảng Cáo Ngay Trong Web
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Trang <strong>nghe nhạc YouTube MP3</strong> giúp bạn chọn nhanh các ca khúc Nhạc Hot, Nhạc Mới, Liên Khúc
              Trữ Tình, Nhạc Thiền hay Acoustic để <strong>nghe nhạc không quảng cáo</strong> làm gián đoạn giao diện.
              Nhờ cơ chế phát nhúng nội tuyến chống nhảy ứng dụng YouTube trên di động, bạn vừa nghe nhạc vừa thoải mái
              đọc thông tin bài hát, xem bảng xếp hạng và tìm lại lịch sử đã nghe.
            </p>
          </article>

          <article className="rounded-xl bg-slate-900/70 border border-slate-800 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Tối ưu Di động &amp; Phòng Hát</span>
            </div>
            <h3 className="font-display text-base font-bold text-slate-100">
              Nhúng Trình Phát Giữ Nguyên Trang Web, Tắt Màn Hình Vẫn Nghe Tốt
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Thay vì bị đẩy sang trình duyệt khác hoặc văng vào app ngoài khiến bạn không thể tương tác tiếp với danh
              sách chờ, trình phát trên Karaoke Online giữ toàn bộ điều khiển Phát/Tạm dừng, tua nhạc, âm lượng và{' '}
              <strong>nghe nhạc YouTube MP3</strong> ngay trong một trang duy nhất, kết hợp phòng hát Live truyền giọng
              cùng nhạc nền cực kỳ tiện lợi.
            </p>
          </article>
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
