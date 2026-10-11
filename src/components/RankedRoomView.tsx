import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import {
  Flame,
  Clock,
  EyeOff,
  Plus,
  LogIn,
  Play,
  Flag,
  Handshake,
  Copy,
  LogOut,
  Send,
  Users,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RefreshCw,
  Lock,
  ArrowRightLeft,
  Crown,
  Eye,
  Swords,
  Radio,
  Trophy,
} from 'lucide-react';
import { RatedMode } from '../shared/elo';
import { parseFen, Pos } from '../shared/xiangqi';
import { XiangqiBoard } from './XiangqiBoard';
import { BoardTheme } from '../utils/themes';
import { UserProfile } from './AuthModal';
import { sound } from '../utils/sound';
import { navigateUrl, handleLinkClick } from '../utils/navigation';

interface RankedRoomViewProps {
  socket: Socket | null;
  currentUser: UserProfile | null;
  theme: BoardTheme;
  pieceCharMode: 'hanzi' | 'viet';
  activeRoom: any | null;
  setActiveRoom: React.Dispatch<React.SetStateAction<any | null>>;
  onOpenAuth: () => void;
  onToast: (msg: string) => void;
}

const QUICK_MESSAGES = ['Chào', 'Hay lắm', 'Đợi chút', 'Hòa nhé?', 'Ván hay!'];
const EMOJIS = ['👍', '🔥', '👏', '😄', '🤔', '🤝'];

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseRankedModeFromPath(pathname: string): RatedMode | 'all' {
  if (pathname.startsWith('/ranked/blitz')) return 'blitz';
  if (pathname.startsWith('/ranked/standard')) return 'standard';
  if (pathname.startsWith('/ranked/dark')) return 'dark';
  return 'all';
}

function parseRoomCodeFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/ranked\/room\/([A-Za-z0-9]+)/);
  return m ? m[1].toUpperCase() : null;
}

