import React, { useState, useEffect } from 'react';
import { X, LogIn, UserPlus, Edit3, KeyRound, Loader2, ShieldAlert, CheckCircle2 } from 'lucide-react';

export interface UserProfile {
  uid: string;
  username: string;
  displayName?: string;
  role: 'user' | 'admin';
  isCreateAccount: boolean;
  isLogin: boolean;
  isLocked?: boolean;
  activeSessionId?: string;
  theme: string;
  pieceCharMode: 'hanzi' | 'viet';
  soundEnabled: boolean;
  lastUsernameChangeAt?: number;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onAuthSuccess: (user: UserProfile, sessionId: string, decayNotice?: string | null) => void;
  onToast: (msg: string) => void;
}

type AuthTab = 'login' | 'register' | 'rename' | 'password';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthSuccess,
  onToast,
}) => {
  const [tab, setTab] = useState<AuthTab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 3-step concurrent login states
  const [loginStep, setLoginStep] = useState<0 | 1 | 2 | 3>(0);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingRequestId || loginStep !== 2) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/login-request/${pendingRequestId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.request?.status === 'approved') {
          setLoginStep(3);
          setErrorMsg('');
          onToast('Quản trị viên đã duyệt! Nhập lại mật khẩu gốc để vào');
        } else if (data.request?.status === 'rejected') {
          setLoginStep(0);
          setPendingRequestId(null);
          setErrorMsg('Quản trị viên đã từ chối yêu cầu đăng nhập lại');
        }
      } catch {
        // Ignore poll error
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [pendingRequestId, loginStep, onToast]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.status === 409 && data.status === 'already_logged_in') {
        setLoginStep(1);
        setErrorMsg('Tài khoản đang đăng nhập ở nơi khác');
        setLoading(false);
        return;
      }

      if (res.status === 202 && data.status === 'pending_admin') {
        setLoginStep(2);
        setPendingRequestId(data.requestId);
        setErrorMsg('');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setErrorMsg(data.error || 'Đăng nhập thất bại');
        setLoading(false);
        return;
      }

      setLoginStep(0);
      setPendingRequestId(null);
      onAuthSuccess(data.user, data.sessionId, data.decayNotice);
      onToast(`Xin chào, ${data.user.username}`);
      onClose();
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Đăng ký thất bại');
        setLoading(false);
        return;
      }
      onAuthSuccess(data.user, data.sessionId);
      onToast('Đăng ký thành công (Chờ duyệt xếp hạng)');
      onClose();
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldUsername: currentUser?.username || username,
          newUsername,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Đổi tên thất bại');
        setLoading(false);
        return;
      }
      if (currentUser && data.user) {
        onAuthSuccess(data.user, currentUser.activeSessionId || '');
      }
      onToast(`Đã đổi tên thành ${data.username}`);
      onClose();
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser?.username || username,
          oldPassword: password,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Đổi mật khẩu thất bại');
        setLoading(false);
        return;
      }
      onToast('Đã cập nhật mật khẩu mới');
      onClose();
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-stone-900 border border-stone-800 shadow-2xl overflow-hidden text-stone-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
          <h2 className="text-base font-semibold tracking-tight">Tài khoản</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 4 Clean Segmented Tabs */}
        <div className="grid grid-cols-4 gap-1 p-2 bg-stone-950/60 border-b border-stone-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setErrorMsg('');
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg transition-colors whitespace-nowrap ${
              tab === 'login'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5 shrink-0" />
            <span>Đăng nhập</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setErrorMsg('');
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg transition-colors whitespace-nowrap ${
              tab === 'register'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 shrink-0" />
            <span>Đăng ký</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('rename');
              setErrorMsg('');
            }}
            title="Giới hạn 1 lần / 30 ngày"
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg transition-colors whitespace-nowrap ${
              tab === 'rename'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 shrink-0" />
            <span>Đổi tên</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('password');
              setErrorMsg('');
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg transition-colors whitespace-nowrap ${
              tab === 'password'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 shrink-0" />
            <span>Mật khẩu</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5">
          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-950/60 border border-red-800/70 px-3.5 py-2.5 text-xs text-red-200">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span className="flex-1">{errorMsg}</span>
              {loginStep === 1 && (
                <button
                  type="button"
                  onClick={() => {
                    if (!password.endsWith('_resetacc')) {
                      setPassword(`${password}_resetacc`);
                    }
                  }}
                  title="Thêm hậu tố _resetacc để gửi yêu cầu quản trị viên duyệt đăng nhập lại"
                  className="px-2 py-1 rounded bg-amber-600/30 border border-amber-500/40 text-amber-200 hover:bg-amber-600/50 whitespace-nowrap"
                >
                  +_resetacc
                </button>
              )}
            </div>
          )}

          {tab === 'login' && loginStep === 2 && (
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-amber-950/50 border border-amber-700/60 px-4 py-3 text-xs text-amber-200">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
              <span className="flex-1 font-medium">Đang liên hệ quản trị viên…</span>
            </div>
          )}

          {tab === 'login' && loginStep === 3 && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-950/60 border border-emerald-700/60 px-3.5 py-2.5 text-xs text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Đã được duyệt! Xóa _resetacc và bấm Đăng nhập.</span>
            </div>
          )}

          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs text-stone-400 mb-1">Tên đăng nhập</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập"
                  className="w-full rounded-xl bg-stone-950 border border-stone-800 px-3.5 py-2.5 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label
                  className="block text-xs text-stone-400 mb-1"
                  title="Nếu kẹt phiên ở nơi khác, nhập mật khẩu kèm _resetacc ở lần 2"
                >
                  Mật khẩu
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="w-full rounded-xl bg-stone-950 border border-stone-800 px-3.5 py-2.5 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Đăng nhập</span>
              </button>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs text-stone-400 mb-1">
                  Tên đăng nhập (duy nhất)
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="3–24 ký tự chữ, số, _"
                  className="w-full rounded-xl bg-stone-950 border border-stone-800 px-3.5 py-2.5 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Mật khẩu</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full rounded-xl bg-stone-950 border border-stone-800 px-3.5 py-2.5 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Tạo tài khoản</span>
              </button>
            </form>
          )}

          {tab === 'rename' && (
            <form onSubmit={handleRename} className="space-y-3.5">
              {!currentUser && (
                <div>
                  <label className="block text-xs text-stone-400 mb-1">Tên hiện tại</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-xl bg-stone-950 border border-stone-800 px-3.5 py-2.5 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}
              <div>
                <label
                  className="block text-xs text-stone-400 mb-1"
                  title="Giới hạn đổi tên 1 lần mỗi 30 ngày"
                >
                  Tên mới (1 lần / 30 ngày)
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Nhập tên mới"
                  className="w-full rounded-xl bg-stone-950 border border-stone-800 px-3.5 py-2.5 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Mật khẩu xác nhận</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-stone-950 border border-stone-800 px-3.5 py-2.5 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Lưu tên mới</span>
              </button>
            </form>
          )}

          {tab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-3.5">
              {!currentUser && (
                <div>
                  <label className="block text-xs text-stone-400 mb-1">Tên đăng nhập</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-xl bg-stone-950 border border-stone-800 px-3.5 py-2.5 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-stone-400 mb-1">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-stone-950 border border-stone-800 px-3.5 py-2.5 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full rounded-xl bg-stone-950 border border-stone-800 px-3.5 py-2.5 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Đổi mật khẩu</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
