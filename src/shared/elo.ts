/**
 * FIDE Elo Calculation, Rank Title System, and Anti-Boosting Penalty Engine
 * Shared between Client and Server, with unit tests.
 */

export type RatedMode = 'blitz' | 'standard' | 'dark';

export interface EloConfig {
  antiBoostWindowGames: number; // default 5
  antiBoostThreshold: number; // default 2 (3rd match onwards)
  antiBoostMaxPenalty: number; // default 2
  decayDays: number; // default 7
  decayPenalty: number; // default 20
  resetDays: number; // default 14
  cleanupHour: number; // default 22
}

export const DEFAULT_INITIAL_ELO = 1300;

export const DEFAULT_ELO_CONFIG: EloConfig = {
  antiBoostWindowGames: 5,
  antiBoostThreshold: 2,
  antiBoostMaxPenalty: 2,
  decayDays: 7,
  decayPenalty: 20,
  resetDays: 14,
  cleanupHour: 22,
};

/**
 * Determines FIDE K-factor for a player:
 * - K = 40 for the first 30 rated games (gamesPlayed < 30 or provisional = true)
 * - K = 10 if current Elo >= 2400
 * - K = 20 otherwise
 */
export function getKFactor(elo: number, gamesPlayed: number, provisional = false): number {
  if (provisional || gamesPlayed < 30) {
    return 40;
  }
  if (elo >= 2400) {
    return 10;
  }
  return 20;
}

/**
 * Expected score E = 1 / (1 + 10^((R_opp - R) / 400))
 */
export function getExpectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

export interface EloMatchInput {
  redElo: number;
  redGames: number;
  redProvisional?: boolean;
  blackElo: number;
  blackGames: number;
  blackProvisional?: boolean;
  outcome: 'red' | 'black' | 'draw';
  /**
   * Recent opponent UIDs in the last N rated games of the same mode for Red and Black
   */
  redRecentOpponents?: string[];
  blackRecentOpponents?: string[];
  redUid?: string;
  blackUid?: string;
  config?: Partial<EloConfig>;
}

export interface EloMatchResult {
  redBefore: number;
  redAfter: number;
  redDelta: number;
  redBoostPenalty: number;
  blackBefore: number;
  blackAfter: number;
  blackDelta: number;
  blackBoostPenalty: number;
  repeatCountN: number;
}

/**
 * Calculates FIDE Elo changes for both players including Anti-Boosting penalty:
 * - Floor is 100.
 * - Anti-boosting: look at the last `antiBoostWindowGames` (default 5) rated games in the same mode
 *   for BOTH players, count how many times they played this exact opponent, take the larger count `n`.
 * - If `n >= antiBoostThreshold` (default 2, i.e., 3rd match onwards), the WINNER's positive Elo gain
 *   is reduced: n = 2 reduces by 1 point, n >= 3 reduces by `antiBoostMaxPenalty` (default 2 points),
 *   but a winner always receives at least +1.
 * - The loser still loses the full amount; draws are calculated normally.
 */
export function calculateMatchElo(input: EloMatchInput): EloMatchResult {
  const cfg: EloConfig = { ...DEFAULT_ELO_CONFIG, ...(input.config || {}) };

  const kRed = getKFactor(input.redElo, input.redGames, input.redProvisional);
  const kBlack = getKFactor(input.blackElo, input.blackGames, input.blackProvisional);

  const eRed = getExpectedScore(input.redElo, input.blackElo);
  const eBlack = getExpectedScore(input.blackElo, input.redElo);

  const sRed = input.outcome === 'red' ? 1 : input.outcome === 'black' ? 0 : 0.5;
  const sBlack = 1 - sRed;

  let rawRedDelta = Math.round(kRed * (sRed - eRed));
  let rawBlackDelta = Math.round(kBlack * (sBlack - eBlack));

  // Count recent matchups within the window
  const windowSize = cfg.antiBoostWindowGames;
  const redOpps = (input.redRecentOpponents || []).slice(0, windowSize);
  const blackOpps = (input.blackRecentOpponents || []).slice(0, windowSize);

  const countRedMetBlack = input.blackUid
    ? redOpps.filter((id) => id === input.blackUid).length
    : 0;
  const countBlackMetRed = input.redUid
    ? blackOpps.filter((id) => id === input.redUid).length
    : 0;

  const repeatCountN = Math.max(countRedMetBlack, countBlackMetRed);

  let redBoostPenalty = 0;
  let blackBoostPenalty = 0;

  if (repeatCountN >= cfg.antiBoostThreshold) {
    const penalty =
      repeatCountN === cfg.antiBoostThreshold
        ? 1
        : Math.min(cfg.antiBoostMaxPenalty, repeatCountN - cfg.antiBoostThreshold + 1);

    if (input.outcome === 'red') {
      const baseGain = Math.max(1, rawRedDelta);
      const reducedGain = Math.max(1, baseGain - penalty);
      redBoostPenalty = baseGain - reducedGain;
      rawRedDelta = reducedGain;
    } else if (input.outcome === 'black') {
      const baseGain = Math.max(1, rawBlackDelta);
      const reducedGain = Math.max(1, baseGain - penalty);
      blackBoostPenalty = baseGain - reducedGain;
      rawBlackDelta = reducedGain;
    }
  } else {
    // Ensure a win always grants at least +1 before floor
    if (input.outcome === 'red' && rawRedDelta < 1) rawRedDelta = 1;
    if (input.outcome === 'black' && rawBlackDelta < 1) rawBlackDelta = 1;
  }

  const redAfter = Math.max(100, input.redElo + rawRedDelta);
  const blackAfter = Math.max(100, input.blackElo + rawBlackDelta);

  return {
    redBefore: input.redElo,
    redAfter,
    redDelta: redAfter - input.redElo,
    redBoostPenalty,
    blackBefore: input.blackElo,
    blackAfter,
    blackDelta: blackAfter - input.blackElo,
    blackBoostPenalty,
    repeatCountN,
  };
}

