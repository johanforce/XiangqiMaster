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
  Library,
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
import { LibraryView } from './components/LibraryView';
import { Logo } from './components/Logo';
import {
  MainTab,
  navigateUrl,
  handleLinkClick,
  getMainTabFromPath,
} from './utils/navigation';

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
    getMainTabFromPath(window.location.pathname)
  );
  const [viewerInitialPgn, setViewerInitialPgn] = useState<string>('');

  // User & Session state (persisted in localStorage so page reload keeps login session, verified in realtime)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('xq_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [sessionId, setSessionId] = useState<string>(() => {
    try {
      return localStorage.getItem('xq_session') || '';
    } catch {
      return '';
    }
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Preferences
  const [themeId, setThemeId] = useState<BoardThemeId>(() => {
    try {
      const saved = localStorage.getItem('xq_theme') as BoardThemeId;
      if (saved && BOARD_THEMES[saved]) return saved;
    } catch {
      // Ignore
    }
    return 'classic_wood';
  });
  const [pieceCharMode, setPieceCharMode] = useState<'hanzi' | 'viet'>(() => {
    try {
      const saved = localStorage.getItem('xq_char');
      if (saved === 'hanzi' || saved === 'viet') return saved;
    } catch {
      // Ignore
    }
    return 'hanzi';
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('xq_sound');
      if (saved !== null) return saved === 'true';
    } catch {
      // Ignore
    }
    return true;
  });
  const [themeDrawerOpen, setThemeDrawerOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Sync auth & preferences state to localStorage so reload preserves login
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem('xq_user', JSON.stringify(currentUser));
      } else {
        localStorage.removeItem('xq_user');
      }
    } catch {
      // Ignore storage errors
    }
  }, [currentUser]);

  useEffect(() => {
    try {
      if (sessionId) {
        localStorage.setItem('xq_session', sessionId);
      } else {
        localStorage.removeItem('xq_session');
      }
    } catch {
      // Ignore storage errors
    }
  }, [sessionId]);

  useEffect(() => {
    try {
      localStorage.setItem('xq_theme', themeId);
      localStorage.setItem('xq_char', pieceCharMode);
      localStorage.setItem('xq_sound', String(soundEnabled));
    } catch {
      // Ignore storage errors
    }
  }, [themeId, pieceCharMode, soundEnabled]);

  // 1-line Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  // Realtime fetch of current user profile & preferences from API on reload, tab switch, or modal toggle
  const refreshCurrentUserRealtime = useCallback(
    async (uid: string, currentSessId?: string) => {
      if (!uid) return;
      try {
        const query = currentSessId ? `?sessionId=${encodeURIComponent(currentSessId)}` : '';
        const res = await fetch(`/api/auth/me/${encodeURIComponent(uid)}${query}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403 || res.status === 404) {
            setCurrentUser(null);
            setSessionId('');
            setActiveRoom(null);
            try {
              localStorage.removeItem('xq_user');
              localStorage.removeItem('xq_session');
            } catch {
              // Ignore
            }
          }
          return;
        }
        const data = await res.json();
        if (data?.user) {
          setCurrentUser(data.user);
          if (data.user.activeSessionId && !currentSessId) {
            setSessionId(data.user.activeSessionId);
          }
          if (data.user.theme && BOARD_THEMES[data.user.theme as BoardThemeId]) {
            setThemeId(data.user.theme as BoardThemeId);
          }
          if (data.user.pieceCharMode) {
            setPieceCharMode(data.user.pieceCharMode);
          }
          if (typeof data.user.soundEnabled === 'boolean') {
            setSoundEnabled(data.user.soundEnabled);
          }
        }
      } catch {
        // Ignore transient network errors
      }
    },
    []
  );

  useEffect(() => {
    if (currentUser?.uid) {
      void refreshCurrentUserRealtime(currentUser.uid, sessionId || currentUser.activeSessionId);
    }
  }, [activeTab, authModalOpen, currentUser?.uid, sessionId, refreshCurrentUserRealtime]);

  // Socket & Realtime state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [activeRoom, setActiveRoom] = useState<any | null>(null);
  const [adminLoginReqs, setAdminLoginReqs] = useState<any[] | null>(null);

  // AI Match State (synced with URL query params when on /ai or /ai/play)
  const [aiScreenState, setAiScreenState] = useState<'setup' | 'playing'>(() =>
    window.location.pathname.startsWith('/ai/play') ? 'playing' : 'setup'
  );
  const [aiEngine, setAiEngine] = useState<AIEngineType>(() => {
    const p = new URLSearchParams(window.location.search).get('engine');
    return p === 'pikafish' || p === 'builtin' || p === 'fairy_stockfish' ? p : 'fairy_stockfish';
  });
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>(() => {
    const p = new URLSearchParams(window.location.search).get('level');
    return p === 'novice' || p === 'veteran' || p === 'master' || p === 'grandmaster'
      ? p
      : 'veteran';
  });
  const [playerSide, setPlayerSide] = useState<PieceColor>(() => {
    const p = new URLSearchParams(window.location.search).get('side');
    return p === 'b' ? 'b' : 'r';
  });
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

  // Sync activeTab & AI query params with URL changes (popstate + app:locationchange)
  useEffect(() => {
    const syncFromUrl = () => {
      const nextTab = getMainTabFromPath(window.location.pathname);
      setActiveTab(nextTab);
      if (nextTab === 'ai') {
        const isPlayScreen = window.location.pathname.startsWith('/ai/play');
        setAiScreenState(isPlayScreen ? 'playing' : 'setup');
        const params = new URLSearchParams(window.location.search);
        const eng = params.get('engine');
        if (eng === 'fairy_stockfish' || eng === 'pikafish' || eng === 'builtin') {
          setAiEngine(eng);
        }
        const lvl = params.get('level');
        if (lvl === 'novice' || lvl === 'veteran' || lvl === 'master' || lvl === 'grandmaster') {
          setAiDifficulty(lvl);
        }
        const side = params.get('side');
        if (side === 'r' || side === 'b') {
          setPlayerSide(side);
        }
      }
    };
    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('app:locationchange', syncFromUrl);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('app:locationchange', syncFromUrl);
    };
  }, []);

  const workerRef = useRef<Worker | null>(null);
  const currentFen = fenHistory[fenHistory.length - 1];
  const { board, turn } = parseFen(currentFen);
  const currentTheme = BOARD_THEMES[themeId] || BOARD_THEMES.classic_wood;

  useEffect(() => {
    sound.enabled = soundEnabled;
  }, [soundEnabled]);

  // Sync preferences helper via realtime API call (no localStorage cache)
  const savePreferences = (
    nextTheme: BoardThemeId,
    nextChar: 'hanzi' | 'viet',
    nextSound: boolean
  ) => {
    if (currentUser) {
      fetch('/api/auth/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
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
        let settled = false;
        const reqId = Date.now() + Math.random();
        const fallbackTimer = setTimeout(() => {
          if (settled) return;
          settled = true;
          workerRef.current?.removeEventListener('message', handler);
          const m = findBestMove(fen, difficulty, false);
          resolve(m ? { from: m.from, to: m.to } : null);
        }, 3500);

        const handler = (e: MessageEvent) => {
          if (e.data?.id === reqId && !settled) {
            settled = true;
            clearTimeout(fallbackTimer);
            workerRef.current?.removeEventListener('message', handler);
            if (e.data.move?.from && e.data.move?.to) {
              resolve({ from: e.data.move.from, to: e.data.move.to });
            } else {
              const m = findBestMove(fen, difficulty, false);
              resolve(m ? { from: m.from, to: m.to } : null);
            }
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
        prev ? { ...prev, chat: [...(prev.chat || []), msg].slice(-300) } : prev
      );
    });

    s.on('room:closed', (payload: any) => {
      setActiveRoom(null);
      showToast(payload?.reason || 'Phòng đã đóng');
    });

    s.on('user:updated', (payload: any) => {
      if (payload?.user) {
        setCurrentUser(payload.user);
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
      setCurrentUser(null);
      setSessionId('');
      setActiveRoom(null);
      try {
        localStorage.removeItem('xq_user');
        localStorage.removeItem('xq_session');
      } catch {
        // Ignore
      }
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

  // AI games are local practice matches and are never uploaded to the database
  const saveGameToServer = useCallback(
    (_winner: 'red' | 'black' | 'draw', _reason: string, _currentMoves = moves, _finalFenStr = currentFen) => {
      // No-op: AI matches must not be saved to database even when logged in
    },
    [currentFen, moves]
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
      }
    },
    [
      gameResult.isOver,
      currentFen,
      moves,
      fenHistory,
      checkHistory,
      playerSide,
    ]
  );

  // Trigger AI turn when it is AI's move (only when inside the 'playing' screen)
  useEffect(() => {
    if (activeTab !== 'ai' || aiScreenState !== 'playing' || gameResult.isOver) return;
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
  }, [
    activeTab,
    aiScreenState,
    turn,
    playerSide,
    gameResult.isOver,
    currentFen,
    aiDifficulty,
    requestEngineMove,
    executeAIModeMove,
  ]);

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
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser.uid, sessionId }),
      }).catch(() => {});
    }
    setCurrentUser(null);
    setSessionId('');
    setActiveRoom(null);
    try {
      localStorage.removeItem('xq_user');
      localStorage.removeItem('xq_session');
    } catch {
      // Ignore
    }
    if (activeTab === 'admin') {
      navigateUrl('/ai');
    }
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

      {/* Top Navigation Bar: Ẩn thanh header chính khi ở trong phòng chờ / trận đấu xếp hạng để tập trung, tránh bấm tab gây lỗi */}
      {!(activeTab === 'ranked' && activeRoom) ? (
        <header className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3 border-b border-stone-800/80 bg-stone-950/90 backdrop-blur-xs sticky top-0 z-30">
          {/* Zone 1: Brand Wordmark & Official Logo */}
          <a
            href="/"
            onClick={(e) => handleLinkClick(e, '/')}
            className="hover:opacity-95 transition-opacity shrink-0 flex items-center"
          >
            <Logo size="sm" variant="full" theme="dark" />
          </a>

          {/* Zone 2: Concise Single-Line Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth">
            <a
              href="/"
              onClick={(e) => handleLinkClick(e, '/')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'home'
                  ? 'bg-stone-800 text-amber-400 font-semibold'
                  : 'text-stone-400 hover:text-stone-100'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Trang chủ</span>
            </a>

            <a
              href={`/ai?engine=${aiEngine}&level=${aiDifficulty}&side=${playerSide}`}
              onClick={(e) =>
                handleLinkClick(e, `/ai?engine=${aiEngine}&level=${aiDifficulty}&side=${playerSide}`)
              }
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'ai'
                  ? 'bg-stone-800 text-amber-400 font-semibold'
                  : 'text-stone-400 hover:text-stone-100'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>Chơi với máy</span>
            </a>

            <a
              href={activeRoom?.code ? `/ranked/room/${activeRoom.code}` : '/ranked'}
              onClick={(e) =>
                handleLinkClick(
                  e,
                  activeRoom?.code ? `/ranked/room/${activeRoom.code}` : '/ranked'
                )
              }
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'ranked'
                  ? 'bg-stone-800 text-amber-400 font-semibold'
                  : 'text-stone-400 hover:text-stone-100'
              }`}
            >
              <Swords className="w-4 h-4" />
              <span>Đấu xếp hạng</span>
            </a>

            <a
              href="/viewer"
              onClick={(e) => handleLinkClick(e, '/viewer')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'viewer'
                  ? 'bg-stone-800 text-amber-400 font-semibold'
                  : 'text-stone-400 hover:text-stone-100'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Kỳ phổ</span>
            </a>

            <a
              href="/library"
              onClick={(e) => handleLinkClick(e, '/library')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'library'
                  ? 'bg-stone-800 text-amber-400 font-semibold'
                  : 'text-stone-400 hover:text-stone-100'
              }`}
            >
              <Library className="w-4 h-4" />
              <span>Tàng thư</span>
            </a>

            <a
              href="/leaderboard"
              onClick={(e) => handleLinkClick(e, '/leaderboard')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'leaderboard'
                  ? 'bg-stone-800 text-amber-400 font-semibold'
                  : 'text-stone-400 hover:text-stone-100'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Xếp hạng</span>
            </a>

            {currentUser?.role === 'admin' && (
              <a
                href="/admin/users"
                onClick={(e) => handleLinkClick(e, '/admin/users')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'admin'
                    ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-stone-400 hover:text-stone-100'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Quản trị</span>
              </a>
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
      ) : (
        /* 2 icon âm thanh và theme ở góc khi ở trong phòng chờ hoặc trong trận đấu */
        <div className="fixed top-3 right-4 z-40 flex items-center gap-2">
          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              savePreferences(themeId, pieceCharMode, next);
            }}
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            className="w-10 h-10 rounded-xl bg-stone-900/95 hover:bg-stone-800 border border-stone-800 text-stone-200 flex items-center justify-center shadow-xl backdrop-blur-md transition-colors"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-amber-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-stone-500" />
            )}
          </button>

          <button
            onClick={() => setThemeDrawerOpen((o) => !o)}
            title="Đổi giao diện bàn cờ (6 chủ đề)"
            className="w-10 h-10 rounded-xl bg-stone-900/95 hover:bg-stone-800 border border-stone-800 text-amber-400 flex items-center justify-center shadow-xl backdrop-blur-md transition-colors"
          >
            <Palette className="w-4 h-4" />
          </button>
        </div>
      )}

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
              const targetMap: Record<MainTab, string> = {
                home: '/',
                ai: `/ai?engine=${aiEngine}&level=${aiDifficulty}&side=${playerSide}`,
                ranked: '/ranked',
                viewer: '/viewer',
                library: '/library',
                leaderboard: '/leaderboard',
                admin: '/admin/users',
              };
              navigateUrl(targetMap[tab] || '/');
            }}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {activeTab === 'ai' &&
          (aiScreenState === 'setup' ? (
            /* SCREEN 1: PRE-GAME AI SETTINGS */
            <div className="w-full max-w-4xl mx-auto space-y-6 py-2">
              <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-stone-900 shadow-2xl p-6 sm:p-8">
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-25 pointer-events-none"
                  style={{ backgroundImage: `url('/images/ranked_duel_stage.jpg')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-stone-950 via-stone-950/90 to-stone-900/75 pointer-events-none" />

                <div className="relative z-10 space-y-6">
                  {/* Title Header */}
                  <div className="space-y-2 border-b border-stone-800 pb-5">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                      <Bot className="w-3.5 h-3.5" />
                      <span>Thiết Lập Trận Đấu Với Máy (AI)</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-display font-bold text-stone-100">
                      Cấu Hình Đối Thủ AI Trước Khi Vào Trận
                    </h1>
                    <p className="text-xs sm:text-sm text-stone-400">
                      Lựa chọn động cơ tính toán, cấp độ kỳ lực và màu quân bạn muốn cầm trước khi bắt đầu ván cờ.
                    </p>
                  </div>

                  {/* Step 1: Engine Selection */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs sm:text-sm font-bold text-stone-200 uppercase tracking-wider">
                        1. Chọn Động Cơ Tính Toán (AI Engine)
                      </label>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                        100% WebAssembly
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {AI_ENGINES.map((eng) => {
                        const active = aiEngine === eng.id;
                        const targetUrl = `/ai?engine=${eng.id}&level=${aiDifficulty}&side=${playerSide}`;
                        return (
                          <a
                            key={eng.id}
                            href={targetUrl}
                            onClick={(e) =>
                              handleLinkClick(e, targetUrl, () => setAiEngine(eng.id))
                            }
                            className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                              active
                                ? 'bg-amber-600/20 border-amber-500 text-stone-100 shadow-lg ring-1 ring-amber-500/50'
                                : 'bg-stone-950/80 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-bold text-stone-100">
                                  {eng.name}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-stone-800 text-amber-400 border border-stone-700 font-semibold shrink-0">
                                  {eng.badge}
                                </span>
                              </div>
                              <p className="text-xs text-stone-400 leading-relaxed">{eng.desc}</p>
                            </div>
                            <div className="mt-4 pt-2.5 border-t border-stone-800/70 flex items-center justify-between text-[11px]">
                              <span className={active ? 'text-amber-300 font-semibold' : 'text-stone-500'}>
                                {active ? 'Đang chọn' : 'Bấm để chọn'}
                              </span>
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  active ? 'border-amber-400 bg-amber-400' : 'border-stone-600'
                                }`}
                              >
                                {active && <div className="w-1.5 h-1.5 rounded-full bg-stone-950" />}
                              </div>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: Difficulty Level Selection */}
                  <div className="space-y-3">
                    <label className="block text-xs sm:text-sm font-bold text-stone-200 uppercase tracking-wider">
                      2. Chọn Cấp Độ Kỳ Lực
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {AI_LEVELS.map((lvl) => {
                        const active = aiDifficulty === lvl.id;
                        const targetUrl = `/ai?engine=${aiEngine}&level=${lvl.id}&side=${playerSide}`;
                        return (
                          <a
                            key={lvl.id}
                            href={targetUrl}
                            onClick={(e) =>
                              handleLinkClick(e, targetUrl, () => setAiDifficulty(lvl.id))
                            }
                            className={`p-4 rounded-2xl border text-left transition-all ${
                              active
                                ? 'bg-amber-600/20 border-amber-500 text-stone-100 shadow-lg ring-1 ring-amber-500/50'
                                : 'bg-stone-950/80 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                            }`}
                          >
                            <div className="text-sm font-bold text-stone-100">{lvl.name}</div>
                            <div className="text-xs font-mono-num text-amber-400 mt-1 font-semibold">
                              Elo {lvl.eloLabel}
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 3: Side & Board Preview Settings */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-2.5">
                      <label className="block text-xs sm:text-sm font-bold text-stone-200 uppercase tracking-wider">
                        3. Chọn Phe Cầm Quân
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <a
                          href={`/ai?engine=${aiEngine}&level=${aiDifficulty}&side=r`}
                          onClick={(e) =>
                            handleLinkClick(
                              e,
                              `/ai?engine=${aiEngine}&level=${aiDifficulty}&side=r`,
                              () => setPlayerSide('r')
                            )
                          }
                          className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                            playerSide === 'r'
                              ? 'bg-red-900/40 border-red-500 text-red-200 shadow-md'
                              : 'bg-stone-950/80 border-stone-800 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          <span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block" />
                          <span>Quân Đỏ (Đi tiên)</span>
                        </a>
                        <a
                          href={`/ai?engine=${aiEngine}&level=${aiDifficulty}&side=b`}
                          onClick={(e) =>
                            handleLinkClick(
                              e,
                              `/ai?engine=${aiEngine}&level=${aiDifficulty}&side=b`,
                              () => setPlayerSide('b')
                            )
                          }
                          className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                            playerSide === 'b'
                              ? 'bg-stone-800 border-amber-400 text-stone-100 shadow-md'
                              : 'bg-stone-950/80 border-stone-800 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          <span className="w-3.5 h-3.5 rounded-full bg-stone-950 border border-amber-400 inline-block" />
                          <span>Quân Đen (Đi hậu)</span>
                        </a>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <label className="block text-xs sm:text-sm font-bold text-stone-200 uppercase tracking-wider">
                        4. Kiểu Chữ Trên Quân Cờ
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPieceCharMode('hanzi');
                            savePreferences(themeId, 'hanzi', soundEnabled);
                          }}
                          className={`p-3.5 rounded-2xl border font-bold text-xs transition-all ${
                            pieceCharMode === 'hanzi'
                              ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                              : 'bg-stone-950/80 border-stone-800 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          Chữ Hán (帥 · 將)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPieceCharMode('viet');
                            savePreferences(themeId, 'viet', soundEnabled);
                          }}
                          className={`p-3.5 rounded-2xl border font-bold text-xs transition-all ${
                            pieceCharMode === 'viet'
                              ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                              : 'bg-stone-950/80 border-stone-800 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          Chữ Việt (Tướng · Sĩ)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Start Game Primary CTA */}
                  <div className="pt-4 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs text-stone-400">
                      Cấu hình đã chọn:{' '}
                      <span className="text-amber-300 font-semibold">
                        {AI_ENGINES.find((e) => e.id === aiEngine)?.name}
                      </span>{' '}
                      ·{' '}
                      <span className="text-stone-200 font-semibold">
                        {AI_LEVELS.find((l) => l.id === aiDifficulty)?.name}
                      </span>{' '}
                      ·{' '}
                      <span className="text-stone-200 font-semibold">
                        {playerSide === 'r' ? 'Cầm Đỏ (Đi tiên)' : 'Cầm Đen (Đi hậu)'}
                      </span>
                    </div>

                    <a
                      href={`/ai/play?engine=${aiEngine}&level=${aiDifficulty}&side=${playerSide}`}
                      onClick={(e) =>
                        handleLinkClick(
                          e,
                          `/ai/play?engine=${aiEngine}&level=${aiDifficulty}&side=${playerSide}`,
                          () => {
                            startNewAIGame(playerSide);
                            setAiScreenState('playing');
                          }
                        )
                      }
                      className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-bold text-sm shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all flex items-center justify-center gap-2.5 transform hover:-translate-y-0.5"
                    >
                      <Swords className="w-4 h-4" />
                      <span>Bắt Đầu Chơi Ngay</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* SCREEN 2: PLAYING GAME WITH AI */
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
                            ? playerSide === 'r'
                              ? 'Bạn đã chiến thắng!'
                              : 'Máy đã chiến thắng!'
                            : gameResult.winner === 'black'
                            ? playerSide === 'b'
                              ? 'Bạn đã chiến thắng!'
                              : 'Máy đã chiến thắng!'
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
                  <a
                    href={`/ai?engine=${aiEngine}&level=${aiDifficulty}&side=${playerSide}`}
                    onClick={(e) =>
                      handleLinkClick(
                        e,
                        `/ai?engine=${aiEngine}&level=${aiDifficulty}&side=${playerSide}`,
                        () => setAiScreenState('setup')
                      )
                    }
                    title="Quay lại màn Cài đặt"
                    className="min-h-[44px] px-3.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <span>⚙ Cài đặt</span>
                  </a>
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
                        saveGameToServer(
                          resignWinner,
                          `${playerSide === 'r' ? 'Đỏ' : 'Đen'} xin đầu hàng`
                        );
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
                    {mobileSheetOpen ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronUp className="w-4 h-4" />
                    )}
                    <span>Thông tin</span>
                  </button>
                </div>
              </div>

              {/* Side Panel (Desktop Column / Mobile Bottom Sheet) */}
              <div
                className={`lg:col-span-5 space-y-4 ${
                  mobileSheetOpen ? 'block' : 'hidden lg:block'
                }`}
              >
                {/* Current AI Match Info Card + Button to Return to Pre-Game Settings */}
                <div className="rounded-2xl bg-stone-900/90 border border-stone-800 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-stone-100 uppercase tracking-wider">
                        Thông Tin Trận Đấu Với Máy
                      </span>
                    </div>
                    <a
                      href={`/ai?engine=${aiEngine}&level=${aiDifficulty}&side=${playerSide}`}
                      onClick={(e) =>
                        handleLinkClick(
                          e,
                          `/ai?engine=${aiEngine}&level=${aiDifficulty}&side=${playerSide}`,
                          () => setAiScreenState('setup')
                        )
                      }
                      className="px-3 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-semibold transition-colors"
                    >
                      Đổi cài đặt
                    </a>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800/80">
                      <div className="text-[10px] text-stone-500">Động cơ</div>
                      <div className="font-semibold text-stone-200 truncate mt-0.5">
                        {AI_ENGINES.find((e) => e.id === aiEngine)?.name}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800/80">
                      <div className="text-[10px] text-stone-500">Cấp độ</div>
                      <div className="font-semibold text-amber-300 mt-0.5">
                        {AI_LEVELS.find((l) => l.id === aiDifficulty)?.name} (
                        {AI_LEVELS.find((l) => l.id === aiDifficulty)?.eloLabel})
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800/80">
                      <div className="text-[10px] text-stone-500">Trạng thái</div>
                      <div className="font-semibold text-stone-200 mt-0.5">
                        {aiThinking ? 'Máy đang nghĩ…' : `Lượt: ${turn === 'r' ? 'Đỏ' : 'Đen'}`}
                      </div>
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

                  <div className="h-64 max-h-64 overflow-y-auto overscroll-contain rounded-xl bg-stone-950/80 border border-stone-800/80 p-2.5 text-xs font-mono-num">
                    {moves.length === 0 ? (
                      <div className="h-full flex items-center justify-center py-12 text-center text-stone-500 font-sans">
                        Hãy đi nước cờ đầu tiên để bắt đầu ghi biên bản...
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5 auto-rows-max content-start">
                        {moves.map((m, idx) => (
                          <div
                            key={m.ply}
                            className="min-h-[32px] shrink-0 flex items-center px-2.5 py-1.5 rounded-lg bg-stone-900/70 text-stone-200 truncate"
                            title={`ICCS: ${m.iccs} | FEN: ${m.fen}`}
                          >
                            <span className="text-stone-500 mr-1.5 shrink-0">
                              {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}.` : '...'}
                            </span>
                            <span className="font-semibold text-amber-300 shrink-0">{m.wxf}</span>
                            <span className="font-sans text-[11px] text-stone-400 truncate ml-1">
                              ({m.viet})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))},

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

        {activeTab === 'library' && (
          <LibraryView
            theme={currentTheme}
            pieceCharMode={pieceCharMode}
            isAdmin={currentUser?.role === 'admin'}
            onToast={showToast}
          />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardView
            onOpenViewer={(txt) => {
              setViewerInitialPgn(txt);
              navigateUrl('/viewer');
              showToast('Đã mở ván đấu trong trình xem kỳ phổ');
            }}
          />
        )}

        {activeTab === 'admin' &&
          (currentUser?.role === 'admin' ? (
            <AdminDashboardView
              adminUid={currentUser.uid}
              theme={currentTheme}
              pieceCharMode={pieceCharMode}
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
