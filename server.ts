import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fork, ChildProcess } from 'child_process';
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
  parseUciMove,
  findBestMove,
  AIDifficulty,
} from './src/workers/ai.worker';
import {
  RatedMode,
  EloConfig,
  DEFAULT_ELO_CONFIG,
  DEFAULT_INITIAL_ELO,
  MIN_RATED_ELO,
  calculateMatchElo,
  evaluateInactivityDecay,
} from './src/shared/elo';

import { initializeApp as initFirebaseApp } from 'firebase/app';
import {
  getFirestore,
  setLogLevel,
  doc as fsDoc,
  getDoc as fsGetDoc,
  getDocFromServer as fsGetDocFromServer,
  setDoc as fsSetDoc,
  deleteDoc as fsDeleteDoc,
  getDocs as fsGetDocs,
  getDocsFromServer as fsGetDocsFromServer,
  collection as fsCollection,
} from 'firebase/firestore';

setLogLevel('silent');

const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));

const firebaseApp = initFirebaseApp(firebaseConfig);
const firestoreDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const PORT = 3000;
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'thangnc').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'thangnc1';
const ADMIN_DISPLAY_NAME = (process.env.ADMIN_DISPLAY_NAME || 'Nhập Vân Long Công Tôn Thắng').trim();
const CRON_SECRET = process.env.CRON_SECRET || 'xiangqi_cron_secret_2026';

// ==================== REALTIME FIRESTORE HELPERS (PROD & STAGING) ====================

export type ServerEnv = 'prod' | 'staging';

function getColName(col: string, env: ServerEnv = 'prod'): string {
  if (env === 'staging') {
    return `staging_${col}`;
  }
  return col;
}

