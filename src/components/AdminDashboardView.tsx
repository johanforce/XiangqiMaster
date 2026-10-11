import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  Check,
  X,
  Lock,
  Unlock,
  Key,
  Trash2,
  Sliders,
  Activity,
  Users,
  Bell,
  RefreshCw,
} from 'lucide-react';
import { RatedMode } from '../shared/elo';
import { handleLinkClick } from '../utils/navigation';

interface AdminDashboardViewProps {
  adminUid: string;
  incomingLoginRequests?: any[] | null;
  onToast: (msg: string) => void;
}

type AdminSubTab = 'users' | 'requests' | 'rooms' | 'config';

function parseAdminUrl(): {
  subTab: AdminSubTab;
  statusFilter: 'all' | 'pending' | 'approved' | 'locked';
} {
  const path = window.location.pathname;
  let subTab: AdminSubTab = 'users';
  if (path.startsWith('/admin/requests')) subTab = 'requests';
  else if (path.startsWith('/admin/rooms')) subTab = 'rooms';
  else if (path.startsWith('/admin/config')) subTab = 'config';

  const st = new URLSearchParams(window.location.search).get('status');
  const statusFilter =
    st === 'pending' || st === 'approved' || st === 'locked' ? st : 'all';

  return { subTab, statusFilter };
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  adminUid,
  incomingLoginRequests,
  onToast,
}) => {
  const initialAdminUrl = parseAdminUrl();
  const [subTab, setSubTab] = useState<AdminSubTab>(initialAdminUrl.subTab);
  const [users, setUsers] = useState<any[]>([]);
  const [loginRequests, setLoginRequests] = useState<any[]>([]);
  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [ratingHistory, setRatingHistory] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({
    antiBoostWindowGames: 5,
    antiBoostThreshold: 2,
    antiBoostMaxPenalty: 2,
    decayDays: 7,
    decayPenalty: 20,
    resetDays: 14,
    cleanupHour: 22,
    blitzMinutes: 5,
    blitzIncrementSec: 3,
    standardMinutes: 30,
    standardMoveSec: 120,
    darkMinutes: 15,
    darkMoveSec: 120,
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'locked'>(
    initialAdminUrl.statusFilter
  );
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    const syncAdminUrl = () => {
      if (!window.location.pathname.startsWith('/admin')) return;
      const parsed = parseAdminUrl();
      setSubTab(parsed.subTab);
      setStatusFilter(parsed.statusFilter);
    };
    window.addEventListener('popstate', syncAdminUrl);
    window.addEventListener('app:locationchange', syncAdminUrl);
    return () => {
      window.removeEventListener('popstate', syncAdminUrl);
      window.removeEventListener('app:locationchange', syncAdminUrl);
    };
  }, []);

  // Inline states for password reset / Elo edit instead of window.prompt
  const [editingEloUid, setEditingEloUid] = useState<string | null>(null);
  const [editEloMode, setEditEloMode] = useState<RatedMode>('blitz');
  const [editEloVal, setEditEloVal] = useState<number>(1300);
  const [resetPassUid, setResetPassUid] = useState<string | null>(null);
  const [resetPassVal, setResetPassVal] = useState('123456');

  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/admin/overview', {
        cache: 'no-store',
        headers: { 'x-admin-uid': adminUid },
      });
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users || []);
      setLoginRequests(data.loginRequests || []);
      setActiveRooms(data.activeRooms || []);
      setGames(data.games || []);
      setRatingHistory(data.ratingHistory || []);
      if (data.config) setConfig(data.config);
    } catch {
      // Ignore error
    }
  };

  useEffect(() => {
    fetchOverview();
    const timer = setInterval(fetchOverview, 5000);
    return () => clearInterval(timer);
  }, [adminUid]);

  useEffect(() => {
    if (incomingLoginRequests) {
      setLoginRequests(incomingLoginRequests);
    }
  }, [incomingLoginRequests]);

  const handleUserAction = async (targetUid: string, action: string, payload?: any) => {
    try {
      const res = await fetch('/api/admin/user-action', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-uid': adminUid,
        },
        body: JSON.stringify({ targetUid, action, payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.error || 'Lỗi thao tác');
        return;
      }
      onToast('Đã cập nhật');
      setEditingEloUid(null);
      setResetPassUid(null);
      fetchOverview();
    } catch {
      onToast('Lỗi kết nối');
    }
  };

  const handleRequestDecision = async (requestId: string, decision: 'approved' | 'rejected') => {
    try {
      const res = await fetch('/api/admin/login-request-action', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-uid': adminUid,
        },
        body: JSON.stringify({ requestId, decision }),
      });
      if (res.ok) {
        onToast(decision === 'approved' ? 'Đã chấp nhận đăng nhập lại' : 'Đã từ chối');
        fetchOverview();
      }
    } catch {
      onToast('Lỗi xử lý yêu cầu');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-uid': adminUid,
        },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        onToast('Đã lưu cấu hình hệ thống');
      }
    } catch {
      onToast('Lỗi lưu cấu hình');
    }
  };

  const triggerCron = async (endpoint: 'cleanup-rooms' | 'rating-decay') => {
    try {
      const res = await fetch(`/api/cron/${endpoint}`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'x-admin-uid': adminUid },
      });
      if (res.ok) {
        onToast('Đã chạy tác vụ định kỳ');
        fetchOverview();
      }
    } catch {
      onToast('Lỗi chạy tác vụ');
    }
  };

  const pendingReqCount = loginRequests.filter((r) => r.status === 'pending').length;

  const filteredUsers = users.filter((u) => {
    if (search && !u.username.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === 'pending' && u.isCreateAccount) return false;
    if (statusFilter === 'approved' && !u.isCreateAccount) return false;
    if (statusFilter === 'locked' && !u.isLocked) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const pagedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="w-full max-w-6xl mx-auto rounded-2xl bg-stone-900/95 border border-stone-800 p-4 sm:p-6 shadow-xl space-y-5">
      {/* Header & Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-4">
        <div className="flex items-center gap-2 text-base font-semibold text-stone-100">
          <ShieldCheck className="w-5 h-5 text-amber-500" />
          <span>Quản trị hệ thống</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs">
          <a
            href="/admin/users"
            onClick={(e) => handleLinkClick(e, '/admin/users', () => setSubTab('users'))}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition-colors ${
              subTab === 'users' ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Tài khoản ({users.length})</span>
          </a>
          <a
            href="/admin/requests"
            onClick={(e) => handleLinkClick(e, '/admin/requests', () => setSubTab('requests'))}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition-colors ${
              subTab === 'requests'
                ? 'bg-amber-600 text-white'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Yêu cầu đăng nhập</span>
            {pendingReqCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded-md">
                {pendingReqCount}
              </span>
            )}
          </a>
          <a
            href="/admin/rooms"
            onClick={(e) => handleLinkClick(e, '/admin/rooms', () => setSubTab('rooms'))}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition-colors ${
              subTab === 'rooms' ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Phòng & Nhật ký</span>
          </a>
          <a
            href="/admin/config"
            onClick={(e) => handleLinkClick(e, '/admin/config', () => setSubTab('config'))}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition-colors ${
              subTab === 'config'
                ? 'bg-amber-600 text-white'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Cấu hình</span>
          </a>
          <button
            onClick={fetchOverview}
            title="Làm mới"
            className="p-2 rounded-lg text-stone-400 hover:text-stone-100"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* TAB 1: USERS TABLE */}
      {subTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Tìm tên đăng nhập..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs">
              {(
                [
                  ['all', 'Tất cả'],
                  ['pending', 'Chờ duyệt'],
                  ['approved', 'Đã duyệt'],
                  ['locked', 'Bị khóa'],
                ] as const
              ).map(([k, label]) => {
                const filterUrl = k === 'all' ? '/admin/users' : `/admin/users?status=${k}`;
                return (
                  <a
                    key={k}
                    href={filterUrl}
                    onClick={(e) =>
                      handleLinkClick(e, filterUrl, () => {
                        setStatusFilter(k);
                        setPage(1);
                      })
                    }
                    className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                      statusFilter === k
                        ? 'bg-stone-800 text-stone-100'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {label}
                  </a>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-800 text-stone-400">
                  <th className="py-2.5 px-3">Tài khoản</th>
                  <th className="py-2.5 px-3">Mật khẩu</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                  <th className="py-2.5 px-3">Phiên</th>
                  <th className="py-2.5 px-3">Elo (Chớp/TC/Úp)</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60">
                {pagedUsers.map((u) => (
                  <tr key={u.uid} className="hover:bg-stone-800/30">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-stone-100 flex items-center gap-1.5">
                        <span>{u.displayName || u.username}</span>
                        {u.role === 'admin' && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">Admin</span>
                        )}
                      </div>
                      {u.displayName && u.displayName !== u.username && (
                        <div className="text-xs text-stone-400 font-normal">@{u.username}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono-num text-stone-300">
                      <span className="px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-amber-300/90">
                        {u.password || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={
                          u.isLocked
                            ? 'text-red-400'
                            : u.isCreateAccount
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }
                      >
                        {u.isLocked ? 'Bị khóa' : u.isCreateAccount ? 'Đã duyệt' : 'Chờ duyệt'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-stone-400">
                      {u.isLogin ? 'Đang hoạt động' : 'Ngoại tuyến'}
                    </td>
                    <td className="py-3 px-3 font-mono-num text-stone-300">
                      {u.ratings?.blitz ?? 1300} / {u.ratings?.standard ?? 1300} /{' '}
                      {u.ratings?.dark ?? 1300}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!u.isCreateAccount ? (
                          <button
                            onClick={() => handleUserAction(u.uid, 'approve_account')}
                            title="Duyệt tài khoản"
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/40 flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Duyệt</span>
                          </button>
                        ) : (
                          u.role !== 'admin' && (
                            <button
                              onClick={() => handleUserAction(u.uid, 'reject_account')}
                              title="Hủy duyệt"
                              className="px-2 py-1.5 rounded-lg bg-stone-800 text-stone-400 hover:text-stone-200"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}

                        <button
                          onClick={() => {
                            setEditingEloUid(editingEloUid === u.uid ? null : u.uid);
                            setEditEloVal(u.ratings?.blitz ?? 1300);
                          }}
                          title="Sửa Elo thủ công"
                          className="px-2 py-1.5 rounded-lg bg-stone-800 text-amber-300 hover:bg-stone-700"
                        >
                          Elo
                        </button>

                        <button
                          onClick={() => {
                            if (resetPassUid === u.uid) {
                              setResetPassUid(null);
                            } else {
                              setResetPassUid(u.uid);
                              setResetPassVal(u.password || '123456');
                            }
                          }}
                          title="Sửa mật khẩu"
                          className="px-2.5 py-1.5 rounded-lg bg-stone-800 text-stone-200 hover:bg-stone-700 flex items-center gap-1"
                        >
                          <Key className="w-3.5 h-3.5 text-amber-400" />
                          <span>Sửa MK</span>
                        </button>

                        {u.role !== 'admin' && (
                          <>
                            <button
                              onClick={() => handleUserAction(u.uid, 'toggle_lock')}
                              title={u.isLocked ? 'Mở khóa' : 'Khóa tài khoản'}
                              className="p-1.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700"
                            >
                              {u.isLocked ? (
                                <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Lock className="w-3.5 h-3.5 text-amber-400" />
                              )}
                            </button>
                            <button
                              onClick={() => handleUserAction(u.uid, 'delete_user')}
                              title="Xóa tài khoản"
                              className="p-1.5 rounded-lg bg-red-950/60 text-red-400 hover:bg-red-900/60"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>

                      {/* Inline Elo Editor */}
                      {editingEloUid === u.uid && (
                        <div className="mt-2 flex items-center justify-end gap-1.5 bg-stone-950 p-2 rounded-xl border border-stone-800">
                          <select
                            value={editEloMode}
                            onChange={(e) => {
                              const m = e.target.value as RatedMode;
                              setEditEloMode(m);
                              setEditEloVal(u.ratings?.[m] ?? 1300);
                            }}
                            className="rounded-lg bg-stone-900 border border-stone-700 px-2 py-1 text-xs text-stone-200"
                          >
                            <option value="blitz">Cờ chớp</option>
                            <option value="standard">Tiêu chuẩn</option>
                            <option value="dark">Cờ úp</option>
                          </select>
                          <input
                            type="number"
                            value={editEloVal}
                            onChange={(e) => setEditEloVal(Number(e.target.value))}
                            className="w-20 rounded-lg bg-stone-900 border border-stone-700 px-2 py-1 text-xs text-stone-100 font-mono-num"
                          />
                          <button
                            onClick={() =>
                              handleUserAction(u.uid, 'update_elo', {
                                mode: editEloMode,
                                elo: editEloVal,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs font-medium"
                          >
                            Lưu
                          </button>
                        </div>
                      )}

                      {/* Inline Password Editor */}
                      {resetPassUid === u.uid && (
                        <div className="mt-2 flex items-center justify-end gap-1.5 bg-stone-950 p-2 rounded-xl border border-stone-800">
                          <span className="text-[11px] text-stone-400">Mật khẩu mới:</span>
                          <input
                            type="text"
                            value={resetPassVal}
                            onChange={(e) => setResetPassVal(e.target.value)}
                            placeholder="Nhập mật khẩu mới"
                            className="w-36 rounded-lg bg-stone-900 border border-stone-700 px-2.5 py-1 text-xs text-stone-100 font-mono-num focus:outline-none focus:border-amber-500"
                          />
                          <button
                            onClick={() =>
                              handleUserAction(u.uid, 'update_password', {
                                newPassword: resetPassVal,
                              })
                            }
                            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors"
                          >
                            Lưu MK
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 text-xs">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg bg-stone-800 disabled:opacity-40"
              >
                Trước
              </button>
              <span className="text-stone-400 font-mono-num">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-stone-800 disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LOGIN REQUESTS QUEUE */}
      {subTab === 'requests' && (
        <div className="space-y-2">
          {loginRequests.length === 0 ? (
            <div className="py-10 text-center text-xs text-stone-500">
              Không có yêu cầu đăng nhập lại
            </div>
          ) : (
            loginRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-stone-950/80 border border-stone-800 text-xs"
              >
                <div>
                  <span className="font-semibold text-stone-100">{req.username}</span>
                  <span className="mx-2 text-stone-600">·</span>
                  <span className="text-stone-400">Lượt thử: {req.attemptCount}</span>
                  <span className="mx-2 text-stone-600">·</span>
                  <span
                    className={
                      req.status === 'pending'
                        ? 'text-amber-400 font-medium'
                        : req.status === 'approved'
                        ? 'text-emerald-400'
                        : 'text-stone-500'
                    }
                  >
                    {req.status}
                  </span>
                </div>
                {req.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRequestDecision(req.id, 'approved')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500"
                    >
                      Chấp nhận
                    </button>
                    <button
                      onClick={() => handleRequestDecision(req.id, 'rejected')}
                      className="px-3 py-1.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700"
                    >
                      Từ chối
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: ACTIVE ROOMS, GAMES & ELO LOGS */}
      {subTab === 'rooms' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <h3 className="font-semibold text-stone-300">
              Phòng đang mở ({activeRooms.length})
            </h3>
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {activeRooms.map((r) => (
                <div
                  key={r.code}
                  className="p-3 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono-num font-bold text-amber-400">{r.code}</span>
                    <span className="mx-2 text-stone-600">·</span>
                    <span>
                      {r.redPlayer?.username || 'Trống'} vs {r.blackPlayer?.username || 'Trống'}
                    </span>
                  </div>
                  <span className="text-stone-400">{r.status}</span>
                </div>
              ))}
              {activeRooms.length === 0 && (
                <div className="text-stone-500 py-4">Chưa có phòng hoạt động</div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-stone-300">Nhật ký Elo gần đây</h3>
            <div className="max-h-60 overflow-y-auto space-y-1.5 font-mono-num">
              {ratingHistory.map((h) => (
                <div
                  key={h.id}
                  className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between"
                >
                  <div className="truncate pr-2">
                    <span className="font-sans font-semibold text-stone-200">{h.username}</span>{' '}
                    <span className="text-stone-500">({h.mode})</span> ·{' '}
                    <span className="font-sans text-stone-400">{h.reason}</span>
                  </div>
                  <div
                    className={
                      h.delta >= 0 ? 'text-emerald-400 shrink-0' : 'text-red-400 shrink-0'
                    }
                  >
                    {h.beforeElo} → {h.afterElo} ({h.delta >= 0 ? `+${h.delta}` : h.delta})
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SYSTEM PARAMETERS CONFIG */}
      {subTab === 'config' && (
        <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-stone-400 mb-1">Số ván xét chống cày</label>
              <input
                type="number"
                value={config.antiBoostWindowGames}
                onChange={(e) =>
                  setConfig({ ...config, antiBoostWindowGames: Number(e.target.value) })
                }
                className="w-full rounded-xl bg-stone-950 border border-stone-800 px-3 py-2 text-stone-100 font-mono-num"
              />
            </div>
            <div>
              <label className="block text-stone-400 mb-1">Ngưỡng lặp đối thủ (n)</label>
              <input
                type="number"
                value={config.antiBoostThreshold}
                onChange={(e) =>
                  setConfig({ ...config, antiBoostThreshold: Number(e.target.value) })
                }
                className="w-full rounded-xl bg-stone-950 border border-stone-800 px-3 py-2 text-stone-100 font-mono-num"
              />
            </div>
            <div>
              <label className="block text-stone-400 mb-1">Mức trừ cày tối đa</label>
              <input
                type="number"
                value={config.antiBoostMaxPenalty}
                onChange={(e) =>
                  setConfig({ ...config, antiBoostMaxPenalty: Number(e.target.value) })
                }
                className="w-full rounded-xl bg-stone-950 border border-stone-800 px-3 py-2 text-stone-100 font-mono-num"
              />
            </div>
            <div>
              <label className="block text-stone-400 mb-1">Giờ dọn phòng (0-23h)</label>
              <input
                type="number"
                value={config.cleanupHour}
                onChange={(e) => setConfig({ ...config, cleanupHour: Number(e.target.value) })}
                className="w-full rounded-xl bg-stone-950 border border-stone-800 px-3 py-2 text-stone-100 font-mono-num"
              />
            </div>
            <div>
              <label className="block text-stone-400 mb-1">Ngày trừ không hoạt động</label>
              <input
                type="number"
                value={config.decayDays}
                onChange={(e) => setConfig({ ...config, decayDays: Number(e.target.value) })}
                className="w-full rounded-xl bg-stone-950 border border-stone-800 px-3 py-2 text-stone-100 font-mono-num"
              />
            </div>
            <div>
              <label className="block text-stone-400 mb-1">Điểm trừ 7 ngày</label>
              <input
                type="number"
                value={config.decayPenalty}
                onChange={(e) => setConfig({ ...config, decayPenalty: Number(e.target.value) })}
                className="w-full rounded-xl bg-stone-950 border border-stone-800 px-3 py-2 text-stone-100 font-mono-num"
              />
            </div>
            <div>
              <label className="block text-stone-400 mb-1">Ngày reset Elo (1300)</label>
              <input
                type="number"
                value={config.resetDays}
                onChange={(e) => setConfig({ ...config, resetDays: Number(e.target.value) })}
                className="w-full rounded-xl bg-stone-950 border border-stone-800 px-3 py-2 text-stone-100 font-mono-num"
              />
            </div>
            <div>
              <label className="block text-stone-400 mb-1">Phút Cờ chớp / Tiêu chuẩn / Úp</label>
              <div className="grid grid-cols-3 gap-1">
                <input
                  type="number"
                  value={config.blitzMinutes}
                  onChange={(e) => setConfig({ ...config, blitzMinutes: Number(e.target.value) })}
                  className="rounded-lg bg-stone-950 border border-stone-800 px-2 py-2 text-center font-mono-num"
                />
                <input
                  type="number"
                  value={config.standardMinutes}
                  onChange={(e) =>
                    setConfig({ ...config, standardMinutes: Number(e.target.value) })
                  }
                  className="rounded-lg bg-stone-950 border border-stone-800 px-2 py-2 text-center font-mono-num"
                />
                <input
                  type="number"
                  value={config.darkMinutes}
                  onChange={(e) => setConfig({ ...config, darkMinutes: Number(e.target.value) })}
                  className="rounded-lg bg-stone-950 border border-stone-800 px-2 py-2 text-center font-mono-num"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => triggerCron('cleanup-rooms')}
                className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium"
              >
                Dọn phòng ngay
              </button>
              <button
                type="button"
                onClick={() => triggerCron('rating-decay')}
                className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium"
              >
                Quét trừ điểm nghỉ
              </button>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold"
            >
              Lưu cấu hình
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
