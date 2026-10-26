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
  Zap,
  X,
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
import { AIEngineType, findBestMove } from './workers/ai.worker';
import { XiangqiBoard } from './components/XiangqiBoard';
import { AuthModal, UserProfile } from './components/AuthModal';
import { NotationViewerView } from './components/NotationViewerView';
import { LeaderboardView } from './components/LeaderboardView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { RankedRoomView, parseRoomCodeFromPath } from './components/RankedRoomView';
import { HomeView } from './components/HomeView';
import { LibraryView } from './components/LibraryView';
import { Logo } from './components/Logo';
import { ServerEnvSwitcher } from './components/ServerEnvSwitcher';
import { StagingPasswordModal } from './components/StagingPasswordModal';
import {
  ServerEnv,
  getServerEnv,
  setServerEnv,
  getStoredUserForEnv,
  setStoredUserForEnv,
  getStoredSessionForEnv,
  setStoredSessionForEnv,
  SERVER_ENV_CONFIG,
  isStagingUnlocked,
} from './utils/serverEnv';
import {
  MainTab,
  navigateUrl,
  handleLinkClick,
  getMainTabFromPath,
} from './utils/navigation';

const AI_ENGINES: { id: AIEngineType; name: string; desc: string; badge: string; highlight: string }[] = [
  {
    id: 'fairy_stockfish',
    name: 'Fairy-Stockfish WASM',
    desc: 'Động cơ cờ tướng đa biến quốc tế chuẩn NNUE & Alpha-Beta, kỳ lực tối thượng',
    badge: 'Quốc Tế',
    highlight: 'Kiểm soát thế trận vững chắc, tính toán sâu sắc và chuẩn xác',
  },
  {
    id: 'pikafish',
    name: 'Pikafish NNUE',
    desc: 'Động cơ chuyên biệt cờ tướng số 1 thế giới, thế cờ sắc bén và hiểm hóc nhất',
    badge: 'Vô Địch',
    highlight: 'Sát lực vô song, tư duy chiến thuật đỉnh cao không thể lay chuyển',
  },
];

