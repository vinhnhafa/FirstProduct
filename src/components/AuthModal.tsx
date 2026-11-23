import { useState } from 'react';
import { X, Mail, Lock, User, LogIn, UserPlus, KeyRound, LogOut, CheckCircle2 } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  registerWithEmail,
  requestPasswordReset,
  signInWithEmail,
  signInWithGooglePopup,
  signOutFirebase,
} from '../lib/firebase';

interface AuthModalProps {
  isOpen: boolean;
  firebaseUser: FirebaseUser | null;
  currentNickname: string;
  onClose: () => void;
  onNicknameChange: (nextName: string) => void;
  onToast: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

function formatAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Bạn đã đóng cửa sổ đăng nhập Google.';
    case 'auth/popup-blocked':
      return 'Trình duyệt đang chặn cửa sổ bật lên (popup). Hãy cho phép popup rồi thử lại.';
    case 'auth/operation-not-allowed':
      return 'Phương thức đăng nhập Email/Mật khẩu chưa được bật trong Firebase Console (Authentication -> Sign-in method). Bạn có thể đăng nhập bằng Google ngay hoặc bật Email/Password trong Firebase Console.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email hoặc mật khẩu chưa chính xác.';
    case 'auth/email-already-in-use':
      return 'Email này đã được đăng ký. Hãy chuyển sang tab Đăng nhập.';
    case 'auth/weak-password':
      return 'Mật khẩu cần tối thiểu 6 ký tự.';
    case 'auth/invalid-email':
      return 'Địa chỉ email không hợp lệ.';
    default:
      return err instanceof Error ? err.message : 'Không thể đăng nhập lúc này.';
  }
}

export function AuthModal({
  isOpen,
  firebaseUser,
  currentNickname,
  onClose,
  onNicknameChange,
  onToast,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'guest'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [guestNick, setGuestNick] = useState(currentNickname);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsBusy(true);
    setErrorMsg(null);
    try {
      const user = await signInWithGooglePopup();
      onToast(`Đăng nhập thành công: ${user.displayName || user.email}`, 'success');
      onClose();
    } catch (err) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    setErrorMsg(null);
    try {
      if (mode === 'register') {
        const user = await registerWithEmail(email, password, displayName);
        onToast(`Tạo tài khoản thành công: ${user.displayName || user.email}`, 'success');
      } else {
        const user = await signInWithEmail(email, password);
        onToast(`Chào mừng trở lại, ${user.displayName || user.email}!`, 'success');
      }
      onClose();
    } catch (err) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setErrorMsg('Hãy nhập email của bạn ở ô phía trên trước khi đặt lại mật khẩu.');
      return;
    }
    setIsBusy(true);
    setErrorMsg(null);
    try {
      await requestPasswordReset(email);
      onToast('Đã gửi liên kết đặt lại mật khẩu tới email của bạn.', 'success');
    } catch (err) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSignOut = async () => {
    setIsBusy(true);
    try {
      await signOutFirebase();
      onToast('Đã đăng xuất tài khoản.', 'info');
      onClose();
    } catch {
      onToast('Không thể đăng xuất lúc này.', 'warning');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveGuestNick = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = guestNick.trim().slice(0, 28);
    if (!clean) return;
    onNicknameChange(clean);
    onToast(`Đã đổi tên hiển thị thành "${clean}".`, 'success');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#111520] border border-slate-800 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 id="auth-modal-title" className="font-display text-lg font-bold text-slate-50">
              {firebaseUser ? 'Tài Khoản Karaoke Online' : 'Đăng Nhập Tài Khoản'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Đồng bộ ví Tim, lịch sử hát và phòng chơi trên mọi thiết bị
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            aria-label="Đóng cửa sổ đăng nhập"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {firebaseUser ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-900/90 border border-emerald-500/35 p-4 flex items-center gap-3.5">
                {firebaseUser.photoURL ? (
                  <img
                    src={firebaseUser.photoURL}
                    alt={firebaseUser.displayName || 'Avatar'}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover border border-emerald-400/50"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold text-lg">
                    {(firebaseUser.displayName || firebaseUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-slate-50 truncate">
                      {firebaseUser.displayName || currentNickname}
                    </p>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  </div>
                  {firebaseUser.email && (
                    <p className="text-xs text-slate-400 truncate">{firebaseUser.email}</p>
                  )}
                  <p className="text-[11px] text-emerald-400 mt-0.5">Đã liên kết tài khoản</p>
                </div>
              </div>

              <form onSubmit={handleSaveGuestNick} className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Biệt danh hiển thị trong phòng hát & game
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={guestNick}
                    onChange={(e) => setGuestNick(e.target.value)}
                    maxLength={28}
                    className="flex-1 h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="px-4 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs cursor-pointer"
                  >
                    Cập nhật
                  </button>
                </div>
              </form>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={isBusy}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất</span>
              </button>
            </div>
          ) : (
            <>
              {/* Google Login CTA */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isBusy}
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 font-bold text-sm flex items-center justify-center gap-2.5 shadow-md transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>Tiếp tục bằng Google</span>
              </button>

              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <span className="flex-1 h-px bg-slate-800" />
                <span>Hoặc chọn phương thức khác</span>
                <span className="flex-1 h-px bg-slate-800" />
              </div>

              {/* Tabs: Email Sign-In / Sign-Up / Guest Nickname */}
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                  }}
                  className={`py-2 rounded-lg font-semibold transition-colors cursor-pointer ${
                    mode === 'login' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg(null);
                  }}
                  className={`py-2 rounded-lg font-semibold transition-colors cursor-pointer ${
                    mode === 'register'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Đăng ký
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('guest');
                    setErrorMsg(null);
                  }}
                  className={`py-2 rounded-lg font-semibold transition-colors cursor-pointer ${
                    mode === 'guest' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Khách nhanh
                </button>
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/40 px-3.5 py-2.5 text-xs text-rose-300 leading-relaxed">
                  {errorMsg}
                </div>
              )}

              {mode === 'guest' ? (
                <form onSubmit={handleSaveGuestNick} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Tên hiển thị nhanh (không cần mật khẩu)
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="text"
                        value={guestNick}
                        onChange={(e) => setGuestNick(e.target.value)}
                        maxLength={28}
                        placeholder="Nhập tên ca sĩ / người chơi..."
                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm cursor-pointer"
                  >
                    Vào ngay với tên này
                  </button>
                </form>
              ) : (
                <form onSubmit={handleEmailSubmit} className="space-y-3">
                  {mode === 'register' && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-300">Tên hiển thị</label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          maxLength={40}
                          placeholder="VD: Minh Tuấn Bolero"
                          className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ban@example.com"
                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-300">Mật khẩu</label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={handleResetPassword}
                          className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer"
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>Quên mật khẩu?</span>
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Tối thiểu 6 ký tự"
                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {mode === 'register' ? (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>{isBusy ? 'Đang tạo tài khoản...' : 'Tạo tài khoản Email'}</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>{isBusy ? 'Đang đăng nhập...' : 'Đăng nhập bằng Email'}</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
