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
export const MIN_RATED_ELO = 1301;
export const MIN_HELL_ELO_WIN_GAIN = 10;

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
  redEloDebt?: number;
  blackElo: number;
  blackGames: number;
  blackProvisional?: boolean;
  blackEloDebt?: number;
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
  redDebtBefore: number;
  redDebtAfter: number;
  blackBefore: number;
  blackAfter: number;
  blackDelta: number;
  blackBoostPenalty: number;
  blackDebtBefore: number;
  blackDebtAfter: number;
  repeatCountN: number;
}

function resolvePlayerPostMatchElo(
  beforeElo: number,
  debtBefore: number,
  rawDelta: number,
  isWin: boolean,
  isLoss: boolean
): { afterElo: number; delta: number; debtAfter: number } {
  const cleanDebt = Math.max(0, Math.round(Number(debtBefore || 0)));
  const safeBefore = beforeElo < DEFAULT_INITIAL_ELO ? MIN_RATED_ELO : beforeElo;

  if (isWin) {
    const winGain = Math.max(1, rawDelta);
    if (cleanDebt > 0) {
      // Khi đang nợ Elo (Hell Elo): lấy số điểm Elo thắng trừ đi số Elo đang nợ rồi mới cộng Elo.
      // Số điểm tối thiểu nhận được từ 1 trận thắng bị Hell Elo là +10 Elo.
      const netGain = Math.max(MIN_HELL_ELO_WIN_GAIN, winGain - cleanDebt);
      const afterElo = Math.max(MIN_RATED_ELO, safeBefore + netGain);
      const debtAfter = Math.max(0, cleanDebt - winGain);
      return {
        afterElo,
        delta: afterElo - safeBefore,
        debtAfter,
      };
    }

    const afterElo = Math.max(MIN_RATED_ELO, safeBefore + winGain);
    return {
      afterElo,
      delta: afterElo - safeBefore,
      debtAfter: 0,
    };
  }

  if (isLoss || rawDelta < 0) {
    const lossAmount = Math.max(0, Math.abs(rawDelta));
    const availableToDeduct = Math.max(0, safeBefore - MIN_RATED_ELO);
    if (lossAmount <= availableToDeduct) {
      const afterElo = safeBefore - lossAmount;
      return {
        afterElo,
        delta: afterElo - safeBefore,
        debtAfter: cleanDebt,
      };
    } else {
      // Hết điểm để trừ -> giữ ở mức Elo thấp nhất 1301 và tích lũy phần điểm thiếu vào nợ Elo
      const unpaidLoss = lossAmount - availableToDeduct;
      const afterElo = MIN_RATED_ELO;
      return {
        afterElo,
        delta: afterElo - safeBefore,
        debtAfter: cleanDebt + unpaidLoss,
      };
    }
  }

  // Trường hợp Hòa có điểm cộng dương (rawDelta >= 0)
  if (rawDelta > 0) {
    if (cleanDebt > 0) {
      const paid = Math.min(cleanDebt, rawDelta);
      const netGain = rawDelta - paid;
      const afterElo = Math.max(MIN_RATED_ELO, safeBefore + netGain);
      return {
        afterElo,
        delta: afterElo - safeBefore,
        debtAfter: cleanDebt - paid,
      };
    }
    const afterElo = Math.max(MIN_RATED_ELO, safeBefore + rawDelta);
    return {
      afterElo,
      delta: afterElo - safeBefore,
      debtAfter: 0,
    };
  }

  const afterElo = Math.max(MIN_RATED_ELO, safeBefore);
  return {
    afterElo,
    delta: afterElo - safeBefore,
    debtAfter: cleanDebt,
  };
}

/**
 * Calculates FIDE Elo changes for both players including:
 * - Minimum rated Elo floor of 1301 (`MIN_RATED_ELO`).
 * - Elo debt (`eloDebt`) accumulation when a loss exceeds deductible points above 1301.
 * - Hell Elo win resolution: `effectiveGain = Math.max(10, winGain - eloDebt)`.
 * - Anti-boosting penalty for repeated matchups within `antiBoostWindowGames`.
 */
