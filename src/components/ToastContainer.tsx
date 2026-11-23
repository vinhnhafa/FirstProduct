import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { ToastMessage } from '../types/karaoke';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.type === 'success'
            ? CheckCircle2
            : toast.type === 'warning'
              ? AlertTriangle
              : Info;

        const accentClass =
          toast.type === 'success'
            ? 'text-emerald-400 border-emerald-500/30'
            : toast.type === 'warning'
              ? 'text-amber-400 border-amber-500/30'
              : 'text-sky-400 border-sky-500/30';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl bg-[#121620]/95 backdrop-blur-md border ${accentClass} px-4 py-3 shadow-2xl transition-all duration-200`}
            role="status"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon className="w-4 h-4 shrink-0" />
              <p className="text-sm text-slate-100 font-medium leading-snug truncate">
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-slate-100 p-1 rounded-md transition-colors shrink-0"
              aria-label="Đóng thông báo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