export const RankedRoomView: React.FC<RankedRoomViewProps> = ({
  socket,
  currentUser,
  theme,
  pieceCharMode,
  activeRoom,
  setActiveRoom,
  onOpenAuth,
  onToast,
}) => {
  const [selectedMode, setSelectedMode] = useState<RatedMode | 'all'>(() =>
    parseRankedModeFromPath(window.location.pathname)
  );
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [openRooms, setOpenRooms] = useState<any[]>([]);
  const [roomCounts, setRoomCounts] = useState<{ all: number; blitz: number; standard: number; dark: number }>({
    all: 0,
    blitz: 0,
    standard: 0,
    dark: 0,
  });
  const [chatInput, setChatInput] = useState('');
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewPly, setReviewPly] = useState(0);
  const [sideTab, setSideTab] = useState<'notation' | 'spectators' | 'chat'>(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    return t === 'spectators' || t === 'chat' ? t : 'notation';
  });
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const lastSeenChatLengthRef = useRef(0);

  // Sync Ranked view state from URL changes
  useEffect(() => {
    const syncRankedFromUrl = () => {
      const path = window.location.pathname;
      const roomCode = parseRoomCodeFromPath(path);
      if (!roomCode) {
        setSelectedMode(parseRankedModeFromPath(path));
      } else {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('tab');
        if (t === 'notation' || t === 'spectators' || t === 'chat') {
          setSideTab(t);
        }
        const plyParam = params.get('ply');
        if (plyParam !== null && !Number.isNaN(Number(plyParam))) {
          setReviewMode(true);
          setReviewPly(Math.max(0, Number(plyParam)));
        }
      }
    };
    window.addEventListener('popstate', syncRankedFromUrl);
    window.addEventListener('app:locationchange', syncRankedFromUrl);
    return () => {
      window.removeEventListener('popstate', syncRankedFromUrl);
      window.removeEventListener('app:locationchange', syncRankedFromUrl);
    };
  }, []);

  // Auto-join room if URL is /ranked/room/:code and user is approved & connected
  useEffect(() => {
    const urlCode = parseRoomCodeFromPath(window.location.pathname);
    if (
      urlCode &&
      !activeRoom &&
      socket &&
      socket.connected &&
      currentUser &&
      currentUser.isCreateAccount
    ) {
      socket.emit(
        'room:join',
        {
          code: urlCode,
          uid: currentUser.uid,
          username: currentUser.username,
          asSpectator: false,
        },
        (res: any) => {
          if (res?.room) {
            setActiveRoom(res.room);
          } else if (res?.error) {
            onToast(res.error);
            navigateUrl('/ranked', true);
          }
        }
      );
    }
  }, [socket, currentUser, activeRoom, setActiveRoom, onToast]);

  const fetchOpenRooms = () => {
    if (socket && socket.connected) {
      socket.emit('room:list', { mode: selectedMode }, (res: any) => {
        if (res?.rooms) setOpenRooms(res.rooms);
        if (res?.counts) setRoomCounts(res.counts);
      });
    }
    // HTTP fallback & immediate fetch
    fetch(`/api/rooms?mode=${selectedMode}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data?.rooms) setOpenRooms(data.rooms);
        if (data?.counts) setRoomCounts(data.counts);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchOpenRooms();
    const timer = setInterval(fetchOpenRooms, 3000);
    if (socket) {
      const onListUpdate = (data: any) => {
        if (data?.counts) setRoomCounts(data.counts);
        fetchOpenRooms();
      };
      socket.on('room:list_updated', onListUpdate);
      return () => {
        clearInterval(timer);
        socket.off('room:list_updated', onListUpdate);
      };
    }
    return () => clearInterval(timer);
  }, [socket, selectedMode, activeRoom]);

  // Keep chat unread count and auto-scroll
  useEffect(() => {
    const currentLength = activeRoom?.chat?.length || 0;
    if (currentLength > lastSeenChatLengthRef.current) {
      if (activeRoom?.status === 'playing' && sideTab !== 'chat') {
        setUnreadChatCount((prev) => prev + (currentLength - lastSeenChatLengthRef.current));
      }
      lastSeenChatLengthRef.current = currentLength;
    }
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [activeRoom?.chat, sideTab]);

  useEffect(() => {
    if (sideTab === 'chat') {
      setUnreadChatCount(0);
    }
  }, [sideTab]);

  useEffect(() => {
    if (activeRoom?.status === 'playing') {
      setReviewMode(false);
    }
    if (activeRoom?.status === 'finished' && activeRoom?.moves) {
      setReviewPly(activeRoom.moves.length);
    }
  }, [activeRoom?.status, activeRoom?.moves?.length]);

  if (!currentUser || !currentUser.isCreateAccount) {
    const isPendingApproval = Boolean(currentUser && !currentUser.isCreateAccount);

    const previewModes = [
      {
        id: 'blitz' as const,
        title: 'Cờ Chớp Tốc Chiến',
        time: '5 phút + 3 giây / nước',
        desc: 'Phản xạ thần tốc, quyết định trong tích tắc trên từng nước đi.',
        icon: Flame,
        bg: '/images/master_duel.jpg',
        accent: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
      },
      {
        id: 'standard' as const,
        title: 'Cờ Tiêu Chuẩn Đỉnh Cao',
        time: '30 phút · 120 giây / nước',
        desc: 'Đấu trí chuyên sâu theo chuẩn giải đấu kỳ đài chuyên nghiệp.',
        icon: Clock,
        bg: '/images/ranked_duel_stage.jpg',
        accent: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      },
      {
        id: 'dark' as const,
        title: 'Cờ Úp Dân Gian',
        time: '15 phút · 120 giây / nước',
        desc: 'Biến ảo khôn lường với nghệ thuật mở quân và sát cục bất ngờ.',
        icon: EyeOff,
        bg: '/images/champion_hall.jpg',
        accent: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
      },
    ];

    return (
      <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
        {/* Hero Gate Banner with Cinematic Background Image */}
        <div
          className="relative rounded-3xl border border-amber-900/40 p-6 sm:p-10 shadow-2xl overflow-hidden bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(12, 10, 9, 0.90) 0%, rgba(15, 13, 11, 0.74) 55%, rgba(12, 10, 9, 0.88) 100%), url('/images/ranked_arena_gate.jpg')`,
          }}
        >
          <div className="relative z-10 max-w-2xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs font-semibold backdrop-blur-xs">
              <Swords className="w-3.5 h-3.5 text-amber-400" />
              <span>Kỳ Đài Xếp Hạng Thời Gian Thực · Chuẩn FIDE Elo</span>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-100 tracking-tight">
                Đấu Trường Kỳ Đàn Trực Tuyến
              </h1>
              <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                {isPendingApproval
                  ? `Xin chào ${currentUser?.displayName || currentUser?.username}! Tài khoản của bạn đang chờ Quản trị viên phê duyệt để mở khóa tạo phòng và thi đấu tính điểm Elo.`
                  : 'Bước vào sảnh thi đấu trực tuyến cùng các kỳ thủ hàng đầu. Hệ thống tính điểm Elo tự động, lưu biên bản WXF và hỗ trợ khán giả xem trực tiếp.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {!isPendingApproval ? (
                <button
                  onClick={onOpenAuth}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-stone-950 text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 shadow-[0_0_25px_rgba(245,158,11,0.35)] active:scale-95"
                >
                  <LogIn className="w-4 h-4 stroke-[2.2]" />
                  <span>Đăng nhập để đấu xếp hạng</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-stone-950/90 border border-amber-500/40 text-amber-300 text-xs font-bold shadow-lg">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>Tài khoản đang chờ Quản trị viên duyệt xếp hạng</span>
                </div>
              )}

              <a
                href="/ranked"
                onClick={(e) => handleLinkClick(e, '/ranked', () => setSelectedMode('all'))}
                className="px-3.5 py-2.5 rounded-xl bg-stone-950/85 hover:bg-stone-900 border border-stone-800 text-xs font-mono-num text-stone-200 flex items-center gap-2 backdrop-blur-xs transition-colors"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span>{roomCounts.all} phòng đang mở tại sảnh</span>
              </a>
            </div>
          </div>
        </div>

        {/* 3 Thẻ Thể Loại Thi Đấu Có Hình Nền & Đường dẫn trực tiếp */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {previewModes.map((m) => {
            const Icon = m.icon;
            const active = selectedMode === m.id;
            const modeUrl = `/ranked/${m.id}`;
            return (
              <a
                key={m.title}
                href={modeUrl}
                onClick={(e) => handleLinkClick(e, modeUrl, () => setSelectedMode(m.id))}
                className={`relative rounded-2xl border p-5 shadow-xl overflow-hidden bg-cover bg-center flex flex-col justify-between min-h-[160px] group transition-all ${
                  active
                    ? 'border-amber-500 ring-1 ring-amber-400/50 -translate-y-0.5'
                    : 'border-stone-800/90 hover:border-amber-500/50'
                }`}
                style={{
                  backgroundImage: `linear-gradient(to bottom, rgba(15, 13, 12, 0.78) 0%, rgba(10, 9, 8, 0.94) 100%), url('${m.bg}')`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${m.accent}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono-num text-stone-300 bg-stone-950/80 border border-stone-800 px-2.5 py-1 rounded-lg">
                    {m.time}
                  </span>
                </div>

                <div className="mt-4 space-y-1">
                  <h3 className="text-sm font-bold text-stone-100 group-hover:text-amber-300 transition-colors">
                    {m.title}
                  </h3>
                  <p className="text-xs text-stone-400 leading-relaxed">{m.desc}</p>
                </div>
              </a>
            );
          })}
        </div>

        {/* Khu vực xem trước Sảnh Phòng Đấu với hình nền */}
        <div
          className="relative rounded-3xl border border-stone-800/90 p-5 sm:p-6 shadow-2xl overflow-hidden bg-cover bg-center space-y-4"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(18, 16, 14, 0.84) 0%, rgba(12, 10, 9, 0.94) 100%), url('/images/ranked_lobby_pavilion.jpg')`,
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-stone-100 uppercase tracking-wider">
                Các Bàn Đấu Đang Hoạt Động ({openRooms.length})
              </h2>
            </div>
            {!isPendingApproval && (
              <button
                onClick={onOpenAuth}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
              >
                Đăng nhập để vào bàn →
              </button>
            )}
          </div>

          {openRooms.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <div className="text-xs font-semibold text-stone-200">
                Hiện chưa có bàn đấu nào đang mở trong sảnh
              </div>
              <div className="text-[11px] text-stone-300">
                {!isPendingApproval
                  ? 'Hãy đăng nhập ngay để trở thành kỳ thủ đầu tiên lập kỳ đài!'
                  : 'Vui lòng chờ Quản trị viên duyệt tài khoản để bắt đầu tạo phòng.'}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {openRooms.slice(0, 6).map((r) => {
                const modeLabel =
                  r.mode === 'blitz' ? 'Cờ chớp' : r.mode === 'dark' ? 'Cờ úp' : 'Tiêu chuẩn';
                const roomUrl = `/ranked/room/${r.code}`;
                return (
                  <a
                    key={r.code}
                    href={roomUrl}
                    onClick={(e) =>
                      handleLinkClick(e, roomUrl, () => {
                        if (!isPendingApproval) onOpenAuth();
                      })
                    }
                    style={{
                      backgroundImage: `linear-gradient(to bottom, rgba(20, 18, 16, 0.85) 0%, rgba(12, 10, 9, 0.94) 100%), url('/images/ranked_duel_stage.jpg')`,
                    }}
                    className="rounded-2xl bg-cover bg-center border border-stone-800 hover:border-amber-500/50 p-4 space-y-2.5 cursor-pointer transition-all backdrop-blur-xs shadow-lg block"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono-num font-bold text-amber-400">#{r.code}</span>
                      <span className="text-stone-300 font-medium">{modeLabel}</span>
                    </div>
                    <div className="text-xs text-stone-100 font-semibold truncate">
                      Chủ phòng: {r.hostName}
                    </div>
                    <div className="text-[11px] text-stone-300 font-mono-num flex items-center justify-between">
                      <span>Người chơi: {r.playerCount}/2</span>
                      <span>Khán giả: {r.spectatorCount}/6</span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const handleCreateRoom = () => {
    if (!socket) return;
    socket.emit(
      'room:create',
      {
        uid: currentUser.uid,
        username: currentUser.username,
        mode: selectedMode,
      },
      (res: any) => {
        if (res?.error) {
          onToast(res.error);
        } else if (res?.room) {
          setActiveRoom(res.room);
          navigateUrl(`/ranked/room/${res.room.code}`);
          onToast(`Đã tạo phòng ${res.room.code}`);
        }
      }
    );
  };

  const handleJoinRoom = (code: string, asSpectator = false) => {
    if (!socket || !code.trim()) return;
    const cleanCode = code.trim().toUpperCase();
    socket.emit(
      'room:join',
      {
        code: cleanCode,
        uid: currentUser.uid,
        username: currentUser.username,
        asSpectator,
      },
      (res: any) => {
        if (res?.error) {
          onToast(res.error);
        } else if (res?.room) {
          setActiveRoom(res.room);
          navigateUrl(`/ranked/room/${res.room.code}`);
        }
      }
    );
  };

  const handleSwitchSeat = (targetSeat: 'red' | 'black' | 'spectator') => {
    if (!socket || !activeRoom) return;
    socket.emit(
      'room:switch_seat',
      {
        code: activeRoom.code,
        uid: currentUser.uid,
        targetSeat,
      },
      (res: any) => {
        if (res?.error) onToast(res.error);
      }
    );
  };

  const handleLeaveRoom = () => {
    if (!socket || !activeRoom) return;
    socket.emit('room:leave', { code: activeRoom.code, uid: currentUser.uid });
    setActiveRoom(null);
    setReviewMode(false);
    navigateUrl(selectedMode === 'all' ? '/ranked' : `/ranked/${selectedMode}`);
  };

  const handleStartMatch = () => {
    if (!socket || !activeRoom) return;
    socket.emit('room:start', { code: activeRoom.code, uid: currentUser.uid }, (res: any) => {
      if (res?.error) onToast(res.error);
    });
  };

  const handleBoardMove = (from: Pos, to: Pos) => {
    if (!socket || !activeRoom || activeRoom.status !== 'playing') return;
    socket.emit(
      'game:move',
      {
        code: activeRoom.code,
        uid: currentUser.uid,
        from,
        to,
      },
      (res: any) => {
        if (res?.error) {
          onToast(res.error);
        } else {
          sound.playMove();
        }
      }
    );
  };

  const handleSendChat = (text: string, type: 'text' | 'emoji' | 'quick' = 'text') => {
    if (!socket || !activeRoom || !text.trim()) return;
    socket.emit('chat:send', {
      code: activeRoom.code,
      uid: currentUser.uid,
      username: currentUser.username,
      text: text.trim(),
      type,
    });
    if (type === 'text') setChatInput('');
  };

  const handleCopyRoomNotation = () => {
    if (!activeRoom) return;
    const moves = activeRoom.moves || [];
    const pairs: string[] = [];
    for (let i = 0; i < moves.length; i += 2) {
      const m1 = moves[i]?.wxf || '';
      const m2 = moves[i + 1]?.wxf || '';
      pairs.push(`${Math.floor(i / 2) + 1}. ${m1}${m2 ? ' ' + m2 : ''}`);
    }
    const header = [
      `[Event "Xiangqi Master - ${activeRoom.mode}"]`,
      `[Red "${activeRoom.redPlayer?.username || 'Đỏ'}"]`,
      `[Black "${activeRoom.blackPlayer?.username || 'Đen'}"]`,
      `[Result "${activeRoom.winner}"]`,
      `[Date "${new Date().toISOString().slice(0, 10)}"]`,
    ].join('\n');
    navigator.clipboard.writeText(`${header}\n\n${pairs.join(' ')}`);
    onToast('Đã sao chép kỳ phổ');
  };

  // =========================================================================
  // VIEW 1: SẢNH XẾP HẠNG (LOBBY) - Dạng thẻ tổng hợp cao cấp, KHÔNG có bàn cờ
  // =========================================================================
  if (!activeRoom) {
    const modeConfigs = [
      {
        id: 'all',
        label: 'Tất cả phòng',
        sub: 'Toàn bộ sảnh đấu',
        icon: Swords,
        count: roomCounts.all,
        bg: '/images/ranked_arena_gate.jpg',
      },
      {
        id: 'blitz',
        label: 'Cờ chớp',
        sub: '5 phút + 3s',
        icon: Flame,
        count: roomCounts.blitz,
        bg: '/images/master_duel.jpg',
      },
      {
        id: 'standard',
        label: 'Tiêu chuẩn',
        sub: '30p · 2p/nước',
        icon: Clock,
        count: roomCounts.standard,
        bg: '/images/ranked_duel_stage.jpg',
      },
      {
        id: 'dark',
        label: 'Cờ úp',
        sub: '15p · 2p/nước',
        icon: EyeOff,
        count: roomCounts.dark,
        bg: '/images/champion_hall.jpg',
      },
    ] as const;

    return (
      <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
        {/* Banner tiêu đề sảnh hoàng gia có hình nền */}
        <div
          className="relative rounded-3xl border border-amber-900/40 p-5 sm:p-7 shadow-2xl overflow-hidden bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(15, 13, 12, 0.88) 0%, rgba(18, 15, 13, 0.74) 50%, rgba(12, 10, 9, 0.90) 100%), url('/images/ranked_lobby_pavilion.jpg')`,
          }}
        >
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/25 to-amber-950/70 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)] backdrop-blur-xs">
                <Swords className="w-6 h-6 stroke-[1.8]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-extrabold text-stone-100 tracking-tight">
                    Sảnh Đấu Xếp Hạng
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                    Kỳ Đài Realtime
                  </span>
                </div>
                <p className="text-xs text-stone-300 mt-0.5">
                  Chọn thể loại, ghép đối thủ xứng tầm và ghi danh trên bảng vàng
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="px-3.5 py-2 rounded-xl bg-stone-950/85 border border-stone-800 text-xs font-mono-num text-stone-200 flex items-center gap-2 shadow-inner backdrop-blur-xs">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span>{roomCounts.all} phòng đang mở</span>
              </div>
            </div>
          </div>
        </div>

        {/* 1. Thanh chọn thể loại thi đấu (4 Thẻ nghệ thuật có hình nền & đường dẫn trực tiếp) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {modeConfigs.map((item) => {
            const Icon = item.icon;
            const active = selectedMode === item.id;
            const modeUrl = item.id === 'all' ? '/ranked' : `/ranked/${item.id}`;
            return (
              <a
                key={item.id}
                href={modeUrl}
                onClick={(e) => handleLinkClick(e, modeUrl, () => setSelectedMode(item.id))}
                style={{
                  backgroundImage: active
                    ? `linear-gradient(to bottom, rgba(24, 18, 12, 0.72) 0%, rgba(15, 12, 10, 0.90) 100%), url('${item.bg}')`
                    : `linear-gradient(to bottom, rgba(18, 16, 15, 0.86) 0%, rgba(12, 10, 9, 0.95) 100%), url('${item.bg}')`,
                }}
                className={`group relative p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 overflow-hidden min-h-[96px] flex flex-col justify-between bg-cover bg-center ${
                  active
                    ? 'border-amber-500 text-stone-100 shadow-[0_0_24px_rgba(245,158,11,0.22)] ring-1 ring-amber-400/60 -translate-y-0.5'
                    : 'border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700'
                }`}
              >
                <div className="flex items-center justify-between relative z-10">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors backdrop-blur-xs ${
                      active
                        ? 'bg-amber-500/25 text-amber-300 border border-amber-400/50 shadow-inner'
                        : 'bg-stone-950/85 border border-stone-800 text-stone-400 group-hover:text-stone-200'
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {item.count > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold backdrop-blur-xs">
                        {item.count} phòng
                      </span>
                    ) : (
                      <span className="text-[10px] text-stone-500 font-mono-num font-medium">0</span>
                    )}
                  </div>
                </div>

                <div className="mt-2 relative z-10">
                  <div className={`text-sm font-bold flex items-center gap-1.5 ${active ? 'text-amber-300' : 'text-stone-200'}`}>
                    <span>{item.label}</span>
                  </div>
                  <div className="text-[11px] text-stone-300/90 font-mono-num mt-0.5">
                    {item.sub}
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        {/* 2. Thanh tác vụ: Nhập mã nhanh & Tạo phòng */}
        <div
          className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border border-stone-800/90 rounded-2xl p-3.5 sm:p-4 shadow-xl bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(18, 16, 15, 0.92) 0%, rgba(14, 12, 11, 0.94) 100%), url('/images/leaderboard_bg.jpg')`,
          }}
        >
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <input
                type="text"
                maxLength={6}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="Nhập mã phòng (6 ký tự)"
                className="w-full rounded-xl bg-stone-950/90 border border-stone-800 pl-4 pr-3 py-2.5 text-xs font-mono-num uppercase tracking-widest text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 shadow-inner transition-colors"
              />
            </div>
            <button
              onClick={() => handleJoinRoom(roomCodeInput)}
              disabled={!roomCodeInput.trim()}
              className="min-h-[42px] px-4.5 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 text-xs font-bold whitespace-nowrap transition-all shadow-sm active:scale-95"
            >
              Vào ngay
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchOpenRooms}
              title="Làm mới danh sách phòng"
              className="min-h-[42px] px-3.5 rounded-xl bg-stone-950/90 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-stone-100 text-xs flex items-center justify-center transition-colors shadow-inner"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleCreateRoom()}
              className="min-h-[42px] px-6 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-stone-950 font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Tạo phòng mới</span>
            </button>
          </div>
        </div>

        {/* 3. Danh sách phòng SẢNH dạng thẻ tổng hợp có hình nền */}
        {openRooms.length === 0 ? (
          roomCounts.all > 0 && selectedMode !== 'all' ? (
            /* Có phòng ở thể loại khác nhưng thể loại hiện tại đang rỗng */
            <div
              className="py-16 flex flex-col items-center justify-center gap-4 rounded-3xl border border-stone-800/90 p-8 text-center shadow-2xl bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(to bottom, rgba(16, 14, 13, 0.80) 0%, rgba(10, 9, 8, 0.92) 100%), url('/images/ranked_arena_gate.jpg')`,
              }}
            >
              <div className="w-14 h-14 rounded-full bg-stone-950/90 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
                <Swords className="w-7 h-7 stroke-[1.4]" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <div className="text-sm font-bold text-stone-100">
                  Chưa có phòng nào cho thể loại này
                </div>
                <div className="text-xs text-amber-300">
                  Đang có <strong className="font-extrabold underline">{roomCounts.all} phòng</strong> đang mở ở các thể loại khác!
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <a
                  href="/ranked"
                  onClick={(e) => handleLinkClick(e, '/ranked', () => setSelectedMode('all'))}
                  className="min-h-[42px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95"
                >
                  <Swords className="w-4 h-4 stroke-[2]" />
                  <span>Xem tất cả {roomCounts.all} phòng đang mở</span>
                </a>
                <button
                  onClick={() => handleCreateRoom()}
                  className="min-h-[42px] px-5 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-stone-700 text-stone-200 font-bold text-xs flex items-center gap-2 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[2]" />
                  <span>Tạo phòng thể loại này</span>
                </button>
              </div>
            </div>
          ) : (
            /* Hoàn toàn chưa có phòng nào */
            <div
              className="py-20 flex flex-col items-center justify-center gap-4 rounded-3xl border border-stone-800/90 p-8 text-center shadow-2xl bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(to bottom, rgba(16, 14, 13, 0.78) 0%, rgba(10, 9, 8, 0.92) 100%), url('/images/ranked_arena_gate.jpg')`,
              }}
            >
              <div className="w-16 h-16 rounded-full bg-stone-950/90 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
                <Swords className="w-8 h-8 stroke-[1.4]" />
              </div>
              <div className="space-y-1">
                <div className="text-base font-bold text-stone-100">Chưa có phòng nào đang mở</div>
                <div className="text-xs text-stone-300">Hãy là người đầu tiên lập kỳ đài đón khách!</div>
              </div>
              <button
                onClick={() => handleCreateRoom()}
                className="min-h-[44px] px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-extrabold text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Tạo phòng ngay</span>
              </button>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {openRooms.map((r) => {
              const isWaiting = r.status === 'waiting';
              const canPlay = isWaiting && r.playerCount < 2;
              const modeLabel =
                r.mode === 'blitz' ? 'Cờ chớp' : r.mode === 'dark' ? 'Cờ úp' : 'Tiêu chuẩn';

              return (
                <div
                  key={r.code}
                  style={{
                    backgroundImage: `linear-gradient(to bottom, rgba(20, 18, 16, 0.85) 0%, rgba(12, 10, 9, 0.94) 100%), url('/images/ranked_duel_stage.jpg')`,
                  }}
                  className="rounded-2xl bg-cover bg-center border border-stone-800 hover:border-amber-500/60 p-4.5 flex flex-col justify-between gap-3.5 shadow-xl hover:shadow-[0_4px_24px_rgba(0,0,0,0.5)] transition-all duration-200 group"
                >
                  {/* Header thẻ phòng */}
                  <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num font-black text-amber-400 text-xs px-2.5 py-0.5 rounded-lg bg-stone-950 border border-amber-500/30 shadow-inner tracking-wider">
                        #{r.code}
                      </span>
                      <span className="text-[11px] text-stone-300 font-semibold">{modeLabel}</span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 shadow-xs ${
                        isWaiting
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      <span>{isWaiting ? 'Đang chờ' : 'Đang đấu'}</span>
                    </span>
                  </div>

                  {/* Thông tin đấu thủ & Chủ phòng */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-stone-300">
                      <div className="flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-stone-400 text-[11px]">Chủ phòng:</span>
                        <span className="font-bold text-stone-200 truncate max-w-[120px]">{r.hostName}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-stone-400 font-mono-num">
                        <Eye className="w-3 h-3 text-stone-500" />
                        <span>{r.spectatorCount}/6</span>
                      </div>
                    </div>

                    {/* Hộp so tài 2 phe Đỏ vs Đen */}
                    <div className="p-2.5 rounded-xl bg-stone-950/85 border border-stone-800/90 space-y-1.5 text-[11px] font-mono-num shadow-inner backdrop-blur-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />
                          <span className="text-red-300 font-bold font-sans">Đỏ:</span>
                          <span className="text-stone-200 font-sans truncate max-w-[130px]">
                            {r.redPlayer ? (r.redPlayer.displayName || r.redPlayer.username) : 'Ghế trống'}
                          </span>
                        </div>
                        <span className="text-amber-400/90 font-bold shrink-0">
                          {r.redPlayer ? `${r.redPlayer.elo} xu` : '—'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-stone-300 shadow-[0_0_6px_#cbd5e1]" />
                          <span className="text-stone-300 font-bold font-sans">Đen:</span>
                          <span className="text-stone-200 font-sans truncate max-w-[130px]">
                            {r.blackPlayer ? (r.blackPlayer.displayName || r.blackPlayer.username) : 'Ghế trống'}
                          </span>
                        </div>
                        <span className="text-amber-400/90 font-bold shrink-0">
                          {r.blackPlayer ? `${r.blackPlayer.elo} xu` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Nút hành động trên thẻ: Vào chơi hoặc Vào xem có đường dẫn trực tiếp */}
                  <div className="pt-0.5">
                    {canPlay ? (
                      <a
                        href={`/ranked/room/${r.code}`}
                        onClick={(e) =>
                          handleLinkClick(e, `/ranked/room/${r.code}`, () =>
                            handleJoinRoom(r.code, false)
                          )
                        }
                        className="w-full min-h-[40px] rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_16px_rgba(245,158,11,0.25)] active:scale-95"
                      >
                        <Swords className="w-3.5 h-3.5 stroke-[2.2]" />
                        <span>Vào chơi ({r.playerCount}/2 ghế)</span>
                      </a>
                    ) : (
                      <a
                        href={`/ranked/room/${r.code}`}
                        onClick={(e) => {
                          if (r.spectatorCount >= 6) {
                            e.preventDefault();
                            return;
                          }
                          handleLinkClick(e, `/ranked/room/${r.code}`, () =>
                            handleJoinRoom(r.code, true)
                          );
                        }}
                        className={`w-full min-h-[40px] rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 ${
                          r.spectatorCount >= 6 ? 'opacity-40 pointer-events-none' : ''
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5 text-stone-400" />
                        <span>Vào xem ({r.spectatorCount}/6)</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: PHÒNG CHỜ (WAITING ROOM) - 2 ghế + 6 khán giả, chat liên tục, KHÔNG có bàn cờ
  // =========================================================================
  if (activeRoom.status === 'waiting') {
    const isHost = activeRoom.hostUid === currentUser.uid;
    const isRed = activeRoom.redPlayer?.uid === currentUser.uid;
    const isBlack = activeRoom.blackPlayer?.uid === currentUser.uid;
    const bothReady = Boolean(activeRoom.redPlayer && activeRoom.blackPlayer);

    const modeLabel =
      activeRoom.mode === 'blitz'
        ? 'Cờ chớp (5 phút + 3s)'
        : activeRoom.mode === 'dark'
        ? 'Cờ úp (15 phút · 2p/nước)'
        : 'Tiêu chuẩn (30 phút · 2p/nước)';

    return (
      <div className="w-full max-w-5xl mx-auto space-y-4 animate-in fade-in duration-300">
        {/* Thanh tiêu đề phòng chờ hoàng gia có hình nền */}
        <div
          className="flex items-center justify-between border border-amber-900/40 rounded-2xl px-5 py-3.5 shadow-2xl bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(16, 14, 13, 0.88) 0%, rgba(18, 15, 13, 0.78) 100%), url('/images/ranked_lobby_pavilion.jpg')`,
          }}
        >
          <div className="flex items-center gap-3">
            <span className="font-mono-num font-black text-amber-400 px-3.5 py-1.5 rounded-xl bg-stone-950/90 border border-amber-500/30 text-sm shadow-inner tracking-widest">
              PHÒNG: {activeRoom.code}
            </span>
            <span className="text-xs text-stone-200 font-semibold hidden sm:flex items-center gap-1.5">
              <span>{modeLabel}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(activeRoom.code);
                onToast(`Đã sao chép mã phòng ${activeRoom.code}`);
              }}
              className="px-3.5 py-2 rounded-xl bg-stone-950/90 hover:bg-stone-800 border border-stone-800 text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-inner"
              title="Sao chép mã phòng"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Sao chép mã</span>
            </button>
            <button
              onClick={handleLeaveRoom}
              className="px-3.5 py-2 rounded-xl bg-stone-900/90 hover:bg-red-950/80 hover:text-red-200 border border-stone-700/80 text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Rời phòng</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Cột trái: Kỳ Đài Song Hùng (2 Ghế) + Khán Đài (6 Chỗ) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Kỳ Đài Song Hùng Đối Kháng có hình nền */}
            <div
              className="rounded-3xl border border-amber-900/40 p-5 sm:p-6 space-y-5 shadow-2xl relative overflow-hidden bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(to bottom, rgba(16, 14, 13, 0.82) 0%, rgba(10, 9, 8, 0.92) 100%), url('/images/ranked_duel_stage.jpg')`,
              }}
            >
              {/* Tiêu đề kỳ đài */}
              <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-400">
                  <Swords className="w-4 h-4 text-amber-400" />
                  <span>KỲ ĐÀI SONG HÙNG ĐỐI KHÁNG</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono-num">
                  <span className="text-stone-200 font-semibold text-[11px] font-sans">
                    {bothReady ? 'Đã đủ 2 kỳ thủ' : 'Đang chờ đối thủ'}
                  </span>
                </div>
              </div>

              {/* Bố cục 2 ghế Đỏ vs Đen */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
                {/* Ghế Đỏ (Tiên Thủ) */}
                <div
                  className={`relative rounded-2xl border p-4.5 flex flex-col justify-between min-h-[175px] transition-all overflow-hidden backdrop-blur-xs ${
                    activeRoom.redPlayer
                      ? activeRoom.redPlayer.uid === currentUser.uid
                        ? 'border-2 border-red-500/90 bg-gradient-to-br from-red-950/60 via-stone-900/90 to-stone-950/95 shadow-[0_0_24px_rgba(239,68,68,0.25)]'
                        : 'border-red-900/70 bg-gradient-to-br from-red-950/40 to-stone-950/90 shadow-md'
                      : 'border-2 border-dashed border-stone-700/80 bg-stone-950/65'
                  }`}
                >
                  <div className="flex items-start justify-between relative z-10">
                    <span className="text-xs font-black text-red-400 flex items-center gap-1.5 tracking-wider">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
                      <span>QUÂN ĐỎ</span>
                    </span>

                    {activeRoom.redPlayer?.uid === activeRoom.hostUid && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-400 font-extrabold bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/30 shadow-xs">
                        <Crown className="w-3 h-3 fill-current" />
                        <span>Chủ phòng</span>
                      </span>
                    )}
                  </div>

                  {activeRoom.redPlayer ? (
                    <div className="my-3 flex items-center gap-3 relative z-10">
                      <div className="relative">
                        <div className="w-13 h-13 rounded-full bg-gradient-to-br from-red-800 to-red-950 border-2 border-red-500 flex items-center justify-center text-2xl shadow-xl ring-2 ring-red-500/30">
                          🐵
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-stone-900 ${
                            activeRoom.redPlayer.connected !== false
                              ? 'bg-emerald-400'
                              : 'bg-red-500'
                          }`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-extrabold text-stone-100 truncate flex items-center gap-1.5">
                          <span>{activeRoom.redPlayer.displayName || activeRoom.redPlayer.username}</span>
                          {activeRoom.redPlayer.uid === currentUser.uid && (
                            <span className="px-1.5 py-0.2 rounded-md bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-500/40">
                              Bạn
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono-num font-bold text-amber-400 mt-0.5">
                          {activeRoom.redPlayer.elo ?? 1300} xu
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="my-6 text-center text-xs text-stone-400 italic relative z-10">
                      Ghế Tiên Thủ đang để trống
                    </div>
                  )}

                  <div className="relative z-10">
                    {!activeRoom.redPlayer ? (
                      <button
                        onClick={() => handleSwitchSeat('red')}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 border border-red-500/60 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Ngồi vào ghế Đỏ</span>
                      </button>
                    ) : isRed && !activeRoom.blackPlayer ? (
                      <button
                        onClick={() => handleSwitchSeat('black')}
                        className="w-full py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                      >
                        <span>Chuyển sang ghế Đen</span>
                      </button>
                    ) : isRed ? (
                      <div className="w-full py-1.5 rounded-lg bg-red-950/40 border border-red-900/40 text-center text-[11px] font-bold text-red-300">
                        Ghế của bạn
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Ghế Đen (Hậu Thủ) */}
                <div
                  className={`relative rounded-2xl border p-4.5 flex flex-col justify-between min-h-[175px] transition-all overflow-hidden backdrop-blur-xs ${
                    activeRoom.blackPlayer
                      ? activeRoom.blackPlayer.uid === currentUser.uid
                        ? 'border-2 border-amber-500/90 bg-gradient-to-br from-stone-900/90 via-stone-900/95 to-amber-950/50 shadow-[0_0_24px_rgba(245,158,11,0.25)]'
                        : 'border-stone-700 bg-gradient-to-br from-stone-800/50 to-stone-950/90 shadow-md'
                      : 'border-2 border-dashed border-stone-700/80 bg-stone-950/65'
                  }`}
                >
                  <div className="flex items-start justify-between relative z-10">
                    <span className="text-xs font-black text-stone-300 flex items-center gap-1.5 tracking-wider">
                      <span className="w-2.5 h-2.5 rounded-full bg-stone-300 shadow-[0_0_8px_#cbd5e1]" />
                      <span>QUÂN ĐEN</span>
                    </span>

                    {activeRoom.blackPlayer?.uid === activeRoom.hostUid && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-400 font-extrabold bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/30 shadow-xs">
                        <Crown className="w-3 h-3 fill-current" />
                        <span>Chủ phòng</span>
                      </span>
                    )}
                  </div>

                  {activeRoom.blackPlayer ? (
                    <div className="my-3 flex items-center gap-3 relative z-10">
                      <div className="relative">
                        <div className="w-13 h-13 rounded-full bg-gradient-to-br from-stone-800 to-stone-950 border-2 border-amber-500/50 flex items-center justify-center text-2xl shadow-xl ring-2 ring-amber-500/20">
                          🐵
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-stone-900 ${
                            activeRoom.blackPlayer.connected !== false
                              ? 'bg-emerald-400'
                              : 'bg-red-500'
                          }`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-extrabold text-stone-100 truncate flex items-center gap-1.5">
                          <span>{activeRoom.blackPlayer.displayName || activeRoom.blackPlayer.username}</span>
                          {activeRoom.blackPlayer.uid === currentUser.uid && (
                            <span className="px-1.5 py-0.2 rounded-md bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-500/40">
                              Bạn
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono-num font-bold text-amber-400 mt-0.5">
                          {activeRoom.blackPlayer.elo ?? 1300} xu
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="my-6 text-center text-xs text-stone-400 italic relative z-10">
                      Ghế Hậu Thủ đang để trống
                    </div>
                  )}

                  <div className="relative z-10">
                    {!activeRoom.blackPlayer ? (
                      <button
                        onClick={() => handleSwitchSeat('black')}
                        className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-100 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Ngồi vào ghế Đen</span>
                      </button>
                    ) : isBlack && !activeRoom.redPlayer ? (
                      <button
                        onClick={() => handleSwitchSeat('red')}
                        className="w-full py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                      >
                        <span>Chuyển sang ghế Đỏ</span>
                      </button>
                    ) : isBlack ? (
                      <div className="w-full py-1.5 rounded-lg bg-stone-950/80 border border-stone-800 text-center text-[11px] font-bold text-amber-300">
                        Ghế của bạn
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Nút Bắt đầu ván đấu lớn hoàng gia */}
              <div className="pt-2">
                {isHost ? (
                  <button
                    onClick={handleStartMatch}
                    disabled={!bothReady}
                    className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 disabled:from-stone-800 disabled:to-stone-800 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 font-black text-sm flex items-center justify-center gap-2.5 shadow-[0_0_25px_rgba(245,158,11,0.35)] transition-all active:scale-98"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>{bothReady ? 'BẮT ĐẦU VÁN ĐẤU (KHAI CUỘC)' : 'CHỜ ĐỐI THỦ VÀO GHẾ ĐỂ BẮT ĐẦU'}</span>
                  </button>
                ) : (
                  <div className="w-full py-3.5 rounded-2xl bg-stone-950/90 border border-stone-800 text-center text-xs text-stone-300 font-semibold flex items-center justify-center gap-2 shadow-inner">
                    <span>
                      {bothReady
                        ? 'Đã đủ 2 kỳ thủ. Chờ chủ phòng phát lệnh khai cuộc…'
                        : 'Chờ đối thủ vào phòng…'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Khán Đài Danh Dự (6 Ghế Khán Giả) có hình nền */}
            <div
              className="rounded-3xl border border-stone-800 p-5 space-y-3.5 shadow-xl bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(to bottom, rgba(18, 16, 15, 0.88) 0%, rgba(12, 10, 9, 0.95) 100%), url('/images/champion_hall.jpg')`,
              }}
            >
              <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>KHÁN ĐÀI THEO DÕI ({activeRoom.spectators?.length || 0}/6)</span>
                </span>
                {(isRed || isBlack) && (
                  <button
                    onClick={() => handleSwitchSeat('spectator')}
                    disabled={(activeRoom.spectators?.length || 0) >= 6}
                    className="text-xs text-amber-400 hover:text-amber-300 font-bold transition-colors"
                  >
                    Xuống khán đài
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, idx) => {
                  const spec = activeRoom.spectators?.[idx];
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl border flex items-center gap-2.5 min-h-[58px] transition-all backdrop-blur-xs ${
                        spec
                          ? spec.uid === currentUser.uid
                            ? 'bg-amber-950/40 border-amber-500/60 text-stone-100 shadow-md ring-1 ring-amber-500/30'
                            : 'bg-stone-950/85 border-stone-800 text-stone-300 shadow-inner'
                          : 'border-dashed border-stone-700/80 bg-stone-950/50 text-stone-500'
                      }`}
                    >
                      <div className="w-8.5 h-8.5 rounded-full bg-stone-800 border border-stone-700/80 flex items-center justify-center text-xs font-bold shrink-0">
                        {spec ? '🐵' : idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">
                          {spec ? spec.username : 'Ghế trống'}
                        </div>
                        {spec && (
                          <div className="text-[10px] text-amber-400 font-mono-num font-semibold">
                            {spec.elo ?? 1300} xu
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cột phải: KHUNG CHAT LIÊN TỤC có hình nền */}
          <div
            className="lg:col-span-5 rounded-3xl border border-stone-800 p-5 space-y-3.5 shadow-2xl flex flex-col min-h-[500px] bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(to bottom, rgba(18, 16, 15, 0.90) 0%, rgba(12, 10, 9, 0.96) 100%), url('/images/leaderboard_bg.jpg')`,
            }}
          >
            <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400 border-b border-stone-800/80 pb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                <span>TRÒ CHUYỆN PHÒNG</span>
              </span>
              <span className="text-[10px] text-stone-400 font-semibold">
                Kênh liên tục
              </span>
            </div>

            {/* Vùng tin nhắn liên tục */}
            <div
              ref={chatScrollRef}
              className="flex-1 h-80 overflow-y-auto space-y-2.5 bg-stone-950/85 p-3.5 rounded-2xl border border-stone-800/80 text-xs shadow-inner backdrop-blur-xs"
            >
              {(activeRoom.chat || []).length === 0 ? (
                <div className="h-full flex items-center justify-center text-stone-500 text-[11px] text-center px-4">
                  Chưa có tin nhắn. Gửi lời chào đối thủ để làm quen nhé!
                </div>
              ) : (
                (activeRoom.chat || []).map((c: any) =>
                  c.type === 'system' ? (
                    <div key={c.id} className="text-[11px] text-stone-400 italic text-center py-1 bg-stone-900/50 rounded-lg">
                      {c.text}
                    </div>
                  ) : (
                    <div key={c.id} className="leading-relaxed bg-stone-900/60 p-2 rounded-xl border border-stone-800/60">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-bold text-amber-400">{c.senderName}</span>
                        {c.isSpectator ? (
                          <span className="text-[9px] text-stone-400 px-1.5 py-0.2 rounded bg-stone-800">
                            Khán giả
                          </span>
                        ) : (
                          <span className="text-[9px] text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-500/30">
                            Kỳ thủ
                          </span>
                        )}
                      </div>
                      <div className="text-stone-200 text-xs pl-0.5">{c.text}</div>
                    </div>
                  )
                )
              )}
            </div>

            {/* Thanh Emoji */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => handleSendChat(em, 'emoji')}
                  className="px-2.5 py-1.5 rounded-xl bg-stone-950/90 hover:bg-stone-800 border border-stone-800 text-sm transition-colors shadow-xs active:scale-95"
                >
                  {em}
                </button>
              ))}
            </div>

            {/* Thanh Tin nhắn nhanh */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_MESSAGES.map((qm) => (
                <button
                  key={qm}
                  type="button"
                  onClick={() => handleSendChat(qm, 'quick')}
                  className="px-2.5 py-1 rounded-lg bg-stone-950/90 hover:bg-stone-800 border border-stone-800 text-[11px] text-stone-300 transition-colors shadow-xs active:scale-95"
                >
                  {qm}
                </button>
              ))}
            </div>

            {/* Ô nhập tin nhắn */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat(chatInput, 'text');
              }}
              className="flex items-center gap-2 pt-1"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Nhập tin nhắn..."
                className="flex-1 rounded-xl bg-stone-950/90 border border-stone-800 px-3.5 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500 shadow-inner"
              />
              <button
                type="submit"
                title="Gửi"
                className="min-w-[42px] min-h-[42px] rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold flex items-center justify-center transition-all shadow-md active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: TRONG VÁN ĐẤU HOẶC XEM LẠI TÀN CUỘC (PLAYING / FINISHED)
  // Bàn cờ render tại đây
  // =========================================================================
  const isRed = activeRoom.redPlayer?.uid === currentUser.uid;
  const isBlack = activeRoom.blackPlayer?.uid === currentUser.uid;
  const myColor = isRed ? 'r' : isBlack ? 'b' : undefined;

  const displayFen =
    reviewMode && activeRoom.moves?.length > 0
      ? reviewPly === 0
        ? activeRoom.initialFen || undefined
        : activeRoom.moves[reviewPly - 1]?.fen
      : activeRoom.fen;

  const { board, turn } = parseFen(displayFen);
  const moves = activeRoom.moves || [];
  const lastMove =
    moves.length > 0 ? { from: moves[moves.length - 1].from, to: moves[moves.length - 1].to } : null;

  const renderPlayerBar = (
    seat: any,
    colorLabel: 'Đỏ' | 'Đen',
    timeMs: number,
    isTurn: boolean,
    isMe: boolean
  ) => {
    const disconnectRemainingSec =
      seat && !seat.connected && seat.disconnectDeadline
        ? Math.max(0, Math.ceil((seat.disconnectDeadline - Date.now()) / 1000))
        : null;

    const incrementLabel =
      activeRoom.mode === 'blitz' ? '+3s' : activeRoom.mode === 'dark' ? '+0s' : '+30s';

    return (
      <div
        style={{
          backgroundImage: `linear-gradient(to right, rgba(18, 16, 15, 0.88) 0%, rgba(14, 12, 11, 0.92) 100%), url('/images/ranked_duel_stage.jpg')`,
        }}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-2xl transition-all bg-cover bg-center ${
          isMe
            ? 'border-2 border-amber-500/80 shadow-[0_0_16px_rgba(245,158,11,0.22)]'
            : isTurn && activeRoom.status === 'playing'
            ? 'border border-amber-500/50 shadow-md'
            : 'border border-stone-800'
        }`}
      >
        {/* Trái: Avatar, Tên, Huy hiệu & Điểm */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-md ${
                colorLabel === 'Đỏ'
                  ? 'bg-gradient-to-br from-red-800 to-red-950 text-red-100 border border-red-500/60'
                  : 'bg-gradient-to-br from-stone-800 to-stone-950 text-amber-200 border border-amber-500/40'
              }`}
            >
              {seat ? (
                <span className="text-base select-none">🐵</span>
              ) : (
                <span className="text-stone-500">?</span>
              )}
            </div>
            {isMe && (
              <span
                title="Chủ phòng hoặc tài khoản của bạn"
                className="absolute -top-1.5 -right-1 text-xs select-none filter drop-shadow"
              >
                👑
              </span>
            )}
          </div>

          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-stone-100 truncate max-w-[150px] sm:max-w-[200px]">
                {seat ? (seat.displayName || seat.username) : 'Đang chờ người chơi…'}
              </span>

              {isMe && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-500/50 text-[10px] font-semibold">
                  Bạn
                </span>
              )}

              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 border ${
                  colorLabel === 'Đỏ'
                    ? 'bg-red-950/50 border-red-800/60 text-red-300'
                    : 'bg-stone-950 border-stone-700 text-stone-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    colorLabel === 'Đỏ' ? 'bg-red-500 shadow-[0_0_6px_#ef4444]' : 'bg-stone-300'
                  }`}
                />
                <span>Quân {colorLabel}</span>
              </span>
            </div>

            <div className="text-xs font-mono-num flex items-center gap-2 mt-0.5">
              <span className="font-semibold text-amber-400">
                {seat?.elo ?? 1300} xu
              </span>
              {seat && !seat.connected && (
                <span className="text-red-400 flex items-center gap-1 font-sans text-[11px]">
                  <WifiOff className="w-3 h-3" />
                  <span>
                    {disconnectRemainingSec !== null ? `${disconnectRemainingSec}s` : 'Mất mạng'}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Phải: Đồng hồ bấm giờ */}
        <div className="flex items-center gap-2 font-mono-num shrink-0">
          {activeRoom.moveTimeLimitMs > 0 && isTurn && activeRoom.status === 'playing' && (
            <div
              title="Thời gian tối đa cho nước đi này (2 phút)"
              className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-semibold"
            >
              {formatClock(activeRoom.currentMoveRemainingMs)}
            </div>
          )}

          <div
            className={`px-3.5 py-1.5 rounded-xl text-sm font-bold flex items-center gap-1.5 shadow-inner ${
              isMe
                ? 'border border-amber-500/70 bg-stone-950 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                : 'border border-stone-800 bg-stone-950 text-stone-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-stone-400" />
            <span>{formatClock(timeMs)}</span>
            <span className="text-[11px] text-emerald-400 font-medium">{incrementLabel}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Cột giữa: Bàn cờ + Đồng hồ */}
      <div className="lg:col-span-7 flex flex-col items-center gap-3">
        {/* 1. KHUNG ĐỀ NGHỊ HÒA CỜ (ƯU TIÊN ĐẦU TRANG ĐỂ DỄ CHÚ Ý) */}
        {activeRoom.status === 'playing' &&
          activeRoom.drawOfferBy &&
          myColor &&
          activeRoom.drawOfferBy !== myColor && (
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-amber-500/15 border-2 border-amber-500 text-amber-200 shadow-[0_0_25px_rgba(245,158,11,0.3)] animate-pulse">
              <div className="flex items-center gap-2.5 font-medium text-xs sm:text-sm text-amber-300">
                <Handshake className="w-5 h-5 text-amber-400 shrink-0" />
                <span>
                  <strong className="text-amber-200">Đối thủ đề nghị hòa ván này!</strong> Bạn có chấp nhận không?
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() =>
                    socket?.emit('game:draw_respond', {
                      code: activeRoom.code,
                      uid: currentUser.uid,
                      accept: true,
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                >
                  Đồng ý hòa
                </button>
                <button
                  onClick={() =>
                    socket?.emit('game:draw_respond', {
                      code: activeRoom.code,
                      uid: currentUser.uid,
                      accept: false,
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs border border-stone-700 transition-all active:scale-95"
                >
                  Từ chối
                </button>
              </div>
            </div>
          )}

        {/* 2. THANH TIẾN TRÌNH KẾT QUẢ VÁN ĐẤU (ƯU TIÊN ĐẦU TRANG KHI ĐẦU HÀNG HOẶC XONG GAME) */}
        {activeRoom.status === 'finished' && (
          <div
            style={{
              backgroundImage: `linear-gradient(to right, rgba(18, 15, 13, 0.86) 0%, rgba(14, 12, 10, 0.92) 100%), url('/images/champion_hall.jpg')`,
            }}
            className="w-full rounded-2xl bg-cover bg-center border-2 border-amber-500/80 p-4 space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="text-base font-extrabold text-amber-300">
                  {activeRoom.winner === 'red' || activeRoom.winner === 'r'
                    ? 'Đỏ chiến thắng!'
                    : activeRoom.winner === 'black' || activeRoom.winner === 'b'
                    ? 'Đen chiến thắng!'
                    : 'Hòa cờ!'}
                </span>
              </div>
              <div className="px-3 py-1 rounded-lg bg-stone-950 border border-stone-800 text-xs text-amber-300/90 font-medium">
                {activeRoom.endReason || 'Ván đấu đã kết thúc'}
              </div>
            </div>

            {activeRoom.eloResult && (
              <div className="grid grid-cols-2 gap-3 text-xs font-mono-num">
                <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between">
                  <span className="font-sans text-stone-300 truncate">
                    {activeRoom.redPlayer?.displayName || activeRoom.redPlayer?.username}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={
                        activeRoom.eloResult.redDelta >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }
                    >
                      {activeRoom.eloResult.redAfter} (
                      {activeRoom.eloResult.redDelta >= 0
                        ? `+${activeRoom.eloResult.redDelta}`
                        : activeRoom.eloResult.redDelta}
                      )
                    </span>
                    {activeRoom.eloResult.redBoostPenalty > 0 && (
                      <span
                        title="Trừ điểm chống cày Elo"
                        className="px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]"
                      >
                        −{activeRoom.eloResult.redBoostPenalty}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between">
                  <span className="font-sans text-stone-300 truncate">
                    {activeRoom.blackPlayer?.displayName || activeRoom.blackPlayer?.username}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={
                        activeRoom.eloResult.blackDelta >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }
                    >
                      {activeRoom.eloResult.blackAfter} (
                      {activeRoom.eloResult.blackDelta >= 0
                        ? `+${activeRoom.eloResult.blackDelta}`
                        : activeRoom.eloResult.blackDelta}
                      )
                    </span>
                    {activeRoom.eloResult.blackBoostPenalty > 0 && (
                      <span
                        title="Trừ điểm chống cày Elo"
                        className="px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]"
                      >
                        −{activeRoom.eloResult.blackBoostPenalty}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  setReviewMode(true);
                  setReviewPly(moves.length);
                }}
                className="flex-1 min-h-[40px] rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xem lại tàn cuộc</span>
              </button>
              <button
                onClick={handleLeaveRoom}
                className="flex-1 min-h-[40px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Thoát ra phòng chờ</span>
              </button>
            </div>
          </div>
        )}

        {/* Thẻ đối thủ */}
        {renderPlayerBar(
          isBlack ? activeRoom.redPlayer : activeRoom.blackPlayer,
          isBlack ? 'Đỏ' : 'Đen',
          isBlack ? activeRoom.redTimeMs : activeRoom.blackTimeMs,
          turn === (isBlack ? 'r' : 'b'),
          false
        )}

        {/* Bàn cờ tướng chuẩn đồ họa */}
        <XiangqiBoard
          board={board}
          turn={turn}
          theme={theme}
          pieceCharMode={pieceCharMode}
          flipped={isBlack}
          interactive={activeRoom.status === 'playing' && !reviewMode && Boolean(myColor)}
          allowedColor={myColor || 'r'}
          isDarkXiangqi={activeRoom.mode === 'dark'}
          lastMove={lastMove}
          onMove={handleBoardMove}
        />

        {/* Thẻ người chơi (Bạn) */}
        {renderPlayerBar(
          isBlack ? activeRoom.blackPlayer : activeRoom.redPlayer,
          isBlack ? 'Đen' : 'Đỏ',
          isBlack ? activeRoom.blackTimeMs : activeRoom.redTimeMs,
          turn === (isBlack ? 'b' : 'r'),
          true
        )}

        {/* Nút hành động chính chuẩn giao diện */}
        <div className="w-full grid grid-cols-2 gap-3">
          <button
            onClick={() =>
              socket?.emit('game:draw_offer', {
                code: activeRoom.code,
                uid: currentUser.uid,
              })
            }
            disabled={activeRoom.status !== 'playing' || !myColor}
            className="min-h-[46px] rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-stone-800 text-stone-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-md"
          >
            <Handshake className="w-4 h-4 text-amber-400" />
            <span>Xin Hòa Cờ</span>
          </button>
          <button
            onClick={() =>
              socket?.emit('game:resign', {
                code: activeRoom.code,
                uid: currentUser.uid,
              })
            }
            disabled={activeRoom.status !== 'playing' || !myColor}
            className="min-h-[46px] rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-900/60 text-red-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-md"
          >
            <Flag className="w-4 h-4 text-red-400" />
            <span>Đầu Hàng</span>
          </button>
        </div>

        {/* Thanh công cụ phụ */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2 bg-stone-900/80 border border-stone-800/80 rounded-xl px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono-num font-bold text-amber-400 px-2 py-0.5 rounded bg-stone-950 border border-stone-800">
              Phòng: {activeRoom.code}
            </span>
            <span className="text-stone-400 font-mono-num">
              Xem {activeRoom.spectators?.length || 0}/6
            </span>
          </div>

          <div className="flex items-center gap-2">
            {reviewMode && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setReviewPly((p) => Math.max(0, p - 1))}
                  className="p-1.5 rounded-lg bg-stone-800 text-stone-200"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono-num px-1.5">
                  {reviewPly}/{moves.length}
                </span>
                <button
                  onClick={() => setReviewPly((p) => Math.min(moves.length, p + 1))}
                  className="p-1.5 rounded-lg bg-stone-800 text-stone-200"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={handleCopyRoomNotation}
              title="Sao chép kỳ phổ"
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleLeaveRoom}
              title="Rời phòng"
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-red-300"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Cột phải: 3 Tab (Ký Phổ, Khán Giả, Trò Chuyện) */}
      <div className="lg:col-span-5 space-y-3">
        {/* 3 Tab bấm chuyển có đường dẫn trực tiếp */}
        <div className="flex items-center gap-2 bg-stone-950/60 p-1 rounded-2xl border border-stone-800">
          <a
            href={`/ranked/room/${activeRoom.code}?tab=notation`}
            onClick={(e) =>
              handleLinkClick(e, `/ranked/room/${activeRoom.code}?tab=notation`, () =>
                setSideTab('notation')
              )
            }
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              sideTab === 'notation'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Ký Phổ ({moves.length})</span>
          </a>
          <a
            href={`/ranked/room/${activeRoom.code}?tab=spectators`}
            onClick={(e) =>
              handleLinkClick(e, `/ranked/room/${activeRoom.code}?tab=spectators`, () =>
                setSideTab('spectators')
              )
            }
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              sideTab === 'spectators'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Khán Giả ({activeRoom.spectators?.length || 0}/6)</span>
          </a>
          <a
            href={`/ranked/room/${activeRoom.code}?tab=chat`}
            onClick={(e) =>
              handleLinkClick(e, `/ranked/room/${activeRoom.code}?tab=chat`, () =>
                setSideTab('chat')
              )
            }
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all relative ${
              sideTab === 'chat'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Trò Chuyện</span>
            {unreadChatCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse ml-0.5" />
            )}
          </a>
        </div>

        {/* Tab 1: Ký Phổ */}
        {sideTab === 'notation' && (
          <div
            style={{
              backgroundImage: `linear-gradient(to bottom, rgba(18, 16, 15, 0.88) 0%, rgba(12, 10, 9, 0.95) 100%), url('/images/ranked_lobby_pavilion.jpg')`,
            }}
            className="rounded-2xl bg-cover bg-center border border-stone-800 p-5 space-y-4 min-h-[380px] flex flex-col shadow-xl"
          >
            <div className="border-b border-stone-800/80 pb-3">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-400">
                <RotateCcw className="w-4 h-4" />
                <span>KÝ PHỔ NƯỚC ĐI ({moves.length})</span>
              </div>
              <div className="text-[11px] text-stone-300 mt-1">
                Bấm vào nước cờ để xem lại vị trí trên bàn cờ
              </div>
            </div>

            {moves.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-stone-400 py-16">
                <div className="w-14 h-14 rounded-full border border-stone-800/80 bg-stone-950/75 flex items-center justify-center">
                  <RotateCcw className="w-7 h-7 stroke-1 text-amber-400/70" />
                </div>
                <div className="text-xs text-stone-300 text-center max-w-[240px] leading-relaxed">
                  Trận đấu vừa bắt đầu. Chưa có nước cờ nào.
                </div>
              </div>
            ) : (
              <div className="flex-1 max-h-[360px] overflow-y-auto grid grid-cols-2 gap-1.5 text-xs font-mono-num p-2.5 rounded-xl bg-stone-950/80 border border-stone-800/80 backdrop-blur-xs">
                {moves.map((m: any, idx: number) => {
                  const moveUrl = `/ranked/room/${activeRoom.code}?tab=notation&ply=${idx + 1}`;
                  return (
                    <a
                      key={idx}
                      href={moveUrl}
                      onClick={(e) =>
                        handleLinkClick(e, moveUrl, () => {
                          setReviewMode(true);
                          setReviewPly(idx + 1);
                        })
                      }
                      className={`px-2.5 py-1.5 rounded-lg text-left transition-colors flex items-center justify-between ${
                        reviewMode && reviewPly === idx + 1
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'hover:bg-stone-800/60 text-stone-300'
                      }`}
                    >
                      <span className="text-stone-500">
                        {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}.` : '...'}
                      </span>
                      <span className="font-semibold text-stone-200">{m.wxf}</span>
                      <span className="text-stone-400 text-[10px]">({m.viet})</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Khán Giả */}
        {sideTab === 'spectators' && (
          <div
            style={{
              backgroundImage: `linear-gradient(to bottom, rgba(18, 16, 15, 0.88) 0%, rgba(12, 10, 9, 0.95) 100%), url('/images/champion_hall.jpg')`,
            }}
            className="rounded-2xl bg-cover bg-center border border-stone-800 p-5 space-y-3 min-h-[380px] shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>Khán giả đang xem ({activeRoom.spectators?.length || 0}/6)</span>
              </div>
            </div>

            {!activeRoom.spectators || activeRoom.spectators.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 text-stone-400 py-16">
                <Users className="w-8 h-8 stroke-1 text-amber-400/70" />
                <span className="text-xs text-stone-300">Chưa có ai đang xem phòng này</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {activeRoom.spectators.map((s: any, idx: number) => (
                  <div
                    key={s.uid || idx}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-stone-950/85 border border-stone-800/80 text-xs backdrop-blur-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-stone-800 text-stone-300 flex items-center justify-center font-bold text-[11px]">
                        {(s.displayName || s.username || 'KG').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-semibold text-stone-200">{s.displayName || s.username}</span>
                    </div>
                    <span className="text-stone-400 font-mono-num">{s.elo ?? 1300} xu</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Trò Chuyện (Kênh chat liên tục từ phòng chờ) */}
        {sideTab === 'chat' && (
          <div
            style={{
              backgroundImage: `linear-gradient(to bottom, rgba(18, 16, 15, 0.88) 0%, rgba(12, 10, 9, 0.95) 100%), url('/images/leaderboard_bg.jpg')`,
            }}
            className="rounded-2xl bg-cover bg-center border border-stone-800 p-4 space-y-3 shadow-xl"
          >
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400 border-b border-stone-800/80 pb-2">
              Trò chuyện trong phòng
            </div>

            <div
              ref={chatScrollRef}
              className="h-56 overflow-y-auto space-y-2 bg-stone-950/80 p-3 rounded-xl border border-stone-800/80 text-xs"
            >
              {(activeRoom.chat || []).length === 0 ? (
                <div className="h-full flex items-center justify-center text-stone-500 text-[11px]">
                  Chưa có tin nhắn nào. Gửi lời chào đối thủ nhé!
                </div>
              ) : (
                (activeRoom.chat || []).map((c: any) =>
                  c.type === 'system' ? (
                    <div key={c.id} className="text-[11px] text-stone-500 italic text-center py-0.5">
                      {c.text}
                    </div>
                  ) : (
                    <div key={c.id} className="leading-relaxed">
                      <span className="font-semibold text-amber-400">{c.senderName}</span>
                      {c.isSpectator && (
                        <span className="ml-1 text-[10px] text-stone-500">· Xem</span>
                      )}
                      <span className="text-stone-500 mx-1">:</span>
                      <span className="text-stone-200">{c.text}</span>
                    </div>
                  )
                )
              )}
            </div>

            {/* Thanh Emoji */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => handleSendChat(em, 'emoji')}
                  className="px-2.5 py-1 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 text-sm transition-colors"
                >
                  {em}
                </button>
              ))}
            </div>

            {/* Thanh Tin nhắn nhanh */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_MESSAGES.map((qm) => (
                <button
                  key={qm}
                  type="button"
                  onClick={() => handleSendChat(qm, 'quick')}
                  className="px-2.5 py-1 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 text-[11px] text-stone-300 transition-colors"
                >
                  {qm}
                </button>
              ))}
            </div>

            {/* Ô nhập tin nhắn */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat(chatInput, 'text');
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Nhập tin nhắn..."
                className="flex-1 rounded-xl bg-stone-950 border border-stone-800 px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                title="Gửi"
                className="min-w-[40px] min-h-[40px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
