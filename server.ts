import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';

import {
  Board,
  PieceColor,
  INITIAL_FEN,
  parseFen,
  boardToFen,
  createDarkXiangqiBoard,
  getLegalMovesForSquare,
  applyMove,
  isKingInCheck,
  evaluateGameStatus,
  formatMoveNotation,
  FormattedMove,
} from './src/shared/xiangqi';
import {
  RatedMode,
  EloConfig,
  DEFAULT_ELO_CONFIG,
  calculateMatchElo,
  evaluateInactivityDecay,
} from './src/shared/elo';

const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));

let adminDb: any = null;

const PORT = 3000;
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'thangnc').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'thangnc1';
const CRON_SECRET = process.env.CRON_SECRET || 'xiangqi_cron_secret_2026';

// ==================== PERSISTENT SERVER STORE + FIRESTORE MIRROR ====================
// Ensures 100% reliability in sandbox environments without IAM ADC errors while keeping data persisted

interface StoreData {
  users: Record<string, any>;
  usernames: Record<string, { uid: string; createdAt: number }>;
  userSecrets: Record<string, { uid: string; passwordHash: string; updatedAt: number }>;
  admins: Record<string, { uid: string; createdAt: number }>;
  loginRequests: Record<string, any>;
  games: Record<string, any>;
  moves: Record<string, any[]>;
  rooms: Record<string, any>;
  ratings: Record<string, any>;
  ratingHistory: Record<string, any>;
  adminConfig: Record<string, any>;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'firestore-store.json');

function loadStore(): StoreData {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Initializing fresh store');
  }
  return {
    users: {},
    usernames: {},
    userSecrets: {},
    admins: {},
    loginRequests: {},
    games: {},
    moves: {},
    rooms: {},
    ratings: {},
    ratingHistory: {},
    adminConfig: {},
  };
}

const store: StoreData = loadStore();

function saveStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    // Ignore transient disk errors
  }
}

// Non-blocking mirror to Firestore via Admin SDK when credentials are configured
function mirrorToFirestore(col: string, id: string, data: any | null) {
  if (col === 'userSecrets') return; // Never send passwordHash outside server
  if (!adminDb) return; // Do not call unauthenticated client SDK which triggers PERMISSION_DENIED
  try {
    const ref = adminDb.collection(col).doc(id);
    if (data === null) {
      ref.delete().catch(() => {});
    } else {
      ref.set(data, { merge: true }).catch(() => {});
    }
  } catch {
    // Silent fallback
  }
}

// Brute-force rate limiter in memory
const loginAttempts = new Map<string, { count: number; lockUntil: number }>();

function checkRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (entry && entry.lockUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.lockUntil - now) / 1000) };
  }
  return { allowed: true };
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const entry = loginAttempts.get(key) || { count: 0, lockUntil: 0 };
  entry.count += 1;
  if (entry.count >= 6) {
    entry.lockUntil = now + 60_000;
    entry.count = 0;
  }
  loginAttempts.set(key, entry);
}

function clearRateLimit(key: string) {
  loginAttempts.delete(key);
}

// Active rooms in memory (also persisted in store.rooms)
interface RoomParticipant {
  uid: string;
  username: string;
  elo: number;
  connected: boolean;
  disconnectedAt?: number;
  disconnectDeadline?: number;
}

interface ChatMessage {
  id: string;
  senderUid: string;
  senderName: string;
  text: string;
  type: 'text' | 'emoji' | 'quick' | 'system';
  isSpectator?: boolean;
  timestamp: number;
}

interface LiveRoom {
  code: string;
  mode: RatedMode;
  hostUid: string;
  status: 'waiting' | 'playing' | 'finished';
  redPlayer: RoomParticipant | null;
  blackPlayer: RoomParticipant | null;
  spectators: RoomParticipant[]; // max 6
  board: Board;
  turn: PieceColor;
  initialFen: string;
  fenHistory: string[];
  checkHistory: { color: PieceColor; gaveCheck: boolean }[];
  moves: FormattedMove[];
  redTimeMs: number;
  blackTimeMs: number;
  moveTimeLimitMs: number;
  incrementMs: number;
  currentMoveRemainingMs: number;
  lastTickAt: number;
  turnDeadline: number;
  drawOfferBy: PieceColor | null;
  winner?: 'red' | 'black' | 'draw' | 'ongoing';
  endReason?: string;
  eloResult?: {
    redBefore: number;
    redAfter: number;
    redDelta: number;
    redBoostPenalty: number;
    blackBefore: number;
    blackAfter: number;
    blackDelta: number;
    blackBoostPenalty: number;
  } | null;
  chat: ChatMessage[];
  cleanupAfterFinish?: boolean;
  createdAt: number;
  updatedAt: number;
}

const liveRooms = new Map<string, LiveRoom>();
const userSockets = new Map<string, Set<string>>();
const chatRateLimit = new Map<string, number>();

const BAD_WORDS = ['dm', 'dmm', 'vcl', 'vl', 'cc', 'fuck', 'shit', 'ngu'];
function sanitizeChatText(input: string): string {
  let out = input.trim().slice(0, 120);
  for (const w of BAD_WORDS) {
    const reg = new RegExp(`\\b${w}\\b`, 'gi');
    out = out.replace(reg, '***');
  }
  return out;
}

function getTimeControlForMode(mode: RatedMode, cfg?: Record<string, any>) {
  if (mode === 'blitz') {
    return {
      totalMs: (cfg?.blitzMinutes || 5) * 60_000,
      incrementMs: (cfg?.blitzIncrementSec ?? 3) * 1000,
      moveLimitMs: 0,
    };
  }
  if (mode === 'standard') {
    return {
      totalMs: (cfg?.standardMinutes || 30) * 60_000,
      incrementMs: 0,
      moveLimitMs: (cfg?.standardMoveSec || 120) * 1000,
    };
  }
  return {
    totalMs: (cfg?.darkMinutes || 15) * 60_000,
    incrementMs: 0,
    moveLimitMs: (cfg?.darkMoveSec || 120) * 1000,
  };
}

function serializeRoomForClient(room: LiveRoom) {
  const isDark = room.mode === 'dark';
  const maskHidden = isDark && room.status === 'playing';
  const clientFen = boardToFen(room.board, room.turn, maskHidden);

  return {
    code: room.code,
    mode: room.mode,
    hostUid: room.hostUid,
    status: room.status,
    redPlayer: room.redPlayer,
    blackPlayer: room.blackPlayer,
    spectators: room.spectators,
    fen: clientFen,
    turn: room.turn,
    moves: room.moves,
    redTimeMs: Math.max(0, Math.round(room.redTimeMs)),
    blackTimeMs: Math.max(0, Math.round(room.blackTimeMs)),
    moveTimeLimitMs: room.moveTimeLimitMs,
    currentMoveRemainingMs: Math.max(0, Math.round(room.currentMoveRemainingMs)),
    drawOfferBy: room.drawOfferBy,
    winner: room.winner || 'ongoing',
    endReason: room.endReason || '',
    eloResult: room.eloResult || null,
    chat: room.chat.slice(-50),
  };
}

function getAdminConfig(): EloConfig & Record<string, any> {
  return {
    ...DEFAULT_ELO_CONFIG,
    blitzMinutes: 5,
    blitzIncrementSec: 3,
    standardMinutes: 30,
    standardMoveSec: 120,
    darkMinutes: 15,
    darkMoveSec: 120,
    ...(store.adminConfig['global'] || {}),
  };
}

function getUserModeElo(uid: string, username: string, mode: RatedMode): number {
  const docId = `${uid}_${mode}`;
  if (store.ratings[docId]) {
    return store.ratings[docId].elo ?? 1200;
  }
  const now = Date.now();
  const initialRating = {
    id: docId,
    uid,
    username,
    mode,
    elo: 1200,
    peakElo: 1200,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    provisional: true,
    decayApplied: false,
    hiddenFromLeaderboard: false,
    lastRatedGameAt: 0,
    recentOpponents: [] as string[],
    updatedAt: now,
  };
  store.ratings[docId] = initialRating;
  saveStore();
  mirrorToFirestore('ratings', docId, initialRating);
  return 1200;
}