export function calculateMatchElo(input: EloMatchInput): EloMatchResult {
  const cfg: EloConfig = { ...DEFAULT_ELO_CONFIG, ...(input.config || {}) };

  const safeRedBefore = input.redElo < DEFAULT_INITIAL_ELO ? MIN_RATED_ELO : input.redElo;
  const safeBlackBefore = input.blackElo < DEFAULT_INITIAL_ELO ? MIN_RATED_ELO : input.blackElo;

  const kRed = getKFactor(safeRedBefore, input.redGames, input.redProvisional);
  const kBlack = getKFactor(safeBlackBefore, input.blackGames, input.blackProvisional);

  const eRed = getExpectedScore(safeRedBefore, safeBlackBefore);
  const eBlack = getExpectedScore(safeBlackBefore, safeRedBefore);

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

  const redDebtBefore = Math.max(0, Math.round(Number(input.redEloDebt || 0)));
  const blackDebtBefore = Math.max(0, Math.round(Number(input.blackEloDebt || 0)));

  const redResolved = resolvePlayerPostMatchElo(
    safeRedBefore,
    redDebtBefore,
    rawRedDelta,
    input.outcome === 'red',
    input.outcome === 'black'
  );

  const blackResolved = resolvePlayerPostMatchElo(
    safeBlackBefore,
    blackDebtBefore,
    rawBlackDelta,
    input.outcome === 'black',
    input.outcome === 'red'
  );

  return {
    redBefore: safeRedBefore,
    redAfter: redResolved.afterElo,
    redDelta: redResolved.delta,
    redBoostPenalty,
    redDebtBefore,
    redDebtAfter: redResolved.debtAfter,
    blackBefore: safeBlackBefore,
    blackAfter: blackResolved.afterElo,
    blackDelta: blackResolved.delta,
    blackBoostPenalty,
    blackDebtBefore,
    blackDebtAfter: blackResolved.debtAfter,
    repeatCountN,
  };
}

/**
 * Evaluates inactivity decay/reset for a player's rating record at 00:05 daily cron:
 * - Only applies to players with at least 1 rated game (`gamesPlayed >= 1` and `lastRatedGameAt > 0`).
 * - `inactiveDays = Math.floor((nowMs - lastRatedGameAt) / 86400000)`
 * - If `inactiveDays > resetDays` (default 14): reset Elo to DEFAULT_INITIAL_ELO (1300), `provisional = true`,
 *   `hiddenFromLeaderboard = true`, `eloDebt = 0`.
 * - Else if `inactiveDays >= decayDays` (default 7) and `!decayApplied`:
 *   subtract `decayPenalty` (default 20) once, floor at MIN_RATED_ELO (1301), any excess added to `eloDebt`, set `decayApplied = true`.
 */
export function evaluateInactivityDecay(
  rating: {
    elo: number;
    eloDebt?: number;
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
  eloDebt: number;
  decayApplied: boolean;
  hiddenFromLeaderboard: boolean;
  provisional: boolean;
} {
  const cfg: EloConfig = { ...DEFAULT_ELO_CONFIG, ...config };
  const currentDebt = Math.max(0, Math.round(Number(rating.eloDebt || 0)));

  if (!rating.gamesPlayed || rating.gamesPlayed < 1 || !rating.lastRatedGameAt) {
    return {
      action: 'none',
      afterElo: rating.elo,
      delta: 0,
      eloDebt: currentDebt,
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
        eloDebt: 0,
        decayApplied: true,
        hiddenFromLeaderboard: true,
        provisional: true,
      };
    }
    return {
      action: 'reset',
      afterElo: DEFAULT_INITIAL_ELO,
      delta: DEFAULT_INITIAL_ELO - rating.elo,
      eloDebt: 0,
      decayApplied: true,
      hiddenFromLeaderboard: true,
      provisional: true,
    };
  }

  if (inactiveDays >= cfg.decayDays && !rating.decayApplied) {
    const safeElo = Math.max(MIN_RATED_ELO, rating.elo);
    const deductible = Math.max(0, safeElo - MIN_RATED_ELO);
    const afterElo = safeElo - Math.min(deductible, cfg.decayPenalty);
    const unpaid = Math.max(0, cfg.decayPenalty - deductible);
    return {
      action: 'decay',
      afterElo,
      delta: afterElo - rating.elo,
      eloDebt: currentDebt + unpaid,
      decayApplied: true,
      hiddenFromLeaderboard: Boolean(rating.hiddenFromLeaderboard),
      provisional: Boolean(rating.provisional),
    };
  }

  return {
    action: 'none',
    afterElo: rating.elo,
    delta: 0,
    eloDebt: currentDebt,
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



