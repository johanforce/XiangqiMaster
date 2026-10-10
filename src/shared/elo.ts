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

/**
 * Returns Vietnamese rank title based on Elo:
 * Tập sự → Nghiệp dư → Khá → Giỏi → Cao thủ → Kỳ thủ → Kiện tướng
 */
export function getEloRankTitle(elo: number, hiddenFromLeaderboard = false): string {
  if (hiddenFromLeaderboard) return 'Chưa xếp hạng';
  if (elo >= 2300) return 'Kiện tướng';
  if (elo >= 2000) return 'Kỳ thủ';
  if (elo >= 1700) return 'Cao thủ';
  if (elo >= 1500) return 'Giỏi';
  if (elo >= 1300) return 'Khá';
  if (elo >= 1100) return 'Nghiệp dư';
  return 'Tập sự';
}