async function seedDefaultAdminAndConfig() {
  const norm = ADMIN_USERNAME.toLowerCase();
  const now = Date.now();

  if (!store.usernames[norm]) {
    const uid = `admin_${norm}`;
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    store.userSecrets[uid] = {
      uid,
      passwordHash,
      updatedAt: now,
    };

    store.users[uid] = {
      uid,
      username: ADMIN_USERNAME,
      displayName: 'Quản trị viên',
      role: 'admin',
      isCreateAccount: true,
      isLogin: false,
      isLocked: false,
      activeSessionId: '',
      theme: 'classic_wood',
      pieceCharMode: 'hanzi',
      soundEnabled: true,
      lastUsernameChangeAt: 0,
      createdAt: now,
      updatedAt: now,
    };

    store.usernames[norm] = { uid, createdAt: now };
    store.admins[uid] = { uid, createdAt: now };
    console.log(`Seeded default admin account: ${ADMIN_USERNAME}`);
  } else {
    const uid = store.usernames[norm].uid;
    if (store.users[uid]) {
      store.users[uid].role = 'admin';
      store.users[uid].isCreateAccount = true;
    }
    store.admins[uid] = { uid, createdAt: now };
  }

  if (!store.adminConfig['global']) {
    store.adminConfig['global'] = {
      ...DEFAULT_ELO_CONFIG,
      blitzMinutes: 5,
      blitzIncrementSec: 3,
      standardMinutes: 30,
      standardMoveSec: 120,
      darkMinutes: 15,
      darkMoveSec: 120,
      updatedAt: now,
    };
  }

  saveStore();
}

function persistRoomSnapshot(room: LiveRoom) {
  const snap = {
    code: room.code,
    mode: room.mode,
    hostUid: room.hostUid,
    status: room.status,
    redUid: room.redPlayer?.uid || '',
    blackUid: room.blackPlayer?.uid || '',
    redName: room.redPlayer?.username || '',
    blackName: room.blackPlayer?.username || '',
    spectatorCount: room.spectators.length,
    fen: boardToFen(room.board, room.turn, false),
    turn: room.turn,
    redTimeMs: Math.round(room.redTimeMs),
    blackTimeMs: Math.round(room.blackTimeMs),
    currentMoveRemainingMs: Math.round(room.currentMoveRemainingMs),
    turnDeadline: room.turnDeadline,
    createdAt: room.createdAt,
    updatedAt: Date.now(),
  };
  store.rooms[room.code] = snap;
  saveStore();
  mirrorToFirestore('rooms', room.code, snap);
}

