import React, { useState, useEffect } from 'react';
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

  const fetchOpenRooms = () => {
    if (!socket) return;
    socket.emit('room:list', { mode: selectedMode }, (res: any) => {
      if (res?.rooms) setOpenRooms(res.rooms);
    });
  };

  useEffect(() => {
    fetchOpenRooms();
    const timer = setInterval(fetchOpenRooms, 4000);
    return () => clearInterval(timer);
  }, [socket, selectedMode, activeRoom]);

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
          className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors"
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

  const handleJoinRoom = (code: string) => {
    if (!socket || !code.trim()) return;
    socket.emit(
      'room:join',
      {
        code: code.trim().toUpperCase(),
        uid: currentUser.uid,
        username: currentUser.username,
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

  // LOBBY VIEW (Not in a room yet)
  if (!activeRoom) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* 1. Select Ranked Mode */}
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              {
                id: 'blitz',
                label: 'Cờ chớp',
                sub: '5 phút + 3s',
                icon: Flame,
              },
              {
                id: 'standard',
                label: 'Tiêu chuẩn',
                sub: '30p · 2p/nước',
                icon: Clock,
              },
              {
                id: 'dark',
                label: 'Cờ úp',
                sub: '15p · 2p/nước',
                icon: EyeOff,
              },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = selectedMode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedMode(item.id)}
                title={item.sub}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between min-h-[88px] ${
                  active
                    ? 'bg-amber-600/20 border-amber-500 text-stone-100 shadow-lg'
                    : 'bg-stone-900/80 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-amber-400' : 'text-stone-500'}`} />
                <div>
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="text-[11px] text-stone-400 font-mono-num">{item.sub}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 2. Two Clear Choices: "Vào phòng" & "Tạo phòng" */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Join Room Card */}
          <div className="rounded-2xl bg-stone-900/90 border border-stone-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-100">
                <LogIn className="w-4 h-4 text-amber-500" />
                <span>Vào phòng</span>
              </div>
              <button
                onClick={fetchOpenRooms}
                title="Làm mới danh sách phòng"
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={6}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="Mã 6 ký tự"
                className="flex-1 rounded-xl bg-stone-950 border border-stone-800 px-3.5 py-2.5 text-sm font-mono-num uppercase tracking-widest text-stone-100 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={() => handleJoinRoom(roomCodeInput)}
                className="min-h-[44px] px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold whitespace-nowrap transition-colors"
              >
                Vào ngay
              </button>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {openRooms.length === 0 ? (
                <div className="py-6 flex flex-col items-center justify-center gap-2 text-stone-500">
                  <Users className="w-5 h-5 stroke-1" />
                  <button
                    onClick={handleCreateRoom}
                    className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-stone-200"
                  >
                    Tạo phòng đầu tiên
                  </button>
                </div>
              ) : (
                openRooms.map((r) => (
                  <button
                    key={r.code}
                    onClick={() => handleJoinRoom(r.code)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-stone-950/80 hover:bg-stone-800 border border-stone-800 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num font-bold text-amber-400">{r.code}</span>
                      <span className="text-stone-300">{r.hostName}</span>
                    </div>
                    <div className="text-stone-400 font-mono-num">
                      {r.playerCount}/2 · Xem {r.spectatorCount}/6
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Create Room Card */}
          <div className="rounded-2xl bg-stone-900/90 border border-stone-800 p-5 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Plus className="w-6 h-6" />
            </div>
            <button
              onClick={handleCreateRoom}
              className="w-full max-w-xs min-h-[48px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo phòng</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // IN-ROOM / ACTIVE MATCH VIEW
  const isRed = activeRoom.redPlayer?.uid === currentUser.uid;
  const isBlack = activeRoom.blackPlayer?.uid === currentUser.uid;
  const isHost = activeRoom.hostUid === currentUser.uid;
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

  const renderPlayerBar = (seat: any, colorLabel: 'Đỏ' | 'Đen', timeMs: number, isTurn: boolean) => {
    const disconnectRemainingSec =
      seat && !seat.connected && seat.disconnectDeadline
        ? Math.max(0, Math.ceil((seat.disconnectDeadline - Date.now()) / 1000))
        : null;

    return (
      <div
        className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl border transition-colors ${
          isTurn && activeRoom.status === 'playing'
            ? 'bg-amber-950/40 border-amber-500/60'
            : 'bg-stone-900/90 border-stone-800'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              colorLabel === 'Đỏ'
                ? 'bg-red-900/70 text-red-200 border border-red-500/50'
                : 'bg-stone-800 text-stone-200 border border-stone-600'
            }`}
          >
            {seat ? seat.username.slice(0, 2).toUpperCase() : '?'}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-stone-100 truncate">
              {seat ? seat.username : 'Đang chờ người chơi…'}
            </div>
            <div className="text-[11px] text-stone-400 font-mono-num flex items-center gap-1.5">
              <span>Elo {seat?.elo ?? 1200}</span>
              {seat && !seat.connected && (
                <span className="text-red-400 flex items-center gap-1">
                  <WifiOff className="w-3 h-3" />
                  <span>{disconnectRemainingSec !== null ? `${disconnectRemainingSec}s` : 'Mất mạng'}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Total Clock + Per-move 2m Ring */}
        <div className="flex items-center gap-2 font-mono-num shrink-0">
          {activeRoom.moveTimeLimitMs > 0 && isTurn && activeRoom.status === 'playing' && (
            <div
              title="Thời gian tối đa cho nước đi này (2 phút)"
              className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-semibold"
            >
              {formatClock(activeRoom.currentMoveRemainingMs)}
            </div>
          )}
          <div className="px-3 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-sm font-bold text-stone-100">
            {formatClock(timeMs)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Center Board + Clocks */}
      <div className="lg:col-span-7 flex flex-col items-center gap-2.5">
        {renderPlayerBar(
          isBlack ? activeRoom.redPlayer : activeRoom.blackPlayer,
          isBlack ? 'Đỏ' : 'Đen',
          isBlack ? activeRoom.redTimeMs : activeRoom.blackTimeMs,
          turn === (isBlack ? 'r' : 'b')
        )}

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

        {renderPlayerBar(
          isBlack ? activeRoom.blackPlayer : activeRoom.redPlayer,
          isBlack ? 'Đen' : 'Đỏ',
          isBlack ? activeRoom.blackTimeMs : activeRoom.redTimeMs,
          turn === (isBlack ? 'b' : 'r')
        )}

        {/* Action Toolbar */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2 bg-stone-900/90 border border-stone-800 rounded-2xl p-2.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono-num font-bold text-amber-400 px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-800">
              Mã: {activeRoom.code}
            </span>
            <span className="text-stone-400 font-mono-num">
              Xem: {activeRoom.spectators?.length || 0}/6
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeRoom.status === 'waiting' && isHost && (
              <button
                onClick={handleStartMatch}
                disabled={!activeRoom.redPlayer || !activeRoom.blackPlayer}
                className="min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Bắt đầu</span>
              </button>
            )}

            {activeRoom.status === 'playing' && myColor && (
              <>
                <button
                  onClick={() =>
                    socket?.emit('game:draw_offer', {
                      code: activeRoom.code,
                      uid: currentUser.uid,
                    })
                  }
                  title="Xin hòa"
                  className="min-h-[40px] px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium flex items-center gap-1.5"
                >
                  <Handshake className="w-3.5 h-3.5" />
                  <span>Xin hòa</span>
                </button>
                <button
                  onClick={() =>
                    socket?.emit('game:resign', {
                      code: activeRoom.code,
                      uid: currentUser.uid,
                    })
                  }
                  title="Đầu hàng"
                  className="min-h-[40px] px-3 rounded-xl bg-red-950/70 hover:bg-red-900/80 text-red-300 border border-red-800/50 text-xs font-medium flex items-center gap-1.5"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Đầu hàng</span>
                </button>
              </>
            )}

            {reviewMode && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setReviewPly((p) => Math.max(0, p - 1))}
                  className="p-2 rounded-lg bg-stone-800 text-stone-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono-num px-2">
                  {reviewPly}/{moves.length}
                </span>
                <button
                  onClick={() => setReviewPly((p) => Math.min(moves.length, p + 1))}
                  className="p-2 rounded-lg bg-stone-800 text-stone-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={handleCopyRoomNotation}
              title="Sao chép kỳ phổ"
              className="min-h-[40px] px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Sao chép</span>
            </button>

            <button
              onClick={handleLeaveRoom}
              title="Rời phòng"
              className="min-h-[40px] px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Rời phòng</span>
            </button>
          </div>
        </div>

        {/* Draw Offer Prompt */}
        {activeRoom.status === 'playing' &&
          activeRoom.drawOfferBy &&
          myColor &&
          activeRoom.drawOfferBy !== myColor && (
            <div className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-amber-950/60 border border-amber-600/60 text-xs text-amber-200">
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

        {/* Match Result & Anti-Boosting Summary Card */}
        {activeRoom.status === 'finished' && (
          <div className="w-full rounded-2xl bg-stone-900 border border-amber-500/50 p-4 space-y-3">
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
                  <span className="font-sans text-stone-300">
                    {activeRoom.redPlayer?.username}
                  </span>
                  <div className="flex items-center gap-1.5">
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
                        title="Trừ điểm chống cày Elo do gặp lặp đối thủ"
                        className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]"
                      >
                        −{activeRoom.eloResult.redBoostPenalty}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between">
                  <span className="font-sans text-stone-300">
                    {activeRoom.blackPlayer?.username}
                  </span>
                  <div className="flex items-center gap-1.5">
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
                        title="Trừ điểm chống cày Elo do gặp lặp đối thủ"
                        className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]"
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

      {/* Right Column: Moves & 1-Channel Chat */}
      <div className="lg:col-span-5 space-y-4">
        {/* Move List */}
        <div className="rounded-2xl bg-stone-900/90 border border-stone-800 p-4 space-y-2">
          <div className="text-xs font-semibold text-stone-300">Kỳ phổ ({moves.length} nước)</div>
          <div className="max-h-36 overflow-y-auto grid grid-cols-2 gap-1 text-xs font-mono-num bg-stone-950/70 p-2 rounded-xl border border-stone-800/80">
            {moves.map((m: any, idx: number) => (
              <div key={idx} className="px-2 py-1 text-stone-300 truncate">
                <span className="text-stone-500 mr-1">
                  {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}.` : '...'}
                </span>
                {m.wxf} <span className="text-stone-500 text-[10px]">({m.viet})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Single-Channel Chat (Free text, Emoji, Quick Messages) */}
        <div className="rounded-2xl bg-stone-900/90 border border-stone-800 p-4 space-y-3">
          <div className="text-xs font-semibold text-stone-300">Trò chuyện phòng</div>

          <div className="h-48 overflow-y-auto space-y-1.5 bg-stone-950/80 p-3 rounded-xl border border-stone-800/80 text-xs">
            {(activeRoom.chat || []).map((c: any) =>
              c.type === 'system' ? (
                <div key={c.id} className="text-[11px] text-stone-500 italic">
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
            )}
          </div>

          {/* Emoji Bar */}
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

          {/* Quick Messages Bar */}
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

          {/* Free Text Input */}
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
      </div>
    </div>
  );
};