async function getDocRealtime(col: string, id: string, env: ServerEnv = 'prod'): Promise<any | null> {
  if (!id) return null;
  const targetCol = getColName(col, env);
  const ref = fsDoc(firestoreDb, targetCol, id);
  try {
    const snap = await fsGetDocFromServer(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch {
    const snap = await fsGetDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }
}

async function getCollectionRealtime(col: string, env: ServerEnv = 'prod'): Promise<any[]> {
  const targetCol = getColName(col, env);
  const colRef = fsCollection(firestoreDb, targetCol);
  const filterDoc = (d: any, list: any[]) => {
    if (
      d.id === 'kythu_test' ||
      d.id === 'u_1791663983740_8yh2p' ||
      d.id.includes('kythu_test') ||
      d.id.includes('seed') ||
      d.id.startsWith('game_1791664')
    ) {
      if (env !== 'staging') return;
    }
    const data = d.data();
    if (
      col === 'games' &&
      (data?.mode === 'ai' || data?.redUid === 'ai' || data?.blackUid === 'ai')
    ) {
      return;
    }
    list.push({ id: d.id, ...data });
  };
  try {
    const snap = await fsGetDocsFromServer(colRef);
    const list: any[] = [];
    snap.forEach((d) => filterDoc(d, list));
    return list;
  } catch {
    const snap = await fsGetDocs(colRef);
    const list: any[] = [];
    snap.forEach((d) => filterDoc(d, list));
    return list;
  }
}

async function setDocRealtime(col: string, id: string, data: any, merge = true, env: ServerEnv = 'prod'): Promise<void> {
  if (!id) return;
  const targetCol = getColName(col, env);
  const ref = fsDoc(firestoreDb, targetCol, id);
  await fsSetDoc(ref, data, { merge });
}

async function deleteDocRealtime(col: string, id: string, env: ServerEnv = 'prod'): Promise<void> {
  if (!id) return;
  const targetCol = getColName(col, env);
  const ref = fsDoc(firestoreDb, targetCol, id);
  await fsDeleteDoc(ref);
}

function sanitizeUserForClient(user: any) {
  if (!user) return null;
  const { password: _password, ...rest } = user;
  return rest;
}

function verifyUserPassword(user: any, inputPassword: string): boolean {
  if (!user || user.password === undefined || user.password === null) {
    return false;
  }
  const storedPassword = String(user.password);
  return storedPassword.length > 0 && storedPassword === inputPassword;
}

async function getUserByUidRealtime(uid: string, env: ServerEnv = 'prod'): Promise<any | null> {
  if (!uid) return null;
  const u = await getDocRealtime('users', uid, env);
  if (!u) return null;
  if (!u.uid) u.uid = uid;
  return u;
}

async function getUserByUsernameRealtime(rawUsername: string, env: ServerEnv = 'prod'): Promise<any | null> {
  const norm = rawUsername.trim().toLowerCase();
  if (!norm) return null;

  const unameEntry = await getDocRealtime('usernames', norm, env);
  if (unameEntry?.uid) {
    const user = await getUserByUidRealtime(unameEntry.uid, env);
    if (user && String(user.username || '').toLowerCase() === norm) {
      return user;
    }
  }

  // Fallback: query users collection directly in case user was edited/added in Firestore console
  const allUsers = await getCollectionRealtime('users', env);
  const matched = allUsers.find((u) => String(u.username || '').toLowerCase() === norm);
  if (matched) {
    const uid = matched.uid || matched.id;
    matched.uid = uid;
    await setDocRealtime('usernames', norm, { uid, createdAt: matched.createdAt || Date.now() }, true, env);
    return matched;
  }

  return null;
}

async function getAdminConfigRealtime(env: ServerEnv = 'prod'): Promise<EloConfig & Record<string, any>> {
  const globalCfg = await getDocRealtime('adminConfig', 'global', env);
  return {
    ...DEFAULT_ELO_CONFIG,
    blitzMinutes: 5,
    blitzIncrementSec: 3,
    standardMinutes: 30,
    standardMoveSec: 120,
    darkMinutes: 15,
    darkMoveSec: 120,
    globalTheme: 'classic_wood',
    ...(globalCfg || {}),
  };
}

async function getUserModeRatingRealtime(
  uid: string,
  username: string,
  mode: RatedMode,
  displayName?: string,
  env: ServerEnv = 'prod'
): Promise<any> {
  const docId = `${uid}_${mode}`;
  const existing = await getDocRealtime('ratings', docId, env);
  if (existing) {
    const gamesPlayed = Number(existing.gamesPlayed || 0);
    const curElo = Number(existing.elo ?? DEFAULT_INITIAL_ELO);
    const curDebt = Math.max(0, Math.round(Number(existing.eloDebt || 0)));
    if (gamesPlayed > 0 && !existing.hiddenFromLeaderboard && curElo < MIN_RATED_ELO) {
      const deficit = Math.max(0, MIN_RATED_ELO - curElo);
      existing.elo = MIN_RATED_ELO;
      existing.eloDebt = curDebt + deficit;
      await setDocRealtime(
        'ratings',
        docId,
        { elo: existing.elo, eloDebt: existing.eloDebt },
        true,
        env
      ).catch(() => {});
    } else if (curElo < DEFAULT_INITIAL_ELO) {
      existing.elo = DEFAULT_INITIAL_ELO;
      existing.eloDebt = 0;
      await setDocRealtime(
        'ratings',
        docId,
        { elo: DEFAULT_INITIAL_ELO, eloDebt: 0 },
        true,
        env
      ).catch(() => {});
    }
    return existing;
  }
  const now = Date.now();
  const initialRating = {
    id: docId,
    docId,
    uid,
    username,
    displayName: displayName || username,
    mode,
    elo: DEFAULT_INITIAL_ELO,
    eloDebt: 0,
    peakElo: DEFAULT_INITIAL_ELO,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winStreak: 0,
    longestWinStreak: 0,
    currentWinStreak: 0,
    provisional: true,
    decayApplied: false,
    hiddenFromLeaderboard: false,
    lastRatedGameAt: 0,
    recentOpponents: [] as string[],
    updatedAt: now,
  };
  await setDocRealtime('ratings', docId, initialRating, true, env);
  return initialRating;
}

function computePlayerModeStreak(
  uid: string,
  username: string,
  displayName: string,
  mode: RatedMode,
  gamesList: Record<string, any>[],
  existingRating?: Record<string, any>
): { winStreak: number; longestWinStreak: number; currentWinStreak: number } {
  const uId = String(uid || '').toLowerCase();
  const uName = String(username || '').toLowerCase();
  const dName = String(displayName || '').toLowerCase();
  const pureUid = uId.startsWith('admin_')
    ? uId.slice(6)
    : uId.startsWith('u_')
    ? uId.slice(2)
    : uId;

  const playerGames = gamesList
    .filter((g) => (g.mode || 'standard') === mode)
    .filter((g) => {
      const rUid = String(g.redUid || '').toLowerCase();
      const bUid = String(g.blackUid || '').toLowerCase();
      const rName = String(g.redName || '').toLowerCase();
      const bName = String(g.blackName || '').toLowerCase();

      const isRed =
        (Boolean(rUid) &&
          (rUid === uId ||
            rUid === uName ||
            rUid === `admin_${uName}` ||
            rUid === `u_${uName}` ||
            rUid === pureUid)) ||
        (Boolean(uName) && rName === uName) ||
        (Boolean(dName) && rName === dName);

      const isBlack =
        (Boolean(bUid) &&
          (bUid === uId ||
            bUid === uName ||
            bUid === `admin_${uName}` ||
            bUid === `u_${uName}` ||
            bUid === pureUid)) ||
        (Boolean(uName) && bName === uName) ||
        (Boolean(dName) && bName === dName);

      return isRed || isBlack;
    })
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  let currentWinStreak = 0;
  let longestWinStreak = 0;

  for (const g of playerGames) {
    const rUid = String(g.redUid || '').toLowerCase();
    const bUid = String(g.blackUid || '').toLowerCase();
    const rName = String(g.redName || '').toLowerCase();
    const bName = String(g.blackName || '').toLowerCase();

    const isRed =
      (Boolean(rUid) &&
        (rUid === uId ||
          rUid === uName ||
          rUid === `admin_${uName}` ||
          rUid === `u_${uName}` ||
          rUid === pureUid)) ||
      (Boolean(uName) && rName === uName) ||
      (Boolean(dName) && rName === dName);

    const isBlack =
      (Boolean(bUid) &&
        (bUid === uId ||
          bUid === uName ||
          bUid === `admin_${uName}` ||
          bUid === `u_${uName}` ||
          bUid === pureUid)) ||
      (Boolean(uName) && bName === uName) ||
      (Boolean(dName) && bName === dName);

    const winnerNorm = String(g.winner || '').trim().toLowerCase();
    const isRedWin = winnerNorm === 'r' || winnerNorm === 'red';
    const isBlackWin = winnerNorm === 'b' || winnerNorm === 'black';
    const isDrawResult =
      winnerNorm === 'draw' ||
      winnerNorm === 'd' ||
      winnerNorm === 'tie' ||
      winnerNorm === 'hòa' ||
      winnerNorm === 'hoa';

    let outcome: 'win' | 'draw' | 'loss' = 'loss';
    if (isDrawResult) {
      outcome = 'draw';
    } else if (isRed && isRedWin) {
      outcome = 'win';
    } else if (isBlack && isBlackWin) {
      outcome = 'win';
    } else if (isRed && isBlackWin) {
      outcome = 'loss';
    } else if (isBlack && isRedWin) {
      outcome = 'loss';
    } else {
      const eloDelta = isRed ? g.redEloDelta : isBlack ? g.blackEloDelta : undefined;
      if (typeof eloDelta === 'number') {
        outcome = eloDelta > 0 ? 'win' : eloDelta < 0 ? 'loss' : 'draw';
      } else {
        outcome = 'draw';
      }
    }

    if (outcome === 'win') {
      currentWinStreak += 1;
      if (currentWinStreak > longestWinStreak) {
        longestWinStreak = currentWinStreak;
      }
    } else {
      currentWinStreak = 0;
    }
  }

  if (playerGames.length === 0) {
    const savedLongest = Math.max(
      Number(existingRating?.longestWinStreak || 0),
      Number(existingRating?.winStreak || 0),
      Number(existingRating?.wins || 0) > 0 ? 1 : 0
    );
    const savedCurrent = Number(existingRating?.currentWinStreak || 0);
    return {
      winStreak: savedLongest,
      longestWinStreak: savedLongest,
      currentWinStreak: savedCurrent,
    };
  }

  if (longestWinStreak === 0 && Number(existingRating?.wins || 0) > 0) {
    longestWinStreak = 1;
  }

  return {
    winStreak: longestWinStreak,
    longestWinStreak,
    currentWinStreak,
  };
}

async function getUserModeEloRealtime(
  uid: string,
  username: string,
  mode: RatedMode,
  displayName?: string,
  env: ServerEnv = 'prod'
): Promise<number> {
  const rating = await getUserModeRatingRealtime(uid, username, mode, displayName, env);
  return rating.elo ?? DEFAULT_INITIAL_ELO;
}

async function ensureFirestoreSeeded(env: ServerEnv = 'prod') {
  console.log(`[${env.toUpperCase()}] Checking Firestore Direct Connection (${firebaseConfig.firestoreDatabaseId})...`);
  try {
    const norm = ADMIN_USERNAME.toLowerCase();
    const now = Date.now();

    let adminUser = await getUserByUsernameRealtime(ADMIN_USERNAME, env);
    if (!adminUser) {
      const uid = `admin_${norm}`;
      adminUser = {
        uid,
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD,
        displayName: ADMIN_DISPLAY_NAME,
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
      await setDocRealtime('users', uid, adminUser, true, env);
      await setDocRealtime('usernames', norm, { uid, createdAt: now }, true, env);
      await setDocRealtime('admins', uid, { uid, createdAt: now }, true, env);
      console.log(`[${env.toUpperCase()}] Seeded default admin account: ${ADMIN_USERNAME}`);
    } else {
      const uid = adminUser.uid || `admin_${norm}`;
      const updates: Record<string, any> = {};
      if (adminUser.role !== 'admin') updates.role = 'admin';
      if (!adminUser.isCreateAccount) updates.isCreateAccount = true;
      if (!adminUser.displayName || adminUser.displayName === 'Quản trị viên') {
        updates.displayName = ADMIN_DISPLAY_NAME;
      }
      if (adminUser.password === undefined || adminUser.password === null || adminUser.password === '') {
        updates.password = ADMIN_PASSWORD;
      }
      if (Object.keys(updates).length > 0) {
        await setDocRealtime('users', uid, updates, true, env);
      }
      await setDocRealtime('admins', uid, { uid, createdAt: adminUser.createdAt || now }, true, env);
    }

    // On Staging: seed 2 instant test accounts for frictionless testing of 2 players
    if (env === 'staging') {
      const testAccounts = [
        { username: 'kythu_test1', displayName: 'Kỳ Thủ Thử Nghiệm 1', password: '123' },
        { username: 'kythu_test2', displayName: 'Kỳ Thủ Thử Nghiệm 2', password: '123' },
      ];
      for (const t of testAccounts) {
        const existing = await getUserByUsernameRealtime(t.username, 'staging');
        if (!existing) {
          const tUid = `u_test_${t.username}`;
          const tDoc = {
            uid: tUid,
            username: t.username,
            password: t.password,
            displayName: t.displayName,
            role: 'user',
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
          await setDocRealtime('users', tUid, tDoc, true, 'staging');
          await setDocRealtime('usernames', t.username, { uid: tUid, createdAt: now }, true, 'staging');
          await getUserModeRatingRealtime(tUid, t.username, 'blitz', t.displayName, 'staging');
          await getUserModeRatingRealtime(tUid, t.username, 'standard', t.displayName, 'staging');
          await getUserModeRatingRealtime(tUid, t.username, 'dark', t.displayName, 'staging');
          console.log(`[STAGING] Seeded quick test account: ${t.username}`);
        }
      }
    }

    // Clean up any legacy AI games that were previously saved to Firestore
    try {
      const rawGamesSnap = await fsGetDocsFromServer(fsCollection(firestoreDb, getColName('games', env)));
      const aiCleanupPromises: Promise<any>[] = [];
      rawGamesSnap.forEach((d) => {
        const gData = d.data();
        if (gData?.mode === 'ai' || gData?.redUid === 'ai' || gData?.blackUid === 'ai') {
          aiCleanupPromises.push(deleteDocRealtime('games', d.id, env).catch(() => {}));
          aiCleanupPromises.push(deleteDocRealtime('moves', d.id, env).catch(() => {}));
        }
      });
      if (aiCleanupPromises.length > 0) {
        await Promise.all(aiCleanupPromises);
      }
    } catch {
      // Ignore cleanup errors
    }

    // Ensure all existing users in Firestore have a password field if missing
    const [allUsers, allRatings, allGames] = await Promise.all([
      getCollectionRealtime('users', env),
      getCollectionRealtime('ratings', env),
      getCollectionRealtime('games', env),
    ]);
    const usersByUid = new Map<string, any>();
    for (const u of allUsers) {
      const uid = u.uid || u.id;
      usersByUid.set(uid, u);
      if (u.password === undefined || u.password === null || String(u.password) === '') {
        const defaultPassword =
          u.username === ADMIN_USERNAME || u.role === 'admin'
            ? ADMIN_PASSWORD
            : `${u.username || uid}1`;
        await setDocRealtime('users', uid, { password: defaultPassword }, true, env);
      }
    }

    // Backfill & repair winStreak / longestWinStreak / currentWinStreak and minimum 1301 Elo floor in ratings collection
    for (const r of allRatings) {
      const rId = r.id || r.docId || `${r.uid}_${r.mode}`;
      const u = usersByUid.get(r.uid) || {};
      const streaks = computePlayerModeStreak(
        r.uid,
        u.username || r.username || '',
        u.displayName || r.displayName || '',
        (r.mode as RatedMode) || 'standard',
        allGames,
        r
      );
      const gamesPlayed = Number(r.gamesPlayed || 0);
      const curElo = Number(r.elo ?? DEFAULT_INITIAL_ELO);
      const curDebt = Math.max(0, Math.round(Number(r.eloDebt || 0)));
      const patches: Record<string, any> = {};

      if (
        r.winStreak !== streaks.winStreak ||
        r.longestWinStreak !== streaks.longestWinStreak ||
        r.currentWinStreak !== streaks.currentWinStreak
      ) {
        Object.assign(patches, streaks);
      }

      if (gamesPlayed > 0 && !r.hiddenFromLeaderboard && curElo < MIN_RATED_ELO) {
        const deficit = Math.max(0, MIN_RATED_ELO - curElo);
        patches.elo = MIN_RATED_ELO;
        patches.eloDebt = curDebt + deficit;
      } else if (curElo < DEFAULT_INITIAL_ELO) {
        patches.elo = DEFAULT_INITIAL_ELO;
        patches.eloDebt = 0;
      } else if (r.eloDebt === undefined) {
        patches.eloDebt = 0;
      }

      if (Object.keys(patches).length > 0) {
        await setDocRealtime('ratings', rId, patches, true, env);
      }
    }

    const globalCfg = await getDocRealtime('adminConfig', 'global', env);
    if (!globalCfg) {
      await setDocRealtime(
        'adminConfig',
        'global',
        {
          ...DEFAULT_ELO_CONFIG,
          blitzMinutes: 5,
          blitzIncrementSec: 3,
          standardMinutes: 30,
          standardMoveSec: 120,
          darkMinutes: 15,
          darkMoveSec: 120,
          updatedAt: now,
        },
        true,
        env
      );
    }
  } catch (err) {
    console.warn(`Firestore seed check error (${env}):`, (err as any)?.message);
  }
}

// Brute-force rate limiter
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

// Active rooms for realtime Socket.IO clock & move engine (persisted to Firestore rooms collection)
interface RoomParticipant {
  uid: string;
  username: string;
  displayName?: string;
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
  env?: ServerEnv;
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

function sanitizeChatText(input: string): string {
  return input.trim().slice(0, 120);
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

function isSameAccount(
  p: RoomParticipant | null | undefined,
  uid: string,
  username?: string
): boolean {
  if (!p) return false;
  if (uid && p.uid && p.uid === uid) return true;
  const normA = String(p.username || '').trim().toLowerCase();
  const normB = String(username || '').trim().toLowerCase();
  if (normA && normB && normA === normB) return true;
  return false;
}

function deduplicateRoomParticipants(room: LiveRoom) {
  // 1. Red and Black cannot belong to the same account
  if (
    room.redPlayer &&
    room.blackPlayer &&
    isSameAccount(room.blackPlayer, room.redPlayer.uid, room.redPlayer.username)
  ) {
    room.blackPlayer = null;
  }

  // 2. Spectators cannot contain Red, Black, or duplicate spectator accounts
  const uniqueSpecs: RoomParticipant[] = [];
  for (const s of room.spectators || []) {
    if (!s) continue;
    if (room.redPlayer && isSameAccount(s, room.redPlayer.uid, room.redPlayer.username)) {
      continue;
    }
    if (room.blackPlayer && isSameAccount(s, room.blackPlayer.uid, room.blackPlayer.username)) {
      continue;
    }
    if (uniqueSpecs.some((existing) => isSameAccount(existing, s.uid, s.username))) {
      continue;
    }
    uniqueSpecs.push(s);
  }
  room.spectators = uniqueSpecs;

  // 3. Ensure room always has a valid hostUid present among active players/spectators
  const activeParticipants = [
    room.redPlayer?.uid,
    room.blackPlayer?.uid,
    ...room.spectators.map((s) => s.uid),
  ].filter(Boolean);
  if (!room.hostUid || !activeParticipants.includes(room.hostUid)) {
    room.hostUid =
      room.redPlayer?.uid ||
      room.blackPlayer?.uid ||
      room.spectators[0]?.uid ||
      '';
  }
}

function serializeRoomForClient(room: LiveRoom) {
  deduplicateRoomParticipants(room);
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
    chat: [...room.chat],
  };
}

async function persistRoomSnapshotRealtime(room: LiveRoom) {
  const targetEnv = room.env || 'prod';
  const snap = {
    code: room.code,
    env: targetEnv,
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
  await setDocRealtime('rooms', room.code, snap, true, targetEnv).catch(() => {});
}

async function hydrateLiveRoomsFromFirestore(env: ServerEnv = 'prod') {
  const now = Date.now();
  let count = 0;
  try {
    const roomsList = await getCollectionRealtime('rooms', env);
    const cfg = await getAdminConfigRealtime(env);

    for (const snap of roomsList) {
      const code = snap.code || snap.id;
      if (!code || snap.status === 'finished') continue;
      if (snap.updatedAt && now - snap.updatedAt > 24 * 3600 * 1000) {
        await deleteDocRealtime('rooms', code, env).catch(() => {});
        continue;
      }

      try {
        const mode: RatedMode = snap.mode || 'blitz';
        const tc = getTimeControlForMode(mode, cfg);
        const { board } = snap.fen
          ? parseFen(snap.fen)
          : mode === 'dark'
          ? createDarkXiangqiBoard()
          : parseFen(INITIAL_FEN);

        const redUser = snap.redUid ? await getUserByUidRealtime(snap.redUid, env) : null;
        const blackUser = snap.blackUid ? await getUserByUidRealtime(snap.blackUid, env) : null;
        const movesDoc = await getDocRealtime('moves', code, env);

        const redElo = snap.redUid
          ? await getUserModeEloRealtime(
              snap.redUid,
              snap.redName || redUser?.username || 'Đỏ',
              mode,
              redUser?.displayName,
              env
            )
          : DEFAULT_INITIAL_ELO;

        const blackElo = snap.blackUid
          ? await getUserModeEloRealtime(
              snap.blackUid,
              snap.blackName || blackUser?.username || 'Đen',
              mode,
              blackUser?.displayName,
              env
            )
          : DEFAULT_INITIAL_ELO;

        const room: LiveRoom = {
          code,
          env,
          mode,
          hostUid: snap.hostUid || snap.redUid || '',
          status: snap.status === 'playing' ? 'playing' : 'waiting',
          redPlayer: snap.redUid
            ? {
                uid: snap.redUid,
                username: snap.redName || redUser?.username || 'Đỏ',
                displayName: redUser?.displayName || snap.redName,
                elo: redElo,
                connected: false,
              }
            : null,
          blackPlayer: snap.blackUid
            ? {
                uid: snap.blackUid,
                username: snap.blackName || blackUser?.username || 'Đen',
                displayName: blackUser?.displayName || snap.blackName,
                elo: blackElo,
                connected: false,
              }
            : null,
          spectators: [],
          board,
          turn: snap.turn || 'r',
          initialFen: snap.initialFen || INITIAL_FEN,
          fenHistory: [],
          checkHistory: [],
          moves: movesDoc?.moves || [],
          redTimeMs: snap.redTimeMs ?? tc.totalMs,
          blackTimeMs: snap.blackTimeMs ?? tc.totalMs,
          moveTimeLimitMs: snap.moveTimeLimitMs ?? tc.moveLimitMs,
          incrementMs: snap.incrementMs ?? tc.incrementMs,
          currentMoveRemainingMs: snap.currentMoveRemainingMs ?? tc.moveLimitMs,
          lastTickAt: now,
          turnDeadline: snap.turnDeadline || 0,
          drawOfferBy: null,
          chat: [],
          createdAt: snap.createdAt || now,
          updatedAt: snap.updatedAt || now,
        };

        deduplicateRoomParticipants(room);
        if (room.status === 'playing' && (!room.redPlayer || !room.blackPlayer)) {
          room.status = 'waiting';
        }
        liveRooms.set(code, room);
        count++;
      } catch (e) {
        console.warn(`Failed to hydrate room ${code} (${env}):`, e);
      }
    }
    console.log(`[${env.toUpperCase()}] Hydrated ${count} active rooms from Firestore.`);
  } catch (e) {
    console.warn(`Could not hydrate rooms from Firestore (${env}):`, e);
  }
}

function getRoomListSummary(modeFilter?: string, envFilter: ServerEnv = 'prod') {
  const allRooms = Array.from(liveRooms.values()).filter(
    (r) => r.status !== 'finished' && (r.env || 'prod') === envFilter
  );

  const counts = {
    all: allRooms.length,
    blitz: allRooms.filter((r) => r.mode === 'blitz').length,
    standard: allRooms.filter((r) => r.mode === 'standard').length,
    dark: allRooms.filter((r) => r.mode === 'dark').length,
  };

  const filtered = allRooms.filter(
    (r) => !modeFilter || modeFilter === 'all' || r.mode === modeFilter
  );

  const rooms = filtered.map((r) => ({
    code: r.code,
    env: r.env || 'prod',
    mode: r.mode,
    status: r.status,
    hostUid: r.hostUid,
    hostName:
      (r.hostUid === r.redPlayer?.uid
        ? r.redPlayer?.displayName || r.redPlayer?.username
        : undefined) ||
      (r.hostUid === r.blackPlayer?.uid
        ? r.blackPlayer?.displayName || r.blackPlayer?.username
        : undefined) ||
      r.spectators.find((s) => s.uid === r.hostUid)?.displayName ||
      r.redPlayer?.displayName ||
      r.redPlayer?.username ||
      r.blackPlayer?.displayName ||
      r.blackPlayer?.username ||
      'Chủ phòng',
    redPlayer: r.redPlayer
      ? {
          uid: r.redPlayer.uid,
          username: r.redPlayer.username,
          displayName: r.redPlayer.displayName || r.redPlayer.username,
          elo: r.redPlayer.elo,
        }
      : null,
    blackPlayer: r.blackPlayer
      ? {
          uid: r.blackPlayer.uid,
          username: r.blackPlayer.username,
          displayName: r.blackPlayer.displayName || r.blackPlayer.username,
          elo: r.blackPlayer.elo,
        }
      : null,
    playerCount: (r.redPlayer ? 1 : 0) + (r.blackPlayer ? 1 : 0),
    spectatorCount: r.spectators.length,
    createdAt: r.createdAt,
  }));

  return { rooms, counts };
}

async function startServer() {
  await ensureFirestoreSeeded('prod');
  await ensureFirestoreSeeded('staging');
  await hydrateLiveRoomsFromFirestore('prod');
  await hydrateLiveRoomsFromFirestore('staging');

  const app = express();
  app.set('etag', false);
  app.use(express.json({ limit: '1mb' }));

  // Extract server environment (prod vs staging) from header, query, or cookie
  app.use((req, res, next) => {
    const cookieHeader = req.headers.cookie || '';
    const cookieMatch = cookieHeader.match(/(?:^|;\s*)xq_server_env=(prod|staging)/);
    const rawEnv = (
      req.headers['x-server-env'] ||
      req.headers['x-env'] ||
      req.query.env ||
      cookieMatch?.[1]
    ) as string;
    (req as any).env = rawEnv === 'staging' || rawEnv === 'stage' ? 'staging' : 'prod';
    res.setHeader('X-Server-Env', (req as any).env);
    next();
  });

  // Disable all HTTP caching on API responses so every call is realtime
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
    pingInterval: 15000,
    pingTimeout: 30000,
  });

  io.use((socket, next) => {
    const rawEnv = socket.handshake.auth?.env || socket.handshake.query?.env;
    socket.data.env = rawEnv === 'staging' || rawEnv === 'stage' ? 'staging' : 'prod';
    next();
  });

  function getReqEnv(req: express.Request): ServerEnv {
    return (req as any).env || 'prod';
  }

  function emitToUser(uid: string, event: string, payload: any, targetEnv?: ServerEnv) {
    for (const [key, sockets] of userSockets.entries()) {
      if (targetEnv) {
        if (key !== `${targetEnv}:${uid}` && key !== uid) continue;
      } else {
        if (!key.endsWith(`:${uid}`) && key !== uid) continue;
      }
      for (const sid of sockets) {
        io.to(sid).emit(event, payload);
      }
    }
  }

  async function broadcastAdminUpdate(targetEnv: ServerEnv = 'prod') {
    try {
      const [usersList, reqsList] = await Promise.all([
        getCollectionRealtime('users', targetEnv),
        getCollectionRealtime('loginRequests', targetEnv),
      ]);
      const sortedReqs = reqsList.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      for (const u of usersList) {
        if (u.role === 'admin') {
          emitToUser(
            u.uid || u.id,
            'admin:login_requests_updated',
            { loginRequests: sortedReqs },
            targetEnv
          );
        }
      }
    } catch {
      // Ignore broadcast error
    }
  }

  function broadcastRoomListUpdate(targetEnv?: ServerEnv) {
    if (targetEnv) {
      io.to(`env:${targetEnv}`).emit(
        'room:list_updated',
        getRoomListSummary(undefined, targetEnv)
      );
    } else {
      io.to('env:prod').emit('room:list_updated', getRoomListSummary(undefined, 'prod'));
      io.to('env:staging').emit('room:list_updated', getRoomListSummary(undefined, 'staging'));
    }
  }

  // ==================== AUTHENTICATION API (REALTIME FIRESTORE + USER.PASSWORD) ====================

  app.post('/api/auth/register', async (req, res) => {
    try {
      const env = getReqEnv(req);
      const isStaging = env === 'staging';
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
      const existingUser = await getUserByUsernameRealtime(rawUsername, env);
      if (existingUser) {
        return res
          .status(409)
          .json({ error: `Tên đăng nhập đã tồn tại trên máy chủ ${env.toUpperCase()}` });
      }

      const now = Date.now();
      const uid = `u_${now}_${Math.random().toString(36).slice(2, 7)}`;
      const sessionId = `sess_${now}_${Math.random().toString(36).slice(2, 9)}`;

      const userDoc = {
        uid,
        username: rawUsername,
        password,
        displayName: rawUsername,
        role: 'user',
        isCreateAccount: isStaging, // Tự động duyệt trên Staging để test ngay!
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

      await Promise.all([
        setDocRealtime('users', uid, userDoc, true, env),
        setDocRealtime('usernames', norm, { uid, createdAt: now }, true, env),
        getUserModeEloRealtime(uid, rawUsername, 'blitz', rawUsername, env),
        getUserModeEloRealtime(uid, rawUsername, 'standard', rawUsername, env),
        getUserModeEloRealtime(uid, rawUsername, 'dark', rawUsername, env),
      ]);

      broadcastAdminUpdate(env);

      return res.json({
        user: sanitizeUserForClient(userDoc),
        sessionId,
        customToken: '',
        env,
        message: isStaging
          ? 'Đăng ký tài khoản Staging thành công (Đã duyệt ngay để test)!'
          : undefined,
      });
    } catch (error) {
      console.error('Register error:', error);
      return res.status(500).json({ error: 'Lỗi máy chủ khi đăng ký' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const env = getReqEnv(req);
      const rawUsername = String(req.body.username || '').trim();
      const rawPassword = String(req.body.password || '');
      const ip = req.ip || 'unknown';
      const norm = rawUsername.toLowerCase();

      const rateKey = `${env}_${ip}_${norm}`;
      const rate = checkRateLimit(rateKey);
      if (!rate.allowed) {
        return res
          .status(429)
          .json({ error: `Thử quá nhiều lần. Vui lòng đợi ${rate.retryAfterSec}s` });
      }

      const user = await getUserByUsernameRealtime(rawUsername, env);
      if (!user) {
        recordFailedAttempt(rateKey);
        return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
      }

      const uid = user.uid || user.id;

      if (user.isLocked) {
        return res.status(403).json({ error: 'Tài khoản đã bị khóa bởi quản trị viên' });
      }

      // Detect _resetacc suffix for Step 2 of concurrent login resolution
      const hasResetSuffix = rawPassword.endsWith('_resetacc');
      const basePassword = hasResetSuffix ? rawPassword.slice(0, -9) : rawPassword;

      const passwordValid = verifyUserPassword(user, basePassword);
      if (!passwordValid) {
        recordFailedAttempt(rateKey);
        return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
      }

      clearRateLimit(rateKey);
      const now = Date.now();
      const reqId = `req_${uid}`;
      const reqData = await getDocRealtime('loginRequests', reqId, env);

      // Admin is exempt from multi-device login block (replaces old session immediately)
      const boundKey = `${env}:${uid}`;
      const hasActiveSocket =
        userSockets.has(boundKey) && (userSockets.get(boundKey)?.size || 0) > 0;
      if (user.role !== 'admin' && user.isLogin && hasActiveSocket) {
        // Step 2: User entered password + _resetacc
        if (hasResetSuffix) {
          const nextReq = {
            id: reqId,
            uid,
            username: user.username,
            attemptCount: 2,
            status: 'pending',
            createdAt: reqData?.createdAt || now,
            updatedAt: now,
          };
          await setDocRealtime('loginRequests', reqId, nextReq, true, env);
          await broadcastAdminUpdate(env);

          return res.status(202).json({
            status: 'pending_admin',
            step: 2,
            requestId: reqId,
            message: 'Đang liên hệ quản trị viên…',
          });
        }

        // Step 3: User entered normal password after submitting _resetacc
        if (reqData && reqData.status === 'approved') {
          const nextReq = {
            ...reqData,
            status: 'completed',
            attemptCount: 3,
            updatedAt: now,
          };
          await setDocRealtime('loginRequests', reqId, nextReq, true, env);
          await broadcastAdminUpdate(env);
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
          const nextReq = {
            id: reqId,
            uid,
            username: user.username,
            attemptCount: 1,
            status: 'blocked_step1',
            createdAt: now,
            updatedAt: now,
          };
          await setDocRealtime('loginRequests', reqId, nextReq, true, env);
          await broadcastAdminUpdate(env);

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
        }, env);
      }

      const decayNotice = user.lastDecayNotice || null;
      const userUpdates = {
        isLogin: true,
        activeSessionId: newSessionId,
        lastDecayNotice: '',
        updatedAt: now,
      };

      await setDocRealtime('users', uid, userUpdates, true, env);

      const updatedUser = {
        ...user,
        ...userUpdates,
      };

      return res.json({
        user: sanitizeUserForClient(updatedUser),
        sessionId: newSessionId,
        customToken: '',
        env,
        decayNotice,
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Lỗi máy chủ khi đăng nhập' });
    }
  });

  app.get('/api/auth/me/:uid', async (req, res) => {
    try {
      const env = getReqEnv(req);
      const user = await getUserByUidRealtime(req.params.uid, env);
      if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản trên máy chủ này' });
      if (user.isLocked) {
        return res.status(403).json({ error: 'Tài khoản đã bị khóa' });
      }
      const clientSessionId = String(req.query.sessionId || '').trim();
      if (
        clientSessionId &&
        user.activeSessionId &&
        user.activeSessionId !== clientSessionId
      ) {
        return res.status(401).json({ error: 'Phiên đăng nhập đã được thay thế ở thiết bị khác' });
      }
      if (!user.isLogin) {
        const targetUid = user.uid || req.params.uid;
        await setDocRealtime('users', targetUid, { isLogin: true, updatedAt: Date.now() }, true, env);
        user.isLogin = true;
      }
      return res.json({ user: sanitizeUserForClient(user), env });
    } catch (error) {
      return res.status(500).json({ error: 'Lỗi truy vấn tài khoản' });
    }
  });

  app.get('/api/auth/login-request/:requestId', async (req, res) => {
    try {
      const env = getReqEnv(req);
      const reqDoc = await getDocRealtime('loginRequests', req.params.requestId, env);
      if (!reqDoc) {
        return res.status(404).json({ error: 'Không tìm thấy yêu cầu' });
      }
      return res.json({ request: reqDoc });
    } catch {
      return res.status(500).json({ error: 'Lỗi truy vấn yêu cầu đăng nhập' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const env = getReqEnv(req);
      const { uid, sessionId } = req.body;
      if (!uid) return res.json({ ok: true });
      const user = await getUserByUidRealtime(String(uid), env);
      if (user) {
        if (!sessionId || !user.activeSessionId || user.activeSessionId === sessionId) {
          await setDocRealtime(
            'users',
            user.uid || String(uid),
            {
              isLogin: false,
              activeSessionId: '',
              updatedAt: Date.now(),
            },
            true,
            env
          );
        }
      }
      return res.json({ ok: true });
    } catch {
      return res.json({ ok: true });
    }
  });

  app.post('/api/auth/change-username', async (req, res) => {
    try {
      const env = getReqEnv(req);
      const oldUsername = String(req.body.oldUsername || req.body.username || '').trim();
      const newDisplayName = String(req.body.newDisplayName || req.body.newUsername || '').trim();
      const password = String(req.body.password || '');

      if (!newDisplayName || newDisplayName.length < 2 || newDisplayName.length > 30) {
        return res
          .status(400)
          .json({ error: 'Tên hiển thị phải từ 2–30 ký tự' });
      }

      if (!/^[\p{L}\p{N}\s_.\-]{2,30}$/u.test(newDisplayName)) {
        return res
          .status(400)
          .json({ error: 'Tên hiển thị chứa ký tự không hợp lệ (hỗ trợ chữ, số, khoảng trắng)' });
      }

      const user = await getUserByUsernameRealtime(oldUsername, env);
      if (!user) {
        return res.status(404).json({ error: 'Tài khoản không tồn tại' });
      }

      if (!verifyUserPassword(user, password)) {
        return res.status(401).json({ error: 'Mật khẩu xác nhận không đúng' });
      }

      const now = Date.now();
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      const lastChange = user.lastDisplayNameChangeAt || user.lastUsernameChangeAt || 0;
      if (lastChange && now - lastChange < threeDaysMs) {
        const daysLeft = Math.ceil(
          (threeDaysMs - (now - lastChange)) / (24 * 60 * 60 * 1000)
        );
        return res
          .status(429)
          .json({ error: `Chỉ được đổi tên 1 lần/3 ngày (còn ${daysLeft} ngày)` });
      }

      const uid = user.uid || user.id;
      const userUpdates = {
        displayName: newDisplayName,
        lastDisplayNameChangeAt: now,
        updatedAt: now,
      };

      await setDocRealtime('users', uid, userUpdates, true, env);

      for (const m of ['blitz', 'standard', 'dark'] as RatedMode[]) {
        const rKey = `${uid}_${m}`;
        const rDoc = await getDocRealtime('ratings', rKey, env);
        if (rDoc) {
          await setDocRealtime('ratings', rKey, { displayName: newDisplayName, updatedAt: now }, true, env);
        }
      }

      const updatedUser = { ...user, ...userUpdates };
      return res.json({ ok: true, displayName: newDisplayName, user: sanitizeUserForClient(updatedUser) });
    } catch {
      return res.status(500).json({ error: 'Lỗi đổi tên hiển thị' });
    }
  });

  app.post('/api/auth/change-password', async (req, res) => {
    try {
      const env = getReqEnv(req);
      const username = String(req.body.username || '').trim();
      const oldPassword = String(req.body.oldPassword || '');
      const newPassword = String(req.body.newPassword || '');

      if (newPassword.length < 6 || newPassword.length > 64 || newPassword.endsWith('_resetacc')) {
        return res.status(400).json({ error: 'Mật khẩu mới phải từ 6–64 ký tự hợp lệ' });
      }

      const user = await getUserByUsernameRealtime(username, env);
      if (!user) {
        return res.status(404).json({ error: 'Tài khoản không tồn tại' });
      }

      if (!verifyUserPassword(user, oldPassword)) {
        return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng' });
      }

      const uid = user.uid || user.id;
      await setDocRealtime(
        'users',
        uid,
        {
          password: newPassword,
          updatedAt: Date.now(),
        },
        true,
        env
      );

      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: 'Lỗi đổi mật khẩu' });
    }
  });

  app.post('/api/auth/preferences', async (req, res) => {
    try {
      const env = getReqEnv(req);
      const { uid, theme, pieceCharMode, soundEnabled } = req.body;
      if (!uid) return res.status(400).json({ error: 'Thiếu uid' });
      const user = await getUserByUidRealtime(String(uid), env);
      if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });

      const updates: Record<string, any> = { updatedAt: Date.now() };
      if (theme) updates.theme = theme;
      if (pieceCharMode) updates.pieceCharMode = pieceCharMode;
      if (typeof soundEnabled === 'boolean') updates.soundEnabled = soundEnabled;

      await setDocRealtime('users', String(uid), updates, true, env);
      const updatedUser = { ...user, ...updates };
      return res.json({ ok: true, user: sanitizeUserForClient(updatedUser) });
    } catch {
      return res.status(500).json({ error: 'Lỗi lưu tùy chỉnh' });
    }
  });

  // ==================== GAMES & NOTATION API (REALTIME FIRESTORE) ====================

  app.post('/api/games', async (req, res) => {
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

      // Never persist AI matches to the database (even when logged in)
      if (mode === 'ai' || redUid === 'ai' || blackUid === 'ai') {
        return res.json({ ok: true, skipped: true });
      }

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

      const formattedMoves = Array.isArray(moves)
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

      const env = getReqEnv(req);
      await Promise.all([
        setDocRealtime('games', gameId, gameDoc, true, env),
        setDocRealtime('moves', gameId, { moves: formattedMoves }, true, env),
      ]);

      return res.json({ game: gameDoc });
    } catch {
      return res.status(500).json({ error: 'Lỗi lưu ván cờ' });
    }
  });

  app.get('/api/rooms', (req, res) => {
    const env = getReqEnv(req);
    const mode = String(req.query.mode || 'all').trim();
    return res.json(getRoomListSummary(mode, env));
  });

  app.get('/api/games', async (req, res) => {
    try {
      const env = getReqEnv(req);
      const rawUid = String(req.query.uid || '').trim();
      const allGames = await getCollectionRealtime('games', env);
      let list = allGames.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      if (rawUid) {
        const q = rawUid.toLowerCase();
        const targetIds = new Set<string>([rawUid, q]);
        const targetNames = new Set<string>([rawUid, q]);

        if (q.startsWith('admin_')) {
          const pure = q.slice(6);
          targetIds.add(pure);
          targetNames.add(pure);
        } else {
          targetIds.add(`admin_${q}`);
        }

        const allUsers = await getCollectionRealtime('users', env);
        const u = allUsers.find(
          (user) =>
            user.uid === rawUid ||
            user.id === rawUid ||
            user.uid?.toLowerCase() === q ||
            user.username?.toLowerCase() === q ||
            user.displayName?.toLowerCase() === q
        );

        if (u) {
          const uUid = u.uid || u.id;
          targetIds.add(uUid);
          targetIds.add(String(uUid).toLowerCase());
          if (u.username) {
            targetNames.add(u.username);
            targetNames.add(u.username.toLowerCase());
          }
          if (u.displayName) {
            targetNames.add(u.displayName);
            targetNames.add(u.displayName.toLowerCase());
          }
        }

        list = list.filter((g) => {
          const rUid = String(g.redUid || '').toLowerCase();
          const bUid = String(g.blackUid || '').toLowerCase();
          const rName = String(g.redName || '').toLowerCase();
          const bName = String(g.blackName || '').toLowerCase();
          return (
            targetIds.has(rUid) ||
            targetIds.has(bUid) ||
            targetNames.has(rName) ||
            targetNames.has(bName)
          );
        });
      }

      return res.json({ games: list.slice(0, 50) });
    } catch {
      return res.status(500).json({ error: 'Lỗi tải danh sách ván đấu' });
    }
  });

  app.get('/api/games/:id', async (req, res) => {
    try {
      const env = getReqEnv(req);
      const [game, movesDoc] = await Promise.all([
        getDocRealtime('games', req.params.id, env),
        getDocRealtime('moves', req.params.id, env),
      ]);
      if (!game) {
        return res.status(404).json({ error: 'Không tìm thấy ván đấu' });
      }
      return res.json({
        game,
        moves: movesDoc?.moves || game.moves || [],
      });
    } catch {
      return res.status(500).json({ error: 'Lỗi tải chi tiết ván đấu' });
    }
  });

  // ==================== LEADERBOARD & USER RATINGS API (REALTIME FIRESTORE) ====================

  app.get('/api/ratings/:uid', async (req, res) => {
    try {
      const env = getReqEnv(req);
      const uid = req.params.uid;
      const [user, gamesList] = await Promise.all([
        getUserByUidRealtime(uid, env),
        getCollectionRealtime('games', env),
      ]);
      const username = user ? user.username : 'Kỳ thủ';
      const displayName = user ? user.displayName || user.username : 'Kỳ thủ';
      const modes: RatedMode[] = ['blitz', 'standard', 'dark'];
      const result: Record<string, any> = {};

      for (const m of modes) {
        const r = await getUserModeRatingRealtime(uid, username, m, displayName, env);
        const streaks = computePlayerModeStreak(uid, username, displayName, m, gamesList, r);
        result[m] = {
          ...r,
          ...streaks,
        };
      }
      return res.json({ ratings: result });
    } catch {
      return res.status(500).json({ error: 'Lỗi truy vấn điểm Elo' });
    }
  });

  app.get('/api/leaderboard', async (req, res) => {
    try {
      const env = getReqEnv(req);
      const mode = (req.query.mode as RatedMode) || 'blitz';
      const period = String(req.query.period || 'all');
      const now = Date.now();
      const minTime =
        period === 'week'
          ? now - 7 * 86400_000
          : period === 'month'
          ? now - 30 * 86400_000
          : 0;

      const [ratingsList, usersList, gamesList] = await Promise.all([
        getCollectionRealtime('ratings', env),
        getCollectionRealtime('users', env),
        getCollectionRealtime('games', env),
      ]);

      const usersMap = new Map<string, any>();
      for (const u of usersList) {
        usersMap.set(u.uid || u.id, u);
      }

      const entries = ratingsList
        .filter((r) => {
          const u = usersMap.get(r.uid);
          if (!u) {
            const orphanId = r.id || r.docId || (r.uid && r.mode ? `${r.uid}_${r.mode}` : '');
            if (orphanId) {
              void deleteDocRealtime('ratings', orphanId, env).catch(() => {});
            }
            return false;
          }
          if (r.mode !== mode) return false;
          if (r.hiddenFromLeaderboard) return false;
          if (minTime > 0 && (r.lastRatedGameAt || 0) < minTime) return false;
          return true;
        })
        .map((r) => {
          const u = usersMap.get(r.uid);
          const username = u?.username || r.username || '';
          const displayName = u?.displayName || r.displayName || r.username || '';
          const streaks = computePlayerModeStreak(r.uid, username, displayName, mode, gamesList, r);
          return {
            ...r,
            displayName,
            ...streaks,
          };
        })
        .sort((a, b) => (b.elo || 0) - (a.elo || 0))
        .slice(0, 100);

      return res.json({ leaderboard: entries });
    } catch {
      return res.status(500).json({ error: 'Lỗi tải bảng xếp hạng' });
    }
  });

  // ==================== ADMIN API (REALTIME FIRESTORE) ====================

  async function verifyAdminRequest(
    req: express.Request,
    res: express.Response
  ): Promise<boolean> {
    const env = getReqEnv(req);
    const adminUid = String(req.headers['x-admin-uid'] || req.body?.adminUid || '');
    if (!adminUid) {
      res.status(403).json({ error: 'Từ chối truy cập (Thiếu thông tin Admin)' });
      return false;
    }
    const adminUser = await getUserByUidRealtime(adminUid, env);
    if (!adminUser || adminUser.role !== 'admin') {
      res.status(403).json({ error: 'Chỉ quản trị viên mới có quyền thực hiện' });
      return false;
    }
    return true;
  }

  app.get('/api/admin/overview', async (req, res) => {
    try {
      if (!(await verifyAdminRequest(req, res))) return;
      const env = getReqEnv(req);

      const [usersList, ratingsList, loginRequestsList, gamesList, ratingHistoryList, config] =
        await Promise.all([
          getCollectionRealtime('users', env),
          getCollectionRealtime('ratings', env),
          getCollectionRealtime('loginRequests', env),
          getCollectionRealtime('games', env),
          getCollectionRealtime('ratingHistory', env),
          getAdminConfigRealtime(env),
        ]);

      const ratingsByUid: Record<string, Record<string, number>> = {};
      ratingsList.forEach((data) => {
        if (!ratingsByUid[data.uid]) ratingsByUid[data.uid] = {};
        ratingsByUid[data.uid][data.mode] = data.elo;
      });

      const users = usersList
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .map((u) => ({
          ...sanitizeUserForClient(u),
          password: String(u.password ?? ''),
          ratings: ratingsByUid[u.uid || u.id] || {
            blitz: DEFAULT_INITIAL_ELO,
            standard: DEFAULT_INITIAL_ELO,
            dark: DEFAULT_INITIAL_ELO,
          },
        }));

      return res.json({
        users,
        loginRequests: loginRequestsList.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
        activeRooms: Array.from(liveRooms.values())
          .filter((r) => (r.env || 'prod') === env)
          .map((r) => serializeRoomForClient(r)),
        games: gamesList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 50),
        ratingHistory: ratingHistoryList
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          .slice(0, 80),
        config,
      });
    } catch {
      return res.status(500).json({ error: 'Lỗi tải dữ liệu quản trị' });
    }
  });

  app.post('/api/admin/user-action', async (req, res) => {
    try {
      if (!(await verifyAdminRequest(req, res))) return;
      const env = getReqEnv(req);

      const { targetUid, action, payload } = req.body;
      const uid = String(targetUid || '');
      const userData = await getUserByUidRealtime(uid, env);
      if (!userData) {
        return res.status(404).json({ error: 'Không tìm thấy người dùng' });
      }
      const now = Date.now();

      if (action === 'approve_account') {
        const updates = { isCreateAccount: true, updatedAt: now };
        await setDocRealtime('users', uid, updates, true, env);
        emitToUser(uid, 'user:updated', { user: sanitizeUserForClient({ ...userData, ...updates }) }, env);
      } else if (action === 'reject_account') {
        const updates = { isCreateAccount: false, updatedAt: now };
        await setDocRealtime('users', uid, updates, true, env);
        emitToUser(uid, 'user:updated', { user: sanitizeUserForClient({ ...userData, ...updates }) }, env);
      } else if (action === 'toggle_lock') {
        const nextLock = !userData.isLocked;
        const updates: Record<string, any> = { isLocked: nextLock, updatedAt: now };
        if (nextLock) {
          updates.isLogin = false;
          updates.activeSessionId = '';
          emitToUser(uid, 'session:kicked', { reason: 'Tài khoản đã bị khóa' }, env);
        }
        await setDocRealtime('users', uid, updates, true, env);
      } else if (action === 'force_logout') {
        await setDocRealtime(
          'users',
          uid,
          { isLogin: false, activeSessionId: '', updatedAt: now },
          true,
          env
        );
        emitToUser(uid, 'session:kicked', {
          reason: 'Quản trị viên đã đặt lại phiên đăng nhập',
        }, env);
      } else if (action === 'reset_password' || action === 'update_password') {
        const newPass = String(payload?.newPassword ?? '').trim();
        if (!newPass || newPass.length > 64 || newPass.endsWith('_resetacc')) {
          return res.status(400).json({ error: 'Mật khẩu mới không hợp lệ' });
        }
        await setDocRealtime('users', uid, { password: newPass, updatedAt: now }, true, env);
      } else if (action === 'update_elo') {
        const mode = (payload?.mode as RatedMode) || 'blitz';
        const newElo = Math.max(
          DEFAULT_INITIAL_ELO,
          Math.min(3500, Number(payload?.elo || DEFAULT_INITIAL_ELO))
        );
        const rKey = `${uid}_${mode}`;
        const existingRating = await getUserModeRatingRealtime(
          uid,
          userData.username,
          mode,
          userData.displayName,
          env
        );
        const beforeElo = existingRating.elo ?? DEFAULT_INITIAL_ELO;

        const ratingUpdates = {
          ...existingRating,
          elo: newElo,
          eloDebt: 0,
          peakElo: Math.max(newElo, existingRating.peakElo || DEFAULT_INITIAL_ELO),
          hiddenFromLeaderboard: false,
          updatedAt: now,
        };
        const histId = `hist_${now}_${Math.random().toString(36).slice(2, 7)}`;
        const histDoc = {
          id: histId,
          uid,
          username: userData.username,
          displayName: userData.displayName || userData.username,
          mode,
          beforeElo,
          afterElo: newElo,
          delta: newElo - beforeElo,
          boostPenalty: 0,
          reason: 'Admin điều chỉnh',
          gameId: 'admin',
          createdAt: now,
        };

        await Promise.all([
          setDocRealtime('ratings', rKey, ratingUpdates, true, env),
          setDocRealtime('ratingHistory', histId, histDoc, true, env),
        ]);
      } else if (action === 'delete_user') {
        if (userData.role === 'admin') {
          return res.status(400).json({ error: 'Không thể xóa tài khoản Admin' });
        }

        const uidLower = uid.toLowerCase();
        const usernameLower = String(userData.username || '').trim().toLowerCase();
        const displayNameLower = String(userData.displayName || '').trim().toLowerCase();

        const [ratingsList, ratingHistoryList, loginRequestsList, gamesList] = await Promise.all([
          getCollectionRealtime('ratings', env),
          getCollectionRealtime('ratingHistory', env),
          getCollectionRealtime('loginRequests', env),
          getCollectionRealtime('games', env),
        ]);

        const deletePromises: Promise<any>[] = [
          deleteDocRealtime('users', uid, env).catch(() => {}),
          deleteDocRealtime('usernames', usernameLower, env).catch(() => {}),
          deleteDocRealtime('ratings', `${uid}_blitz`, env).catch(() => {}),
          deleteDocRealtime('ratings', `${uid}_standard`, env).catch(() => {}),
          deleteDocRealtime('ratings', `${uid}_dark`, env).catch(() => {}),
        ];

        // Delete any matching rating documents on Leaderboard
        for (const r of ratingsList) {
          const rUid = String(r.uid || '').toLowerCase();
          const rUser = String(r.username || '').trim().toLowerCase();
          const rId = String(r.id || r.docId || '');
          if (
            rUid === uidLower ||
            (usernameLower && rUser === usernameLower) ||
            rId.startsWith(`${uid}_`)
          ) {
            if (rId) {
              deletePromises.push(deleteDocRealtime('ratings', rId, env).catch(() => {}));
            }
          }
        }

        // Delete all rating history entries for this account
        for (const h of ratingHistoryList) {
          const hUid = String(h.uid || '').toLowerCase();
          const hUser = String(h.username || '').trim().toLowerCase();
          if (hUid === uidLower || (usernameLower && hUser === usernameLower)) {
            if (h.id) {
              deletePromises.push(deleteDocRealtime('ratingHistory', h.id, env).catch(() => {}));
            }
          }
        }

        // Delete any login requests for this account
        for (const reqDoc of loginRequestsList) {
          const reqUid = String(reqDoc.uid || '').toLowerCase();
          const reqUser = String(reqDoc.username || '').trim().toLowerCase();
          if (reqUid === uidLower || (usernameLower && reqUser === usernameLower)) {
            if (reqDoc.id) {
              deletePromises.push(deleteDocRealtime('loginRequests', reqDoc.id, env).catch(() => {}));
            }
          }
        }

        // Delete games and moves associated with this account on Leaderboard profile
        for (const g of gamesList) {
          const rUid = String(g.redUid || '').toLowerCase();
          const bUid = String(g.blackUid || '').toLowerCase();
          const rName = String(g.redName || '').trim().toLowerCase();
          const bName = String(g.blackName || '').trim().toLowerCase();
          const matchesUser =
            rUid === uidLower ||
            bUid === uidLower ||
            (usernameLower && (rName === usernameLower || bName === usernameLower)) ||
            (displayNameLower && (rName === displayNameLower || bName === displayNameLower));
          if (matchesUser && g.id) {
            deletePromises.push(deleteDocRealtime('games', g.id, env).catch(() => {}));
            deletePromises.push(deleteDocRealtime('moves', g.id, env).catch(() => {}));
          }
        }

        // Remove user from any active rooms
        for (const [roomCode, room] of liveRooms.entries()) {
          if ((room.env || 'prod') !== env) continue;
          let changed = false;
          if (isSameAccount(room.redPlayer, uid, userData.username)) {
            room.redPlayer = null;
            changed = true;
          }
          if (isSameAccount(room.blackPlayer, uid, userData.username)) {
            room.blackPlayer = null;
            changed = true;
          }
          const beforeSpecLen = room.spectators.length;
          room.spectators = room.spectators.filter(
            (s) => !isSameAccount(s, uid, userData.username)
          );
          if (room.spectators.length !== beforeSpecLen) {
            changed = true;
          }
          if (changed) {
            if (!room.redPlayer && !room.blackPlayer && room.spectators.length === 0) {
              liveRooms.delete(roomCode);
              deletePromises.push(deleteDocRealtime('rooms', roomCode, env).catch(() => {}));
            } else {
              if (room.hostUid === uid) {
                room.hostUid =
                  room.redPlayer?.uid ||
                  room.blackPlayer?.uid ||
                  room.spectators[0]?.uid ||
                  '';
              }
              io.to(roomCode).emit('room:state', serializeRoomForClient(room));
            }
          }
        }

        await Promise.all(deletePromises);
        broadcastRoomListUpdate(env);
        emitToUser(uid, 'session:kicked', { reason: 'Tài khoản đã bị xóa' }, env);
      }

      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: 'Lỗi thực thi thao tác quản trị' });
    }
  });

  app.post('/api/admin/login-request-action', async (req, res) => {
    try {
      if (!(await verifyAdminRequest(req, res))) return;
      const env = getReqEnv(req);
      const { requestId, decision } = req.body;
      const reqDoc = await getDocRealtime('loginRequests', String(requestId), env);
      if (!reqDoc) {
        return res.status(404).json({ error: 'Không tìm thấy yêu cầu' });
      }
      const updatedReq = {
        ...reqDoc,
        status: decision === 'approved' ? 'approved' : 'rejected',
        updatedAt: Date.now(),
      };
      await setDocRealtime('loginRequests', String(requestId), updatedReq, true, env);
      await broadcastAdminUpdate(env);
      return res.json({ ok: true, request: updatedReq });
    } catch {
      return res.status(500).json({ error: 'Lỗi xử lý yêu cầu' });
    }
  });

  app.post('/api/admin/config', async (req, res) => {
    try {
      if (!(await verifyAdminRequest(req, res))) return;
      const env = getReqEnv(req);
      const updates: Record<string, any> = {
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
        stagingPassword: String(req.body.stagingPassword || '123456').trim(),
        updatedAt: Date.now(),
      };
      if (req.body.globalTheme) {
        updates.globalTheme = String(req.body.globalTheme).trim();
      }
      await setDocRealtime('adminConfig', 'global', updates, true, env);
      if (req.body.globalTheme) {
        io.emit('system:theme_changed', { theme: updates.globalTheme, env });
      }
      return res.json({ ok: true, config: updates });
    } catch {
      return res.status(500).json({ error: 'Lỗi lưu cấu hình' });
    }
  });

  // ==================== SYSTEM THEME API (ADMIN CONTROLLED) ====================

  app.get('/api/system/theme', async (req, res) => {
    try {
      const env = getReqEnv(req);
      const cfg = await getAdminConfigRealtime(env);
      return res.json({ ok: true, theme: cfg.globalTheme || 'classic_wood' });
    } catch {
      return res.json({ ok: true, theme: 'classic_wood' });
    }
  });

  app.post('/api/admin/theme', async (req, res) => {
    try {
      if (!(await verifyAdminRequest(req, res))) return;
      const env = getReqEnv(req);
      const theme = String(req.body?.theme || 'classic_wood').trim();
      const validThemes = [
        'classic_wood',
        'jade',
        'sumi_ink',
        'imperial',
        'midnight_neon',
        'minimal_light',
        'pure_light',
      ];
      if (!validThemes.includes(theme)) {
        return res.status(400).json({ error: 'Mã giao diện không hợp lệ' });
      }
      await setDocRealtime('adminConfig', 'global', { globalTheme: theme, updatedAt: Date.now() }, true, env);
      io.emit('system:theme_changed', { theme, env });
      return res.json({ ok: true, theme });
    } catch {
      return res.status(500).json({ error: 'Lỗi cập nhật giao diện hệ thống' });
    }
  });

  // Staging Access Password Verification (Default: 123456)
  app.post('/api/staging/verify-access', async (req, res) => {
    try {
      const inputPass = String(req.body?.password || '').trim();
      const cfg = await getAdminConfigRealtime('staging');
      const validPass = String(cfg?.stagingPassword || '123456').trim();

      if (inputPass === validPass || inputPass === '123456') {
        return res.json({ ok: true, message: 'Mở khóa Staging thành công' });
      }

      return res.status(401).json({
        error: 'Mật khẩu Staging không chính xác. Mật khẩu mặc định là: 123456',
      });
    } catch {
      // In case of error, fallback to default 123456
      if (String(req.body?.password || '').trim() === '123456') {
        return res.json({ ok: true });
      }
      return res.status(500).json({ error: 'Lỗi máy chủ khi kiểm tra mật khẩu Staging' });
    }
  });

  // ==================== TÀNG THƯ (LIBRARY ARTICLES) API ====================

  app.get('/api/articles', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim().toLowerCase();
      const category = String(req.query.category || '').trim();
      const list = await getCollectionRealtime('articles');

      const filtered = list
        .filter((a) => {
          if (category && category !== 'all' && a.category !== category) return false;
          if (!q) return true;
          const hay = [
            a.title || '',
            a.summary || '',
            a.content || '',
            a.category || '',
            a.authorName || '',
            a.notationText || '',
          ]
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
        })
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

      return res.json({ articles: filtered });
    } catch {
      return res.status(500).json({ error: 'Lỗi tải danh sách Tàng Thư' });
    }
  });

  app.get('/api/articles/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      const article = await getDocRealtime('articles', id);
      if (!article) {
        return res.status(404).json({ error: 'Không tìm thấy bài viết trong Tàng Thư' });
      }
      return res.json({ article });
    } catch {
      return res.status(500).json({ error: 'Lỗi tải chi tiết bài viết' });
    }
  });

  app.post('/api/admin/articles', async (req, res) => {
    try {
      if (!(await verifyAdminRequest(req, res))) return;
      const adminUid = String(req.headers['x-admin-uid'] || req.body?.adminUid || '');
      const adminUser = await getUserByUidRealtime(adminUid);

      const title = String(req.body?.title || '').trim();
      const category = String(req.body?.category || 'Khai cuộc').trim();
      const summary = String(req.body?.summary || '').trim();
      const content = String(req.body?.content || '').trim();
      const initialFen = String(req.body?.initialFen || INITIAL_FEN).trim() || INITIAL_FEN;
      const notationText = String(req.body?.notationText || '').trim();
      const moves = Array.isArray(req.body?.moves) ? req.body.moves : [];

      if (!title) {
        return res.status(400).json({ error: 'Tiêu đề bài viết không được để trống' });
      }
      if (!content) {
        return res.status(400).json({ error: 'Nội dung bài viết không được để trống' });
      }

      const now = Date.now();
      const id = `art_${now}_${Math.random().toString(36).slice(2, 7)}`;

      const articleDoc = {
        id,
        title: title.slice(0, 160),
        category: category.slice(0, 64),
        summary: (summary || content.replace(/[#*_>`~\n]+/g, ' ').trim()).slice(0, 300),
        content: content.slice(0, 50000),
        initialFen: initialFen.slice(0, 200),
        notationText: notationText.slice(0, 10000),
        moves,
        moveCount: moves.length,
        authorUid: adminUid,
        authorName: adminUser?.displayName || adminUser?.username || ADMIN_DISPLAY_NAME,
        createdAt: now,
        updatedAt: now,
      };

      await setDocRealtime('articles', id, articleDoc, false);
      return res.json({ ok: true, article: articleDoc });
    } catch {
      return res.status(500).json({ error: 'Lỗi tạo bài viết Tàng Thư' });
    }
  });

  app.put('/api/admin/articles/:id', async (req, res) => {
    try {
      if (!(await verifyAdminRequest(req, res))) return;
      const id = String(req.params.id || '').trim();
      const existing = await getDocRealtime('articles', id);
      if (!existing) {
        return res.status(404).json({ error: 'Không tìm thấy bài viết cần sửa' });
      }

      const title = String(req.body?.title ?? existing.title ?? '').trim();
      const category = String(req.body?.category ?? existing.category ?? 'Khai cuộc').trim();
      const summary = String(req.body?.summary ?? existing.summary ?? '').trim();
      const content = String(req.body?.content ?? existing.content ?? '').trim();
      const initialFen =
        String(req.body?.initialFen ?? existing.initialFen ?? INITIAL_FEN).trim() || INITIAL_FEN;
      const notationText = String(req.body?.notationText ?? existing.notationText ?? '').trim();
      const moves = Array.isArray(req.body?.moves) ? req.body.moves : existing.moves || [];

      if (!title) {
        return res.status(400).json({ error: 'Tiêu đề bài viết không được để trống' });
      }
      if (!content) {
        return res.status(400).json({ error: 'Nội dung bài viết không được để trống' });
      }

      const now = Date.now();
      const updatedDoc = {
        ...existing,
        id,
        title: title.slice(0, 160),
        category: category.slice(0, 64),
        summary: (summary || content.replace(/[#*_>`~\n]+/g, ' ').trim()).slice(0, 300),
        content: content.slice(0, 50000),
        initialFen: initialFen.slice(0, 200),
        notationText: notationText.slice(0, 10000),
        moves,
        moveCount: moves.length,
        updatedAt: now,
      };

      await setDocRealtime('articles', id, updatedDoc, false);
      return res.json({ ok: true, article: updatedDoc });
    } catch {
      return res.status(500).json({ error: 'Lỗi cập nhật bài viết Tàng Thư' });
    }
  });

  app.delete('/api/admin/articles/:id', async (req, res) => {
    try {
      if (!(await verifyAdminRequest(req, res))) return;
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Thiếu mã bài viết' });
      }
      await deleteDocRealtime('articles', id);
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: 'Lỗi xóa bài viết Tàng Thư' });
    }
  });

  // ==================== CRON ENDPOINTS (CLEANUP 22:00 & RATING DECAY 00:05) ====================

  async function runRoomCleanupJob() {
    let removedCount = 0;
    let markedCount = 0;
    for (const [code, room] of liveRooms.entries()) {
      if (room.status !== 'playing') {
        liveRooms.delete(code);
        await deleteDocRealtime('rooms', code).catch(() => {});
        io.to(code).emit('room:closed', { reason: 'Phòng được dọn định kỳ lúc 22:00' });
        removedCount++;
      } else {
        room.cleanupAfterFinish = true;
        markedCount++;
      }
    }
    broadcastRoomListUpdate();
    return { removedCount, markedCount };
  }

  async function runRatingDecayJob() {
    const [cfg, ratingsList] = await Promise.all([
      getAdminConfigRealtime(),
      getCollectionRealtime('ratings'),
    ]);
    const now = Date.now();
    let decayedCount = 0;
    let resetCount = 0;

    for (const r of ratingsList) {
      const res = evaluateInactivityDecay(
        {
          elo: r.elo,
          eloDebt: r.eloDebt,
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
        const rId = r.id || r.docId || `${r.uid}_${r.mode}`;
        const updatedRating = {
          ...r,
          elo: res.afterElo,
          eloDebt: res.eloDebt,
          decayApplied: res.decayApplied,
          hiddenFromLeaderboard: res.hiddenFromLeaderboard,
          provisional: res.provisional,
          gamesPlayed: res.action === 'reset' ? 0 : r.gamesPlayed,
          updatedAt: now,
        };

        const histId = `hist_${now}_${Math.random().toString(36).slice(2, 7)}`;
        const reasonText =
          res.action === 'reset'
            ? 'Reset Elo (>14 ngày không hoạt động)'
            : 'Trừ điểm không hoạt động (7 ngày)';

        const histDoc = {
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

        await Promise.all([
          setDocRealtime('ratings', rId, updatedRating),
          setDocRealtime('ratingHistory', histId, histDoc),
          setDocRealtime(
            'users',
            r.uid,
            {
              lastDecayNotice: `${reasonText}: ${beforeElo} → ${res.afterElo} (${r.mode})`,
              updatedAt: now,
            },
            true
          ).catch(() => {}),
        ]);

        if (res.action === 'decay') decayedCount++;
        if (res.action === 'reset') resetCount++;
      }
    }

    return { decayedCount, resetCount };
  }

  app.post('/api/cron/cleanup-rooms', async (req, res) => {
    const secret = req.headers['x-cron-secret'];
    const adminUid = req.headers['x-admin-uid'];
    if (secret !== CRON_SECRET && !adminUid) {
      return res.status(401).json({ error: 'Unauthorized cron request' });
    }
    const result = await runRoomCleanupJob();
    return res.json({ ok: true, ...result });
  });

  app.post('/api/cron/rating-decay', async (req, res) => {
    const secret = req.headers['x-cron-secret'];
    const adminUid = req.headers['x-admin-uid'];
    if (secret !== CRON_SECRET && !adminUid) {
      return res.status(401).json({ error: 'Unauthorized cron request' });
    }
    const result = await runRatingDecayJob();
    return res.json({ ok: true, ...result });
  });

  // ==================== FAIRY-STOCKFISH WASM ENGINE SERVICE ====================
  let fairyChild: ChildProcess | null = null;
  let fairyReqCounter = 1;
  const fairyPending = new Map<number, (uci: string | null) => void>();

  function ensureFairyChildProcess(): ChildProcess | null {
    if (fairyChild && !fairyChild.killed && fairyChild.connected) {
      return fairyChild;
    }
    try {
      const runnerPath = path.resolve(
        process.cwd(),
        'public',
        'engine',
        'fairy',
        'node-engine-runner.js'
      );
      if (!fs.existsSync(runnerPath)) return null;

      // Fork a clean Node process without tsx loader flags or server CLI args (--port 3000)
      const child = fork(runnerPath, [], {
        execArgv: [],
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });

      child.on('message', (msg: any) => {
        if (msg && typeof msg.id === 'number') {
          const cb = fairyPending.get(msg.id);
          if (cb) {
            fairyPending.delete(msg.id);
            cb(typeof msg.uci === 'string' ? msg.uci : null);
          }
        }
      });

      const cleanup = () => {
        if (fairyChild === child) {
          fairyChild = null;
        }
        for (const [, cb] of fairyPending) {
          cb(null);
        }
        fairyPending.clear();
      };

      child.on('exit', cleanup);
      child.on('error', cleanup);
      fairyChild = child;
      return child;
    } catch {
      return null;
    }
  }

  // Pre-warm the Fairy-Stockfish WASM engine process in the background
  ensureFairyChildProcess();

  function queryServerFairyUci(
    fen: string,
    engine: 'fairy_stockfish' | 'pikafish' = 'fairy_stockfish'
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const child = ensureFairyChildProcess();
      if (!child || !child.connected) {
        resolve(null);
        return;
      }

      const isPika = engine === 'pikafish';
      const searchDepth = isPika ? 18 : 16;
      const searchTime = isPika ? 2400 : 2000;
      const searchSkill = 20;
      const reqId = fairyReqCounter++;

      const timeout = setTimeout(() => {
        if (fairyPending.has(reqId)) {
          fairyPending.delete(reqId);
          resolve(null);
        }
      }, searchTime + 2500);

      fairyPending.set(reqId, (uci) => {
        clearTimeout(timeout);
        resolve(uci);
      });

      try {
        child.send({
          cmd: 'search',
          id: reqId,
          fen,
          engine,
          depth: searchDepth,
          time: searchTime,
          skill: searchSkill,
        });
      } catch {
        clearTimeout(timeout);
        fairyPending.delete(reqId);
        resolve(null);
      }
    });
  }

  app.post('/api/ai/move', async (req, res) => {
    try {
      const fen = String(req.body?.fen || INITIAL_FEN).trim();
      const rawEng = String(req.body?.engine || 'fairy_stockfish');
      const engine = rawEng === 'pikafish' ? 'pikafish' : 'fairy_stockfish';

      const { board, turn } = parseFen(fen);
      const bestUci = await queryServerFairyUci(fen, engine);

      if (bestUci) {
        const parsedMove = parseUciMove(bestUci, board, turn);
        if (parsedMove) {
          return res.json({
            ok: true,
            uci: bestUci,
            move: parsedMove,
            engineUsed: engine === 'pikafish' ? 'pikafish_nnue_server' : 'fairy_stockfish_wasm_server',
          });
        }
      }

      const fallback = findBestMove(fen, 'master', false);
      return res.json({
        ok: true,
        uci: null,
        move: fallback ? { from: fallback.from, to: fallback.to } : null,
        engineUsed: 'offline_fallback',
      });
    } catch (error) {
      return res.status(500).json({ error: 'AI move calculation failed' });
    }
  });

  let lastCleanupDate = '';
  let lastDecayDate = '';
  setInterval(async () => {
    try {
      const vnTime = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
      );
      const dateKey = `${vnTime.getFullYear()}-${vnTime.getMonth() + 1}-${vnTime.getDate()}`;
      const hour = vnTime.getHours();
      const minute = vnTime.getMinutes();

      const cfg = await getAdminConfigRealtime();
      if (hour === (cfg.cleanupHour ?? 22) && minute === 0 && lastCleanupDate !== dateKey) {
        lastCleanupDate = dateKey;
        await runRoomCleanupJob();
      }
      if (hour === 0 && minute === 5 && lastDecayDate !== dateKey) {
        lastDecayDate = dateKey;
        await runRatingDecayJob();
      }
    } catch (e) {
      console.error('Cron tick error:', e);
    }
  }, 45_000);

  // ==================== SOCKET.IO REALTIME ROOMS & MATCH ENGINE ====================

  async function finalizeRealtimeGame(
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

    const roomEnv: ServerEnv = room.env || 'prod';
    if (room.redPlayer && room.blackPlayer) {
      try {
        const mode = room.mode;
        const redDocId = `${room.redPlayer.uid}_${mode}`;
        const blackDocId = `${room.blackPlayer.uid}_${mode}`;

        const [cfg, redData, blackData] = await Promise.all([
          getAdminConfigRealtime(roomEnv),
          getUserModeRatingRealtime(
            room.redPlayer.uid,
            room.redPlayer.username,
            mode,
            room.redPlayer.displayName,
            roomEnv
          ),
          getUserModeRatingRealtime(
            room.blackPlayer.uid,
            room.blackPlayer.username,
            mode,
            room.blackPlayer.displayName,
            roomEnv
          ),
        ]);

        const eloRes = calculateMatchElo({
          redElo: redData.elo ?? DEFAULT_INITIAL_ELO,
          redGames: redData.gamesPlayed ?? 0,
          redProvisional: redData.provisional,
          redEloDebt: Number(redData.eloDebt || 0),
          blackElo: blackData.elo ?? DEFAULT_INITIAL_ELO,
          blackGames: blackData.gamesPlayed ?? 0,
          blackProvisional: blackData.provisional,
          blackEloDebt: Number(blackData.eloDebt || 0),
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

        const nextRedCurrentStreak =
          winner === 'red' ? Number(redData.currentWinStreak || 0) + 1 : 0;
        const nextRedLongestStreak = Math.max(
          Number(redData.longestWinStreak || 0),
          Number(redData.winStreak || 0),
          nextRedCurrentStreak
        );

        const nextBlackCurrentStreak =
          winner === 'black' ? Number(blackData.currentWinStreak || 0) + 1 : 0;
        const nextBlackLongestStreak = Math.max(
          Number(blackData.longestWinStreak || 0),
          Number(blackData.winStreak || 0),
          nextBlackCurrentStreak
        );

        const updatedRedRating = {
          ...redData,
          elo: eloRes.redAfter,
          eloDebt: eloRes.redDebtAfter,
          peakElo: Math.max(redData.peakElo || DEFAULT_INITIAL_ELO, eloRes.redAfter),
          gamesPlayed: nextRedGames,
          wins: (redData.wins || 0) + (winner === 'red' ? 1 : 0),
          losses: (redData.losses || 0) + (winner === 'black' ? 1 : 0),
          draws: (redData.draws || 0) + (winner === 'draw' ? 1 : 0),
          winStreak: nextRedLongestStreak,
          longestWinStreak: nextRedLongestStreak,
          currentWinStreak: nextRedCurrentStreak,
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

        const updatedBlackRating = {
          ...blackData,
          elo: eloRes.blackAfter,
          eloDebt: eloRes.blackDebtAfter,
          peakElo: Math.max(blackData.peakElo || DEFAULT_INITIAL_ELO, eloRes.blackAfter),
          gamesPlayed: nextBlackGames,
          wins: (blackData.wins || 0) + (winner === 'black' ? 1 : 0),
          losses: (blackData.losses || 0) + (winner === 'red' ? 1 : 0),
          draws: (blackData.draws || 0) + (winner === 'draw' ? 1 : 0),
          winStreak: nextBlackLongestStreak,
          longestWinStreak: nextBlackLongestStreak,
          currentWinStreak: nextBlackCurrentStreak,
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

        const redHistDoc = {
          id: `hist_${now}_r`,
          uid: room.redPlayer.uid,
          username: room.redPlayer.username,
          displayName: room.redPlayer.displayName || room.redPlayer.username,
          mode,
          beforeElo: eloRes.redBefore,
          afterElo: eloRes.redAfter,
          delta: eloRes.redDelta,
          boostPenalty: eloRes.redBoostPenalty,
          reason: `Đấu với ${room.blackPlayer.displayName || room.blackPlayer.username} (${reason})`,
          gameId,
          createdAt: now,
        };

        const blackHistDoc = {
          id: `hist_${now}_b`,
          uid: room.blackPlayer.uid,
          username: room.blackPlayer.username,
          displayName: room.blackPlayer.displayName || room.blackPlayer.username,
          mode,
          beforeElo: eloRes.blackBefore,
          afterElo: eloRes.blackAfter,
          delta: eloRes.blackDelta,
          boostPenalty: eloRes.blackBoostPenalty,
          reason: `Đấu với ${room.redPlayer.displayName || room.redPlayer.username} (${reason})`,
          gameId,
          createdAt: now,
        };

        const wxfPairs: string[] = [];
        for (let i = 0; i < room.moves.length; i += 2) {
          const m1 = room.moves[i]?.wxf || '';
          const m2 = room.moves[i + 1]?.wxf || '';
          wxfPairs.push(`${Math.floor(i / 2) + 1}. ${m1}${m2 ? ' ' + m2 : ''}`);
        }

        const gameDoc = {
          id: gameId,
          mode,
          redUid: room.redPlayer.uid,
          redName: room.redPlayer.displayName || room.redPlayer.username,
          blackUid: room.blackPlayer.uid,
          blackName: room.blackPlayer.displayName || room.blackPlayer.username,
          winner,
          reason,
          redEloBefore: eloRes.redBefore,
          redEloAfter: eloRes.redAfter,
          redEloDelta: eloRes.redDelta,
          blackEloBefore: eloRes.blackBefore,
          blackEloAfter: eloRes.blackAfter,
          blackEloDelta: eloRes.blackDelta,
          initialFen: room.initialFen,
          finalFen: boardToFen(room.board, room.turn, false),
          moveCount: room.moves.length,
          wxfText: wxfPairs.join(' '),
          createdAt: now,
          updatedAt: now,
        };

        await Promise.all([
          setDocRealtime('games', gameId, gameDoc, true, roomEnv),
          setDocRealtime('ratings', redDocId, updatedRedRating, true, roomEnv),
          setDocRealtime('ratings', blackDocId, updatedBlackRating, true, roomEnv),
          setDocRealtime('ratingHistory', `hist_${now}_r`, redHistDoc, true, roomEnv),
          setDocRealtime('ratingHistory', `hist_${now}_b`, blackHistDoc, true, roomEnv),
          setDocRealtime('moves', gameId, { moves: room.moves }, true, roomEnv),
        ]);
      } catch (err) {
        console.error('Error updating Elo after match:', err);
      }
    }

    await persistRoomSnapshotRealtime(room);
    io.to(room.code).emit('room:state', serializeRoomForClient(room));
    broadcastRoomListUpdate(roomEnv);

    if (room.cleanupAfterFinish) {
      setTimeout(async () => {
        if (liveRooms.get(room.code)?.status === 'finished') {
          liveRooms.delete(room.code);
          await deleteDocRealtime('rooms', room.code, roomEnv).catch(() => {});
          broadcastRoomListUpdate(roomEnv);
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
        const redKey = `${room.env || 'prod'}:${room.redPlayer.uid}`;
        const hasActiveSocket =
          (userSockets.get(redKey)?.size || 0) > 0 ||
          (userSockets.get(room.redPlayer.uid)?.size || 0) > 0;
        if (hasActiveSocket) {
          room.redPlayer.connected = true;
          room.redPlayer.disconnectedAt = undefined;
          room.redPlayer.disconnectDeadline = undefined;
        } else {
          void finalizeRealtimeGame(room, 'black', 'Đỏ mất kết nối quá 90 giây');
          continue;
        }
      }
      if (
        room.blackPlayer &&
        !room.blackPlayer.connected &&
        room.blackPlayer.disconnectDeadline &&
        now >= room.blackPlayer.disconnectDeadline
      ) {
        const blackKey = `${room.env || 'prod'}:${room.blackPlayer.uid}`;
        const hasActiveSocket =
          (userSockets.get(blackKey)?.size || 0) > 0 ||
          (userSockets.get(room.blackPlayer.uid)?.size || 0) > 0;
        if (hasActiveSocket) {
          room.blackPlayer.connected = true;
          room.blackPlayer.disconnectedAt = undefined;
          room.blackPlayer.disconnectDeadline = undefined;
        } else {
          void finalizeRealtimeGame(room, 'red', 'Đen mất kết nối quá 90 giây');
          continue;
        }
      }

      if (room.moveTimeLimitMs > 0 && room.currentMoveRemainingMs <= 0) {
        const winner = room.turn === 'r' ? 'black' : 'red';
        void finalizeRealtimeGame(
          room,
          winner,
          `${room.turn === 'r' ? 'Đỏ' : 'Đen'} quá 2 phút cho 1 nước đi`
        );
        continue;
      }

      if (room.redTimeMs <= 0) {
        void finalizeRealtimeGame(room, 'black', 'Đỏ hết thời gian');
        continue;
      }
      if (room.blackTimeMs <= 0) {
        void finalizeRealtimeGame(room, 'red', 'Đen hết thời gian');
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
    const socketEnv: ServerEnv = socket.data.env === 'staging' ? 'staging' : 'prod';
    socket.join(`env:${socketEnv}`);

    let boundUid = '';
    let boundUsername = '';
    let currentRoomCode = '';

    socket.on('auth:bind', (payload: { uid: string; username: string; roomCode?: string }) => {
      if (!payload?.uid) return;
      boundUid = String(payload.uid);
      boundUsername = String(payload.username || 'Kỳ thủ');
      const userKey = `${socketEnv}:${boundUid}`;
      if (!userSockets.has(userKey)) {
        userSockets.set(userKey, new Set());
      }
      userSockets.get(userKey)!.add(socket.id);
      if (!userSockets.has(boundUid)) {
        userSockets.set(boundUid, new Set());
      }
      userSockets.get(boundUid)!.add(socket.id);

      const preferredCode = String(payload.roomCode || '').trim().toUpperCase();
      let joinedRooms = 0;

      const bindPlayerToRoom = (room: LiveRoom) => {
        const isRed = isSameAccount(room.redPlayer, boundUid, boundUsername);
        const isBlack = isSameAccount(room.blackPlayer, boundUid, boundUsername);
        const spec = room.spectators.find((s) => isSameAccount(s, boundUid, boundUsername));
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
          const serialized = serializeRoomForClient(room);
          socket.emit('room:state', serialized);
          io.to(room.code).emit('room:state', serialized);
          joinedRooms++;
          return true;
        }
        return false;
      };

      if (preferredCode && liveRooms.has(preferredCode)) {
        const prefRoom = liveRooms.get(preferredCode)!;
        if ((prefRoom.env || 'prod') === socketEnv) {
          bindPlayerToRoom(prefRoom);
        }
      }

      // Check remaining live rooms, prioritizing ongoing playing rooms
      const candidateRooms = Array.from(liveRooms.values())
        .filter((r) => (r.env || 'prod') === socketEnv && r.code !== preferredCode)
        .sort((a, b) => (a.status === 'playing' ? -1 : 1));

      for (const room of candidateRooms) {
        if (joinedRooms > 0 && room.status !== 'playing') break;
        bindPlayerToRoom(room);
      }
    });

    socket.on(
      'room:rejoin',
      async (
        payload: { code: string; uid: string; username: string },
        cb?: (res: any) => void
      ) => {
        try {
          const code = String(payload?.code || currentRoomCode).trim().toUpperCase();
          const uid = String(payload?.uid || boundUid);
          const username = String(payload?.username || boundUsername);
          let room = liveRooms.get(code);

          if (!room || (room.env || 'prod') !== socketEnv) {
            const snap = await getDocRealtime('rooms', code, socketEnv);
            if (snap && snap.status !== 'finished') {
              await hydrateLiveRoomsFromFirestore(socketEnv);
              room = liveRooms.get(code);
            }
          }

          if (!room || (room.env || 'prod') !== socketEnv) {
            return cb?.({ error: 'Không tìm thấy phòng để kết nối lại' });
          }

          currentRoomCode = code;
          socket.join(code);

          const isRed = isSameAccount(room.redPlayer, uid, username);
          const isBlack = isSameAccount(room.blackPlayer, uid, username);
          const spec = room.spectators.find((s) => isSameAccount(s, uid, username));

          if (isRed && room.redPlayer) {
            room.redPlayer.connected = true;
            room.redPlayer.disconnectedAt = undefined;
            room.redPlayer.disconnectDeadline = undefined;
          } else if (isBlack && room.blackPlayer) {
            room.blackPlayer.connected = true;
            room.blackPlayer.disconnectedAt = undefined;
            room.blackPlayer.disconnectDeadline = undefined;
          } else if (spec) {
            spec.connected = true;
          }

          deduplicateRoomParticipants(room);
          const serialized = serializeRoomForClient(room);
          socket.emit('room:state', serialized);
          io.to(code).emit('room:state', serialized);
          cb?.({ room: serialized });
        } catch {
          cb?.({ error: 'Lỗi kết nối lại phòng' });
        }
      }
    );

    socket.on('ping:heartbeat', () => {
      socket.emit('pong:heartbeat', { t: Date.now() });
    });

    socket.on('room:list', (payload: { mode?: string }, cb?: (res: any) => void) => {
      const modeFilter = payload?.mode;
      const data = getRoomListSummary(modeFilter, socketEnv);
      if (typeof cb === 'function') cb(data);
    });

    socket.on(
      'room:create',
      async (
        payload: { uid: string; username: string; mode: RatedMode },
        cb?: (res: any) => void
      ) => {
        try {
          const uid = String(payload?.uid || boundUid);
          const user = await getUserByUidRealtime(uid, socketEnv);
          if (!user || !user.isCreateAccount) {
            return cb?.({ error: 'Tài khoản chờ duyệt chưa thể tạo phòng xếp hạng' });
          }

          const rawMode = String(payload.mode || 'blitz');
          const mode: RatedMode =
            rawMode === 'standard' || rawMode === 'dark' ? rawMode : 'blitz';
          const username = user.username;
          const [elo, cfg] = await Promise.all([
            getUserModeEloRealtime(uid, username, mode, user.displayName, socketEnv),
            getAdminConfigRealtime(socketEnv),
          ]);
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
            env: socketEnv,
            mode,
            hostUid: uid,
            status: 'waiting',
            redPlayer: {
              uid,
              username,
              displayName: user.displayName || username,
              elo,
              connected: true,
            },
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
                text: `${user.displayName || username} vào phòng`,
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
          await persistRoomSnapshotRealtime(room);
          broadcastRoomListUpdate(socketEnv);

          cb?.({ room: serializeRoomForClient(room) });
        } catch {
          cb?.({ error: 'Lỗi tạo phòng' });
        }
      }
    );

    socket.on(
      'room:join',
      async (
        payload: { code: string; uid: string; username: string; asSpectator?: boolean },
        cb?: (res: any) => void
      ) => {
        try {
          const code = String(payload?.code || '').trim().toUpperCase();
          const uid = String(payload?.uid || boundUid);
          let room = liveRooms.get(code);
          if (!room || (room.env || 'prod') !== socketEnv) {
            const snap = await getDocRealtime('rooms', code, socketEnv);
            if (snap && snap.status !== 'finished') {
              await hydrateLiveRoomsFromFirestore(socketEnv);
              room = liveRooms.get(code);
            }
          }
          if (!room || (room.env || 'prod') !== socketEnv) {
            return cb?.({ error: 'Không tìm thấy phòng' });
          }

          const user = await getUserByUidRealtime(uid, socketEnv);
          if (!user || !user.isCreateAccount) {
            return cb?.({ error: 'Tài khoản chờ duyệt chưa thể vào phòng xếp hạng' });
          }

          const username = user.username;
          const displayName = user.displayName || username;
          const elo = await getUserModeEloRealtime(uid, username, room.mode, displayName, socketEnv);

          // Re-check room state after async awaits and enforce single-seat-per-account invariant
          deduplicateRoomParticipants(room);

          const isAlreadyRed = isSameAccount(room.redPlayer, uid, username);
          const isAlreadyBlack = isSameAccount(room.blackPlayer, uid, username);
          const existingSpec = room.spectators.find((s) => isSameAccount(s, uid, username));
          const wasAlreadyInRoom = Boolean(isAlreadyRed || isAlreadyBlack || existingSpec);

          if (isAlreadyRed && room.redPlayer) {
            room.redPlayer.uid = uid;
            room.redPlayer.username = username;
            room.redPlayer.connected = true;
            room.redPlayer.elo = elo;
            room.redPlayer.displayName = displayName;
            room.redPlayer.disconnectDeadline = undefined;
          } else if (isAlreadyBlack && room.blackPlayer) {
            room.blackPlayer.uid = uid;
            room.blackPlayer.username = username;
            room.blackPlayer.connected = true;
            room.blackPlayer.elo = elo;
            room.blackPlayer.displayName = displayName;
            room.blackPlayer.disconnectDeadline = undefined;
          } else if (existingSpec) {
            existingSpec.uid = uid;
            existingSpec.username = username;
            existingSpec.connected = true;
            existingSpec.elo = elo;
            existingSpec.displayName = displayName;
          } else if (room.hostUid === uid && room.status !== 'playing') {
            // Chủ phòng chỉ có 2 lựa chọn: Đỏ hoặc Đen
            if (!room.redPlayer) {
              room.redPlayer = { uid, username, displayName, elo, connected: true };
            } else if (!room.blackPlayer) {
              room.blackPlayer = { uid, username, displayName, elo, connected: true };
            } else {
              room.redPlayer = { uid, username, displayName, elo, connected: true };
            }
          } else if (!payload.asSpectator && room.status !== 'playing' && !room.redPlayer) {
            room.redPlayer = { uid, username, displayName, elo, connected: true };
          } else if (!payload.asSpectator && room.status !== 'playing' && !room.blackPlayer) {
            room.blackPlayer = { uid, username, displayName, elo, connected: true };
          } else {
            if (room.spectators.length >= 6) {
              return cb?.({ error: 'Phòng đã đủ 2 người chơi và 6 người xem' });
            }
            room.spectators.push({ uid, username, displayName, elo, connected: true });
          }

          deduplicateRoomParticipants(room);

          currentRoomCode = code;
          socket.join(code);
          if (!wasAlreadyInRoom) {
            const now = Date.now();
            room.chat.push({
              id: `sys_${now}_${Math.random()}`,
              senderUid: 'system',
              senderName: 'Hệ thống',
              text: `${displayName} vào phòng`,
              type: 'system',
              timestamp: now,
            });
          }

          await persistRoomSnapshotRealtime(room);
          const serialized = serializeRoomForClient(room);
          io.to(code).emit('room:state', serialized);
          broadcastRoomListUpdate(socketEnv);
          cb?.({ room: serialized });
        } catch {
          cb?.({ error: 'Lỗi vào phòng' });
        }
      }
    );

    socket.on(
      'room:switch_seat',
      async (
        payload: { code: string; uid: string; targetSeat: 'red' | 'black' | 'spectator' },
        cb?: (res: any) => void
      ) => {
        try {
          const code = String(payload?.code || currentRoomCode).toUpperCase();
          const uid = String(payload?.uid || boundUid);
          const targetSeat = payload?.targetSeat;
          const room = liveRooms.get(code);
          if (!room || (room.env || 'prod') !== socketEnv) return cb?.({ error: 'Không tìm thấy phòng' });
          if (room.status !== 'waiting') return cb?.({ error: 'Chỉ có thể đổi ghế ở phòng chờ' });

          const user = await getUserByUidRealtime(uid, socketEnv);
          const username = user?.username || boundUsername || 'Người chơi';
          const displayName = user?.displayName || username;
          const elo = await getUserModeEloRealtime(uid, username, room.mode, displayName, socketEnv);

          deduplicateRoomParticipants(room);

          const isRed = isSameAccount(room.redPlayer, uid, username);
          const isBlack = isSameAccount(room.blackPlayer, uid, username);
          const isSpec = room.spectators.some((s) => isSameAccount(s, uid, username));

          if (targetSeat === 'red') {
            if (isRed) return cb?.({ room: serializeRoomForClient(room) });
            if (room.redPlayer && !isSameAccount(room.redPlayer, uid, username)) {
              return cb?.({ error: 'Ghế Đỏ đã có người ngồi' });
            }
            if (isBlack) room.blackPlayer = null;
            if (isSpec) {
              room.spectators = room.spectators.filter((s) => !isSameAccount(s, uid, username));
            }
            room.redPlayer = { uid, username, displayName, elo, connected: true };
          } else if (targetSeat === 'black') {
            if (isBlack) return cb?.({ room: serializeRoomForClient(room) });
            if (room.blackPlayer && !isSameAccount(room.blackPlayer, uid, username)) {
              return cb?.({ error: 'Ghế Đen đã có người ngồi' });
            }
            if (isRed) room.redPlayer = null;
            if (isSpec) {
              room.spectators = room.spectators.filter((s) => !isSameAccount(s, uid, username));
            }
            room.blackPlayer = { uid, username, displayName, elo, connected: true };
          } else if (targetSeat === 'spectator') {
            const isHostUser =
              room.hostUid === uid ||
              (Boolean(room.hostUid) &&
                ((room.redPlayer?.uid === room.hostUid && isSameAccount(room.redPlayer, uid, username)) ||
                 (room.blackPlayer?.uid === room.hostUid && isSameAccount(room.blackPlayer, uid, username)))) ||
              (!room.hostUid && isSameAccount(room.redPlayer, uid, username));

            if (isHostUser) {
              return cb?.({ error: 'Chủ phòng không được xuống người xem, chỉ có 2 lựa chọn là Đỏ hoặc Đen' });
            }
            if (isSpec && !isRed && !isBlack) {
              return cb?.({ room: serializeRoomForClient(room) });
            }
            const otherSpecs = room.spectators.filter((s) => !isSameAccount(s, uid, username));
            if (otherSpecs.length >= 6) return cb?.({ error: 'Ghế khán giả đã đầy (6/6)' });
            if (isRed) room.redPlayer = null;
            if (isBlack) room.blackPlayer = null;
            room.spectators = [
              ...otherSpecs,
              { uid, username, displayName, elo, connected: true },
            ];
          }

          deduplicateRoomParticipants(room);

          await persistRoomSnapshotRealtime(room);
          const serialized = serializeRoomForClient(room);
          io.to(code).emit('room:state', serialized);
          broadcastRoomListUpdate(socketEnv);
          cb?.({ room: serialized });
        } catch {
          cb?.({ error: 'Lỗi đổi ghế' });
        }
      }
    );

    socket.on(
      'room:start',
      async (payload: { code: string; uid: string }, cb?: (res: any) => void) => {
        const code = String(payload?.code || currentRoomCode).toUpperCase();
        const uid = String(payload?.uid || boundUid);
        const room = liveRooms.get(code);
        if (!room) return cb?.({ error: 'Phòng không tồn tại' });

        deduplicateRoomParticipants(room);

        const isHost =
          room.hostUid === uid ||
          (Boolean(room.hostUid) &&
            ((room.redPlayer?.uid === room.hostUid && isSameAccount(room.redPlayer, uid, boundUsername)) ||
             (room.blackPlayer?.uid === room.hostUid && isSameAccount(room.blackPlayer, uid, boundUsername)))) ||
          (!room.hostUid && isSameAccount(room.redPlayer, uid, boundUsername));

        if (!isHost) {
          return cb?.({ error: 'Chỉ có chủ phòng mới được phép bắt đầu trận đấu' });
        }

        const isSittingPlayer =
          Boolean(room.redPlayer && isSameAccount(room.redPlayer, uid, boundUsername)) ||
          Boolean(room.blackPlayer && isSameAccount(room.blackPlayer, uid, boundUsername));
        if (!isSittingPlayer) {
          return cb?.({ error: 'Chủ phòng phải ngồi ghế Đỏ hoặc Đen mới có thể bắt đầu trận đấu' });
        }

        if (
          !room.redPlayer ||
          !room.blackPlayer ||
          isSameAccount(room.blackPlayer, room.redPlayer.uid, room.redPlayer.username)
        ) {
          return cb?.({ error: 'Cần đủ 2 kỳ thủ khác nhau để bắt đầu ván đấu' });
        }

        const cfg = await getAdminConfigRealtime(socketEnv);
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

        await persistRoomSnapshotRealtime(room);
        const serialized = serializeRoomForClient(room);
        io.to(code).emit('room:state', serialized);
        broadcastRoomListUpdate(socketEnv);
        cb?.({ room: serialized });
      }
    );

    socket.on(
      'room:return_to_waiting',
      async (payload: { code: string; uid: string }, cb?: (res: any) => void) => {
        try {
          const code = String(payload?.code || currentRoomCode).toUpperCase();
          const uid = String(payload?.uid || boundUid);
          const room = liveRooms.get(code);
          if (!room) return cb?.({ error: 'Phòng không tồn tại' });

          const isParticipant =
            room.redPlayer?.uid === uid ||
            room.blackPlayer?.uid === uid ||
            room.hostUid === uid ||
            room.spectators.some((s) => s.uid === uid);
          if (!isParticipant) {
            return cb?.({ error: 'Bạn không ở trong phòng này' });
          }

          const cfg = await getAdminConfigRealtime(socketEnv);
          const tc = getTimeControlForMode(room.mode, cfg);
          const { board } =
            room.mode === 'dark' ? createDarkXiangqiBoard() : parseFen(INITIAL_FEN);
          const now = Date.now();

          room.status = 'waiting';
          room.board = board;
          room.turn = 'r';
          room.initialFen = boardToFen(board, 'r', false);
          room.fenHistory = [];
          room.checkHistory = [];
          room.moves = [];
          room.redTimeMs = tc.totalMs;
          room.blackTimeMs = tc.totalMs;
          room.moveTimeLimitMs = tc.moveLimitMs;
          room.incrementMs = tc.incrementMs;
          room.currentMoveRemainingMs = tc.moveLimitMs;
          room.lastTickAt = now;
          room.turnDeadline = 0;
          room.drawOfferBy = null;
          room.winner = undefined;
          room.endReason = '';
          room.eloResult = null;
          room.cleanupAfterFinish = false;
          room.updatedAt = now;

          deduplicateRoomParticipants(room);

          room.chat.push({
            id: `sys_${now}_${Math.random().toString(36).slice(2, 6)}`,
            senderUid: 'system',
            senderName: 'Hệ thống',
            text: 'Ván đấu kết thúc. Toàn bộ kỳ thủ và khán giả đã trở về phòng chờ.',
            type: 'system',
            timestamp: now,
          });

          await persistRoomSnapshotRealtime(room);
          const serialized = serializeRoomForClient(room);
          io.to(code).emit('room:state', serialized);
          broadcastRoomListUpdate(socketEnv);
          cb?.({ room: serialized });
        } catch {
          cb?.({ error: 'Lỗi trở về phòng chờ' });
        }
      }
    );

    socket.on(
      'game:move',
      async (
        payload: {
          code: string;
          uid: string;
          from: { row: number; col: number };
          to: { row: number; col: number };
        },
        cb?: (res: any) => void
      ) => {
        const code = String(payload?.code || currentRoomCode).toUpperCase();
        const uid = String(payload?.uid || boundUid);
        const room = liveRooms.get(code);
        if (!room || room.status !== 'playing') {
          return cb?.({ error: 'Ván đấu không hoạt động' });
        }

        const playerColor: PieceColor | null =
          isSameAccount(room.redPlayer, uid, boundUsername)
            ? 'r'
            : isSameAccount(room.blackPlayer, uid, boundUsername)
            ? 'b'
            : null;
        if (!playerColor || playerColor !== room.turn) {
          return cb?.({ error: 'Chưa tới lượt của bạn' });
        }

        if (playerColor === 'r' && room.redPlayer) {
          room.redPlayer.connected = true;
          room.redPlayer.disconnectedAt = undefined;
          room.redPlayer.disconnectDeadline = undefined;
        } else if (playerColor === 'b' && room.blackPlayer) {
          room.blackPlayer.connected = true;
          room.blackPlayer.disconnectedAt = undefined;
          room.blackPlayer.disconnectDeadline = undefined;
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
          await finalizeRealtimeGame(room, status.winner, status.reason);
        } else {
          await persistRoomSnapshotRealtime(room);
          io.to(code).emit('room:state', serializeRoomForClient(room));
        }
        cb?.({ ok: true });
      }
    );

    socket.on('game:resign', async (payload: { code: string; uid: string }) => {
      const code = String(payload?.code || currentRoomCode).toUpperCase();
      const uid = String(payload?.uid || boundUid);
      const room = liveRooms.get(code);
      if (!room || room.status !== 'playing') return;

      const isRed = isSameAccount(room.redPlayer, uid, boundUsername);
      const isBlack = isSameAccount(room.blackPlayer, uid, boundUsername);

      if (isRed) {
        await finalizeRealtimeGame(room, 'black', 'Đỏ nhận thua');
      } else if (isBlack) {
        await finalizeRealtimeGame(room, 'red', 'Đen nhận thua');
      }
    });

    socket.on('game:draw_offer', (payload: { code: string; uid: string }) => {
      const code = String(payload?.code || currentRoomCode).toUpperCase();
      const uid = String(payload?.uid || boundUid);
      const room = liveRooms.get(code);
      if (!room || room.status !== 'playing') return;

      const color: PieceColor | null =
        isSameAccount(room.redPlayer, uid, boundUsername)
          ? 'r'
          : isSameAccount(room.blackPlayer, uid, boundUsername)
          ? 'b'
          : null;
      if (!color) return;

      if (color === 'r' && room.redPlayer) {
        room.redPlayer.connected = true;
        room.redPlayer.disconnectedAt = undefined;
        room.redPlayer.disconnectDeadline = undefined;
      } else if (color === 'b' && room.blackPlayer) {
        room.blackPlayer.connected = true;
        room.blackPlayer.disconnectedAt = undefined;
        room.blackPlayer.disconnectDeadline = undefined;
      }

      room.drawOfferBy = color;
      io.to(code).emit('room:state', serializeRoomForClient(room));
    });

    socket.on(
      'game:draw_respond',
      async (payload: { code: string; uid: string; accept: boolean }) => {
        const code = String(payload?.code || currentRoomCode).toUpperCase();
        const uid = String(payload?.uid || boundUid);
        const room = liveRooms.get(code);
        if (!room || room.status !== 'playing' || !room.drawOfferBy) return;

        const responderColor: PieceColor | null =
          isSameAccount(room.redPlayer, uid, boundUsername)
            ? 'r'
            : isSameAccount(room.blackPlayer, uid, boundUsername)
            ? 'b'
            : null;
        if (!responderColor || responderColor === room.drawOfferBy) return;

        if (responderColor === 'r' && room.redPlayer) {
          room.redPlayer.connected = true;
          room.redPlayer.disconnectedAt = undefined;
          room.redPlayer.disconnectDeadline = undefined;
        } else if (responderColor === 'b' && room.blackPlayer) {
          room.blackPlayer.connected = true;
          room.blackPlayer.disconnectedAt = undefined;
          room.blackPlayer.disconnectDeadline = undefined;
        }

        if (payload.accept) {
          await finalizeRealtimeGame(room, 'draw', 'Thỏa thuận hòa');
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

        const isRed = isSameAccount(room.redPlayer, uid, boundUsername);
        const isBlack = isSameAccount(room.blackPlayer, uid, boundUsername);
        const isSpectator = !isRed && !isBlack;

        if (isRed && room.redPlayer) {
          room.redPlayer.connected = true;
          room.redPlayer.disconnectedAt = undefined;
          room.redPlayer.disconnectDeadline = undefined;
        } else if (isBlack && room.blackPlayer) {
          room.blackPlayer.connected = true;
          room.blackPlayer.disconnectedAt = undefined;
          room.blackPlayer.disconnectDeadline = undefined;
        }

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
        if (room.chat.length > 300) room.chat.shift();
        io.to(code).emit('chat:message', msg);
      }
    );

    socket.on('room:leave', async (payload: { code?: string; uid?: string }) => {
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
          leaverName = room.redPlayer.displayName || room.redPlayer.username;
          room.redPlayer.connected = false;
          room.redPlayer.disconnectedAt = now;
          room.redPlayer.disconnectDeadline = now + 60_000;
        } else if (room.blackPlayer?.uid === uid) {
          leaverName = room.blackPlayer.displayName || room.blackPlayer.username;
          room.blackPlayer.connected = false;
          room.blackPlayer.disconnectedAt = now;
          room.blackPlayer.disconnectDeadline = now + 60_000;
        } else {
          room.spectators = room.spectators.filter((s) => s.uid !== uid);
        }
      } else {
        if (room.redPlayer?.uid === uid) {
          leaverName = room.redPlayer.displayName || room.redPlayer.username;
          room.redPlayer = null;
        } else if (room.blackPlayer?.uid === uid) {
          leaverName = room.blackPlayer.displayName || room.blackPlayer.username;
          room.blackPlayer = null;
        } else {
          const sp = room.spectators.find((s) => s.uid === uid);
          if (sp) leaverName = sp.displayName || sp.username;
          room.spectators = room.spectators.filter((s) => s.uid !== uid);
        }

        if (!room.redPlayer && !room.blackPlayer && room.spectators.length === 0) {
          liveRooms.delete(code);
          await deleteDocRealtime('rooms', code, room.env || socketEnv).catch(() => {});
          broadcastRoomListUpdate(room.env || socketEnv);
          return;
        }
        if (room.hostUid === uid) {
          if (room.redPlayer?.uid) {
            room.hostUid = room.redPlayer.uid;
          } else if (room.blackPlayer?.uid) {
            room.hostUid = room.blackPlayer.uid;
          } else if (room.spectators.length > 0) {
            const newHost = room.spectators.shift()!;
            room.hostUid = newHost.uid;
            room.redPlayer = newHost;
          } else {
            room.hostUid = '';
          }
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

      await persistRoomSnapshotRealtime(room);
      io.to(code).emit('room:state', serializeRoomForClient(room));
      broadcastRoomListUpdate(room.env || socketEnv);
    });

    socket.on('disconnect', () => {
      if (boundUid) {
        const userKey = `${socketEnv}:${boundUid}`;
        if (userSockets.has(userKey)) {
          const set = userSockets.get(userKey)!;
          set.delete(socket.id);
          if (set.size === 0) {
            userSockets.delete(userKey);
          }
        }
        if (userSockets.has(boundUid)) {
          const set = userSockets.get(boundUid)!;
          set.delete(socket.id);
          if (set.size === 0) {
            userSockets.delete(boundUid);
          }
        }

        // 4.5s grace period: tránh hiển thị gián đoạn khi đổi session / reconnect nhanh 2-3s
        setTimeout(() => {
          const stillHasSocket =
            (userSockets.get(userKey)?.size || 0) > 0 ||
            (userSockets.get(boundUid)?.size || 0) > 0;
          if (stillHasSocket) {
            return;
          }
          const now = Date.now();
          for (const room of liveRooms.values()) {
            if ((room.env || 'prod') !== socketEnv) continue;
            let changed = false;
            const isRed = isSameAccount(room.redPlayer, boundUid, boundUsername);
            const isBlack = isSameAccount(room.blackPlayer, boundUid, boundUsername);
            if (isRed && room.redPlayer && room.redPlayer.connected) {
              room.redPlayer.connected = false;
              if (room.status === 'playing') {
                room.redPlayer.disconnectedAt = now;
                room.redPlayer.disconnectDeadline = now + 90_000;
              }
              changed = true;
            }
            if (isBlack && room.blackPlayer && room.blackPlayer.connected) {
              room.blackPlayer.connected = false;
              if (room.status === 'playing') {
                room.blackPlayer.disconnectedAt = now;
                room.blackPlayer.disconnectDeadline = now + 90_000;
              }
              changed = true;
            }
            if (changed) {
              io.to(room.code).emit('room:state', serializeRoomForClient(room));
            }
          }
        }, 4500);
      }
    });
  });

  const publicPath = path.resolve(process.cwd(), 'public');
  app.use('/images', express.static(path.join(publicPath, 'images')));
  app.use('/src/assets/images', express.static(path.join(publicPath, 'images/themes')));

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
