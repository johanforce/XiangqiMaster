import React, { useState, useEffect, useMemo } from 'react';
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
  Library,
  Plus,
  Edit3,
  BookOpen,
  RotateCcw,
  Undo2,
  SkipBack,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Save,
  Eye,
} from 'lucide-react';
import { RatedMode } from '../shared/elo';
import {
  INITIAL_FEN,
  parseFen,
  boardToFen,
  applyMove,
  formatMoveNotation,
  isKingInCheck,
  replayFromNotationText,
  FormattedMove,
  Pos,
  PieceColor,
} from '../shared/xiangqi';
import { XiangqiBoard } from './XiangqiBoard';
import { BOARD_THEMES } from '../utils/themes';
import { sound } from '../utils/sound';
import { navigateUrl, handleLinkClick } from '../utils/navigation';

interface AdminDashboardViewProps {
  adminUid: string;
  incomingLoginRequests?: any[] | null;
  onToast: (msg: string) => void;
}

type AdminSubTab = 'users' | 'requests' | 'rooms' | 'config' | 'library';

const ARTICLE_CATEGORIES = [
  'Khai cuộc',
  'Trung cuộc',
  'Tàn cuộc',
  'Sát pháp',
  'Bình chú danh cục',
  'Cẩm nang chiến thuật',
];