export default function App() {
  const [serverEnv, setServerEnvState] = useState<ServerEnv>(() => getServerEnv());
  const [activeTab, setActiveTab] = useState<MainTab>(() =>
    getMainTabFromPath(window.location.pathname)
  );
  const [viewerInitialPgn, setViewerInitialPgn] = useState<string>('');

  // User & Session state (persisted in localStorage per server environment)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    return getStoredUserForEnv(getServerEnv());
  });
  const [sessionId, setSessionId] = useState<string>(() => {
    return getStoredSessionForEnv(getServerEnv());
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

  // Sync auth & preferences state to localStorage per server environment
  useEffect(() => {
    setStoredUserForEnv(serverEnv, currentUser);
  }, [currentUser, serverEnv]);

  useEffect(() => {
    setStoredSessionForEnv(serverEnv, sessionId);
  }, [sessionId, serverEnv]);

  const [stagingPasswordModalOpen, setStagingPasswordModalOpen] = useState(false);

  const proceedSwitchEnv = (newEnv: ServerEnv) => {
    setStoredUserForEnv(serverEnv, currentUser);
    setStoredSessionForEnv(serverEnv, sessionId);

    setServerEnv(newEnv);
    setServerEnvState(newEnv);

    const nextUser = getStoredUserForEnv(newEnv);
    const nextSession = getStoredSessionForEnv(newEnv);
    setCurrentUser(nextUser);
    setSessionId(nextSession);
    setActiveRoom(null);

    showToast(`Đã chuyển sang ${SERVER_ENV_CONFIG[newEnv].fullName}`);
  };

  const handleServerEnvChange = (newEnv: ServerEnv) => {
    if (newEnv === serverEnv) return;
    if (newEnv === 'staging' && !isStagingUnlocked()) {
      setStagingPasswordModalOpen(true);
      return;
    }
    proceedSwitchEnv(newEnv);
  };

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const wantsStaging =
        urlParams.get('env') === 'staging' ||
        localStorage.getItem('xq_server_env') === 'staging';
      if (wantsStaging && !isStagingUnlocked()) {
        setStagingPasswordModalOpen(true);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      const newEnv = e.detail?.env;
      if (newEnv && newEnv !== serverEnv) {
        handleServerEnvChange(newEnv);
      }
    };
    window.addEventListener('app:serverenvchange', handler);
    return () => window.removeEventListener('app:serverenvchange', handler);
  }, [serverEnv, currentUser, sessionId]);

  useEffect(() => {
    try {
      localStorage.setItem('xq_theme', themeId);
      localStorage.setItem('xq_char', pieceCharMode);
      localStorage.setItem('xq_sound', String(soundEnabled));
    } catch {
      // Ignore storage errors
    }
  }, [themeId, pieceCharMode, soundEnabled]);

  useEffect(() => {
    fetch(`/api/system/theme?env=${serverEnv}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.theme && BOARD_THEMES[data.theme as BoardThemeId]) {
          setThemeId(data.theme as BoardThemeId);
        }
      })
      .catch(() => {});
  }, [serverEnv]);

  // 1-line Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  const handleApplyGlobalTheme = useCallback(
    async (newThemeId: BoardThemeId) => {
      setThemeId(newThemeId);
      if (currentUser?.role === 'admin') {
        try {
          const res = await fetch('/api/admin/theme', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-uid': currentUser.uid,
            },
            body: JSON.stringify({ theme: newThemeId }),
          });
          const data = await res.json();
          if (res.ok) {
            showToast(`Đã áp dụng giao diện "${BOARD_THEMES[newThemeId].name}" cho toàn bộ hệ thống!`);
          } else {
            showToast(data.error || 'Lỗi cập nhật giao diện');
          }
        } catch {
          showToast('Lỗi kết nối khi cập nhật giao diện');
        }
      }
    },
    [currentUser?.role, currentUser?.uid, showToast]
  );

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
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeRoom, setActiveRoom] = useState<any | null>(null);
  const currentUserRef = useRef<UserProfile | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);
  const activeRoomRef = useRef<any | null>(activeRoom);
  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);
  const [adminLoginReqs, setAdminLoginReqs] = useState<any[] | null>(null);

  // AI Match State (synced with URL query params when on /ai or /ai/play)
  const [aiScreenState, setAiScreenState] = useState<'setup' | 'playing'>(() =>
    window.location.pathname.startsWith('/ai/play') ? 'playing' : 'setup'
  );
  const [aiEngine, setAiEngine] = useState<AIEngineType>(() => {
    const p = new URLSearchParams(window.location.search).get('engine');
    return p === 'pikafish' ? 'pikafish' : 'fairy_stockfish';
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
        if (eng === 'fairy_stockfish' || eng === 'pikafish') {
          setAiEngine(eng);
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
    (fen: string, engineType: AIEngineType = aiEngine): Promise<{ from: Pos; to: Pos } | null> => {
      return new Promise((resolve) => {
        if (!workerRef.current) {
          const m = findBestMove(fen, 'master', false);
          resolve(m ? { from: m.from, to: m.to } : null);
          return;
        }
        let settled = false;
        const reqId = Date.now() + Math.random();
        const fallbackTimer = setTimeout(() => {
          if (settled) return;
          settled = true;
          workerRef.current?.removeEventListener('message', handler);
          const m = findBestMove(fen, 'master', false);
          resolve(m ? { from: m.from, to: m.to } : null);
        }, 4000);

        const handler = (e: MessageEvent) => {
          if (e.data?.id === reqId && !settled) {
            settled = true;
            clearTimeout(fallbackTimer);
            workerRef.current?.removeEventListener('message', handler);
            if (e.data.move?.from && e.data.move?.to) {
              resolve({ from: e.data.move.from, to: e.data.move.to });
            } else {
              const m = findBestMove(fen, 'master', false);
              resolve(m ? { from: m.from, to: m.to } : null);
            }
          }
        };
        workerRef.current.addEventListener('message', handler);
        workerRef.current.postMessage({ id: reqId, fen, engine: engineType, isDarkXiangqi: false });
      });
    },
    [aiEngine]
  );

  // Socket.IO connection & 5s heartbeat (isolated per serverEnv)
  useEffect(() => {
    const s = io({
      auth: { env: serverEnv },
      query: { env: serverEnv },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 4000,
      timeout: 20000,
    });
    setSocket(s);

    s.on('connect', () => {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      setReconnecting(false);

      const user = currentUserRef.current;
      const currentRoom = activeRoomRef.current;
      const urlCode = parseRoomCodeFromPath(window.location.pathname);
      const targetRoomCode = currentRoom?.code || urlCode || '';

      if (user) {
        s.emit('auth:bind', {
          uid: user.uid,
          username: user.username,
          roomCode: targetRoomCode,
        });

        if (targetRoomCode) {
          s.emit(
            'room:rejoin',
            {
              code: targetRoomCode,
              uid: user.uid,
              username: user.username,
            },
            (res: any) => {
              if (res?.room) {
                setActiveRoom(res.room);
              }
            }
          );
        }
      }
    });

    s.on('disconnect', () => {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
      }
      // Grace period: Chỉ hiển thị thanh kết nối lại nếu mất mạng thực sự kéo dài (> 4.5s)
      // Các trường hợp cấp lại session hoặc đổi transport mất 2-3s sẽ không làm gián đoạn người dùng
      disconnectTimerRef.current = setTimeout(() => {
        setReconnecting(true);
      }, 4500);
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

    s.on('system:theme_changed', (payload: any) => {
      if (payload?.theme && BOARD_THEMES[payload.theme as BoardThemeId]) {
        setThemeId(payload.theme as BoardThemeId);
      }
    });

    s.on('session:kicked', (payload: any) => {
      setCurrentUser(null);
      setSessionId('');
      setActiveRoom(null);
      setStoredUserForEnv(serverEnv, null);
      setStoredSessionForEnv(serverEnv, '');
      showToast(payload?.reason || 'Phiên đăng nhập đã bị thay thế');
    });

    const hb = setInterval(() => {
      if (s.connected) s.emit('ping:heartbeat');
    }, 5000);

    return () => {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      clearInterval(hb);
      s.disconnect();
    };
  }, [serverEnv]);

  useEffect(() => {
    if (socket && socket.connected && currentUser) {
      const urlCode = parseRoomCodeFromPath(window.location.pathname);
      const targetRoomCode = activeRoom?.code || urlCode || '';
      socket.emit('auth:bind', {
        uid: currentUser.uid,
        username: currentUser.username,
        roomCode: targetRoomCode,
      });
      if (targetRoomCode) {
        socket.emit(
          'room:rejoin',
          {
            code: targetRoomCode,
            uid: currentUser.uid,
            username: currentUser.username,
          },
          (res: any) => {
            if (res?.room) {
              setActiveRoom(res.room);
            }
          }
        );
      }
    }
  }, [socket, currentUser, activeRoom?.code]);

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
        const best = await requestEngineMove(currentFen);
        setAiThinking(false);
        if (best) {
          executeAIModeMove(best.from, best.to);
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [
    activeTab,
    aiScreenState,
    turn,
    playerSide,
    gameResult.isOver,
    currentFen,
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
    const best = await requestEngineMove(currentFen);
    if (best) {
      setHintMove(best);
      showToast('Đã hiển thị nước gợi ý trên bàn cờ');
    }
  };

  const handleCopyAINotation = () => {
    const aiName = AI_ENGINES.find((e) => e.id === aiEngine)?.name || 'AI';
    const pairs: string[] = [];
    for (let i = 0; i < moves.length; i += 2) {
      const m1 = moves[i]?.wxf || '';
      const m2 = moves[i + 1]?.wxf || '';
      pairs.push(`${Math.floor(i / 2) + 1}. ${m1}${m2 ? ' ' + m2 : ''}`);
    }
    const header = [
      `[Event "Xiangqi Master - Chơi với máy"]`,
      `[Red "${playerSide === 'r' ? currentUser?.username || 'Người chơi' : `${aiName} (Max)`}"]`,
      `[Black "${playerSide === 'b' ? currentUser?.username || 'Người chơi' : `${aiName} (Max)`}"]`,
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
    setStoredUserForEnv(serverEnv, null);
    setStoredSessionForEnv(serverEnv, '');
    if (activeTab === 'admin') {
      navigateUrl('/ai');
    }
    showToast('Đã đăng xuất');
  };

  const lastAIMove =
    moves.length > 0 ? { from: moves[moves.length - 1].from, to: moves[moves.length - 1].to } : null;

  return (
    <div
      className="min-h-screen flex flex-col text-stone-100 transition-all duration-700"
      style={{
        ...currentTheme.web.pageBgStyle,
        '--theme-accent': currentTheme.web.accentColor,
        '--theme-accent-text': currentTheme.web.accentTextColor,
        '--theme-accent-glow': currentTheme.web.accentGlow,
        '--theme-card-border': currentTheme.web.cardBorderColor,
      } as React.CSSProperties}
    >
      {/* Reconnection Banner */}
      {reconnecting && (
        <div
          className="w-full text-white text-xs font-medium py-1.5 px-4 flex items-center justify-center gap-2 z-50 shadow-md"
          style={{ backgroundColor: currentTheme.web.accentColor }}
        >
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>Đang kết nối lại…</span>
        </div>
      )}

      {/* Single-Line Toast Notification */}
      {toastMsg && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-stone-900/95 border text-xs font-semibold shadow-2xl whitespace-nowrap backdrop-blur-md"
          style={{
            borderColor: currentTheme.web.cardBorderColor,
            color: currentTheme.web.accentTextColor,
            boxShadow: `0 0 25px ${currentTheme.web.accentGlow}`,
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* Top Navigation Bar: Ghim cả Header và Thanh Chọn Theme cố định ở đầu trang */}
      <div className="sticky top-0 z-30 w-full transition-all duration-700">
        {!(activeTab === 'ranked' && activeRoom) ? (
          <header
            className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3 border-b backdrop-blur-md transition-all duration-700"
            style={currentTheme.web.headerBgStyle}
          >
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
                  ? currentTheme.web.activeTabClass
                  : 'text-stone-400 hover:text-stone-100'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Trang chủ</span>
            </a>

            <a
              href={`/ai?engine=${aiEngine}&side=${playerSide}`}
              onClick={(e) =>
                handleLinkClick(e, `/ai?engine=${aiEngine}&side=${playerSide}`)
              }
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'ai'
                  ? currentTheme.web.activeTabClass
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
                  ? currentTheme.web.activeTabClass
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
                  ? currentTheme.web.activeTabClass
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
                  ? currentTheme.web.activeTabClass
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
                  ? currentTheme.web.activeTabClass
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
                    ? currentTheme.web.activeTabClass
                    : 'text-stone-400 hover:text-stone-100'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Quản trị</span>
              </a>
            )}
          </nav>

          {/* Zone 3: Theme, Audio, Server Switcher & Account Action */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Bộ chuyển đổi Máy Chủ Prod & Staging */}
            <ServerEnvSwitcher
              currentEnv={serverEnv}
              onEnvChange={handleServerEnvChange}
            />

            <button
              onClick={() => {
                const next = pieceCharMode === 'hanzi' ? 'viet' : 'hanzi';
                setPieceCharMode(next);
                savePreferences(themeId, next, soundEnabled);
              }}
              title="Chuyển chữ Hán / chữ Việt trên quân cờ"
              className={`min-w-[38px] min-h-[38px] px-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-xs font-bold flex items-center justify-center gap-1 transition-colors ${currentTheme.web.textAccentClass}`}
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
              {soundEnabled ? <Volume2 className={`w-4 h-4 ${currentTheme.web.textAccentClass}`} /> : <VolumeX className="w-4 h-4 text-stone-500" />}
            </button>

            {currentUser?.role === 'admin' && (
              <button
                onClick={() => setThemeDrawerOpen((o) => !o)}
                title="Cài đặt giao diện toàn hệ thống (Dành cho Quản trị viên)"
                className={`min-w-[38px] min-h-[38px] rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                  themeDrawerOpen
                    ? currentTheme.web.activeTabClass
                    : `bg-stone-900 hover:bg-stone-800 border-stone-800 ${currentTheme.web.textAccentClass}`
                }`}
              >
                <Palette className="w-4 h-4" />
              </button>
            )}

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
                  <User className={`w-3.5 h-3.5 ${currentTheme.web.textAccentClass}`} />
                  <span className="font-semibold text-stone-100">{currentUser.displayName || currentUser.username}</span>
                  {!currentUser.isCreateAccount && (
                    <span className={`text-[10px] font-normal ${currentTheme.web.textAccentClass}`}>· Chờ duyệt</span>
                  )}
                  {currentUser.role === 'admin' && (
                    <span className={`text-[10px] font-normal ${currentTheme.web.textAccentClass}`}>· Admin</span>
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
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${currentTheme.web.primaryBtnClass}`}
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
              <Volume2 className={`w-4 h-4 ${currentTheme.web.textAccentClass}`} />
            ) : (
              <VolumeX className="w-4 h-4 text-stone-500" />
            )}
          </button>

          {currentUser?.role === 'admin' && (
            <button
              onClick={() => setThemeDrawerOpen((o) => !o)}
              title="Cài đặt giao diện toàn hệ thống (Dành cho Quản trị viên)"
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-xl backdrop-blur-md transition-colors cursor-pointer ${
                themeDrawerOpen
                  ? currentTheme.web.activeTabClass
                  : `bg-stone-900/95 hover:bg-stone-800 border-stone-800 ${currentTheme.web.textAccentClass}`
              }`}
            >
              <Palette className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Instant 6-Theme Swatch & Visual Drawer (Chỉ Quản trị viên điều khiển - Áp dụng cho toàn hệ thống) */}
      {themeDrawerOpen && currentUser?.role === 'admin' && (
        <div
          className="w-full bg-stone-900/98 border-b px-4 py-3.5 shadow-2xl backdrop-blur-md max-h-[85vh] overflow-y-auto animate-fade-in transition-all"
          style={{
            borderColor: currentTheme.web.cardBorderColor,
            backgroundColor: 'rgba(18, 16, 15, 0.97)',
          }}
        >
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Palette className={`w-4 h-4 ${currentTheme.web.textAccentClass}`} />
                <span className="text-xs font-bold text-stone-200 uppercase tracking-wider">
                  Cài Đặt Giao Diện Kỳ Đài (Đồng Bộ Cho Toàn Bộ Người Chơi Hệ Thống)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-stone-400 hidden sm:inline">
                  Đang dùng: <span className={`font-semibold ${currentTheme.web.textAccentClass}`}>{currentTheme.name}</span>
                </span>
                <button
                  onClick={() => setThemeDrawerOpen(false)}
                  title="Đóng thanh chọn giao diện"
                  className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-stone-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {THEME_LIST.map((t) => {
                const active = t.id === themeId;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      handleApplyGlobalTheme(t.id);
                    }}
                    style={{
                      borderColor: active ? t.web.accentColor : undefined,
                      boxShadow: active ? `0 0 16px ${t.web.accentGlow}` : undefined,
                    }}
                    className={`group relative overflow-hidden rounded-2xl border text-left transition-all flex flex-col cursor-pointer ${
                      active
                        ? 'ring-2 scale-[1.02]'
                        : 'border-stone-800 bg-stone-950/80 hover:border-stone-700 hover:bg-stone-900/60'
                    }`}
                  >
                    {/* Theme Thumbnail Image */}
                    <div className="relative h-20 w-full overflow-hidden bg-stone-950">
                      <img
                        src={t.images.heroCover}
                        alt={t.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent" />

                      {/* Swatch color badges on thumbnail */}
                      <div className="absolute top-2 right-2 flex items-center -space-x-1">
                        {t.swatchColors.map((col, idx) => (
                          <span
                            key={idx}
                            className="w-3.5 h-3.5 rounded-full border border-black/60 shadow-sm"
                            style={{ backgroundColor: col }}
                          />
                        ))}
                      </div>

                      {active && (
                        <div
                          className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold shadow text-white"
                          style={{ backgroundColor: t.web.accentColor }}
                        >
                          Đang dùng (Toàn hệ thống)
                        </div>
                      )}
                    </div>

                    {/* Theme Info */}
                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className={`text-xs font-bold truncate ${active ? t.web.textAccentClass : 'text-stone-200'}`}>
                          {t.name}
                        </div>
                        <p className="text-[10px] text-stone-400 line-clamp-1 mt-0.5">
                          {t.web?.tagline || t.tagline}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Main Content Area (With Full Height & Smooth Vertical Scrolling) */}
      <main className="flex-1 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center justify-start p-3 sm:p-6">
        {activeTab === 'home' && (
          <HomeView
            currentUser={currentUser}
            theme={currentTheme}
            onNavigate={(tab) => {
              const targetMap: Record<MainTab, string> = {
                home: '/',
                ai: `/ai?engine=${aiEngine}&side=${playerSide}`,
                ranked: '/ranked',
                viewer: '/viewer',
                library: '/library',
                leaderboard: '/leaderboard',
                admin: '/admin/users',
              };
              navigateUrl(targetMap[tab] || '/');
            }}
            onOpenAuth={() => setAuthModalOpen(true)}
            onSelectTheme={currentUser?.role === 'admin' ? handleApplyGlobalTheme : undefined}
            onOpenThemeDrawer={currentUser?.role === 'admin' ? () => setThemeDrawerOpen(true) : undefined}
          />
        )}

        {activeTab === 'ai' &&
          (aiScreenState === 'setup' ? (
            /* SCREEN 1: PRE-GAME AI SETTINGS */
            <div className="w-full max-w-4xl mx-auto space-y-6 py-2">
              <div className={`relative overflow-hidden rounded-3xl border ${currentTheme.web.cardBorderClass} bg-stone-900 shadow-2xl p-6 sm:p-8`}>
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-25 pointer-events-none"
                  style={{ backgroundImage: `url('${currentTheme.images.masterDuel}')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-stone-950 via-stone-950/90 to-stone-900/75 pointer-events-none" />

                <div className="relative z-10 space-y-6">
                  {/* Title Header */}
                  <div className="space-y-2 border-b border-stone-800 pb-5">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${currentTheme.web.accentBadgeClass} text-xs font-semibold`}>
                      <Bot className={`w-3.5 h-3.5 ${currentTheme.web.textAccentClass}`} />
                      <span>Thiết Lập Trận Đấu Với Máy (AI)</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-display font-bold text-stone-100">
                      Cấu Hình Đối Thủ AI Trước Khi Vào Trận
                    </h1>
                    <p className="text-xs sm:text-sm text-stone-400">
                      Động cơ tính toán đã được đẩy lên mức kỳ lực cao nhất. Lựa chọn động cơ và màu quân để xuất chiến.
                    </p>
                  </div>

                  {/* Step 1: Engine Selection */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs sm:text-sm font-bold text-stone-200 uppercase tracking-wider">
                        1. Chọn Động Cơ Tính Toán (AI Engine)
                      </label>
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-md font-semibold ${currentTheme.web.accentBadgeClass}`}>
                        Kỳ Lực Đỉnh Cao (Max Strength)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {AI_ENGINES.map((eng) => {
                        const active = aiEngine === eng.id;
                        const targetUrl = `/ai?engine=${eng.id}&side=${playerSide}`;
                        return (
                          <a
                            key={eng.id}
                            href={targetUrl}
                            onClick={(e) =>
                              handleLinkClick(e, targetUrl, () => setAiEngine(eng.id))
                            }
                            style={{
                              borderColor: active ? currentTheme.web.accentColor : undefined,
                              boxShadow: active ? `0 0 16px ${currentTheme.web.accentGlow}` : undefined,
                            }}
                            className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                              active
                                ? `${currentTheme.web.accentBgClass} text-stone-100 ring-1`
                                : 'bg-stone-950/80 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-bold text-stone-100">
                                  {eng.name}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded bg-stone-800 border border-stone-700 font-semibold shrink-0 ${currentTheme.web.textAccentClass}`}>
                                  {eng.badge}
                                </span>
                              </div>
                              <p className="text-xs text-stone-400 leading-relaxed">{eng.desc}</p>
                              <div className={`text-[11px] italic ${currentTheme.web.textAccentClass}`}>
                                {eng.highlight}
                              </div>
                            </div>
                            <div className="mt-4 pt-2.5 border-t border-stone-800/70 flex items-center justify-between text-[11px]">
                              <span className={active ? `${currentTheme.web.textAccentClass} font-semibold` : 'text-stone-500'}>
                                {active ? 'Đang chọn' : 'Bấm để chọn'}
                              </span>
                              <div
                                className="w-4 h-4 rounded-full border flex items-center justify-center"
                                style={{
                                  borderColor: active ? currentTheme.web.accentColor : undefined,
                                  backgroundColor: active ? currentTheme.web.accentColor : undefined,
                                }}
                              >
                                {active && <div className="w-1.5 h-1.5 rounded-full bg-stone-950" />}
                              </div>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: Maximum AI Strength Notice */}
                  <div className={`p-4 rounded-2xl bg-gradient-to-r ${currentTheme.web.bannerGradient} border ${currentTheme.web.borderAccentClass} relative overflow-hidden`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl ${currentTheme.web.accentBgClass} border ${currentTheme.web.borderAccentClass} flex items-center justify-center shrink-0 ${currentTheme.web.textAccentClass}`}>
                        <Zap className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${currentTheme.web.textAccentClass}`}>
                            2. Kỳ Lực Tối Thượng (Max Strength) — Đã Tự Động Kích Hoạt
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${currentTheme.web.accentBadgeClass}`}>
                            Sát Lực Cao Nhất
                          </span>
                        </div>
                        <p className="text-xs text-stone-300 leading-relaxed">
                          Hệ thống đã loại bỏ các cấp độ hạn chế kỳ lực. Cả <strong className={currentTheme.web.textAccentClass}>Fairy-Stockfish</strong> và <strong className={currentTheme.web.textAccentClass}>Pikafish</strong> đều vận hành ở mức tính toán cao nhất (Skill Level 20, Depth 16–18 nước, Contempt tích cực và Hash 64MB) để cống hiến những ván cờ sắc bén, thâm sâu nhất.
                        </p>
                      </div>
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
                          href={`/ai?engine=${aiEngine}&side=r`}
                          onClick={(e) =>
                            handleLinkClick(
                              e,
                              `/ai?engine=${aiEngine}&side=r`,
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
                          href={`/ai?engine=${aiEngine}&side=b`}
                          onClick={(e) =>
                            handleLinkClick(
                              e,
                              `/ai?engine=${aiEngine}&side=b`,
                              () => setPlayerSide('b')
                            )
                          }
                          style={{
                            borderColor: playerSide === 'b' ? currentTheme.web.accentColor : undefined,
                          }}
                          className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                            playerSide === 'b'
                              ? 'bg-stone-800 text-stone-100 shadow-md'
                              : 'bg-stone-950/80 border-stone-800 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full bg-stone-950 border inline-block"
                            style={{ borderColor: currentTheme.web.accentColor }}
                          />
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
                              ? currentTheme.web.activeTabClass
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
                              ? currentTheme.web.activeTabClass
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
                      <span className={`font-semibold ${currentTheme.web.textAccentClass}`}>
                        {AI_ENGINES.find((e) => e.id === aiEngine)?.name}
                      </span>{' '}
                      ·{' '}
                      <span className="text-emerald-400 font-semibold">
                        Kỳ Lực Tối Thượng (Max Strength)
                      </span>{' '}
                      ·{' '}
                      <span className="text-stone-200 font-semibold">
                        {playerSide === 'r' ? 'Cầm Đỏ (Đi tiên)' : 'Cầm Đen (Đi hậu)'}
                      </span>
                    </div>

                    <a
                      href={`/ai/play?engine=${aiEngine}&side=${playerSide}`}
                      onClick={(e) =>
                        handleLinkClick(
                          e,
                          `/ai/play?engine=${aiEngine}&side=${playerSide}`,
                          () => {
                            startNewAIGame(playerSide);
                            setAiScreenState('playing');
                          }
                        )
                      }
                      className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2.5 transform hover:-translate-y-0.5 ${currentTheme.web.primaryBtnClass}`}
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
                  <div className={`w-full mb-3 rounded-2xl bg-gradient-to-r from-stone-900 via-stone-900 to-stone-900 border-2 p-3.5 flex items-center justify-between gap-3 shadow-2xl ${currentTheme.web.cardBorderClass}`}>
                    <div className="flex items-center gap-2.5">
                      <Trophy className={`w-5 h-5 shrink-0 ${currentTheme.web.textAccentClass}`} />
                      <div>
                        <div className={`text-sm font-bold ${currentTheme.web.textAccentClass}`}>
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
                      className={`px-3.5 py-1.5 rounded-xl text-white text-xs font-semibold shrink-0 transition-colors ${currentTheme.web.primaryBtnClass}`}
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
                    href={`/ai?engine=${aiEngine}&side=${playerSide}`}
                    onClick={(e) =>
                      handleLinkClick(
                        e,
                        `/ai?engine=${aiEngine}&side=${playerSide}`,
                        () => setAiScreenState('setup')
                      )
                    }
                    title="Quay lại màn Cài đặt"
                    className={`min-h-[44px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${currentTheme.web.secondaryBtnClass}`}
                  >
                    <span>⚙ Cài đặt</span>
                  </a>
                  <button
                    onClick={() => startNewAIGame(playerSide)}
                    title="Ván mới"
                    className={`min-h-[44px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${currentTheme.web.primaryBtnClass}`}
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
                    className={`min-h-[44px] px-3 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-xs font-medium flex items-center gap-1.5 transition-colors ${currentTheme.web.textAccentClass}`}
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
                      <Bot className={`w-4 h-4 ${currentTheme.web.textAccentClass}`} />
                      <span className="text-xs font-bold text-stone-100 uppercase tracking-wider">
                        Thông Tin Trận Đấu Với Máy
                      </span>
                    </div>
                    <a
                      href={`/ai?engine=${aiEngine}&side=${playerSide}`}
                      onClick={(e) =>
                        handleLinkClick(
                          e,
                          `/ai?engine=${aiEngine}&side=${playerSide}`,
                          () => setAiScreenState('setup')
                        )
                      }
                      className={`px-3 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs font-semibold transition-colors ${currentTheme.web.textAccentClass}`}
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
                      <div className="text-[10px] text-stone-500">Kỳ lực</div>
                      <div className="font-semibold text-emerald-400 mt-0.5">
                        Tối Thượng (Max)
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
                      className={`${currentTheme.web.textAccentClass} hover:underline font-medium`}
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
                            <span className={`font-semibold shrink-0 ${currentTheme.web.textAccentClass}`}>{m.wxf}</span>
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
          ))}

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
            onOpenViewer={(txt) => {
              setViewerInitialPgn(txt);
              navigateUrl('/viewer');
              showToast('Đã mở ván đấu trong trình xem kỳ phổ');
            }}
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
            theme={currentTheme}
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
              onThemeChange={handleApplyGlobalTheme}
            />
          ) : (
            <div className="py-16 text-center space-y-3">
              <ShieldCheck className={`w-8 h-8 mx-auto stroke-1 ${currentTheme.web.textAccentClass}`} />
              <div className="text-sm text-stone-400">Chỉ dành cho Quản trị viên</div>
              <button
                onClick={() => setAuthModalOpen(true)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold ${currentTheme.web.primaryBtnClass}`}
              >
                Đăng nhập Admin
              </button>
            </div>
          ))}
      </main>

      {/* Auth Modal (4 tabs + 3-step _resetacc concurrent login flow + Server Selector) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        currentUser={currentUser}
        theme={currentTheme}
        currentEnv={serverEnv}
        onEnvChange={handleServerEnvChange}
        onAuthSuccess={(user, sess, decayNotice) => {
          setCurrentUser(user);
          setSessionId(sess);
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

      {/* Staging Access Password Modal (Default: 123456) */}
      <StagingPasswordModal
        isOpen={stagingPasswordModalOpen}
        onClose={() => setStagingPasswordModalOpen(false)}
        onSuccess={() => {
          proceedSwitchEnv('staging');
        }}
      />
    </div>
  );
};
