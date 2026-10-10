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
} from 'lucide-react';
import { RatedMode } from '../shared/elo';
import { parseFen, Pos } from '../shared/xiangqi';
import { XiangqiBoard } from './XiangqiBoard';
import { BoardTheme } from '../utils/themes';
import { UserProfile } from './AuthModal';
import { sound } from '../utils/sound';

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
  const [selectedMode, setSelectedMode] = useState<RatedMode>('blitz');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [openRooms, setOpenRooms] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewPly, setReviewPly] = useState(0);
  const [sideTab, setSideTab] = useState<'notation' | 'spectators' | 'chat'>('notation');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const lastSeenChatLengthRef = useRef(0);

  const fetchOpenRooms = () => {
    if (!socket) return;
    socket.emit('room:list', { mode: selectedMode }, (res: any) => {
      if (res?.rooms) setOpenRooms(res.rooms);
    });
  };

  useEffect(() => {
    fetchOpenRooms();
    const timer = setInterval(fetchOpenRooms, 3500);
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

  if (!currentUser) {
    return (
      <div className="w-full max-w-md mx-auto py-16 flex flex-col items-center justify-center gap-4 rounded-2xl bg-stone-900/90 border border-stone-800 p-6">
        <Lock className="w-8 h-8 text-amber-500 stroke-1" />
        <button
          onClick={onOpenAuth}
          className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors shadow-lg"
        >
          Đăng nhập để đấu xếp hạng
        </button>
      </div>
    );
  }

  if (!currentUser.isCreateAccount) {
    return (
      <div className="w-full max-w-md mx-auto py-16 flex flex-col items-center justify-center gap-3 rounded-2xl bg-stone-900/90 border border-stone-800 p-6 text-center">
        <Lock className="w-8 h-8 text-amber-500 stroke-1" />
        <span className="text-sm font-semibold text-amber-300">Chờ duyệt tài khoản</span>
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
          onToast(`Đã tạo phòng ${res.room.code}`);
        }
      }
    );
  };

  const handleJoinRoom = (code: string, asSpectator = false) => {
    if (!socket || !code.trim()) return;
    socket.emit(
      'room:join',
      {
        code: code.trim().toUpperCase(),
        uid: currentUser.uid,
        username: currentUser.username,
        asSpectator,
      },
      (res: any) => {
        if (res?.error) {
          onToast(res.error);
        } else if (res?.room) {
          setActiveRoom(res.room);
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
      { id: 'blitz', label: 'Cờ chớp', sub: '5 phút + 3s', icon: Flame, color: 'from-amber-600/30 via-orange-600/20 to-stone-900' },
      { id: 'standard', label: 'Tiêu chuẩn', sub: '30p · 2p/nước', icon: Clock, color: 'from-emerald-600/30 via-teal-600/20 to-stone-900' },
      { id: 'dark', label: 'Cờ úp', sub: '15p · 2p/nước', icon: EyeOff, color: 'from-purple-600/30 via-indigo-600/20 to-stone-900' },
    ] as const;

    return (
      <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
        {/* Banner tiêu đề sảnh hoàng gia */}
        <div className="relative rounded-3xl bg-gradient-to-r from-stone-900 via-stone-900/95 to-amber-950/40 border border-stone-800/90 p-5 sm:p-6 shadow-2xl overflow-hidden">
          <div className="absolute -right-8 -bottom-10 font-hanzi text-8xl font-black text-amber-500/5 select-none pointer-events-none">
            楚河漢界
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-950/60 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
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
                <p className="text-xs text-stone-400 mt-0.5">
                  Chọn thể loại, ghép đối thủ xứng tầm và ghi danh trên bảng vàng
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="px-3 py-1.5 rounded-xl bg-stone-950/80 border border-stone-800 text-xs font-mono-num text-stone-300 flex items-center gap-2 shadow-inner">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{openRooms.length} phòng đang mở</span>
              </div>
            </div>
          </div>
        </div>

        {/* 1. Thanh chọn thể loại thi đấu (3 Thẻ nghệ thuật) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {modeConfigs.map((item) => {
            const Icon = item.icon;
            const active = selectedMode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedMode(item.id)}
                className={`group relative p-4 rounded-2xl border text-left transition-all duration-200 overflow-hidden min-h-[92px] flex flex-col justify-between ${
                  active
                    ? `bg-gradient-to-br ${item.color} border-amber-500 text-stone-100 shadow-[0_0_24px_rgba(245,158,11,0.2)] ring-1 ring-amber-400/60 -translate-y-0.5`
                    : 'bg-stone-900/85 hover:bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                      active
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-inner'
                        : 'bg-stone-950 border border-stone-800 text-stone-500 group-hover:text-stone-300'
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  {active ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[10px] font-black uppercase tracking-wider shadow">
                      Đang chọn
                    </span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-stone-700 group-hover:bg-stone-500 transition-colors" />
                  )}
                </div>

                <div className="mt-2">
                  <div className={`text-sm font-bold ${active ? 'text-stone-100' : 'text-stone-200'}`}>
                    {item.label}
                  </div>
                  <div className="text-[11px] text-stone-400 font-mono-num mt-0.5">
                    {item.sub}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 2. Thanh tác vụ: Nhập mã nhanh & Tạo phòng */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-900/90 border border-stone-800/90 rounded-2xl p-3.5 sm:p-4 shadow-xl">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <input
                type="text"
                maxLength={6}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="Nhập mã phòng (6 ký tự)"
                className="w-full rounded-xl bg-stone-950 border border-stone-800 pl-4 pr-3 py-2.5 text-xs font-mono-num uppercase tracking-widest text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 shadow-inner transition-colors"
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
              className="min-h-[42px] px-3.5 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 text-xs flex items-center justify-center transition-colors shadow-inner"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleCreateRoom}
              className="min-h-[42px] px-6 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-stone-950 font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Tạo phòng mới</span>
            </button>
          </div>
        </div>

        {/* 3. Danh sách phòng SẢNH dạng thẻ tổng hợp */}
        {openRooms.length === 0 ? (
          /* Trạng thái rỗng: Icon + Nút Tạo phòng tối giản theo yêu cầu */
          <div className="py-20 flex flex-col items-center justify-center gap-4 rounded-3xl bg-stone-900/60 border border-stone-800/80 p-8 text-center shadow-xl">
            <div className="w-16 h-16 rounded-full bg-stone-950 border border-stone-800 flex items-center justify-center text-stone-500 shadow-inner">
              <Swords className="w-8 h-8 stroke-[1.2]" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-bold text-stone-300">Chưa có phòng nào cho thể loại này</div>
              <div className="text-xs text-stone-500">Hãy là người đầu tiên lập kỳ đài đón khách!</div>
            </div>
            <button
              onClick={handleCreateRoom}
              className="min-h-[44px] px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-extrabold text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Tạo phòng ngay</span>
            </button>
          </div>
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
                  className="rounded-2xl bg-gradient-to-b from-stone-900/95 via-stone-900 to-stone-950 border border-stone-800 hover:border-amber-500/60 p-4.5 flex flex-col justify-between gap-3.5 shadow-xl hover:shadow-[0_4px_24px_rgba(0,0,0,0.5)] transition-all duration-200 group"
                >
                  {/* Header thẻ phòng */}
                  <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num font-black text-amber-400 text-xs px-2.5 py-0.5 rounded-lg bg-stone-950 border border-amber-500/30 shadow-inner tracking-wider">
                        #{r.code}
                      </span>
                      <span className="text-[11px] text-stone-400 font-semibold">{modeLabel}</span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 shadow-xs ${
                        isWaiting
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isWaiting ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                        }`}
                      />
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
                    <div className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800/90 space-y-1.5 text-[11px] font-mono-num shadow-inner">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />
                          <span className="text-red-300 font-bold font-sans">Đỏ:</span>
                          <span className="text-stone-200 font-sans truncate max-w-[130px]">
                            {r.redPlayer ? r.redPlayer.username : 'Ghế trống'}
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
                            {r.blackPlayer ? r.blackPlayer.username : 'Ghế trống'}
                          </span>
                        </div>
                        <span className="text-amber-400/90 font-bold shrink-0">
                          {r.blackPlayer ? `${r.blackPlayer.elo} xu` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Nút hành động trên thẻ: Vào chơi hoặc Vào xem */}
                  <div className="pt-0.5">
                    {canPlay ? (
                      <button
                        onClick={() => handleJoinRoom(r.code, false)}
                        className="w-full min-h-[40px] rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_16px_rgba(245,158,11,0.25)] active:scale-95"
                      >
                        <Swords className="w-3.5 h-3.5 stroke-[2.2]" />
                        <span>Vào chơi ({r.playerCount}/2 ghế)</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoinRoom(r.code, true)}
                        disabled={r.spectatorCount >= 6}
                        className="w-full min-h-[40px] rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5 text-stone-400" />
                        <span>Vào xem ({r.spectatorCount}/6)</span>
                      </button>
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
        {/* Thanh tiêu đề phòng chờ hoàng gia */}
        <div className="flex items-center justify-between bg-gradient-to-r from-stone-900 via-stone-900/95 to-amber-950/40 border border-stone-800/90 rounded-2xl px-5 py-3.5 shadow-2xl">
          <div className="flex items-center gap-3">
            <span className="font-mono-num font-black text-amber-400 px-3.5 py-1.5 rounded-xl bg-stone-950 border border-amber-500/30 text-sm shadow-inner tracking-widest">
              PHÒNG: {activeRoom.code}
            </span>
            <span className="text-xs text-stone-300 font-semibold hidden sm:flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>{modeLabel}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(activeRoom.code);
                onToast(`Đã sao chép mã phòng ${activeRoom.code}`);
              }}
              className="px-3.5 py-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-inner"
              title="Sao chép mã phòng"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Sao chép mã</span>
            </button>
            <button
              onClick={handleLeaveRoom}
              className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-red-950/80 hover:text-red-200 border border-stone-700/80 text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Rời phòng</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Cột trái: Kỳ Đài Song Hùng (2 Ghế) + Khán Đài (6 Chỗ) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Kỳ Đài Song Hùng Đối Kháng */}
            <div className="rounded-3xl bg-gradient-to-b from-stone-900 via-stone-900/95 to-stone-950 border border-stone-800/90 p-5 sm:p-6 space-y-5 shadow-2xl relative overflow-hidden">
              {/* Tiêu đề kỳ đài */}
              <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-400">
                  <Swords className="w-4 h-4 text-amber-400" />
                  <span>KỲ ĐÀI SONG HÙNG ĐỐI KHÁNG</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono-num">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      bothReady ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400 animate-pulse'
                    }`}
                  />
                  <span className="text-stone-300 font-semibold text-[11px] font-sans">
                    {bothReady ? 'Đã đủ 2 kỳ thủ' : 'Đang chờ đối thủ'}
                  </span>
                </div>
              </div>

              {/* Bố cục 2 ghế Đỏ vs Đen */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
                {/* Ghế Đỏ (Tiên Thủ) */}
                <div
                  className={`relative rounded-2xl border p-4.5 flex flex-col justify-between min-h-[175px] transition-all overflow-hidden ${
                    activeRoom.redPlayer
                      ? activeRoom.redPlayer.uid === currentUser.uid
                        ? 'border-2 border-red-500/90 bg-gradient-to-br from-red-950/40 via-stone-900 to-stone-950 shadow-[0_0_24px_rgba(239,68,68,0.25)]'
                        : 'border-red-900/70 bg-gradient-to-br from-red-950/20 to-stone-950 shadow-md'
                      : 'border-2 border-dashed border-stone-800/80 bg-stone-950/30'
                  }`}
                >
                  {/* Watermark thư pháp chìm */}
                  <span className="absolute -bottom-2 -right-1 font-hanzi font-black text-6xl text-red-500/10 select-none pointer-events-none">
                    帥
                  </span>

                  <div className="flex items-start justify-between relative z-10">
                    <span className="text-xs font-black text-red-400 flex items-center gap-1.5 tracking-wider">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
                      <span>QUÂN ĐỎ (ĐI TRƯỚC)</span>
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
                          <span>{activeRoom.redPlayer.username}</span>
                          {activeRoom.redPlayer.uid === currentUser.uid && (
                            <span className="px-1.5 py-0.2 rounded-md bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-500/40">
                              Bạn
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono-num font-bold text-amber-400 mt-0.5">
                          {activeRoom.redPlayer.elo ?? 1200} xu
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="my-6 text-center text-xs text-stone-500 italic relative z-10">
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
                  className={`relative rounded-2xl border p-4.5 flex flex-col justify-between min-h-[175px] transition-all overflow-hidden ${
                    activeRoom.blackPlayer
                      ? activeRoom.blackPlayer.uid === currentUser.uid
                        ? 'border-2 border-amber-500/90 bg-gradient-to-br from-stone-900 via-stone-900/95 to-amber-950/40 shadow-[0_0_24px_rgba(245,158,11,0.25)]'
                        : 'border-stone-700 bg-gradient-to-br from-stone-800/30 to-stone-950 shadow-md'
                      : 'border-2 border-dashed border-stone-800/80 bg-stone-950/30'
                  }`}
                >
                  {/* Watermark thư pháp chìm */}
                  <span className="absolute -bottom-2 -right-1 font-hanzi font-black text-6xl text-amber-500/10 select-none pointer-events-none">
                    將
                  </span>

                  <div className="flex items-start justify-between relative z-10">
                    <span className="text-xs font-black text-stone-300 flex items-center gap-1.5 tracking-wider">
                      <span className="w-2.5 h-2.5 rounded-full bg-stone-300 shadow-[0_0_8px_#cbd5e1]" />
                      <span>QUÂN ĐEN (ĐI SAU)</span>
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
                          <span>{activeRoom.blackPlayer.username}</span>
                          {activeRoom.blackPlayer.uid === currentUser.uid && (
                            <span className="px-1.5 py-0.2 rounded-md bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-500/40">
                              Bạn
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono-num font-bold text-amber-400 mt-0.5">
                          {activeRoom.blackPlayer.elo ?? 1200} xu
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="my-6 text-center text-xs text-stone-500 italic relative z-10">
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
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>
                      {bothReady
                        ? 'Đã đủ 2 kỳ thủ. Chờ chủ phòng phát lệnh khai cuộc…'
                        : 'Chờ đối thủ vào phòng…'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Khán Đài Danh Dự (6 Ghế Khán Giả) */}
            <div className="rounded-3xl bg-stone-900/90 border border-stone-800 p-5 space-y-3.5 shadow-xl">
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
                      className={`p-3 rounded-2xl border flex items-center gap-2.5 min-h-[58px] transition-all ${
                        spec
                          ? spec.uid === currentUser.uid
                            ? 'bg-amber-950/30 border-amber-500/60 text-stone-100 shadow-md ring-1 ring-amber-500/30'
                            : 'bg-stone-950/80 border-stone-800 text-stone-300 shadow-inner'
                          : 'border-dashed border-stone-800/80 bg-stone-950/20 text-stone-600'
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
                            {spec.elo ?? 1200} xu
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cột phải: KHUNG CHAT LIÊN TỤC (1 kênh duy nhất giữ nguyên khi chuyển trạng thái) */}
          <div className="lg:col-span-5 rounded-3xl bg-stone-900/90 border border-stone-800 p-5 space-y-3.5 shadow-2xl flex flex-col min-h-[500px]">
            <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400 border-b border-stone-800/80 pb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                <span>TRÒ CHUYỆN PHÒNG</span>
              </span>
              <span className="text-[10px] text-stone-500 font-semibold px-2 py-0.5 rounded-full bg-stone-950 border border-stone-800">
                Kênh liên tục
              </span>
            </div>

            {/* Vùng tin nhắn liên tục */}
            <div
              ref={chatScrollRef}
              className="flex-1 h-80 overflow-y-auto space-y-2.5 bg-stone-950/90 p-3.5 rounded-2xl border border-stone-800/80 text-xs shadow-inner"
            >
              {(activeRoom.chat || []).length === 0 ? (
                <div className="h-full flex items-center justify-center text-stone-500 text-[11px] text-center px-4">
                  Chưa có tin nhắn. Gửi lời chào đối thủ để làm quen nhé!
                </div>
              ) : (
                (activeRoom.chat || []).map((c: any) =>
                  c.type === 'system' ? (
                    <div key={c.id} className="text-[11px] text-stone-500 italic text-center py-1 bg-stone-900/40 rounded-lg">
                      {c.text}
                    </div>
                  ) : (
                    <div key={c.id} className="leading-relaxed bg-stone-900/50 p-2 rounded-xl border border-stone-800/50">
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
                  className="px-2.5 py-1.5 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-sm transition-colors shadow-xs active:scale-95"
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
                  className="px-2.5 py-1 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 text-[11px] text-stone-300 transition-colors shadow-xs active:scale-95"
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
                className="flex-1 rounded-xl bg-stone-950 border border-stone-800 px-3.5 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500 shadow-inner"
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
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-2xl transition-all ${
          isMe
            ? 'border-2 border-amber-500/80 shadow-[0_0_16px_rgba(245,158,11,0.22)] bg-gradient-to-r from-stone-900/95 via-stone-900 to-amber-950/20'
            : isTurn && activeRoom.status === 'playing'
            ? 'border border-amber-500/50 bg-stone-900/95 shadow-md'
            : 'border border-stone-800 bg-stone-900/90'
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
                {seat ? seat.username : 'Đang chờ người chơi…'}
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
                {seat?.elo ?? 1200} xu
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

        {/* Khung đề nghị hòa cờ */}
        {activeRoom.status === 'playing' &&
          activeRoom.drawOfferBy &&
          myColor &&
          activeRoom.drawOfferBy !== myColor && (
            <div className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-amber-950/60 border border-amber-600/60 text-xs text-amber-200 shadow-lg">
              <span>Đối thủ đề nghị hòa ván này</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    socket?.emit('game:draw_respond', {
                      code: activeRoom.code,
                      uid: currentUser.uid,
                      accept: true,
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold"
                >
                  Đồng ý
                </button>
                <button
                  onClick={() =>
                    socket?.emit('game:draw_respond', {
                      code: activeRoom.code,
                      uid: currentUser.uid,
                      accept: false,
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-stone-800 text-stone-300"
                >
                  Từ chối
                </button>
              </div>
            </div>
          )}

        {/* Kết quả ván đấu */}
        {activeRoom.status === 'finished' && (
          <div className="w-full rounded-2xl bg-stone-900 border border-amber-500/50 p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-amber-400">
                {activeRoom.winner === 'red'
                  ? 'Đỏ chiến thắng!'
                  : activeRoom.winner === 'black'
                  ? 'Đen chiến thắng!'
                  : 'Hòa cờ!'}
              </div>
              <div className="text-xs text-stone-400">{activeRoom.endReason}</div>
            </div>

            {activeRoom.eloResult && (
              <div className="grid grid-cols-2 gap-3 text-xs font-mono-num">
                <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between">
                  <span className="font-sans text-stone-300 truncate">
                    {activeRoom.redPlayer?.username}
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
                    {activeRoom.blackPlayer?.username}
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
                className="flex-1 min-h-[40px] rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xem lại tàn cuộc</span>
              </button>
              <button
                onClick={handleLeaveRoom}
                className="flex-1 min-h-[40px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Thoát ra phòng chờ</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cột phải: 3 Tab (Ký Phổ, Khán Giả, Trò Chuyện) */}
      <div className="lg:col-span-5 space-y-3">
        {/* 3 Tab bấm chuyển */}
        <div className="flex items-center gap-2 bg-stone-950/60 p-1 rounded-2xl border border-stone-800">
          <button
            onClick={() => setSideTab('notation')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              sideTab === 'notation'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Ký Phổ ({moves.length})</span>
          </button>
          <button
            onClick={() => setSideTab('spectators')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              sideTab === 'spectators'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Khán Giả ({activeRoom.spectators?.length || 0}/6)</span>
          </button>
          <button
            onClick={() => setSideTab('chat')}
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
          </button>
        </div>

        {/* Tab 1: Ký Phổ */}
        {sideTab === 'notation' && (
          <div className="rounded-2xl bg-stone-900/90 border border-stone-800 p-5 space-y-4 min-h-[380px] flex flex-col shadow-xl">
            <div className="border-b border-stone-800/80 pb-3">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-400">
                <RotateCcw className="w-4 h-4" />
                <span>KÝ PHỔ NƯỚC ĐI ({moves.length})</span>
              </div>
              <div className="text-[11px] text-stone-400 mt-1">
                Bấm vào nước cờ để xem lại vị trí trên bàn cờ
              </div>
            </div>

            {moves.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-stone-500 py-16">
                <div className="w-14 h-14 rounded-full border border-stone-800/80 bg-stone-950/60 flex items-center justify-center">
                  <RotateCcw className="w-7 h-7 stroke-1 text-stone-600" />
                </div>
                <div className="text-xs text-stone-400 text-center max-w-[240px] leading-relaxed">
                  Trận đấu vừa bắt đầu. Chưa có nước cờ nào.
                </div>
              </div>
            ) : (
              <div className="flex-1 max-h-[360px] overflow-y-auto grid grid-cols-2 gap-1.5 text-xs font-mono-num p-2.5 rounded-xl bg-stone-950/70 border border-stone-800/70">
                {moves.map((m: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setReviewMode(true);
                      setReviewPly(idx + 1);
                    }}
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
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Khán Giả */}
        {sideTab === 'spectators' && (
          <div className="rounded-2xl bg-stone-900/90 border border-stone-800 p-5 space-y-3 min-h-[380px] shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>Khán giả đang xem ({activeRoom.spectators?.length || 0}/6)</span>
              </div>
            </div>

            {!activeRoom.spectators || activeRoom.spectators.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 text-stone-500 py-16">
                <Users className="w-8 h-8 stroke-1 text-stone-600" />
                <span className="text-xs text-stone-400">Chưa có ai đang xem phòng này</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {activeRoom.spectators.map((s: any, idx: number) => (
                  <div
                    key={s.uid || idx}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-stone-950/80 border border-stone-800/80 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-stone-800 text-stone-300 flex items-center justify-center font-bold text-[11px]">
                        {s.username ? s.username.slice(0, 2).toUpperCase() : 'KG'}
                      </div>
                      <span className="font-semibold text-stone-200">{s.username}</span>
                    </div>
                    <span className="text-stone-400 font-mono-num">{s.elo ?? 1200} xu</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Trò Chuyện (Kênh chat liên tục từ phòng chờ) */}
        {sideTab === 'chat' && (
          <div className="rounded-2xl bg-stone-900/90 border border-stone-800 p-4 space-y-3 shadow-xl">
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
