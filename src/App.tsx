/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Bot,
  Swords,
  BookOpen,
  Trophy,
  ShieldCheck,
  User,
  LogOut,
  Volume2,
  VolumeX,
  Palette,
  Undo2,
  Lightbulb,
  Flag,
  Handshake,
  Copy,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  WifiOff,
  Languages,
  Home,
} from 'lucide-react';

import './firebase';
import {
  INITIAL_FEN,
  Pos,
  PieceColor,
  FormattedMove,
  parseFen,
  boardToFen,
  applyMove,
  isKingInCheck,
  evaluateGameStatus,
  formatMoveNotation,
} from './shared/xiangqi';
import { BOARD_THEMES, THEME_LIST, BoardThemeId } from './utils/themes';
import { sound } from './utils/sound';
import { AIDifficulty, AIEngineType, findBestMove } from './workers/ai.worker';
import { XiangqiBoard } from './components/XiangqiBoard';
import { AuthModal, UserProfile } from './components/AuthModal';
import { NotationViewerView } from './components/NotationViewerView';
import { LeaderboardView } from './components/LeaderboardView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { RankedRoomView } from './components/RankedRoomView';
import { HomeView } from './components/HomeView';
import { Logo } from './components/Logo';

type MainTab = 'home' | 'ai' | 'ranked' | 'viewer' | 'leaderboard' | 'admin';

const AI_ENGINES: { id: AIEngineType; name: string; desc: string; badge: string }[] = [
  { id: 'fairy_stockfish', name: 'Fairy-Stockfish WASM', desc: 'Engine NNUE/AlphaBeta quốc tế siêu mạnh', badge: 'Khuyên dùng' },
  { id: 'pikafish', name: 'Pikafish NNUE', desc: 'Động cơ cờ tướng số 1 thế giới', badge: 'Vô địch' },
  { id: 'builtin', name: 'Alpha-Beta Cục Bộ', desc: 'Thuật toán vị trí nhanh nhẹn', badge: 'Offline' },
];