/**
 * Evaluates inactivity decay/reset for a player's rating record at 00:05 daily cron:
 * - Only applies to players with at least 1 rated game (`gamesPlayed >= 1` and `lastRatedGameAt > 0`).
 * - `inactiveDays = Math.floor((nowMs - lastRatedGameAt) / 86400000)`
 * - If `inactiveDays > resetDays` (default 14): reset Elo to DEFAULT_INITIAL_ELO (1300), `provisional = true`,
 *   `hiddenFromLeaderboard = true`, `gamesPlayedSinceReset = 0`.
 * - Else if `inactiveDays >= decayDays` (default 7) and `!decayApplied`:
 *   subtract `decayPenalty` (default 20) once, floor 800, set `decayApplied = true`.
 */
export function evaluateInactivityDecay(
  rating: {
    elo: number;
    gamesPlayed: number;
    lastRatedGameAt?: number;
    decayApplied?: boolean;
    hiddenFromLeaderboard?: boolean;
    provisional?: boolean;
  },
  nowMs: number,
  config: Partial<EloConfig> = {}
): {
  action: 'none' | 'decay' | 'reset';
  afterElo: number;
  delta: number;
  decayApplied: boolean;
  hiddenFromLeaderboard: boolean;
  provisional: boolean;
} {
  const cfg: EloConfig = { ...DEFAULT_ELO_CONFIG, ...config };
  if (!rating.gamesPlayed || rating.gamesPlayed < 1 || !rating.lastRatedGameAt) {
    return {
      action: 'none',
      afterElo: rating.elo,
      delta: 0,
      decayApplied: Boolean(rating.decayApplied),
      hiddenFromLeaderboard: Boolean(rating.hiddenFromLeaderboard),
      provisional: Boolean(rating.provisional),
    };
  }

  const inactiveDays = Math.floor((nowMs - rating.lastRatedGameAt) / (1000 * 60 * 60 * 24));

  if (inactiveDays > cfg.resetDays) {
    if (rating.hiddenFromLeaderboard && rating.provisional && rating.elo === DEFAULT_INITIAL_ELO) {
      return {
        action: 'none',
        afterElo: DEFAULT_INITIAL_ELO,
        delta: 0,
        decayApplied: true,
        hiddenFromLeaderboard: true,
        provisional: true,
      };
    }
    return {
      action: 'reset',
      afterElo: DEFAULT_INITIAL_ELO,
      delta: DEFAULT_INITIAL_ELO - rating.elo,
      decayApplied: true,
      hiddenFromLeaderboard: true,
      provisional: true,
    };
  }

  if (inactiveDays >= cfg.decayDays && !rating.decayApplied) {
    const afterElo = Math.max(800, rating.elo - cfg.decayPenalty);
    return {
      action: 'decay',
      afterElo,
      delta: afterElo - rating.elo,
      decayApplied: true,
      hiddenFromLeaderboard: Boolean(rating.hiddenFromLeaderboard),
      provisional: Boolean(rating.provisional),
    };
  }

  return {
    action: 'none',
    afterElo: rating.elo,
    delta: 0,
    decayApplied: Boolean(rating.decayApplied),
    hiddenFromLeaderboard: Boolean(rating.hiddenFromLeaderboard),
    provisional: Boolean(rating.provisional),
  };
}

