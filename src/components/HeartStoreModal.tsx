import { useState } from 'react';
import { Heart, X, CheckCircle2, CreditCard, Wallet } from 'lucide-react';

interface HeartStoreModalProps {
  isOpen: boolean;
  userId: string;
  heartsBalance: number;
  onClose: () => void;
  onBalanceUpdated: (nextBalance: number) => void;
  onToast: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

const PACKAGES = [
  { id: 'pack_50', hearts: 50, priceLabel: '10.000đ', label: 'Gói Khởi Động', bonus: '' },
  { id: 'pack_200', hearts: 200, priceLabel: '35.000đ', label: 'Gói Phổ Biến', bonus: 'Tiết kiệm 12%' },
  { id: 'pack_500', hearts: 500, priceLabel: '79.000đ', label: 'Gói Ca Sĩ', bonus: 'Tiết kiệm 21%' },
  { id: 'pack_1000', hearts: 1000, priceLabel: '150.000đ', label: 'Gói Đại Gia', bonus: 'Tiết kiệm 25%' },
];

const PAYMENT_METHODS = ['Ví MoMo', 'Chuyển khoản QR', 'Thẻ cào', 'Nạp nhanh (Ví nội bộ)'];

export function HeartStoreModal({
  isOpen,
  userId,
  heartsBalance,
  onClose,
  onBalanceUpdated,
  onToast,
}: HeartStoreModalProps) {
  const [selectedPack, setSelectedPack] = useState('pack_200');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ receiptId: string; heartsAdded: number } | null>(null);

  if (!isOpen) return null;

  const handlePurchase = async () => {
    setIsSubmitting(true);
    setReceipt(null);
    try {
      const res = await fetch('/api/wallet/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          packageId: selectedPack,
          paymentMethod,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        heartsBalance?: number;
        heartsAdded?: number;
        receiptId?: string;
        error?: string;
      };
      if (!res.ok || !data.success) {
        onToast(data.error || 'Không thể nạp Tim lúc này.', 'warning');
        return;
      }
      if (typeof data.heartsBalance === 'number') {
        onBalanceUpdated(data.heartsBalance);
      }
      setReceipt({
        receiptId: data.receiptId || 'TX-OK',
        heartsAdded: data.heartsAdded || 0,
      });
      onToast(`Nạp thành công +${data.heartsAdded} Tim vào ví của bạn!`, 'success');
    } catch {
      onToast('Lỗi kết nối máy chủ khi nạp Tim.', 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="heart-store-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#111520] border border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-center text-rose-400">
              <Heart className="w-5 h-5 fill-rose-500" />
            </span>
            <div>
              <h2 id="heart-store-title" className="font-display text-lg font-bold text-slate-50">
                Cửa Hàng Mua Tim
              </h2>
              <p className="text-xs text-slate-400">
                Số dư hiện tại:{' '}
                <span className="font-mono font-bold text-rose-400 tabular-nums">
                  {heartsBalance} Tim
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            aria-label="Đóng cửa hàng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Packages */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-300">1. Chọn gói Tim</p>
            <div className="grid grid-cols-2 gap-2.5">
              {PACKAGES.map((pack) => {
                const active = selectedPack === pack.id;
                return (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => setSelectedPack(pack.id)}
                    className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-rose-500/15 border-rose-500 text-white'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 font-mono text-base font-bold text-rose-400 tabular-nums">
                        <Heart className="w-4 h-4 fill-rose-500" />
                        {pack.hearts}
                      </span>
                      <span className="font-mono text-xs font-semibold text-amber-300 tabular-nums">
                        {pack.priceLabel}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-200 mt-1">{pack.label}</p>
                    {pack.bonus && (
                      <p className="text-[11px] text-emerald-400 mt-0.5">{pack.bonus}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-300">2. Phương thức thanh toán</p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    paymentMethod === method
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{method}</span>
                </button>
              ))}
            </div>
          </div>

          {receipt && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/35 p-3 flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Giao dịch <span className="font-mono font-bold">{receipt.receiptId}</span> hoàn tất:
                +{receipt.heartsAdded} Tim đã được cộng vào ví!
              </span>
            </div>
          )}

          {/* Purchase CTA */}
          <button
            type="button"
            onClick={handlePurchase}
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Wallet className="w-4 h-4" />
            <span>{isSubmitting ? 'Đang xử lý...' : 'Xác nhận Mua Tim Ngay'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