async function startServer() {
  await seedDefaultAdminAndConfig();

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
    pingInterval: 5000,
    pingTimeout: 10000,
  });

  function emitToUser(uid: string, event: string, payload: any) {
    const sockets = userSockets.get(uid);
    if (!sockets) return;
    for (const sid of sockets) {
      io.to(sid).emit(event, payload);
    }
  }

  function broadcastAdminUpdate() {
    for (const u of Object.values(store.users)) {
      if (u.role === 'admin') {
        emitToUser(u.uid, 'admin:login_requests_updated', {
          loginRequests: Object.values(store.loginRequests).sort(
            (a, b) => b.updatedAt - a.updatedAt
          ),
        });
      }
    }
  }

  // ==================== AUTHENTICATION API ====================

  app.post('/api/auth/register', async (req, res) => {
    try {
      const rawUsername = String(req.body.username || '').trim();
      const password = String(req.body.password || '');

      if (!/^[a-zA-Z0-9_]{3,24}$/.test(rawUsername)) {
        return res
          .status(400)
          .json({ error: 'Tên đăng nhập gồm 3–24 ký tự chữ, số hoặc gạch dưới' });
      }
      if (password.length < 6 || password.length > 64) {
        return res.status(400).json({ error: 'Mật khẩu phải từ 6 đến 64 ký tự' });
      }
      if (password.endsWith('_resetacc')) {
        return res.status(400).json({ error: 'Mật khẩu không được chứa hậu tố hệ thống' });
      }

      const norm = rawUsername.toLowerCase();
      if (store.usernames[norm]) {
        return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' });
      }

      const now = Date.now();
      const uid = `u_${now}_${Math.random().toString(36).slice(2, 7)}`;
      const sessionId = `sess_${now}_${Math.random().toString(36).slice(2, 9)}`;
      const passwordHash = await bcrypt.hash(password, 10);

      store.userSecrets[uid] = {
        uid,
        passwordHash,
        updatedAt: now,
      };

      const userDoc = {
        uid,
        username: rawUsername,
        displayName: rawUsername,
        role: 'user',
        isCreateAccount: false,
        isLogin: true,
        isLocked: false,
        activeSessionId: sessionId,
        theme: 'classic_wood',
        pieceCharMode: 'hanzi',
        soundEnabled: true,
        lastUsernameChangeAt: 0,
        createdAt: now,
        updatedAt: now,
      };

      store.users[uid] = userDoc;
      store.usernames[norm] = { uid, createdAt: now };

      for (const mode of ['blitz', 'standard', 'dark'] as RatedMode[]) {
        getUserModeElo(uid, rawUsername, mode);
      }

      saveStore();
      mirrorToFirestore('users', uid, userDoc);
      mirrorToFirestore('usernames', norm, store.usernames[norm]);

      return res.json({
        user: userDoc,
        sessionId,
        customToken: '',
      });
    } catch (error) {
      console.error('Register error:', error);
      return res.status(500).json({ error: 'Lỗi máy chủ khi đăng ký' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const rawUsername = String(req.body.username || '').trim();
      const rawPassword = String(req.body.password || '');
      const ip = req.ip || 'unknown';
      const norm = rawUsername.toLowerCase();

      const rateKey = `${ip}_${norm}`;
      const rate = checkRateLimit(rateKey);
      if (!rate.allowed) {
        return res
          .status(429)
          .json({ error: `Thử quá nhiều lần. Vui lòng đợi ${rate.retryAfterSec}s` });
      }

      const unameEntry = store.usernames[norm];
      if (!unameEntry) {
        recordFailedAttempt(rateKey);
        return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
      }

      const uid = unameEntry.uid;
      const user = store.users[uid];
      const secret = store.userSecrets[uid];

      if (!user || !secret) {
        recordFailedAttempt(rateKey);
        return res.status(401).json({ error: 'Tài khoản không tồn tại' });
      }

      if (user.isLocked) {
        return res.status(403).json({ error: 'Tài khoản đã bị khóa bởi quản trị viên' });
      }

      // Detect _resetacc suffix for Step 2 of concurrent login resolution
      const hasResetSuffix = rawPassword.endsWith('_resetacc');
      const basePassword = hasResetSuffix ? rawPassword.slice(0, -9) : rawPassword;

      const passwordValid = await bcrypt.compare(basePassword, secret.passwordHash);
      if (!passwordValid) {
        recordFailedAttempt(rateKey);
        return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
      }

      clearRateLimit(rateKey);
      const now = Date.now();
      const reqId = `req_${uid}`;
      const reqData = store.loginRequests[reqId] || null;

      // Admin is exempt from multi-device login block (replaces old session immediately)
      if (user.role !== 'admin' && user.isLogin) {
        // Step 2: User entered password + _resetacc
        if (hasResetSuffix) {
          store.loginRequests[reqId] = {
            id: reqId,
            uid,
            username: user.username,
            attemptCount: 2,
            status: 'pending',
            createdAt: reqData?.createdAt || now,
            updatedAt: now,
          };
          saveStore();
          mirrorToFirestore('loginRequests', reqId, store.loginRequests[reqId]);
          broadcastAdminUpdate();

          return res.status(202).json({
            status: 'pending_admin',
            step: 2,
            requestId: reqId,
            message: 'Đang liên hệ quản trị viên…',
          });
        }

        // Step 3: User entered normal password after submitting _resetacc
        if (reqData && reqData.status === 'approved') {
          store.loginRequests[reqId] = {
            ...reqData,
            status: 'completed',
            attemptCount: 3,
            updatedAt: now,
          };
          saveStore();
          mirrorToFirestore('loginRequests', reqId, store.loginRequests[reqId]);
          broadcastAdminUpdate();
          // Proceed below to kick old session and issue new session!
        } else if (reqData && reqData.status === 'pending') {
          return res.status(202).json({
            status: 'pending_admin',
            step: 2,
            requestId: reqId,
            message: 'Đang liên hệ quản trị viên…',
          });
        } else {
          // Step 1: First login attempt while account is active elsewhere
          store.loginRequests[reqId] = {
            id: reqId,
            uid,
            username: user.username,
            attemptCount: 1,
            status: 'blocked_step1',
            createdAt: now,
            updatedAt: now,
          };
          saveStore();
          mirrorToFirestore('loginRequests', reqId, store.loginRequests[reqId]);
          broadcastAdminUpdate();

          return res.status(409).json({
            status: 'already_logged_in',
            step: 1,
            error: 'Tài khoản đang đăng nhập ở nơi khác',
          });
        }
      } else if (hasResetSuffix) {
        return res
          .status(400)
          .json({ error: 'Tài khoản không bị kẹt phiên. Hãy nhập mật khẩu bình thường' });
      }

      const newSessionId = `sess_${now}_${Math.random().toString(36).slice(2, 9)}`;
      if (user.activeSessionId && user.activeSessionId !== newSessionId) {
        emitToUser(uid, 'session:kicked', {
          reason: 'Phiên đăng nhập đã được chuyển sang thiết bị mới',
          newSessionId,
        });
      }

      const decayNotice = user.lastDecayNotice || null;
      user.isLogin = true;
      user.activeSessionId = newSessionId;
      user.lastDecayNotice = '';
      user.updatedAt = now;

      saveStore();
      mirrorToFirestore('users', uid, user);

      return res.json({
        user,
        sessionId: newSessionId,
        customToken: '',
        decayNotice,
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Lỗi máy chủ khi đăng nhập' });
    }
  });

  app.get('/api/auth/me/:uid', (req, res) => {
    const user = store.users[req.params.uid];
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    return res.json({ user });
  });

  app.get('/api/auth/login-request/:requestId', (req, res) => {
    const reqDoc = store.loginRequests[req.params.requestId];
    if (!reqDoc) {
      return res.status(404).json({ error: 'Không tìm thấy yêu cầu' });
    }
    return res.json({ request: reqDoc });
  });

  app.post('/api/auth/logout', (req, res) => {
    const { uid, sessionId } = req.body;
    if (!uid) return res.json({ ok: true });
    const user = store.users[String(uid)];
    if (user) {
      if (!sessionId || !user.activeSessionId || user.activeSessionId === sessionId) {
        user.isLogin = false;
        user.activeSessionId = '';
        user.updatedAt = Date.now();
        saveStore();
        mirrorToFirestore('users', user.uid, user);
      }
    }
    return res.json({ ok: true });
  });

  app.post('/api/auth/change-username', async (req, res) => {
    try {
      const oldUsername = String(req.body.oldUsername || '').trim();
      const newUsername = String(req.body.newUsername || '').trim();
      const password = String(req.body.password || '');

      if (!/^[a-zA-Z0-9_]{3,24}$/.test(newUsername)) {
        return res
          .status(400)
          .json({ error: 'Tên mới gồm 3–24 ký tự chữ, số hoặc gạch dưới' });
      }

      const oldNorm = oldUsername.toLowerCase();
      const newNorm = newUsername.toLowerCase();
      if (oldNorm === newNorm) {
        return res.status(400).json({ error: 'Tên mới phải khác tên hiện tại' });
      }

      const oldEntry = store.usernames[oldNorm];
      if (!oldEntry) {
        return res.status(404).json({ error: 'Tên đăng nhập hiện tại không đúng' });
      }

      const uid = oldEntry.uid;
      const user = store.users[uid];
      const secret = store.userSecrets[uid];

      if (!user || !secret) {
        return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
      }
      if (store.usernames[newNorm]) {
        return res.status(409).json({ error: 'Tên đăng nhập mới đã có người dùng' });
      }

      const valid = await bcrypt.compare(password, secret.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Mật khẩu xác nhận không đúng' });
      }

      const now = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      if (user.lastUsernameChangeAt && now - user.lastUsernameChangeAt < thirtyDaysMs) {
        const daysLeft = Math.ceil(
          (thirtyDaysMs - (now - user.lastUsernameChangeAt)) / (24 * 60 * 60 * 1000)
        );
        return res
          .status(429)
          .json({ error: `Chỉ được đổi tên 1 lần/30 ngày (còn ${daysLeft} ngày)` });
      }

      delete store.usernames[oldNorm];
      store.usernames[newNorm] = { uid, createdAt: now };
      user.username = newUsername;
      user.displayName = newUsername;
      user.lastUsernameChangeAt = now;
      user.updatedAt = now;

      for (const m of ['blitz', 'standard', 'dark'] as RatedMode[]) {
        const rKey = `${uid}_${m}`;
        if (store.ratings[rKey]) {
          store.ratings[rKey].username = newUsername;
          store.ratings[rKey].updatedAt = now;
        }
      }

      saveStore();
      mirrorToFirestore('users', uid, user);
      return res.json({ ok: true, username: newUsername, user });
    } catch (e) {
      return res.status(500).json({ error: 'Lỗi đổi tên đăng nhập' });
    }
  });

  app.post('/api/auth/change-password', async (req, res) => {
    try {
      const username = String(req.body.username || '').trim();
      const oldPassword = String(req.body.oldPassword || '');
      const newPassword = String(req.body.newPassword || '');

      if (newPassword.length < 6 || newPassword.length > 64 || newPassword.endsWith('_resetacc')) {
        return res.status(400).json({ error: 'Mật khẩu mới phải từ 6–64 ký tự hợp lệ' });
      }

      const unameEntry = store.usernames[username.toLowerCase()];
      if (!unameEntry) {
        return res.status(404).json({ error: 'Tài khoản không tồn tại' });
      }

      const uid = unameEntry.uid;
      const secret = store.userSecrets[uid];
      if (!secret) {
        return res.status(404).json({ error: 'Không tìm thấy dữ liệu bảo mật' });
      }

      const valid = await bcrypt.compare(oldPassword, secret.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng' });
      }

      secret.passwordHash = await bcrypt.hash(newPassword, 10);
      secret.updatedAt = Date.now();
      saveStore();

      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Lỗi đổi mật khẩu' });
    }
  });

  app.post('/api/auth/preferences', (req, res) => {
    const { uid, theme, pieceCharMode, soundEnabled } = req.body;
    if (!uid || !store.users[uid]) return res.status(400).json({ error: 'Thiếu uid' });
    const user = store.users[uid];
    if (theme) user.theme = theme;
    if (pieceCharMode) user.pieceCharMode = pieceCharMode;
    if (typeof soundEnabled === 'boolean') user.soundEnabled = soundEnabled;
    user.updatedAt = Date.now();
    saveStore();
    mirrorToFirestore('users', uid, user);
    return res.json({ ok: true, user });
  });

  // ==================== GAMES & NOTATION API ====================

  app.post('/api/games', (req, res) => {
    try {
      const {
        mode = 'ai',
        redUid,
        redName,
        blackUid,
        blackName,
        winner,
        reason = '',
        initialFen = INITIAL_FEN,
        finalFen = INITIAL_FEN,
        moves = [],
      } = req.body;

      const now = Date.now();
      const gameId = `game_${now}_${Math.random().toString(36).slice(2, 7)}`;

      const wxfPairs: string[] = [];
      for (let i = 0; i < moves.length; i += 2) {
        const m1 = moves[i]?.wxf || '';
        const m2 = moves[i + 1]?.wxf || '';
        wxfPairs.push(`${Math.floor(i / 2) + 1}. ${m1}${m2 ? ' ' + m2 : ''}`);
      }
      const wxfText = wxfPairs.join(' ');

      const gameDoc = {
        id: gameId,
        mode,
        redUid: String(redUid || 'guest'),
        redName: String(redName || 'Đỏ'),
        blackUid: String(blackUid || 'ai'),
        blackName: String(blackName || 'Máy'),
        winner: winner || 'draw',
        reason: String(reason).slice(0, 64),
        initialFen: String(initialFen).slice(0, 200),
        finalFen: String(finalFen).slice(0, 200),
        moveCount: Array.isArray(moves) ? moves.length : 0,
        wxfText: wxfText.slice(0, 10000),
        createdAt: now,
        updatedAt: now,
      };

      store.games[gameId] = gameDoc;
      store.moves[gameId] = Array.isArray(moves)
        ? moves.slice(0, 400).map((m: any, idx: number) => ({
            ply: idx + 1,
            color: m.color || ((idx + 1) % 2 === 1 ? 'r' : 'b'),
            wxf: String(m.wxf || '').slice(0, 16),
            viet: String(m.viet || '').slice(0, 64),
            iccs: String(m.iccs || '').slice(0, 16),
            fen: String(m.fen || '').slice(0, 200),
            timestamp: m.timestamp || now,
          }))
        : [];

      saveStore();
      mirrorToFirestore('games', gameId, gameDoc);
      return res.json({ game: gameDoc });
    } catch (e) {
      return res.status(500).json({ error: 'Lỗi lưu ván cờ' });
    }
  });

  app.get('/api/games', (req, res) => {
    const uid = String(req.query.uid || '');
    let list = Object.values(store.games).sort((a, b) => b.createdAt - a.createdAt);
    if (uid) {
      list = list.filter((g) => g.redUid === uid || g.blackUid === uid);
    }
    return res.json({ games: list.slice(0, 40) });
  });

  app.get('/api/games/:id', (req, res) => {
    const game = store.games[req.params.id];
    if (!game) {
      return res.status(404).json({ error: 'Không tìm thấy ván đấu' });
    }
    return res.json({
      game,
      moves: store.moves[req.params.id] || [],
    });
  });

  // ==================== LEADERBOARD & USER RATINGS API ====================

  app.get('/api/ratings/:uid', (req, res) => {
    const uid = req.params.uid;
    const user = store.users[uid];
    const username = user ? user.username : 'Kỳ thủ';
    const modes: RatedMode[] = ['blitz', 'standard', 'dark'];
    const result: Record<string, any> = {};

    for (const m of modes) {
      getUserModeElo(uid, username, m);
      result[m] = store.ratings[`${uid}_${m}`];
    }
    return res.json({ ratings: result });
  });

  app.get('/api/leaderboard', (req, res) => {
    const mode = (req.query.mode as RatedMode) || 'blitz';
    const period = String(req.query.period || 'all');
    const now = Date.now();
    const minTime =
      period === 'week'
        ? now - 7 * 86400_000
        : period === 'month'
        ? now - 30 * 86400_000
        : 0;

    const adminUids = new Set(Object.keys(store.admins));

    const entries = Object.values(store.ratings)
      .filter((r) => {
        if (r.mode !== mode) return false;
        if (adminUids.has(r.uid)) return false;
        if (store.users[r.uid]?.role === 'admin') return false;
        if (r.username?.toLowerCase() === ADMIN_USERNAME.toLowerCase()) return false;
        if (r.hiddenFromLeaderboard) return false;
        if (minTime > 0 && (r.lastRatedGameAt || 0) < minTime) return false;
        return true;
      })
      .sort((a, b) => b.elo - a.elo)
      .slice(0, 100);

    return res.json({ leaderboard: entries });
  });

  // ==================== ADMIN API (ROLE=ADMIN VERIFIED AT SERVER) ====================

  function verifyAdminRequest(req: express.Request, res: express.Response): boolean {
    const adminUid = String(req.headers['x-admin-uid'] || req.body?.adminUid || '');
    if (!adminUid) {
      res.status(403).json({ error: 'Từ chối truy cập (Thiếu thông tin Admin)' });
      return false;
    }
    const adminUser = store.users[adminUid];
    if (!adminUser || adminUser.role !== 'admin') {
      res.status(403).json({ error: 'Chỉ quản trị viên mới có quyền thực hiện' });
      return false;
    }
    return true;
  }

  app.get('/api/admin/overview', (req, res) => {
    if (!verifyAdminRequest(req, res)) return;

    const ratingsByUid: Record<string, Record<string, number>> = {};
    Object.values(store.ratings).forEach((data) => {
      if (!ratingsByUid[data.uid]) ratingsByUid[data.uid] = {};
      ratingsByUid[data.uid][data.mode] = data.elo;
    });

    const users = Object.values(store.users)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((u) => ({
        ...u,
        ratings: ratingsByUid[u.uid] || { blitz: 1200, standard: 1200, dark: 1200 },
      }));

    return res.json({
      users,
      loginRequests: Object.values(store.loginRequests).sort(
        (a, b) => b.updatedAt - a.updatedAt
      ),
      activeRooms: Array.from(liveRooms.values()).map((r) => serializeRoomForClient(r)),
      games: Object.values(store.games)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 50),
      ratingHistory: Object.values(store.ratingHistory)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 80),
      config: getAdminConfig(),
    });
  });

  app.post('/api/admin/user-action', async (req, res) => {
    try {
      if (!verifyAdminRequest(req, res)) return;

      const { targetUid, action, payload } = req.body;
      const userData = store.users[String(targetUid)];
      if (!userData) {
        return res.status(404).json({ error: 'Không tìm thấy người dùng' });
      }
      const now = Date.now();

      if (action === 'approve_account') {
        userData.isCreateAccount = true;
        userData.updatedAt = now;
        emitToUser(targetUid, 'user:updated', { user: userData });
      } else if (action === 'reject_account') {
        userData.isCreateAccount = false;
        userData.updatedAt = now;
        emitToUser(targetUid, 'user:updated', { user: userData });
      } else if (action === 'toggle_lock') {
        const nextLock = !userData.isLocked;
        userData.isLocked = nextLock;
        if (nextLock) {
          userData.isLogin = false;
          userData.activeSessionId = '';
          emitToUser(targetUid, 'session:kicked', { reason: 'Tài khoản đã bị khóa' });
        }
        userData.updatedAt = now;
      } else if (action === 'force_logout') {
        userData.isLogin = false;
        userData.activeSessionId = '';
        userData.updatedAt = now;
        emitToUser(targetUid, 'session:kicked', {
          reason: 'Quản trị viên đã đặt lại phiên đăng nhập',
        });
      } else if (action === 'reset_password') {
        const newPass = String(payload?.newPassword || '123456');
        const passwordHash = await bcrypt.hash(newPass, 10);
        store.userSecrets[String(targetUid)] = {
          uid: String(targetUid),
          passwordHash,
          updatedAt: now,
        };
      } else if (action === 'update_elo') {
        const mode = (payload?.mode as RatedMode) || 'blitz';
        const newElo = Math.max(100, Math.min(3500, Number(payload?.elo || 1200)));
        const rKey = `${targetUid}_${mode}`;
        getUserModeElo(targetUid, userData.username, mode);
        const existingRating = store.ratings[rKey];
        const beforeElo = existingRating.elo ?? 1200;

        existingRating.elo = newElo;
        existingRating.peakElo = Math.max(newElo, existingRating.peakElo || 1200);
        existingRating.hiddenFromLeaderboard = false;
        existingRating.updatedAt = now;

        const histId = `hist_${now}_${Math.random().toString(36).slice(2, 7)}`;
        store.ratingHistory[histId] = {
          id: histId,
          uid: targetUid,
          username: userData.username,
          mode,
          beforeElo,
          afterElo: newElo,
          delta: newElo - beforeElo,
          boostPenalty: 0,
          reason: 'Admin điều chỉnh',
          gameId: 'admin',
          createdAt: now,
        };
      } else if (action === 'delete_user') {
        if (userData.role === 'admin') {
          return res.status(400).json({ error: 'Không thể xóa tài khoản Admin' });
        }
        delete store.usernames[userData.username.toLowerCase()];
        delete store.userSecrets[String(targetUid)];
        delete store.users[String(targetUid)];
        emitToUser(targetUid, 'session:kicked', { reason: 'Tài khoản đã bị xóa' });
      }

      saveStore();
      if (store.users[String(targetUid)]) {
        mirrorToFirestore('users', String(targetUid), store.users[String(targetUid)]);
      }
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Lỗi thực thi thao tác quản trị' });
    }
  });

  app.post('/api/admin/login-request-action', (req, res) => {
    if (!verifyAdminRequest(req, res)) return;
    const { requestId, decision } = req.body;
    const reqDoc = store.loginRequests[String(requestId)];
    if (!reqDoc) {
      return res.status(404).json({ error: 'Không tìm thấy yêu cầu' });
    }
    reqDoc.status = decision === 'approved' ? 'approved' : 'rejected';
    reqDoc.updatedAt = Date.now();
    saveStore();
    mirrorToFirestore('loginRequests', String(requestId), reqDoc);
    broadcastAdminUpdate();
    return res.json({ ok: true, request: reqDoc });
  });

  app.post('/api/admin/config', (req, res) => {
    if (!verifyAdminRequest(req, res)) return;
    const updates = {
      antiBoostWindowGames: Number(req.body.antiBoostWindowGames ?? 5),
      antiBoostThreshold: Number(req.body.antiBoostThreshold ?? 2),
      antiBoostMaxPenalty: Number(req.body.antiBoostMaxPenalty ?? 2),
      decayDays: Number(req.body.decayDays ?? 7),
      decayPenalty: Number(req.body.decayPenalty ?? 20),
      resetDays: Number(req.body.resetDays ?? 14),
      cleanupHour: Number(req.body.cleanupHour ?? 22),
      blitzMinutes: Number(req.body.blitzMinutes ?? 5),
      blitzIncrementSec: Number(req.body.blitzIncrementSec ?? 3),
      standardMinutes: Number(req.body.standardMinutes ?? 30),
      standardMoveSec: Number(req.body.standardMoveSec ?? 120),
      darkMinutes: Number(req.body.darkMinutes ?? 15),
      darkMoveSec: Number(req.body.darkMoveSec ?? 120),
      updatedAt: Date.now(),
    };
    store.adminConfig['global'] = updates;
    saveStore();
    mirrorToFirestore('adminConfig', 'global', updates);
    return res.json({ ok: true, config: updates });
  });

  // ==================== CRON ENDPOINTS (CLEANUP 22:00 & RATING DECAY 00:05) ====================

  function runRoomCleanupJob() {
    let removedCount = 0;
    let markedCount = 0;
    for (const [code, room] of liveRooms.entries()) {
      if (room.status !== 'playing') {
        liveRooms.delete(code);
        delete store.rooms[code];
        mirrorToFirestore('rooms', code, null);
        io.to(code).emit('room:closed', { reason: 'Phòng được dọn định kỳ lúc 22:00' });
        removedCount++;
      } else {
        room.cleanupAfterFinish = true;
        markedCount++;
      }
    }
    saveStore();
    return { removedCount, markedCount };
  }

  function runRatingDecayJob() {
    const cfg = getAdminConfig();
    const now = Date.now();
    let decayedCount = 0;
    let resetCount = 0;

    for (const r of Object.values(store.ratings)) {
      const res = evaluateInactivityDecay(
        {
          elo: r.elo,
          gamesPlayed: r.gamesPlayed,
          lastRatedGameAt: r.lastRatedGameAt,
          decayApplied: r.decayApplied,
          hiddenFromLeaderboard: r.hiddenFromLeaderboard,
          provisional: r.provisional,
        },
        now,
        cfg
      );

      if (res.action !== 'none') {
        const beforeElo = r.elo;
        r.elo = res.afterElo;
        r.decayApplied = res.decayApplied;
        r.hiddenFromLeaderboard = res.hiddenFromLeaderboard;
        r.provisional = res.provisional;
        if (res.action === 'reset') {
          r.gamesPlayed = 0;
        }
        r.updatedAt = now;

        const histId = `hist_${now}_${Math.random().toString(36).slice(2, 7)}`;
        const reasonText =
          res.action === 'reset'
            ? 'Reset Elo (>14 ngày không hoạt động)'
            : 'Trừ điểm không hoạt động (7 ngày)';

        store.ratingHistory[histId] = {
          id: histId,
          uid: r.uid,
          username: r.username || '',
          mode: r.mode,
          beforeElo,
          afterElo: res.afterElo,
          delta: res.delta,
          boostPenalty: 0,
          reason: reasonText,
          gameId: res.action,
          createdAt: now,
        };

        if (store.users[r.uid]) {
          store.users[r.uid].lastDecayNotice = `${reasonText}: ${beforeElo} → ${res.afterElo} (${r.mode})`;
          store.users[r.uid].updatedAt = now;
        }

        if (res.action === 'decay') decayedCount++;
        if (res.action === 'reset') resetCount++;
      }
    }

    saveStore();
    return { decayedCount, resetCount };
  }

  app.post('/api/cron/cleanup-rooms', (req, res) => {
    const secret = req.headers['x-cron-secret'];
    const adminUid = req.headers['x-admin-uid'];
    if (secret !== CRON_SECRET && !adminUid) {
      return res.status(401).json({ error: 'Unauthorized cron request' });
    }
    const result = runRoomCleanupJob();
    return res.json({ ok: true, ...result });
  });

  app.post('/api/cron/rating-decay', (req, res) => {
    const secret = req.headers['x-cron-secret'];
    const adminUid = req.headers['x-admin-uid'];
    if (secret !== CRON_SECRET && !adminUid) {
      return res.status(401).json({ error: 'Unauthorized cron request' });
    }
    const result = runRatingDecayJob();
    return res.json({ ok: true, ...result });
  });

  let lastCleanupDate = '';
  let lastDecayDate = '';
  setInterval(() => {
    try {
      const vnTime = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
      );
      const dateKey = `${vnTime.getFullYear()}-${vnTime.getMonth() + 1}-${vnTime.getDate()}`;
      const hour = vnTime.getHours();
      const minute = vnTime.getMinutes();

      const cfg = getAdminConfig();
      if (hour === (cfg.cleanupHour ?? 22) && minute === 0 && lastCleanupDate !== dateKey) {
        lastCleanupDate = dateKey;
        runRoomCleanupJob();
      }
      if (hour === 0 && minute === 5 && lastDecayDate !== dateKey) {
        lastDecayDate = dateKey;
        runRatingDecayJob();
      }
    } catch (e) {
      console.error('Cron tick error:', e);
    }
  }, 45_000);

  // ==================== SOCKET.IO REALTIME ROOMS & MATCH ENGINE ====================

  function finalizeRealtimeGame(
    room: LiveRoom,
    winner: 'red' | 'black' | 'draw',
    reason: string
  ) {
    if (room.status === 'finished') return;
    room.status = 'finished';
    room.winner = winner;
    room.endReason = reason;
    room.drawOfferBy = null;
    room.updatedAt = Date.now();

    if (room.redPlayer && room.blackPlayer) {
      try {
        const cfg = getAdminConfig();
        const mode = room.mode;
        const redDocId = `${room.redPlayer.uid}_${mode}`;
        const blackDocId = `${room.blackPlayer.uid}_${mode}`;

        getUserModeElo(room.redPlayer.uid, room.redPlayer.username, mode);
        getUserModeElo(room.blackPlayer.uid, room.blackPlayer.username, mode);

        const redData = store.ratings[redDocId];
        const blackData = store.ratings[blackDocId];

        const eloRes = calculateMatchElo({
          redElo: redData.elo ?? 1200,
          redGames: redData.gamesPlayed ?? 0,
          redProvisional: redData.provisional,
          blackElo: blackData.elo ?? 1200,
          blackGames: blackData.gamesPlayed ?? 0,
          blackProvisional: blackData.provisional,
          outcome: winner,
          redUid: room.redPlayer.uid,
          blackUid: room.blackPlayer.uid,
          redRecentOpponents: redData.recentOpponents || [],
          blackRecentOpponents: blackData.recentOpponents || [],
          config: cfg,
        });

        room.eloResult = eloRes;
        room.redPlayer.elo = eloRes.redAfter;
        room.blackPlayer.elo = eloRes.blackAfter;

        const now = Date.now();
        const gameId = `game_${now}_${room.code}`;

        const nextRedGames = (redData.gamesPlayed || 0) + 1;
        const nextBlackGames = (blackData.gamesPlayed || 0) + 1;

        store.ratings[redDocId] = {
          ...redData,
          elo: eloRes.redAfter,
          peakElo: Math.max(redData.peakElo || 1200, eloRes.redAfter),
          gamesPlayed: nextRedGames,
          wins: (redData.wins || 0) + (winner === 'red' ? 1 : 0),
          losses: (redData.losses || 0) + (winner === 'black' ? 1 : 0),
          draws: (redData.draws || 0) + (winner === 'draw' ? 1 : 0),
          provisional: nextRedGames < 30,
          decayApplied: false,
          hiddenFromLeaderboard: false,
          lastRatedGameAt: now,
          recentOpponents: [
            room.blackPlayer.uid,
            ...(redData.recentOpponents || []).slice(0, 9),
          ],
          updatedAt: now,
        };

        store.ratings[blackDocId] = {
          ...blackData,
          elo: eloRes.blackAfter,
          peakElo: Math.max(blackData.peakElo || 1200, eloRes.blackAfter),
          gamesPlayed: nextBlackGames,
          wins: (blackData.wins || 0) + (winner === 'black' ? 1 : 0),
          losses: (blackData.losses || 0) + (winner === 'red' ? 1 : 0),
          draws: (blackData.draws || 0) + (winner === 'draw' ? 1 : 0),
          provisional: nextBlackGames < 30,
          decayApplied: false,
          hiddenFromLeaderboard: false,
          lastRatedGameAt: now,
          recentOpponents: [
            room.redPlayer.uid,
            ...(blackData.recentOpponents || []).slice(0, 9),
          ],
          updatedAt: now,
        };

        store.ratingHistory[`hist_${now}_r`] = {
          id: `hist_${now}_r`,
          uid: room.redPlayer.uid,
          username: room.redPlayer.username,
          mode,
          beforeElo: eloRes.redBefore,
          afterElo: eloRes.redAfter,
          delta: eloRes.redDelta,
          boostPenalty: eloRes.redBoostPenalty,
          reason: `Đấu với ${room.blackPlayer.username} (${reason})`,
          gameId,
          createdAt: now,
        };

        store.ratingHistory[`hist_${now}_b`] = {
          id: `hist_${now}_b`,
          uid: room.blackPlayer.uid,
          username: room.blackPlayer.username,
          mode,
          beforeElo: eloRes.blackBefore,
          afterElo: eloRes.blackAfter,
          delta: eloRes.blackDelta,
          boostPenalty: eloRes.blackBoostPenalty,
          reason: `Đấu với ${room.redPlayer.username} (${reason})`,
          gameId,
          createdAt: now,
        };

        const wxfPairs: string[] = [];
        for (let i = 0; i < room.moves.length; i += 2) {
          const m1 = room.moves[i]?.wxf || '';
          const m2 = room.moves[i + 1]?.wxf || '';
          wxfPairs.push(`${Math.floor(i / 2) + 1}. ${m1}${m2 ? ' ' + m2 : ''}`);
        }
        store.games[gameId] = {
          id: gameId,
          mode,
          redUid: room.redPlayer.uid,
          redName: room.redPlayer.username,
          blackUid: room.blackPlayer.uid,
          blackName: room.blackPlayer.username,
          winner,
          reason,
          initialFen: room.initialFen,
          finalFen: boardToFen(room.board, room.turn, false),
          moveCount: room.moves.length,
          wxfText: wxfPairs.join(' '),
          createdAt: now,
          updatedAt: now,
        };
        store.moves[gameId] = room.moves;
        saveStore();
      } catch (err) {
        console.error('Error updating Elo after match:', err);
      }
    }

    persistRoomSnapshot(room);
    io.to(room.code).emit('room:state', serializeRoomForClient(room));

    if (room.cleanupAfterFinish) {
      setTimeout(() => {
        if (liveRooms.get(room.code)?.status === 'finished') {
          liveRooms.delete(room.code);
          delete store.rooms[room.code];
          saveStore();
        }
      }, 60_000);
    }
  }

  setInterval(() => {
    const now = Date.now();
    for (const room of liveRooms.values()) {
      if (room.status !== 'playing') continue;
      const elapsed = now - room.lastTickAt;
      if (elapsed <= 0) continue;
      room.lastTickAt = now;

      if (room.turn === 'r') {
        room.redTimeMs -= elapsed;
      } else {
        room.blackTimeMs -= elapsed;
      }

      if (room.moveTimeLimitMs > 0) {
        room.currentMoveRemainingMs -= elapsed;
      }

      if (
        room.redPlayer &&
        !room.redPlayer.connected &&
        room.redPlayer.disconnectDeadline &&
        now >= room.redPlayer.disconnectDeadline
      ) {
        finalizeRealtimeGame(room, 'black', 'Đỏ mất kết nối quá 60 giây');
        continue;
      }
      if (
        room.blackPlayer &&
        !room.blackPlayer.connected &&
        room.blackPlayer.disconnectDeadline &&
        now >= room.blackPlayer.disconnectDeadline
      ) {
        finalizeRealtimeGame(room, 'red', 'Đen mất kết nối quá 60 giây');
        continue;
      }

      if (room.moveTimeLimitMs > 0 && room.currentMoveRemainingMs <= 0) {
        const winner = room.turn === 'r' ? 'black' : 'red';
        finalizeRealtimeGame(
          room,
          winner,
          `${room.turn === 'r' ? 'Đỏ' : 'Đen'} quá 2 phút cho 1 nước đi`
        );
        continue;
      }

      if (room.redTimeMs <= 0) {
        finalizeRealtimeGame(room, 'black', 'Đỏ hết thời gian');
        continue;
      }
      if (room.blackTimeMs <= 0) {
        finalizeRealtimeGame(room, 'red', 'Đen hết thời gian');
        continue;
      }
    }
  }, 250);

  setInterval(() => {
    for (const room of liveRooms.values()) {
      if (room.status === 'playing') {
        io.to(room.code).emit('game:clock', {
          redTimeMs: Math.max(0, Math.round(room.redTimeMs)),
          blackTimeMs: Math.max(0, Math.round(room.blackTimeMs)),
          currentMoveRemainingMs: Math.max(0, Math.round(room.currentMoveRemainingMs)),
          redDisconnectDeadline: room.redPlayer?.disconnectDeadline || null,
          blackDisconnectDeadline: room.blackPlayer?.disconnectDeadline || null,
        });
      }
    }
  }, 1000);

  io.on('connection', (socket: Socket) => {
    let boundUid = '';
    let boundUsername = '';
    let currentRoomCode = '';

    socket.on('auth:bind', (payload: { uid: string; username: string }) => {
      if (!payload?.uid) return;
      boundUid = String(payload.uid);
      boundUsername = String(payload.username || 'Kỳ thủ');
      if (!userSockets.has(boundUid)) {
        userSockets.set(boundUid, new Set());
      }
      userSockets.get(boundUid)!.add(socket.id);

      for (const room of liveRooms.values()) {
        const isRed = room.redPlayer?.uid === boundUid;
        const isBlack = room.blackPlayer?.uid === boundUid;
        const spec = room.spectators.find((s) => s.uid === boundUid);
        if (isRed || isBlack || spec) {
          currentRoomCode = room.code;
          socket.join(room.code);
          if (isRed && room.redPlayer) {
            room.redPlayer.connected = true;
            room.redPlayer.disconnectedAt = undefined;
            room.redPlayer.disconnectDeadline = undefined;
          }
          if (isBlack && room.blackPlayer) {
            room.blackPlayer.connected = true;
            room.blackPlayer.disconnectedAt = undefined;
            room.blackPlayer.disconnectDeadline = undefined;
          }
          if (spec) spec.connected = true;
          io.to(room.code).emit('room:state', serializeRoomForClient(room));
          break;
        }
      }
    });

    socket.on('ping:heartbeat', () => {
      socket.emit('pong:heartbeat', { t: Date.now() });
    });

    socket.on('room:list', (payload: { mode?: RatedMode }, cb?: (res: any) => void) => {
      const modeFilter = payload?.mode;
      const list = Array.from(liveRooms.values())
        .filter((r) => (!modeFilter || r.mode === modeFilter) && r.status !== 'finished')
        .map((r) => ({
          code: r.code,
          mode: r.mode,
          status: r.status,
          hostUid: r.hostUid,
          hostName:
            (r.hostUid === r.redPlayer?.uid ? r.redPlayer?.username : undefined) ||
            (r.hostUid === r.blackPlayer?.uid ? r.blackPlayer?.username : undefined) ||
            r.spectators.find((s) => s.uid === r.hostUid)?.username ||
            r.redPlayer?.username ||
            r.blackPlayer?.username ||
            'Chủ phòng',
          redPlayer: r.redPlayer ? { username: r.redPlayer.username, elo: r.redPlayer.elo } : null,
          blackPlayer: r.blackPlayer
            ? { username: r.blackPlayer.username, elo: r.blackPlayer.elo }
            : null,
          playerCount: (r.redPlayer ? 1 : 0) + (r.blackPlayer ? 1 : 0),
          spectatorCount: r.spectators.length,
        }));
      if (typeof cb === 'function') cb({ rooms: list });
    });

    socket.on(
      'room:create',
      (payload: { uid: string; username: string; mode: RatedMode }, cb?: (res: any) => void) => {
        try {
          const uid = String(payload?.uid || boundUid);
          const user = store.users[uid];
          if (!user || !user.isCreateAccount) {
            return cb?.({ error: 'Tài khoản chờ duyệt chưa thể tạo phòng xếp hạng' });
          }

          const mode: RatedMode = payload.mode || 'blitz';
          const username = user.username;
          const elo = getUserModeElo(uid, username, mode);
          const cfg = getAdminConfig();
          const tc = getTimeControlForMode(mode, cfg);

          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let code = '';
          do {
            code = Array.from(
              { length: 6 },
              () => chars[Math.floor(Math.random() * chars.length)]
            ).join('');
          } while (liveRooms.has(code));

          const { board } =
            mode === 'dark' ? createDarkXiangqiBoard() : parseFen(INITIAL_FEN);
          const now = Date.now();

          const room: LiveRoom = {
            code,
            mode,
            hostUid: uid,
            status: 'waiting',
            redPlayer: { uid, username, elo, connected: true },
            blackPlayer: null,
            spectators: [],
            board,
            turn: 'r',
            initialFen: boardToFen(board, 'r', false),
            fenHistory: [],
            checkHistory: [],
            moves: [],
            redTimeMs: tc.totalMs,
            blackTimeMs: tc.totalMs,
            moveTimeLimitMs: tc.moveLimitMs,
            incrementMs: tc.incrementMs,
            currentMoveRemainingMs: tc.moveLimitMs,
            lastTickAt: now,
            turnDeadline: 0,
            drawOfferBy: null,
            chat: [
              {
                id: `sys_${now}`,
                senderUid: 'system',
                senderName: 'Hệ thống',
                text: `${username} vào phòng`,
                type: 'system',
                timestamp: now,
              },
            ],
            createdAt: now,
            updatedAt: now,
          };

          liveRooms.set(code, room);
          currentRoomCode = code;
          socket.join(code);
          persistRoomSnapshot(room);

          cb?.({ room: serializeRoomForClient(room) });
        } catch (e) {
          cb?.({ error: 'Lỗi tạo phòng' });
        }
      }
    );

    socket.on(
      'room:join',
      (
        payload: { code: string; uid: string; username: string; asSpectator?: boolean },
        cb?: (res: any) => void
      ) => {
        try {
          const code = String(payload?.code || '').trim().toUpperCase();
          const uid = String(payload?.uid || boundUid);
          const room = liveRooms.get(code);
          if (!room) {
            return cb?.({ error: 'Không tìm thấy phòng' });
          }

          const user = store.users[uid];
          if (!user || !user.isCreateAccount) {
            return cb?.({ error: 'Tài khoản chờ duyệt chưa thể vào phòng xếp hạng' });
          }

          const username = user.username;
          const elo = getUserModeElo(uid, username, room.mode);

          if (room.redPlayer?.uid === uid) {
            room.redPlayer.connected = true;
            room.redPlayer.disconnectDeadline = undefined;
          } else if (room.blackPlayer?.uid === uid) {
            room.blackPlayer.connected = true;
            room.blackPlayer.disconnectDeadline = undefined;
          } else if (!payload.asSpectator && room.status !== 'playing' && !room.redPlayer) {
            room.redPlayer = { uid, username, elo, connected: true };
          } else if (!payload.asSpectator && room.status !== 'playing' && !room.blackPlayer) {
            room.blackPlayer = { uid, username, elo, connected: true };
          } else {
            const existingSpec = room.spectators.find((s) => s.uid === uid);
            if (existingSpec) {
              existingSpec.connected = true;
            } else {
              if (room.spectators.length >= 6) {
                return cb?.({ error: 'Phòng đã đủ 2 người chơi và 6 người xem' });
              }
              room.spectators.push({ uid, username, elo, connected: true });
            }
          }

          currentRoomCode = code;
          socket.join(code);
          const now = Date.now();
          room.chat.push({
            id: `sys_${now}_${Math.random()}`,
            senderUid: 'system',
            senderName: 'Hệ thống',
            text: `${username} vào phòng`,
            type: 'system',
            timestamp: now,
          });

          persistRoomSnapshot(room);
          const serialized = serializeRoomForClient(room);
          io.to(code).emit('room:state', serialized);
          cb?.({ room: serialized });
        } catch (e) {
          cb?.({ error: 'Lỗi vào phòng' });
        }
      }
    );

    socket.on(
      'room:switch_seat',
      (
        payload: { code: string; uid: string; targetSeat: 'red' | 'black' | 'spectator' },
        cb?: (res: any) => void
      ) => {
        try {
          const code = String(payload?.code || currentRoomCode).toUpperCase();
          const uid = String(payload?.uid || boundUid);
          const targetSeat = payload?.targetSeat;
          const room = liveRooms.get(code);
          if (!room) return cb?.({ error: 'Không tìm thấy phòng' });
          if (room.status !== 'waiting') return cb?.({ error: 'Chỉ có thể đổi ghế ở phòng chờ' });

          const user = store.users[uid];
          const username = user?.username || boundUsername || 'Người chơi';
          const elo = getUserModeElo(uid, username, room.mode);

          const isRed = room.redPlayer?.uid === uid;
          const isBlack = room.blackPlayer?.uid === uid;
          const specIdx = room.spectators.findIndex((s) => s.uid === uid);
          const isSpec = specIdx !== -1;

          if (targetSeat === 'red') {
            if (isRed) return cb?.({ room: serializeRoomForClient(room) });
            if (room.redPlayer) return cb?.({ error: 'Ghế Đỏ đã có người ngồi' });
            if (isBlack) room.blackPlayer = null;
            if (isSpec) room.spectators.splice(specIdx, 1);
            room.redPlayer = { uid, username, elo, connected: true };
          } else if (targetSeat === 'black') {
            if (isBlack) return cb?.({ room: serializeRoomForClient(room) });
            if (room.blackPlayer) return cb?.({ error: 'Ghế Đen đã có người ngồi' });
            if (isRed) room.redPlayer = null;
            if (isSpec) room.spectators.splice(specIdx, 1);
            room.blackPlayer = { uid, username, elo, connected: true };
          } else if (targetSeat === 'spectator') {
            if (isSpec) return cb?.({ room: serializeRoomForClient(room) });
            if (room.spectators.length >= 6) return cb?.({ error: 'Ghế khán giả đã đầy (6/6)' });
            if (isRed) room.redPlayer = null;
            if (isBlack) room.blackPlayer = null;
            room.spectators.push({ uid, username, elo, connected: true });
          }

          persistRoomSnapshot(room);
          const serialized = serializeRoomForClient(room);
          io.to(code).emit('room:state', serialized);
          cb?.({ room: serialized });
        } catch (e) {
          cb?.({ error: 'Lỗi đổi ghế' });
        }
      }
    );

    socket.on('room:start', (payload: { code: string; uid: string }, cb?: (res: any) => void) => {
      const code = String(payload?.code || currentRoomCode).toUpperCase();
      const uid = String(payload?.uid || boundUid);
      const room = liveRooms.get(code);
      if (!room) return cb?.({ error: 'Phòng không tồn tại' });
      if (room.hostUid !== uid) {
        return cb?.({ error: 'Chỉ chủ phòng mới được bấm Bắt đầu' });
      }
      if (!room.redPlayer || !room.blackPlayer) {
        return cb?.({ error: 'Cần đủ 2 người chơi để bắt đầu' });
      }

      const cfg = getAdminConfig();
      const tc = getTimeControlForMode(room.mode, cfg);
      const { board } =
        room.mode === 'dark' ? createDarkXiangqiBoard() : parseFen(INITIAL_FEN);
      const now = Date.now();

      room.status = 'playing';
      room.board = board;
      room.turn = 'r';
      room.initialFen = boardToFen(board, 'r', false);
      room.fenHistory = [room.initialFen];
      room.checkHistory = [];
      room.moves = [];
      room.redTimeMs = tc.totalMs;
      room.blackTimeMs = tc.totalMs;
      room.moveTimeLimitMs = tc.moveLimitMs;
      room.incrementMs = tc.incrementMs;
      room.currentMoveRemainingMs = tc.moveLimitMs;
      room.lastTickAt = now;
      room.turnDeadline = tc.moveLimitMs > 0 ? now + tc.moveLimitMs : now + tc.totalMs;
      room.winner = 'ongoing';
      room.endReason = '';
      room.eloResult = null;
      room.drawOfferBy = null;
      room.updatedAt = now;

      persistRoomSnapshot(room);
      const serialized = serializeRoomForClient(room);
      io.to(code).emit('room:state', serialized);
      cb?.({ room: serialized });
    });

    socket.on(
      'game:move',
      (
        payload: { code: string; uid: string; from: { row: number; col: number }; to: { row: number; col: number } },
        cb?: (res: any) => void
      ) => {
        const code = String(payload?.code || currentRoomCode).toUpperCase();
        const uid = String(payload?.uid || boundUid);
        const room = liveRooms.get(code);
        if (!room || room.status !== 'playing') {
          return cb?.({ error: 'Ván đấu không hoạt động' });
        }

        const playerColor: PieceColor | null =
          room.redPlayer?.uid === uid ? 'r' : room.blackPlayer?.uid === uid ? 'b' : null;
        if (!playerColor || playerColor !== room.turn) {
          return cb?.({ error: 'Chưa tới lượt của bạn' });
        }

        const isDark = room.mode === 'dark';
        const legal = getLegalMovesForSquare(room.board, payload.from, isDark);
        if (!legal.some((m) => m.row === payload.to.row && m.col === payload.to.col)) {
          return cb?.({ error: 'Nước đi không hợp lệ' });
        }

        const now = Date.now();
        const notation = formatMoveNotation(room.board, payload.from, payload.to);
        const { nextBoard, move } = applyMove(room.board, payload.from, payload.to);
        const nextTurn: PieceColor = room.turn === 'r' ? 'b' : 'r';

        if (room.incrementMs > 0) {
          if (room.turn === 'r') room.redTimeMs += room.incrementMs;
          else room.blackTimeMs += room.incrementMs;
        }
        room.currentMoveRemainingMs = room.moveTimeLimitMs;
        room.lastTickAt = now;
        room.turnDeadline =
          room.moveTimeLimitMs > 0
            ? now + room.moveTimeLimitMs
            : now + (nextTurn === 'r' ? room.redTimeMs : room.blackTimeMs);

        const nextFenServer = boardToFen(nextBoard, nextTurn, false);
        const nextFenClient = boardToFen(nextBoard, nextTurn, isDark);
        const gaveCheck = isKingInCheck(nextBoard, nextTurn, isDark);

        room.board = nextBoard;
        room.turn = nextTurn;
        room.fenHistory.push(nextFenServer);
        room.checkHistory.push({ color: playerColor, gaveCheck });
        room.drawOfferBy = null;

        const formattedMove: FormattedMove = {
          ...move,
          ply: room.moves.length + 1,
          color: playerColor,
          ...notation,
          fen: nextFenClient,
          isCheck: gaveCheck,
        };
        room.moves.push(formattedMove);

        const status = evaluateGameStatus(
          room.board,
          room.turn,
          room.fenHistory,
          room.checkHistory,
          isDark
        );

        if (status.isOver && status.winner !== 'ongoing') {
          finalizeRealtimeGame(room, status.winner, status.reason);
        } else {
          persistRoomSnapshot(room);
          io.to(code).emit('room:state', serializeRoomForClient(room));
        }
        cb?.({ ok: true });
      }
    );

    socket.on('game:resign', (payload: { code: string; uid: string }) => {
      const code = String(payload?.code || currentRoomCode).toUpperCase();
      const uid = String(payload?.uid || boundUid);
      const room = liveRooms.get(code);
      if (!room || room.status !== 'playing') return;

      if (room.redPlayer?.uid === uid) {
        finalizeRealtimeGame(room, 'black', 'Đỏ nhận thua');
      } else if (room.blackPlayer?.uid === uid) {
        finalizeRealtimeGame(room, 'red', 'Đen nhận thua');
      }
    });

    socket.on('game:draw_offer', (payload: { code: string; uid: string }) => {
      const code = String(payload?.code || currentRoomCode).toUpperCase();
      const uid = String(payload?.uid || boundUid);
      const room = liveRooms.get(code);
      if (!room || room.status !== 'playing') return;

      const color: PieceColor | null =
        room.redPlayer?.uid === uid ? 'r' : room.blackPlayer?.uid === uid ? 'b' : null;
      if (!color) return;
      room.drawOfferBy = color;
      io.to(code).emit('room:state', serializeRoomForClient(room));
    });

    socket.on(
      'game:draw_respond',
      (payload: { code: string; uid: string; accept: boolean }) => {
        const code = String(payload?.code || currentRoomCode).toUpperCase();
        const uid = String(payload?.uid || boundUid);
        const room = liveRooms.get(code);
        if (!room || room.status !== 'playing' || !room.drawOfferBy) return;

        const responderColor: PieceColor | null =
          room.redPlayer?.uid === uid ? 'r' : room.blackPlayer?.uid === uid ? 'b' : null;
        if (!responderColor || responderColor === room.drawOfferBy) return;

        if (payload.accept) {
          finalizeRealtimeGame(room, 'draw', 'Thỏa thuận hòa');
        } else {
          room.drawOfferBy = null;
          io.to(code).emit('room:state', serializeRoomForClient(room));
        }
      }
    );

    socket.on(
      'chat:send',
      (payload: {
        code: string;
        uid: string;
        username: string;
        text: string;
        type?: 'text' | 'emoji' | 'quick';
      }) => {
        const code = String(payload?.code || currentRoomCode).toUpperCase();
        const uid = String(payload?.uid || boundUid);
        const room = liveRooms.get(code);
        if (!room || !uid) return;

        const now = Date.now();
        const lastSent = chatRateLimit.get(uid) || 0;
        if (now - lastSent < 1000) return;
        chatRateLimit.set(uid, now);

        const cleanText = sanitizeChatText(String(payload.text || ''));
        if (!cleanText) return;

        const isSpectator =
          room.redPlayer?.uid !== uid && room.blackPlayer?.uid !== uid;

        const msg: ChatMessage = {
          id: `msg_${now}_${Math.random().toString(36).slice(2, 6)}`,
          senderUid: uid,
          senderName: String(payload.username || boundUsername || 'Kỳ thủ').slice(0, 24),
          text: cleanText,
          type: payload.type || 'text',
          isSpectator,
          timestamp: now,
        };

        room.chat.push(msg);
        if (room.chat.length > 80) room.chat.shift();
        io.to(code).emit('chat:message', msg);
      }
    );

    socket.on('room:leave', (payload: { code?: string; uid?: string }) => {
      const code = String(payload?.code || currentRoomCode).toUpperCase();
      const uid = String(payload?.uid || boundUid);
      const room = liveRooms.get(code);
      if (!room) return;

      socket.leave(code);
      if (currentRoomCode === code) currentRoomCode = '';

      const now = Date.now();
      let leaverName = boundUsername || 'Người chơi';

      if (room.status === 'playing') {
        if (room.redPlayer?.uid === uid) {
          leaverName = room.redPlayer.username;
          room.redPlayer.connected = false;
          room.redPlayer.disconnectedAt = now;
          room.redPlayer.disconnectDeadline = now + 60_000;
        } else if (room.blackPlayer?.uid === uid) {
          leaverName = room.blackPlayer.username;
          room.blackPlayer.connected = false;
          room.blackPlayer.disconnectedAt = now;
          room.blackPlayer.disconnectDeadline = now + 60_000;
        } else {
          room.spectators = room.spectators.filter((s) => s.uid !== uid);
        }
      } else {
        if (room.redPlayer?.uid === uid) {
          leaverName = room.redPlayer.username;
          room.redPlayer = null;
        } else if (room.blackPlayer?.uid === uid) {
          leaverName = room.blackPlayer.username;
          room.blackPlayer = null;
        } else {
          const sp = room.spectators.find((s) => s.uid === uid);
          if (sp) leaverName = sp.username;
          room.spectators = room.spectators.filter((s) => s.uid !== uid);
        }

        if (!room.redPlayer && !room.blackPlayer && room.spectators.length === 0) {
          liveRooms.delete(code);
          delete store.rooms[code];
          saveStore();
          return;
        }
        if (room.hostUid === uid) {
          room.hostUid =
            room.redPlayer?.uid ||
            room.blackPlayer?.uid ||
            room.spectators[0]?.uid ||
            '';
        }
      }

      room.chat.push({
        id: `sys_${now}_${Math.random()}`,
        senderUid: 'system',
        senderName: 'Hệ thống',
        text: `${leaverName} rời phòng`,
        type: 'system',
        timestamp: now,
      });

      io.to(code).emit('room:state', serializeRoomForClient(room));
    });

    socket.on('disconnect', () => {
      if (boundUid && userSockets.has(boundUid)) {
        const set = userSockets.get(boundUid)!;
        set.delete(socket.id);
        if (set.size === 0) {
          userSockets.delete(boundUid);
          const now = Date.now();
          for (const room of liveRooms.values()) {
            let changed = false;
            if (room.redPlayer?.uid === boundUid) {
              room.redPlayer.connected = false;
              if (room.status === 'playing') {
                room.redPlayer.disconnectedAt = now;
                room.redPlayer.disconnectDeadline = now + 60_000;
              }
              changed = true;
            }
            if (room.blackPlayer?.uid === boundUid) {
              room.blackPlayer.connected = false;
              if (room.status === 'playing') {
                room.blackPlayer.disconnectedAt = now;
                room.blackPlayer.disconnectDeadline = now + 60_000;
              }
              changed = true;
            }
            if (changed) {
              io.to(room.code).emit('room:state', serializeRoomForClient(room));
            }
          }
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Xiangqi Master server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