export interface EloRankTier {
  range: string;
  minElo: number;
  maxElo: number | null;
  title: string;
  badgeColor: string;
  desc: string;
}

export const ELO_RANK_TIERS: EloRankTier[] = [
  {
    range: '> 2200',
    minElo: 2201,
    maxElo: null,
    title: 'Kì tiên',
    badgeColor: 'text-rose-300 bg-rose-950/70 border-rose-500/60',
    desc: 'Cảnh giới tối cao của cờ tướng',
  },
  {
    range: '1901 – 2000',
    minElo: 1901,
    maxElo: 2200,
    title: 'Đại sư',
    badgeColor: 'text-amber-300 bg-amber-950/60 border-amber-600/50',
    desc: 'Trình độ Đại Sư danh trấn kỳ đàn',
  },
  {
    range: '1801 – 1900',
    minElo: 1801,
    maxElo: 1900,
    title: 'Kỳ thủ',
    badgeColor: 'text-purple-300 bg-purple-950/60 border-purple-700/50',
    desc: 'Bản lĩnh kỳ đàn thượng thừa',
  },
  {
    range: '1701 – 1800',
    minElo: 1701,
    maxElo: 1800,
    title: 'Cao thủ',
    badgeColor: 'text-indigo-300 bg-indigo-950/60 border-indigo-700/50',
    desc: 'Chiến thuật sắc bén, công thủ toàn diện',
  },
  {
    range: '1601 – 1700',
    minElo: 1601,
    maxElo: 1700,
    title: 'Kỳ thủ',
    badgeColor: 'text-sky-300 bg-sky-950/60 border-sky-700/50',
    desc: 'Nắm vững khai – trung – tàn cuộc',
  },
  {
    range: '1501 – 1600',
    minElo: 1501,
    maxElo: 1600,
    title: 'Ngỗng',
    badgeColor: 'text-teal-300 bg-teal-950/60 border-teal-700/50',
    desc: 'Sức cờ cứng cáp, khó bị bắt nạt',
  },
  {
    range: '1421 – 1500',
    minElo: 1421,
    maxElo: 1500,
    title: 'Ngan',
    badgeColor: 'text-emerald-300 bg-emerald-950/60 border-emerald-700/50',
    desc: 'Đã biết mổ quân và giữ thế',
  },
  {
    range: '1351 – 1420',
    minElo: 1351,
    maxElo: 1420,
    title: 'Vịt chặt chân',
    badgeColor: 'text-lime-300 bg-lime-950/60 border-lime-700/50',
    desc: 'Đang tập tễnh làm quen thế trận',
  },
  {
    range: '1301 – 1350',
    minElo: 1301,
    maxElo: 1350,
    title: 'Gián đất',
    badgeColor: 'text-stone-300 bg-stone-800/90 border-stone-600',
    desc: 'Mới bước chân vào giang hồ',
  },
  {
    range: '1300 (≤ 1300)',
    minElo: 0,
    maxElo: 1300,
    title: 'Unrank',
    badgeColor: 'text-stone-400 bg-stone-800/80 border-stone-700',
    desc: 'Mức điểm khởi đầu / Chưa phân hạng',
  },
];

/**
 * Returns Vietnamese rank tier based on Elo:
 * > 2200: Kì tiên
 * 1901–2000 (đến 2200): Đại sư
 * 1801–1900: Kỳ thủ
 * 1701–1800: Cao thủ
 * 1601–1700: Kỳ thủ
 * 1501–1600: Ngỗng
 * 1421–1500: Ngan
 * 1351–1420: Vịt chặt chân
 * 1301–1350: Gián đất
 * ≤ 1300: Unrank
 */
export function getEloRankTier(elo: number, hiddenFromLeaderboard = false): EloRankTier {
  if (hiddenFromLeaderboard || elo <= 1300) return ELO_RANK_TIERS[9];
  if (elo > 2200) return ELO_RANK_TIERS[0];
  if (elo >= 1901) return ELO_RANK_TIERS[1];
  if (elo >= 1801) return ELO_RANK_TIERS[2];
  if (elo >= 1701) return ELO_RANK_TIERS[3];
  if (elo >= 1601) return ELO_RANK_TIERS[4];
  if (elo >= 1501) return ELO_RANK_TIERS[5];
  if (elo >= 1421) return ELO_RANK_TIERS[6];
  if (elo >= 1351) return ELO_RANK_TIERS[7];
  return ELO_RANK_TIERS[8];
}

export function getEloRankTitle(elo: number, hiddenFromLeaderboard = false): string {
  return getEloRankTier(elo, hiddenFromLeaderboard).title;
}