const AI_LEVELS: { id: AIDifficulty; name: string; eloLabel: string }[] = [
  { id: 'novice', name: 'Tân thủ', eloLabel: '~800' },
  { id: 'veteran', name: 'Kỳ cựu', eloLabel: '~1300' },
  { id: 'master', name: 'Kiện tướng', eloLabel: '~1800' },
  { id: 'grandmaster', name: 'Kỳ tiên', eloLabel: '~2300+' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>(() =>
    window.location.pathname === '/admin' ? 'admin' : 'home'
  );
  const [viewerInitialPgn, setViewerInitialPgn] = useState<string>('');

  // User & Session state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('xq_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [sessionId, setSessionId] = useState<string>(
    () => localStorage.getItem('xq_session') || ''
  );
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Preferences
  const [themeId, setThemeId] = useState<BoardThemeId>(
    () => (localStorage.getItem('xq_theme') as BoardThemeId) || 'classic_wood'
  );
  const [pieceCharMode, setPieceCharMode] = useState<'hanzi' | 'viet'>(
    () => (localStorage.getItem('xq_char') as 'hanzi' | 'viet') || 'hanzi'
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const v = localStorage.getItem('xq_sound');
    return v ? v === 'true' : true;
  });
  const [themeDrawerOpen, setThemeDrawerOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // 1-line Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  // Socket & Realtime state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [activeRoom, setActiveRoom] = useState<any | null>(null);
  const [adminLoginReqs, setAdminLoginReqs] = useState<any[] | null>(null);

  // AI Match State
  const [aiEngine, setAiEngine] = useState<AIEngineType>('fairy_stockfish');
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('veteran');
  const [playerSide, setPlayerSide] = useState<PieceColor>('r');
  const [fenHistory, setFenHistory] = useState<string[]>([INITIAL_FEN]);
  const [checkHistory, setCheckHistory] = useState<{ color: PieceColor; gaveCheck: boolean }[]>([]);
  const [moves, setMoves] = useState<FormattedMove[]>([]);
  const [hintMove, setHintMove] = useState<{ from: Pos; to: Pos } | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [gameResult, setGameResult] = useState<{
    isOver: boolean;
    winner: 'red' | 'black' | 'draw' | 'ongoing';
    reason: string;
  }>({ isOver: false, winner: 'ongoing', reason: '' });

  const workerRef = useRef<Worker | null>(null);
  const currentFen = fenHistory[fenHistory.length - 1];
  const { board, turn } = parseFen(currentFen);
  const currentTheme = BOARD_THEMES[themeId] || BOARD_THEMES.classic_wood;

  useEffect(() => {
    sound.enabled = soundEnabled;
  }, [soundEnabled]);

  // Sync preferences helper
  const savePreferences = (
    nextTheme: BoardThemeId,
    nextChar: 'hanzi' | 'viet',
    nextSound: boolean
  ) => {
    localStorage.setItem('xq_theme', nextTheme);
    localStorage.setItem('xq_char', nextChar);
    localStorage.setItem('xq_sound', String(nextSound));
    if (currentUser) {
      fetch('/api/auth/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser.uid,
          theme: nextTheme,
          pieceCharMode: nextChar,
          soundEnabled: nextSound,
        }),
      }).catch(() => {});
    }
  };

  // Initialize Web Worker for AI
  useEffect(() => {
    try {
      const w = new Worker(new URL('./workers/ai.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current = w;
      return () => w.terminate();
    } catch {
      workerRef.current = null;
    }
  }, []);

  const requestEngineMove = useCallback(
    (fen: string, difficulty: AIDifficulty, engineType: AIEngineType = aiEngine): Promise<{ from: Pos; to: Pos } | null> => {
      return new Promise((resolve) => {
        if (!workerRef.current) {
          const m = findBestMove(fen, difficulty, false);
          resolve(m ? { from: m.from, to: m.to } : null);
          return;
        }
        const reqId = Date.now() + Math.random();
        const handler = (e: MessageEvent) => {
          if (e.data?.id === reqId) {
            workerRef.current?.removeEventListener('message', handler);
            resolve(e.data.move ? { from: e.data.move.from, to: e.data.move.to } : null);
          }
        };
        workerRef.current.addEventListener('message', handler);
        workerRef.current.postMessage({ id: reqId, fen, difficulty, engine: engineType, isDarkXiangqi: false });
      });
    },
    [aiEngine]
  );

  // Socket.IO connection & 5s heartbeat
  useEffect(() => {
    const s = io({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    setSocket(s);

    s.on('connect', () => {
      setReconnecting(false);
      if (currentUser) {
        s.emit('auth:bind', { uid: currentUser.uid, username: currentUser.username });
      }
    });

    s.on('disconnect', () => {
      setReconnecting(true);
    });

    s.on('room:state', (roomData: any) => {
      setActiveRoom(roomData);
    });

    s.on('game:clock', (clockData: any) => {
      setActiveRoom((prev: any) => (prev ? { ...prev, ...clockData } : prev));
    });

    s.on('chat:message', (msg: any) => {
      setActiveRoom((prev: any) =>
        prev ? { ...prev, chat: [...(prev.chat || []), msg].slice(-60) } : prev
      );
    });

    s.on('room:closed', (payload: any) => {
      setActiveRoom(null);
      showToast(payload?.reason || 'Phòng đã đóng');
    });

    s.on('user:updated', (payload: any) => {
      if (payload?.user) {
        setCurrentUser(payload.user);
        localStorage.setItem('xq_user', JSON.stringify(payload.user));
        if (payload.user.isCreateAccount) {
          showToast('Tài khoản đã được duyệt đấu xếp hạng!');
        }
      }
    });

    s.on('admin:login_requests_updated', (payload: any) => {
      if (payload?.loginRequests) {
        setAdminLoginReqs(payload.loginRequests);
      }
    });

    s.on('session:kicked', (payload: any) => {
      localStorage.removeItem('xq_user');
      localStorage.removeItem('xq_session');
      setCurrentUser(null);
      setSessionId('');
      setActiveRoom(null);
      showToast(payload?.reason || 'Phiên đăng nhập đã bị thay thế');
    });

    const hb = setInterval(() => {
      if (s.connected) s.emit('ping:heartbeat');
    }, 5000);

    return () => {
      clearInterval(hb);
      s.disconnect();
    };
  }, [currentUser?.uid, showToast]);

  // Helper to persist finished AI game
  const saveGameToServer = useCallback(
    (winner: 'red' | 'black' | 'draw', reason: string, currentMoves = moves, finalFenStr = currentFen) => {
      const aiLabel = AI_LEVELS.find((l) => l.id === aiDifficulty)?.name || 'Máy';
      fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'ai',
          redUid: playerSide === 'r' ? currentUser?.uid || 'guest' : 'ai',
          redName: playerSide === 'r' ? currentUser?.username || 'Người chơi' : `AI ${aiLabel}`,
          blackUid: playerSide === 'b' ? currentUser?.uid || 'guest' : 'ai',
          blackName:
            playerSide === 'b' ? currentUser?.username || 'Người chơi' : `AI ${aiLabel}`,
          winner,
          reason,
          initialFen: INITIAL_FEN,
          finalFen: finalFenStr,
          moves: currentMoves,
        }),
      }).catch(() => {});
    },
    [aiDifficulty, currentUser, currentFen, moves, playerSide]
  );

  // Execute a move in AI mode
  const executeAIModeMove = useCallback(
    (from: Pos, to: Pos) => {
      if (gameResult.isOver) return;
      const { board: curBoard, turn: curTurn } = parseFen(currentFen);
      const notation = formatMoveNotation(curBoard, from, to);
      const { nextBoard, move } = applyMove(curBoard, from, to);
      const nextTurn: PieceColor = curTurn === 'r' ? 'b' : 'r';
      const nextFen = boardToFen(nextBoard, nextTurn);
      const gaveCheck = isKingInCheck(nextBoard, nextTurn);

      if (gaveCheck) {
        sound.playCheck();
      } else if (move.captured) {
        sound.playCapture();
      } else {
        sound.playMove();
      }

      const formatted: FormattedMove = {
        ...move,
        ply: moves.length + 1,
        color: curTurn,
        ...notation,
        fen: nextFen,
        isCheck: gaveCheck,
      };

      const nextFenHist = [...fenHistory, nextFen];
      const nextCheckHist = [...checkHistory, { color: curTurn, gaveCheck }];
      const nextMoves = [...moves, formatted];

      setFenHistory(nextFenHist);
      setCheckHistory(nextCheckHist);
      setMoves(nextMoves);
      setHintMove(null);

      const status = evaluateGameStatus(nextBoard, nextTurn, nextFenHist, nextCheckHist, false);
      if (status.isOver) {
        setGameResult(status);
        const won =
          (status.winner === 'red' && playerSide === 'r') ||
          (status.winner === 'black' && playerSide === 'b');
        sound.playGameEnd(won);

        saveGameToServer(status.winner as any, status.reason, nextMoves, nextFen);
      }
    },
    [
      gameResult.isOver,
      currentFen,
      moves,
      fenHistory,
      checkHistory,
      playerSide,
      saveGameToServer,
    ]
  );

  // Trigger AI turn when it is AI's move
  useEffect(() => {
    if (activeTab !== 'ai' || gameResult.isOver) return;
    if (turn !== playerSide) {
      setAiThinking(true);
      const timer = setTimeout(async () => {
        const best = await requestEngineMove(currentFen, aiDifficulty);
        setAiThinking(false);
        if (best) {
          executeAIModeMove(best.from, best.to);
        }
      }, 320);
      return () => clearTimeout(timer);
    }
  }, [activeTab, turn, playerSide, gameResult.isOver, currentFen, aiDifficulty, requestEngineMove, executeAIModeMove]);

  const startNewAIGame = (side: PieceColor = playerSide) => {
    setPlayerSide(side);
    setFenHistory([INITIAL_FEN]);
    setCheckHistory([]);
    setMoves([]);
    setHintMove(null);
    setGameResult({ isOver: false, winner: 'ongoing', reason: '' });
  };

  const handleUndoMove = () => {
    if (aiThinking || fenHistory.length < 3) return;
    setFenHistory((prev) => prev.slice(0, -2));
    setCheckHistory((prev) => prev.slice(0, -2));
    setMoves((prev) => prev.slice(0, -2));
    setHintMove(null);
    setGameResult({ isOver: false, winner: 'ongoing', reason: '' });
  };

  const handleHint = async () => {
    if (aiThinking || gameResult.isOver || turn !== playerSide) return;
    const best = await requestEngineMove(currentFen, 'master');
    if (best) {
      setHintMove(best);
      showToast('Đã hiển thị nước gợi ý trên bàn cờ');
    }
  };

  const handleCopyAINotation = () => {
    const aiLabel = AI_LEVELS.find((l) => l.id === aiDifficulty)?.name || 'Máy';
    const pairs: string[] = [];
    for (let i = 0; i < moves.length; i += 2) {
      const m1 = moves[i]?.wxf || '';
      const m2 = moves[i + 1]?.wxf || '';
      pairs.push(`${Math.floor(i / 2) + 1}. ${m1}${m2 ? ' ' + m2 : ''}`);
    }
    const header = [
      `[Event "Xiangqi Master - Chơi với máy"]`,
      `[Red "${playerSide === 'r' ? currentUser?.username || 'Người chơi' : `AI ${aiLabel}`}"]`,
      `[Black "${playerSide === 'b' ? currentUser?.username || 'Người chơi' : `AI ${aiLabel}`}"]`,
      `[Result "${gameResult.winner}"]`,
      `[Date "${new Date().toISOString().slice(0, 10)}"]`,
    ].join('\n');
    navigator.clipboard.writeText(`${header}\n\n${pairs.join(' ')}`);
    showToast('Đã sao chép toàn bộ kỳ phổ');
  };

  const handleLogout = async () => {
    if (currentUser) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser.uid, sessionId }),
      }).catch(() => {});
    }
    localStorage.removeItem('xq_user');
    localStorage.removeItem('xq_session');
    setCurrentUser(null);
    setSessionId('');
    setActiveRoom(null);
    if (activeTab === 'admin') setActiveTab('ai');
    showToast('Đã đăng xuất');
  };

  const lastAIMove =
    moves.length > 0 ? { from: moves[moves.length - 1].from, to: moves[moves.length - 1].to } : null;

  return (
    <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
      {/* Reconnection Banner */}
      {reconnecting && (
        <div className="w-full bg-amber-600/90 text-white text-xs font-medium py-1.5 px-4 flex items-center justify-center gap-2 z-50">
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>Đang kết nối lại…</span>
        </div>
      )}

      {/* Single-Line Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-stone-900 border border-amber-500/60 text-amber-200 text-xs font-medium shadow-2xl whitespace-nowrap">
          {toastMsg}
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3 border-b border-stone-800/80 bg-stone-950/90 backdrop-blur-xs sticky top-0 z-30">
        {/* Zone 1: Brand Wordmark & Official Logo */}
        <button
          onClick={() => {
            setActiveTab('home');
            window.history.pushState({}, '', '/');
          }}
          className="hover:opacity-95 transition-opacity shrink-0 flex items-center"
        >
          <Logo size="sm" variant="full" theme="dark" />
        </button>

        {/* Zone 2: Concise Single-Line Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth">
          <button
            onClick={() => {
              setActiveTab('home');
              window.history.pushState({}, '', '/');
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'home'
                ? 'bg-stone-800 text-amber-400 font-semibold'
                : 'text-stone-400 hover:text-stone-100'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Trang chủ</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('ai');
              window.history.pushState({}, '', '/');
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'ai'
                ? 'bg-stone-800 text-amber-400 font-semibold'
                : 'text-stone-400 hover:text-stone-100'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Chơi với máy</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('ranked');
              window.history.pushState({}, '', '/');
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'ranked'
                ? 'bg-stone-800 text-amber-400'
                : 'text-stone-400 hover:text-stone-100'
            }`}
          >
            <Swords className="w-4 h-4" />
            <span>Đấu xếp hạng</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('viewer');
              window.history.pushState({}, '', '/');
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'viewer'
                ? 'bg-stone-800 text-amber-400'
                : 'text-stone-400 hover:text-stone-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Kỳ phổ</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('leaderboard');
              window.history.pushState({}, '', '/');
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'leaderboard'
                ? 'bg-stone-800 text-amber-400'
                : 'text-stone-400 hover:text-stone-100'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Xếp hạng</span>
          </button>

          {currentUser?.role === 'admin' && (
            <button
              onClick={() => {
                setActiveTab('admin');
                window.history.pushState({}, '', '/admin');
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'admin'
                  ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40'
                  : 'text-stone-400 hover:text-stone-100'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Quản trị</span>
            </button>
          )}
        </nav>

        {/* Zone 3: Theme, Audio & Account Action */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              const next = pieceCharMode === 'hanzi' ? 'viet' : 'hanzi';
              setPieceCharMode(next);
              savePreferences(themeId, next, soundEnabled);
            }}
            title="Chuyển chữ Hán / chữ Việt trên quân cờ"
            className="min-w-[38px] min-h-[38px] px-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-xs font-bold text-amber-400 flex items-center justify-center gap-1 transition-colors"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{pieceCharMode === 'hanzi' ? '漢' : 'Việt'}</span>
          </button>

          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              savePreferences(themeId, pieceCharMode, next);
            }}
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            className="min-w-[38px] min-h-[38px] rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 flex items-center justify-center transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-stone-500" />}
          </button>

          <button
            onClick={() => setThemeDrawerOpen((o) => !o)}
            title="Đổi giao diện bàn cờ (6 chủ đề)"
            className="min-w-[38px] min-h-[38px] rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 flex items-center justify-center transition-colors"
          >
            <Palette className="w-4 h-4" />
          </button>

          {currentUser ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setAuthModalOpen(true)}
                title={
                  currentUser.isCreateAccount
                    ? 'Tài khoản đã duyệt'
                    : 'Tài khoản đang chờ quản trị viên duyệt'
                }
                className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
              >
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-stone-100">{currentUser.displayName || currentUser.username}</span>
                {!currentUser.isCreateAccount && (
                  <span className="text-[10px] text-amber-400 font-normal">· Chờ duyệt</span>
                )}
                {currentUser.role === 'admin' && (
                  <span className="text-[10px] text-amber-400/90 font-normal">· Admin</span>
                )}
              </button>
              <button
                onClick={handleLogout}
                title="Đăng xuất"
                className="min-w-[38px] min-h-[38px] rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-red-400 flex items-center justify-center transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold whitespace-nowrap transition-colors"
            >
              Đăng nhập
            </button>
          )}
        </div>
      </header>

      {/* Instant 6-Theme Swatch Bar */}
      {themeDrawerOpen && (
        <div className="bg-stone-900/95 border-b border-stone-800 px-4 py-3">
          <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-6 gap-2">
            {THEME_LIST.map((t) => {
              const active = t.id === themeId;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setThemeId(t.id);
                    savePreferences(t.id, pieceCharMode, soundEnabled);
                  }}
                  className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium transition-all ${
                    active
                      ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                      : 'border-stone-800 bg-stone-950 text-stone-300 hover:border-stone-700'
                  }`}
                >
                  <span className="flex items-center -space-x-1 shrink-0">
                    {t.swatchColors.map((col, idx) => (
                      <span
                        key={idx}
                        className="w-3.5 h-3.5 rounded-full border border-black/40"
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </span>
                  <span className="truncate">{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Area (With Full Height & Smooth Vertical Scrolling) */}
      <main className="flex-1 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center justify-start p-3 sm:p-6">
        {activeTab === 'home' && (
          <HomeView
            currentUser={currentUser}
            onNavigate={(tab) => {
              setActiveTab(tab);
              window.history.pushState({}, '', tab === 'admin' ? '/admin' : '/');
            }}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {activeTab === 'ai' && (
          <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Center Xiangqi Board */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center w-full">
              {/* Thanh tiến trình kết quả trận đấu trên đầu bàn cờ (khi kết thúc hoặc đầu hàng) */}
              {gameResult.isOver && (
                <div className="w-full mb-3 rounded-2xl bg-gradient-to-r from-stone-900 via-stone-900 to-stone-900 border-2 border-amber-500/80 p-3.5 flex items-center justify-between gap-3 shadow-2xl">
                  <div className="flex items-center gap-2.5">
                    <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-amber-300">
                        {gameResult.winner === 'red'
                          ? (playerSide === 'r' ? 'Bạn đã chiến thắng!' : 'Máy đã chiến thắng!')
                          : gameResult.winner === 'black'
                          ? (playerSide === 'b' ? 'Bạn đã chiến thắng!' : 'Máy đã chiến thắng!')
                          : 'Ván đấu hòa cờ!'}
                      </div>
                      <div className="text-xs text-stone-300">{gameResult.reason}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => startNewAIGame(playerSide)}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shrink-0 transition-colors"
                  >
                    Ván mới
                  </button>
                </div>
              )}

              <XiangqiBoard
                board={board}
                turn={turn}
                theme={currentTheme}
                pieceCharMode={pieceCharMode}
                flipped={playerSide === 'b'}
                interactive={!gameResult.isOver && !aiThinking}
                allowedColor={playerSide}
                lastMove={lastAIMove}
                hintMove={hintMove}
                onMove={executeAIModeMove}
              />

              {/* Compact Bottom Action Bar (Touch targets >= 44px) */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 bg-stone-900/90 border border-stone-800 rounded-2xl p-2 shadow-lg">
                <button
                  onClick={() => startNewAIGame(playerSide)}
                  title="Ván mới"
                  className="min-h-[44px] px-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ván mới</span>
                </button>
                <button
                  onClick={handleUndoMove}
                  disabled={fenHistory.length < 3 || aiThinking}
                  title="Đi lại nước trước"
                  className="min-h-[44px] px-3 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Đi lại</span>
                </button>
                <button
                  onClick={handleHint}
                  disabled={gameResult.isOver || aiThinking}
                  title="Gợi ý nước đi tốt nhất"
                  className="min-h-[44px] px-3 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-amber-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Gợi ý</span>
                </button>
                <button
                  onClick={() => {
                    if (!gameResult.isOver) {
                      const res = {
                        isOver: true,
                        winner: 'draw' as const,
                        reason: 'Hòa cờ theo thỏa thuận',
                      };
                      setGameResult(res);
                      sound.playGameEnd(false);
                      saveGameToServer('draw', 'Hòa cờ theo thỏa thuận');
                    }
                  }}
                  disabled={gameResult.isOver}
                  title="Xin hòa"
                  className="min-h-[44px] px-3 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Handshake className="w-3.5 h-3.5" />
                  <span>Xin hòa</span>
                </button>
                <button
                  onClick={() => {
                    if (!gameResult.isOver) {
                      const resignWinner = playerSide === 'r' ? 'black' : 'red';
                      const res = {
                        isOver: true,
                        winner: resignWinner as 'red' | 'black',
                        reason: `${playerSide === 'r' ? 'Đỏ' : 'Đen'} xin đầu hàng`,
                      };
                      setGameResult(res);
                      sound.playGameEnd(false);
                      saveGameToServer(resignWinner, `${playerSide === 'r' ? 'Đỏ' : 'Đen'} xin đầu hàng`);
                    }
                  }}
                  disabled={gameResult.isOver}
                  title="Đầu hàng"
                  className="min-h-[44px] px-3 rounded-xl bg-red-950/70 hover:bg-red-900/70 disabled:opacity-40 text-red-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Đầu hàng</span>
                </button>
                <button
                  onClick={handleCopyAINotation}
                  title="Sao chép kỳ phổ WXF"
                  className="min-h-[44px] px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép</span>
                </button>

                {/* Mobile Bottom Sheet Toggle */}
                <button
                  onClick={() => setMobileSheetOpen((v) => !v)}
                  className="lg:hidden min-h-[44px] px-3 rounded-xl bg-stone-800 text-stone-300 text-xs flex items-center gap-1"
                >
                  {mobileSheetOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  <span>Cài đặt</span>
                </button>
              </div>
            </div>

            {/* Side Panel (Desktop Column / Mobile Bottom Sheet) */}
            <div
              className={`lg:col-span-5 space-y-4 ${
                mobileSheetOpen ? 'block' : 'hidden lg:block'
              }`}
            >
              {/* Game Result Banner */}
              {gameResult.isOver && (
                <div className="rounded-2xl bg-amber-950/50 border border-amber-500/60 p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-amber-300">
                      {gameResult.winner === 'red'
                        ? 'Đỏ thắng!'
                        : gameResult.winner === 'black'
                        ? 'Đen thắng!'
                        : 'Hòa cờ!'}
                    </div>
                    <div className="text-xs text-stone-300">{gameResult.reason}</div>
                  </div>
                  <button
                    onClick={() => startNewAIGame(playerSide)}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                  >
                    Chơi lại
                  </button>
                </div>
              )}

              {/* AI Difficulty & Side Selector */}
              <div className="rounded-2xl bg-stone-900/90 border border-stone-800 p-4 space-y-4">
                {/* AI Engine Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-300">Động cơ tính toán</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      WASM Native
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {AI_ENGINES.map((eng) => {
                      const active = aiEngine === eng.id;
                      return (
                        <button
                          key={eng.id}
                          onClick={() => setAiEngine(eng.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                            active
                              ? 'bg-amber-600/20 border-amber-500 text-stone-100 shadow-sm'
                              : 'bg-stone-950/70 border-stone-800 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-semibold flex items-center gap-1.5">
                              <span>{eng.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-amber-400 border border-stone-700">
                                {eng.badge}
                              </span>
                            </div>
                            <div className="text-[11px] text-stone-400 mt-0.5">{eng.desc}</div>
                          </div>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${
                            active ? 'border-amber-400 bg-amber-400' : 'border-stone-600'
                          }`}>
                            {active && <div className="w-1.5 h-1.5 rounded-full bg-stone-950" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-semibold text-stone-300">Cấp độ máy</span>
                  <span className="text-xs text-stone-400 font-mono-num">
                    {aiThinking ? 'Máy đang nghĩ…' : `Lượt: ${turn === 'r' ? 'Đỏ' : 'Đen'}`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {AI_LEVELS.map((lvl) => {
                    const active = aiDifficulty === lvl.id;
                    return (
                      <button
                        key={lvl.id}
                        onClick={() => setAiDifficulty(lvl.id)}
                        className={`p-3 rounded-xl border text-left transition-colors ${
                          active
                            ? 'bg-amber-600/20 border-amber-500 text-stone-100'
                            : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        <div className="text-xs font-semibold">{lvl.name}</div>
                        <div className="text-[11px] font-mono-num text-amber-400/90">
                          Elo {lvl.eloLabel}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Side Picker (Red / Black) */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-semibold text-stone-300">Chọn quân</span>
                  <div className="flex items-center gap-1.5 bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs">
                    <button
                      onClick={() => startNewAIGame('r')}
                      className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors ${
                        playerSide === 'r'
                          ? 'bg-red-700 text-white'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      Đỏ (Đi tiên)
                    </button>
                    <button
                      onClick={() => startNewAIGame('b')}
                      className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors ${
                        playerSide === 'b'
                          ? 'bg-stone-700 text-white'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      Đen (Đi hậu)
                    </button>
                  </div>
                </div>
              </div>

              {/* Live WXF / Viet Notation List */}
              <div className="rounded-2xl bg-stone-900/90 border border-stone-800 p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-300">
                    Kỳ phổ ({moves.length} nước)
                  </span>
                  <button
                    onClick={handleCopyAINotation}
                    className="text-amber-400 hover:underline font-medium"
                  >
                    Sao chép WXF
                  </button>
                </div>

                <div className="h-48 overflow-y-auto rounded-xl bg-stone-950/80 border border-stone-800/80 p-2.5 grid grid-cols-2 gap-1 text-xs font-mono-num content-start">
                  {moves.map((m, idx) => (
                    <div
                      key={m.ply}
                      className="px-2 py-1 rounded bg-stone-900/70 text-stone-200 truncate"
                      title={`ICCS: ${m.iccs} | FEN: ${m.fen}`}
                    >
                      <span className="text-stone-500 mr-1">
                        {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}.` : '...'}
                      </span>
                      <span className="font-semibold text-amber-300">{m.wxf}</span>{' '}
                      <span className="font-sans text-[11px] text-stone-400">({m.viet})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ranked' && (
          <RankedRoomView
            socket={socket}
            currentUser={currentUser}
            theme={currentTheme}
            pieceCharMode={pieceCharMode}
            activeRoom={activeRoom}
            setActiveRoom={setActiveRoom}
            onOpenAuth={() => setAuthModalOpen(true)}
            onToast={showToast}
          />
        )}

        {activeTab === 'viewer' && (
          <NotationViewerView
            theme={currentTheme}
            pieceCharMode={pieceCharMode}
            uid={currentUser?.uid}
            initialPgnText={viewerInitialPgn}
            onToast={showToast}
          />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardView
            onOpenViewer={(txt) => {
              setViewerInitialPgn(txt);
              setActiveTab('viewer');
              showToast('Đã mở ván đấu trong trình xem kỳ phổ');
            }}
          />
        )}

        {activeTab === 'admin' &&
          (currentUser?.role === 'admin' ? (
            <AdminDashboardView
              adminUid={currentUser.uid}
              incomingLoginRequests={adminLoginReqs}
              onToast={showToast}
            />
          ) : (
            <div className="py-16 text-center space-y-3">
              <ShieldCheck className="w-8 h-8 text-amber-500 mx-auto stroke-1" />
              <div className="text-sm text-stone-400">Chỉ dành cho Quản trị viên</div>
              <button
                onClick={() => setAuthModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold"
              >
                Đăng nhập Admin
              </button>
            </div>
          ))}
      </main>

      {/* Auth Modal (4 tabs + 3-step _resetacc concurrent login flow) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        currentUser={currentUser}
        onAuthSuccess={(user, sess, decayNotice) => {
          setCurrentUser(user);
          setSessionId(sess);
          localStorage.setItem('xq_user', JSON.stringify(user));
          localStorage.setItem('xq_session', sess);
          if (user.theme && BOARD_THEMES[user.theme as BoardThemeId]) {
            setThemeId(user.theme as BoardThemeId);
          }
          if (user.pieceCharMode) setPieceCharMode(user.pieceCharMode);
          if (typeof user.soundEnabled === 'boolean') setSoundEnabled(user.soundEnabled);
          if (socket) {
            socket.emit('auth:bind', { uid: user.uid, username: user.username });
          }
          if (decayNotice) {
            setTimeout(() => showToast(decayNotice), 600);
          }
        }}
        onToast={showToast}
      />
    </div>
  );
}
