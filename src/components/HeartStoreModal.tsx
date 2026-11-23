import { useState, useEffect } from 'react';
import {
  Heart,
  X,
  CheckCircle2,
  Wallet,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  QrCode,
  Loader2,
} from 'lucide-react';
import { WsListener } from '../hooks/useRealtimeSocket';

interface HeartStoreModalProps {
  isOpen: boolean;
  userId: string;
  heartsBalance: number;
  subscribe: (listener: WsListener) => () => void;
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

interface ActiveMomoOrder {
  orderId: string;
  amountVnd: number;
  hearts: number;
  payUrl: string;
  qrCodeUrl?: string | null;
  deeplink?: string | null;
  status: 'pending' | 'paid' | 'failed';
  transId?: string | null;
}

export function HeartStoreModal({
  isOpen,
  userId,
  heartsBalance,
  subscribe,
  onClose,
  onBalanceUpdated,
  onToast,
}: HeartStoreModalProps) {
  const [selectedPack, setSelectedPack] = useState('pack_200');
  const [momoConfigured, setMomoConfigured] = useState<boolean | null>(null);
  const [momoEnv, setMomoEnv] = useState<'sandbox' | 'production'>('production');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeOrder, setActiveOrder] = useState<ActiveMomoOrder | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Check whether MoMo merchant keys are configured on the server
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/momo/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { configured?: boolean; environment?: 'sandbox' | 'production' } | null) => {
        if (d) {
          setMomoConfigured(Boolean(d.configured));
          if (d.environment) setMomoEnv(d.environment);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Listen for instant WebSocket MoMo IPN payment confirmation
  useEffect(() => {
    return subscribe((type, payload) => {
      if (type === 'momo:order_paid') {
        const orderId = String(payload.orderId || '');
        const heartsAdded = Number(payload.heartsAdded || 0);
        const nextBalance = Number(payload.heartsBalance ?? heartsBalance);
        const transId = payload.transId ? String(payload.transId) : null;
        onBalanceUpdated(nextBalance);
        setActiveOrder((prev) =>
          prev && prev.orderId === orderId ? { ...prev, status: 'paid', transId } : prev
        );
        if (heartsAdded > 0) {
          onToast(`Thanh toán MoMo thành công! Đã cộng +${heartsAdded} Tim.`, 'success');
        }
      }
    });
  }, [subscribe, heartsBalance, onBalanceUpdated, onToast]);

  // Poll pending MoMo order status every 3.5s while open
  useEffect(() => {
    if (!isOpen || !activeOrder || activeOrder.status !== 'pending') return;
    const orderId = activeOrder.orderId;
    const interval = window.setInterval(() => {
      fetch(`/api/momo/order/${encodeURIComponent(orderId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(
          (
            d: {
              status?: 'pending' | 'paid' | 'failed';
              heartsBalance?: number;
              hearts?: number;
              transId?: string | null;
            } | null
          ) => {
            if (!d) return;
            if (d.status === 'paid') {
              if (typeof d.heartsBalance === 'number') onBalanceUpdated(d.heartsBalance);
              setActiveOrder((prev) =>
                prev && prev.orderId === orderId
                  ? { ...prev, status: 'paid', transId: d.transId }
                  : prev
              );
              onToast(`Thanh toán MoMo thành công! +${d.hearts || 0} Tim đã vào ví.`, 'success');
            } else if (d.status === 'failed') {
              setActiveOrder((prev) =>
                prev && prev.orderId === orderId ? { ...prev, status: 'failed' } : prev
              );
            }
          }
        )
        .catch(() => {});
    }, 3500);

    return () => window.clearInterval(interval);
  }, [isOpen, activeOrder, onBalanceUpdated, onToast]);

  if (!isOpen) return null;

  const handleCreateMomoOrder = async () => {
    setIsSubmitting(true);
    setConfigError(null);
    setActiveOrder(null);
    try {
      const res = await fetch('/api/momo/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          packageId: selectedPack,
        }),
      });
      const data = (await res.json()) as {
        orderId?: string;
        amountVnd?: number;
        hearts?: number;
        payUrl?: string;
        qrCodeUrl?: string | null;
        deeplink?: string | null;
        missingConfig?: boolean;
        error?: string;
      };

      if (!res.ok || !data.payUrl || !data.orderId) {
        if (data.missingConfig) {
          setMomoConfigured(false);
          setConfigError(
            data.error ||
              'Cổng MoMo chưa cấu hình khóa đối tác (MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY).'
          );
        } else {
          onToast(data.error || 'Không tạo được đơn thanh toán MoMo.', 'warning');
        }
        return;
      }

      setActiveOrder({
        orderId: data.orderId,
        amountVnd: data.amountVnd || 0,
        hearts: data.hearts || 0,
        payUrl: data.payUrl,
        qrCodeUrl: data.qrCodeUrl,
        deeplink: data.deeplink,
        status: 'pending',
      });
      onToast('Đã tạo đơn MoMo! Hãy bấm Mở cổng MoMo hoặc quét QR để thanh toán.', 'info');
    } catch {
      onToast('Lỗi kết nối máy chủ khi tạo đơn MoMo.', 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualCheckStatus = async () => {
    if (!activeOrder) return;
    setIsCheckingStatus(true);
    try {
      const res = await fetch(`/api/momo/order/${encodeURIComponent(activeOrder.orderId)}`);
      const d = (await res.json()) as {
        status?: 'pending' | 'paid' | 'failed';
        heartsBalance?: number;
        hearts?: number;
        transId?: string | null;
      };
      if (d.status === 'paid') {
        if (typeof d.heartsBalance === 'number') onBalanceUpdated(d.heartsBalance);
        setActiveOrder((prev) => (prev ? { ...prev, status: 'paid', transId: d.transId } : prev));
        onToast(`Đã xác nhận thanh toán MoMo thành công (+${d.hearts || 0} Tim)!`, 'success');
      } else if (d.status === 'failed') {
        setActiveOrder((prev) => (prev ? { ...prev, status: 'failed' } : prev));
        onToast('Giao dịch MoMo không thành công hoặc đã hủy.', 'warning');
      } else {
        onToast('Đơn MoMo đang chờ xác nhận thanh toán...', 'info');
      }
    } catch {
      onToast('Không kiểm tra được trạng thái đơn hàng.', 'warning');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="heart-store-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#111520] border border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-center text-rose-400">
              <Heart className="w-5 h-5 fill-rose-500" />
            </span>
            <div>
              <h2 id="heart-store-title" className="font-display text-lg font-bold text-slate-50">
                Nạp Tim Qua Ví MoMo
              </h2>
              <p className="text-xs text-slate-400">
                Số dư hiện tại:{' '}
                <span className="font-mono font-bold text-rose-400 tabular-nums">
                  {heartsBalance} Tim
                </span>
                {momoConfigured !== null && (
                  <span className="ml-2 text-[11px] text-slate-500">
                    · {momoConfigured ? `Cổng MoMo (${momoEnv})` : 'Chưa cấu hình khóa MoMo'}
                  </span>
                )}
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
            <p className="text-xs font-semibold text-slate-300">1. Chọn gói Tim muốn nạp</p>
            <div className="grid grid-cols-2 gap-2.5">
              {PACKAGES.map((pack) => {
                const active = selectedPack === pack.id;
                return (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => {
                      setSelectedPack(pack.id);
                      setActiveOrder(null);
                    }}
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

          {/* MoMo Gateway Info */}
          <div className="rounded-xl bg-[#A50064]/12 border border-[#D82D8B]/40 p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#A50064] text-white font-display font-extrabold text-xs flex items-center justify-center shrink-0">
              MoMo
            </div>
            <div className="text-xs space-y-0.5">
              <p className="font-semibold text-pink-200">
                Thanh toán chính thức qua Cổng MoMo API v2 (HMAC-SHA256)
              </p>
              <p className="text-slate-300">
                Tim chỉ được cộng tự động sau khi MoMo xác nhận giao dịch thành công qua chữ ký bảo mật.
              </p>
            </div>
          </div>

          {configError && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/40 p-3.5 text-xs text-amber-200 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Cần cấu hình khóa đối tác MoMo Business trên máy chủ</span>
              </div>
              <p>{configError}</p>
              <p className="text-slate-300">
                Vào phần <strong>Settings → Secrets</strong> thêm 3 biến:{' '}
                <code className="font-mono text-amber-300">MOMO_PARTNER_CODE</code>,{' '}
                <code className="font-mono text-amber-300">MOMO_ACCESS_KEY</code>,{' '}
                <code className="font-mono text-amber-300">MOMO_SECRET_KEY</code> (tùy chọn{' '}
                <code className="font-mono text-amber-300">MOMO_ENDPOINT</code>).
              </p>
            </div>
          )}

          {/* Active MoMo Checkout Order */}
          {activeOrder && activeOrder.status === 'pending' && (
            <div className="rounded-xl bg-slate-900 border border-[#D82D8B]/50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-pink-300">
                  Mã đơn: <span className="font-mono">{activeOrder.orderId}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang chờ thanh toán
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href={activeOrder.payUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#A50064] hover:bg-[#c20076] text-white font-bold text-xs transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Mở cổng thanh toán MoMo ({activeOrder.amountVnd.toLocaleString('vi-VN')}đ)</span>
                </a>

                {activeOrder.deeplink && (
                  <a
                    href={activeOrder.deeplink}
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-pink-200 font-semibold text-xs border border-slate-700"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Mở App MoMo</span>
                  </a>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Sau khi thanh toán xong trên MoMo, Tim sẽ tự cộng vào ví.</span>
                <button
                  type="button"
                  onClick={handleManualCheckStatus}
                  disabled={isCheckingStatus}
                  className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 font-semibold cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                  <span>Kiểm tra ngay</span>
                </button>
              </div>
            </div>
          )}

          {activeOrder && activeOrder.status === 'paid' && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/35 p-3.5 flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Đơn <span className="font-mono font-bold">{activeOrder.orderId}</span> đã thanh toán
                thành công qua MoMo: +{activeOrder.hearts} Tim đã cộng vào ví!
              </span>
            </div>
          )}

          {activeOrder && activeOrder.status === 'failed' && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/35 p-3 text-xs text-rose-300">
              Giao dịch <span className="font-mono">{activeOrder.orderId}</span> đã bị hủy hoặc không thành công.
            </div>
          )}

          {/* Create MoMo Order CTA */}
          <button
            type="button"
            onClick={handleCreateMomoOrder}
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-[#A50064] hover:bg-[#c20076] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Wallet className="w-4 h-4" />
            <span>{isSubmitting ? 'Đang khởi tạo cổng MoMo...' : 'Thanh toán bằng Ví MoMo'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