function parseAdminUrl(): {
  subTab: AdminSubTab;
  statusFilter: 'all' | 'pending' | 'approved' | 'locked';
  editArticleId: string | null;
} {
  const path = window.location.pathname;
  let subTab: AdminSubTab = 'users';
  if (path.startsWith('/admin/requests')) subTab = 'requests';
  else if (path.startsWith('/admin/rooms')) subTab = 'rooms';
  else if (path.startsWith('/admin/config')) subTab = 'config';
  else if (path.startsWith('/admin/library')) subTab = 'library';

  const params = new URLSearchParams(window.location.search);
  const st = params.get('status');
  const statusFilter =
    st === 'pending' || st === 'approved' || st === 'locked' ? st : 'all';
  const editArticleId = params.get('edit');

  return { subTab, statusFilter, editArticleId };
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

  // Tàng Thư (Library) Admin State
  const [articles, setArticles] = useState<any[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [editingArticleId, setEditingArticleId] = useState<string | null>(
    initialAdminUrl.editArticleId
  );
  const [artTitle, setArtTitle] = useState('');
  const [artCategory, setArtCategory] = useState('Khai cuộc');
  const [artSummary, setArtSummary] = useState('');
  const [artContent, setArtContent] = useState('');
  const [artInitialFen, setArtInitialFen] = useState(INITIAL_FEN);
  const [artNotationText, setArtNotationText] = useState('');
  const [artMoves, setArtMoves] = useState<FormattedMove[]>([]);
  const [previewPly, setPreviewPly] = useState(0);
  const [savingArticle, setSavingArticle] = useState(false);
  const [deletingArticleId, setDeletingArticleId] = useState<string | null>(null);

  const fetchArticlesAdmin = async () => {
    try {
      const res = await fetch('/api/articles', { cache: 'no-store' });
      const data = await res.json();
      if (data.articles) {
        setArticles(data.articles);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    void fetchArticlesAdmin();
  }, []);

  const loadArticleIntoEditor = (art: any) => {
    setEditingArticleId(art.id);
    setArtTitle(art.title || '');
    setArtCategory(art.category || 'Khai cuộc');
    setArtSummary(art.summary || '');
    setArtContent(art.content || '');
    const initFen = art.initialFen || INITIAL_FEN;
    setArtInitialFen(initFen);
    setArtNotationText(art.notationText || '');
    if (Array.isArray(art.moves) && art.moves.length > 0) {
      setArtMoves(art.moves);
      setPreviewPly(art.moves.length);
    } else if (art.notationText) {
      const parsed = replayFromNotationText(
        (initFen !== INITIAL_FEN ? `[FEN "${initFen}"]\n` : '') + art.notationText
      );
      setArtMoves(parsed.moves);
      setPreviewPly(parsed.moves.length);
    } else {
      setArtMoves([]);
      setPreviewPly(0);
    }
  };

  const resetArticleEditor = () => {
    setEditingArticleId(null);
    setArtTitle('');
    setArtCategory('Khai cuộc');
    setArtSummary('');
    setArtContent('');
    setArtInitialFen(INITIAL_FEN);
    setArtNotationText('');
    setArtMoves([]);
    setPreviewPly(0);
    navigateUrl('/admin/library', true);
  };

  useEffect(() => {
    if (initialAdminUrl.editArticleId && articles.length > 0) {
      const target = articles.find((a) => a.id === initialAdminUrl.editArticleId);
      if (target) loadArticleIntoEditor(target);
    }
  }, [articles]);

  useEffect(() => {
    const syncAdminUrl = () => {
      if (!window.location.pathname.startsWith('/admin')) return;
      const parsed = parseAdminUrl();
      setSubTab(parsed.subTab);
      setStatusFilter(parsed.statusFilter);
      if (parsed.editArticleId) {
        const target = articles.find((a) => a.id === parsed.editArticleId);
        if (target) loadArticleIntoEditor(target);
      }
    };
    window.addEventListener('popstate', syncAdminUrl);
    window.addEventListener('app:locationchange', syncAdminUrl);
    return () => {
      window.removeEventListener('popstate', syncAdminUrl);
      window.removeEventListener('app:locationchange', syncAdminUrl);
    };
  }, [articles]);

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
            href="/admin/library"
            onClick={(e) => handleLinkClick(e, '/admin/library', () => setSubTab('library'))}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition-colors ${
              subTab === 'library'
                ? 'bg-amber-600 text-white'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Library className="w-3.5 h-3.5" />
            <span>Tàng Thư ({articles.length})</span>
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
            onClick={() => {
              fetchOverview();
              fetchArticlesAdmin();
            }}
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

      {/* TAB 5: TÀNG THƯ (LIBRARY ARTICLES EDITOR & BOARD / NOTATION BUILDER) */}
      {subTab === 'library' && (() => {
        const clampedEditorPly = Math.min(previewPly, artMoves.length);
        const activeEditorFen =
          clampedEditorPly === 0 || artMoves.length === 0
            ? artInitialFen || INITIAL_FEN
            : artMoves[clampedEditorPly - 1]?.fen || artInitialFen || INITIAL_FEN;

        let editorBoardState = parseFen(INITIAL_FEN);
        try {
          editorBoardState = parseFen(activeEditorFen);
        } catch {
          editorBoardState = parseFen(INITIAL_FEN);
        }

        const editorLastMove =
          clampedEditorPly > 0 && artMoves[clampedEditorPly - 1]
            ? {
                from: artMoves[clampedEditorPly - 1].from,
                to: artMoves[clampedEditorPly - 1].to,
              }
            : null;

        const rebuildNotationString = (movesList: FormattedMove[]) => {
          const pairs: string[] = [];
          for (let i = 0; i < movesList.length; i += 2) {
            const m1 = movesList[i]?.wxf || '';
            const m2 = movesList[i + 1]?.wxf || '';
            pairs.push(`${Math.floor(i / 2) + 1}. ${m1}${m2 ? ' ' + m2 : ''}`);
          }
          return pairs.join(' ');
        };

        const handleEditorBoardMove = (from: Pos, to: Pos) => {
          const baseMoves = artMoves.slice(0, clampedEditorPly);
          const currentBoard = editorBoardState.board;
          const currentTurn = editorBoardState.turn;

          const notation = formatMoveNotation(currentBoard, from, to);
          const { nextBoard, move } = applyMove(currentBoard, from, to);
          const nextTurn: PieceColor = currentTurn === 'r' ? 'b' : 'r';
          const nextFen = boardToFen(nextBoard, nextTurn);
          const gaveCheck = isKingInCheck(nextBoard, nextTurn);

          if (gaveCheck) sound.playCheck();
          else if (move.captured) sound.playCapture();
          else sound.playMove();

          const newMove: FormattedMove = {
            ...move,
            ply: baseMoves.length + 1,
            color: currentTurn,
            ...notation,
            fen: nextFen,
            isCheck: gaveCheck,
          };

          const updatedMoves = [...baseMoves, newMove];
          setArtMoves(updatedMoves);
          setPreviewPly(updatedMoves.length);
          setArtNotationText(rebuildNotationString(updatedMoves));
        };

        const handleParseNotationIntoBoard = () => {
          if (!artNotationText.trim()) {
            setArtMoves([]);
            setPreviewPly(0);
            onToast('Đã làm trống ký phổ');
            return;
          }
          const fenHeader =
            artInitialFen.trim() && artInitialFen.trim() !== INITIAL_FEN
              ? `[FEN "${artInitialFen.trim()}"]\n`
              : '';
          const parsed = replayFromNotationText(fenHeader + artNotationText);
          if (parsed.moves.length === 0) {
            onToast('Không nhận diện được nước đi hợp lệ từ ký phổ đã nhập');
            return;
          }
          if (parsed.initialFen && parsed.initialFen !== INITIAL_FEN) {
            setArtInitialFen(parsed.initialFen);
          }
          setArtMoves(parsed.moves);
          setPreviewPly(parsed.moves.length);
          onToast(`Đã nạp ${parsed.moves.length} bước lên bàn cờ minh họa`);
        };

        const handleUndoEditorMove = () => {
          if (artMoves.length === 0) return;
          const next = artMoves.slice(0, -1);
          setArtMoves(next);
          setPreviewPly(next.length);
          setArtNotationText(rebuildNotationString(next));
        };

        const handleResetEditorBoard = () => {
          setArtMoves([]);
          setPreviewPly(0);
          setArtNotationText('');
        };

        const insertFormatting = (snippet: string) => {
          setArtContent((prev) => (prev ? `${prev}\n${snippet}` : snippet));
        };

        const handleSaveArticle = async (e: React.FormEvent) => {
          e.preventDefault();
          if (!artTitle.trim()) {
            onToast('Vui lòng nhập tiêu đề bài viết');
            return;
          }
          if (!artContent.trim()) {
            onToast('Vui lòng nhập nội dung bài viết');
            return;
          }

          setSavingArticle(true);
          try {
            const url = editingArticleId
              ? `/api/admin/articles/${encodeURIComponent(editingArticleId)}`
              : '/api/admin/articles';
            const method = editingArticleId ? 'PUT' : 'POST';

            const res = await fetch(url, {
              method,
              headers: {
                'Content-Type': 'application/json',
                'x-admin-uid': adminUid,
              },
              body: JSON.stringify({
                title: artTitle.trim(),
                category: artCategory,
                summary: artSummary.trim(),
                content: artContent.trim(),
                initialFen: artInitialFen.trim() || INITIAL_FEN,
                notationText: artNotationText.trim(),
                moves: artMoves,
              }),
            });
            const data = await res.json();
            if (!res.ok) {
              onToast(data.error || 'Lỗi lưu bài viết');
              return;
            }
            onToast(editingArticleId ? 'Đã cập nhật bài viết Tàng Thư' : 'Đã đăng bài viết mới vào Tàng Thư');
            await fetchArticlesAdmin();
            resetArticleEditor();
          } catch {
            onToast('Lỗi kết nối khi lưu bài viết');
          } finally {
            setSavingArticle(false);
          }
        };

        const handleDeleteArticle = async (id: string) => {
          try {
            const res = await fetch(`/api/admin/articles/${encodeURIComponent(id)}`, {
              method: 'DELETE',
              headers: { 'x-admin-uid': adminUid },
            });
            if (res.ok) {
              onToast('Đã xóa bài viết khỏi Tàng Thư');
              setDeletingArticleId(null);
              if (editingArticleId === id) {
                resetArticleEditor();
              }
              await fetchArticlesAdmin();
            } else {
              onToast('Không thể xóa bài viết');
            }
          } catch {
            onToast('Lỗi kết nối khi xóa bài viết');
          }
        };

        const filteredAdminArticles = articles.filter((a) => {
          if (!librarySearch.trim()) return true;
          const q = librarySearch.trim().toLowerCase();
          return (
            String(a.title || '').toLowerCase().includes(q) ||
            String(a.category || '').toLowerCase().includes(q) ||
            String(a.summary || '').toLowerCase().includes(q)
          );
        });

        return (
          <div className="space-y-6">
            {/* Editor Form + Interactive Board & Notation Builder */}
            <form
              onSubmit={handleSaveArticle}
              className="rounded-2xl bg-stone-950/90 border border-stone-800 p-4 sm:p-5 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-display font-bold text-stone-100">
                    {editingArticleId
                      ? `Chỉnh sửa bài viết: ${artTitle}`
                      : 'Soạn Bài Viết Mới Cho Tàng Thư (Lưu Firebase)'}
                  </h3>
                </div>
                {editingArticleId && (
                  <button
                    type="button"
                    onClick={resetArticleEditor}
                    className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs text-stone-300 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tạo bài viết mới</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT COLUMN: Article Text Editor */}
                <div className="lg:col-span-6 space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-stone-400 mb-1 font-medium">
                        Tiêu đề bài viết *
                      </label>
                      <input
                        type="text"
                        value={artTitle}
                        onChange={(e) => setArtTitle(e.target.value)}
                        placeholder="VD: Tuyệt kỹ Trung Pháo Đối Bình Phong Mã..."
                        className="w-full rounded-xl bg-stone-900 border border-stone-800 px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-400 mb-1 font-medium">Chuyên mục</label>
                      <select
                        value={artCategory}
                        onChange={(e) => setArtCategory(e.target.value)}
                        className="w-full rounded-xl bg-stone-900 border border-stone-800 px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
                      >
                        {ARTICLE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-stone-400 mb-1 font-medium">
                      Tóm tắt ngắn (hiển thị ngoài thẻ bài viết)
                    </label>
                    <input
                      type="text"
                      value={artSummary}
                      onChange={(e) => setArtSummary(e.target.value)}
                      placeholder="Mô tả ngắn gọn nội dung trọng tâm của bài viết..."
                      className="w-full rounded-xl bg-stone-900 border border-stone-800 px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <label className="text-stone-400 font-medium">
                        Trình soạn thảo nội dung bài viết *
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => insertFormatting('## Tiêu đề phần mới')}
                          className="px-2 py-1 rounded bg-stone-900 hover:bg-stone-800 border border-stone-800 text-[11px] text-amber-300 font-semibold"
                        >
                          + Tiêu đề (H2)
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting('**Ý chính quan trọng**')}
                          className="px-2 py-1 rounded bg-stone-900 hover:bg-stone-800 border border-stone-800 text-[11px] text-stone-200 font-bold"
                        >
                          + In đậm
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting('- Phân tích nước đi: ')}
                          className="px-2 py-1 rounded bg-stone-900 hover:bg-stone-800 border border-stone-800 text-[11px] text-stone-200"
                        >
                          + Gạch đầu dòng
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting('> Bình chú danh thủ: ')}
                          className="px-2 py-1 rounded bg-stone-900 hover:bg-stone-800 border border-stone-800 text-[11px] text-stone-300 italic"
                        >
                          + Trích dẫn
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={13}
                      value={artContent}
                      onChange={(e) => setArtContent(e.target.value)}
                      placeholder="Nhập bài phân tích, bình chú khai cuộc, sát pháp... Hỗ trợ định dạng ## Tiêu đề, **In đậm**, - Danh sách, > Trích dẫn."
                      className="w-full rounded-xl bg-stone-900 border border-stone-800 p-3 text-xs sm:text-sm text-stone-100 leading-relaxed focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-400 mb-1 font-medium">
                      FEN thế cờ khởi đầu (Mặc định là bàn cờ tiêu chuẩn hoặc dán FEN thế cờ tàn)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={artInitialFen}
                        onChange={(e) => {
                          setArtInitialFen(e.target.value);
                          setArtMoves([]);
                          setPreviewPly(0);
                        }}
                        className="flex-1 rounded-xl bg-stone-900 border border-stone-800 px-3 py-2 text-stone-200 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setArtInitialFen(INITIAL_FEN);
                          setArtMoves([]);
                          setPreviewPly(0);
                        }}
                        className="px-2.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] shrink-0"
                      >
                        Mặc định
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-stone-400 font-medium">
                        Ký phổ minh họa (Tự động ghi khi đi quân trên bàn cờ bên phải, hoặc dán WXF / Tiếng Việt)
                      </label>
                      <button
                        type="button"
                        onClick={handleParseNotationIntoBoard}
                        className="px-2.5 py-1 rounded-lg bg-amber-600/20 border border-amber-500/40 text-amber-300 hover:bg-amber-600/30 text-[11px] font-medium"
                      >
                        Nạp ký phổ vào bàn cờ
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={artNotationText}
                      onChange={(e) => setArtNotationText(e.target.value)}
                      placeholder="1. C2.5 H8+7 2. H2+3 R9.8 ... (hoặc đi trực tiếp trên bàn cờ bên phải để hệ thống tự ghi)"
                      className="w-full rounded-xl bg-stone-900 border border-stone-800 p-2.5 font-mono text-xs text-amber-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    {editingArticleId && (
                      <button
                        type="button"
                        onClick={resetArticleEditor}
                        className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium"
                      >
                        Hủy sửa
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={savingArticle}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-red-700 hover:from-amber-500 hover:to-red-600 disabled:opacity-50 text-white font-semibold flex items-center gap-2 shadow-lg"
                    >
                      <Save className="w-4 h-4" />
                      <span>
                        {savingArticle
                          ? 'Đang lưu lên Firebase...'
                          : editingArticleId
                          ? 'Cập nhật bài viết'
                          : 'Lưu bài viết vào Tàng Thư'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* RIGHT COLUMN: Interactive Board Recorder + Step List */}
                <div className="lg:col-span-6 space-y-3">
                  <div className="rounded-2xl bg-stone-900 border border-stone-800 p-3.5 flex flex-col items-center">
                    <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-2.5 text-xs">
                      <span className="font-semibold text-stone-200">
                        Bàn Cờ Soạn Thảo Ký Phổ ({artMoves.length} nước)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleUndoEditorMove}
                          disabled={artMoves.length === 0}
                          className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 flex items-center gap-1 text-[11px]"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          <span>Lùi nước</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleResetEditorBoard}
                          disabled={artMoves.length === 0}
                          className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-red-300 flex items-center gap-1 text-[11px]"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Xóa nước đi</span>
                        </button>
                      </div>
                    </div>

                    <XiangqiBoard
                      board={editorBoardState.board}
                      turn={editorBoardState.turn}
                      theme={BOARD_THEMES.classic_wood}
                      pieceCharMode="hanzi"
                      interactive={true}
                      allowedColor="both"
                      lastMove={editorLastMove}
                      onMove={handleEditorBoardMove}
                    />

                    {/* Step Navigation in Editor */}
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setPreviewPly(0)}
                        disabled={clampedEditorPly === 0}
                        className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200"
                      >
                        <SkipBack className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewPly(Math.max(0, clampedEditorPly - 1))}
                        disabled={clampedEditorPly === 0}
                        className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Trước</span>
                      </button>
                      <span className="font-mono-num text-amber-300 px-2">
                        Bước {clampedEditorPly} / {artMoves.length}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewPly(Math.min(artMoves.length, clampedEditorPly + 1))
                        }
                        disabled={clampedEditorPly >= artMoves.length}
                        className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 flex items-center gap-1"
                      >
                        <span>Tiếp</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewPly(artMoves.length)}
                        disabled={clampedEditorPly >= artMoves.length}
                        className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Recorded Moves Preview List */}
                  <div className="rounded-2xl bg-stone-900 border border-stone-800 p-3 text-xs space-y-2">
                    <div className="font-semibold text-stone-300">
                      Danh sách nước đi minh họa (Bấm vào nước bất kỳ để kiểm tra):
                    </div>
                    <div className="max-h-44 overflow-y-auto overscroll-contain rounded-xl bg-stone-950 border border-stone-800 p-2.5 font-mono-num">
                      {artMoves.length === 0 ? (
                        <span className="text-stone-500 font-sans">
                          Hãy kéo hoặc bấm đi quân trực tiếp trên bàn cờ để tạo ký phổ minh họa...
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 content-start">
                          {artMoves.map((m, i) => {
                            const p = i + 1;
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setPreviewPly(p)}
                                className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                                  clampedEditorPly === p
                                    ? 'bg-amber-600 text-white font-bold'
                                    : m.color === 'r'
                                    ? 'bg-red-950/40 text-red-300 hover:bg-stone-800'
                                    : 'bg-stone-800/80 text-stone-300 hover:bg-stone-800'
                                }`}
                              >
                                {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ''}
                                {m.viet}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </form>

            {/* Existing Articles List with Edit / Delete / Search */}
            <div className="rounded-2xl bg-stone-950/90 border border-stone-800 p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-display font-bold text-stone-100">
                  Danh sách bài viết Tàng Thư ({articles.length})
                </h3>
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    placeholder="Tìm bài viết để sửa / xóa..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {filteredAdminArticles.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  Chưa có bài viết nào trong Tàng Thư
                </div>
              ) : (
                <div className="divide-y divide-stone-800/70 text-xs">
                  {filteredAdminArticles.map((art) => (
                    <div
                      key={art.id}
                      className="py-3 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="space-y-1 max-w-xl">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold">
                            {art.category || 'Khai cuộc'}
                          </span>
                          <span className="font-semibold text-stone-100 text-sm">
                            {art.title}
                          </span>
                        </div>
                        <div className="text-stone-400 line-clamp-1">
                          {art.summary || art.content}
                        </div>
                        <div className="text-[11px] text-stone-500 font-mono-num">
                          Số nước minh họa: {art.moveCount ?? (art.moves?.length || 0)} · Cập nhật:{' '}
                          {new Date(art.updatedAt || art.createdAt || Date.now()).toLocaleString(
                            'vi-VN'
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={`/library/${encodeURIComponent(art.id)}`}
                          onClick={(e) =>
                            handleLinkClick(e, `/library/${encodeURIComponent(art.id)}`)
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-400" />
                          <span>Xem</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            loadArticleIntoEditor(art);
                            navigateUrl(
                              `/admin/library?edit=${encodeURIComponent(art.id)}`,
                              true
                            );
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-600/20 border border-amber-500/40 text-amber-300 hover:bg-amber-600/30 flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Sửa</span>
                        </button>
                        {deletingArticleId === art.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteArticle(art.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white font-semibold"
                            >
                              Xác nhận xóa
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingArticleId(null)}
                              className="px-2 py-1.5 rounded-lg bg-stone-800 text-stone-300"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeletingArticleId(art.id)}
                            className="p-1.5 rounded-lg bg-red-950/60 text-red-400 hover:bg-red-900/60"
                            title="Xóa bài viết"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

