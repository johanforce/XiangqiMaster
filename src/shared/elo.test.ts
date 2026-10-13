import { describe, it, expect } from 'vitest';
import {
  getKFactor,
  calculateMatchElo,
  evaluateInactivityDecay,
  getEloRankTitle,
  MIN_RATED_ELO,
  MIN_HELL_ELO_WIN_GAIN,
} from './elo';

describe('FIDE Elo, Hell Elo Debt, Anti-Boosting & Inactivity Decay Engine', () => {
  it('selects correct K-factor (40 for provisional/<30 games, 20 standard, 10 for >=2400)', () => {
    expect(getKFactor(1300, 0)).toBe(40);
    expect(getKFactor(1500, 29)).toBe(40);
    expect(getKFactor(1500, 30)).toBe(20);
    expect(getKFactor(2400, 50)).toBe(10);
    expect(getKFactor(2450, 50, true)).toBe(40); // Provisional overrides
  });

  it('calculates standard FIDE Elo changes for equal 1350 players', () => {
    const res = calculateMatchElo({
      redElo: 1350,
      redGames: 10,
      blackElo: 1350,
      blackGames: 10,
      outcome: 'red',
      redUid: 'u1',
      blackUid: 'u2',
    });
    expect(res.redDelta).toBe(20); // K=40 * (1 - 0.5) = +20
    expect(res.blackDelta).toBe(-20);
    expect(res.redBoostPenalty).toBe(0);
    expect(res.blackDebtAfter).toBe(0);
  });

  it('clamps Elo loss at minimum 1301, tracks Elo debt, and deducts debt on subsequent win with +10 minimum in Hell Elo', () => {
    // 1. Player at 1315 loses 20 points -> drops to 1301 (deducts 14), owes 6 Elo debt
    const loss1 = calculateMatchElo({
      redElo: 1315,
      redGames: 10,
      redEloDebt: 0,
      blackElo: 1315,
      blackGames: 10,
      blackEloDebt: 0,
      outcome: 'black',
      redUid: 'u1',
      blackUid: 'u2',
    });
    expect(loss1.redAfter).toBe(MIN_RATED_ELO); // 1301
    expect(loss1.redDebtAfter).toBe(6);

    // 2. Next match: Player at 1301 with 6 debt wins +20 -> 20 - 6 = +14 added (1315), debt cleared
    const winAfterSmallDebt = calculateMatchElo({
      redElo: loss1.redAfter,
      redGames: 11,
      redEloDebt: loss1.redDebtAfter,
      blackElo: 1301,
      blackGames: 11,
      outcome: 'red',
      redUid: 'u1',
      blackUid: 'u2',
    });
    expect(winAfterSmallDebt.redDelta).toBe(14);
    expect(winAfterSmallDebt.redAfter).toBe(1315);
    expect(winAfterSmallDebt.redDebtAfter).toBe(0);

    // 3. Deep Hell Elo: Player at 1301 with 120 Elo debt (lost 6 games in a row) wins a match
    // Even with huge debt, minimum gain on a win in Hell Elo is +10
    const winInDeepHellElo = calculateMatchElo({
      redElo: 1301,
      redGames: 20,
      redEloDebt: 120,
      blackElo: 1301,
      blackGames: 20,
      outcome: 'red',
      redUid: 'u1',
      blackUid: 'u2',
    });
    expect(winInDeepHellElo.redDelta).toBe(MIN_HELL_ELO_WIN_GAIN); // +10
    expect(winInDeepHellElo.redAfter).toBe(1311);
    expect(winInDeepHellElo.redDebtAfter).toBe(100); // 120 - 20 = 100
  });

  it('applies anti-boosting penalty on 3rd (n=2) and 4th+ (n>=3) matches in last 5 games', () => {
    const thirdMatch = calculateMatchElo({
      redElo: 1400,
      redGames: 10,
      blackElo: 1400,
      blackGames: 10,
      outcome: 'red',
      redUid: 'u1',
      blackUid: 'u2',
      redRecentOpponents: ['u2', 'u3', 'u2', 'u4', 'u5'],
      blackRecentOpponents: ['u1', 'u1'],
    });
    expect(thirdMatch.repeatCountN).toBe(2);
    expect(thirdMatch.redBoostPenalty).toBe(1);
    expect(thirdMatch.redDelta).toBe(19);
    expect(thirdMatch.blackDelta).toBe(-20);

    const fourthMatch = calculateMatchElo({
      redElo: 1400,
      redGames: 10,
      blackElo: 1400,
      blackGames: 10,
      outcome: 'red',
      redUid: 'u1',
      blackUid: 'u2',
      redRecentOpponents: ['u2', 'u2', 'u2', 'u4', 'u5'],
    });
    expect(fourthMatch.repeatCountN).toBe(3);
    expect(fourthMatch.redBoostPenalty).toBe(2);
    expect(fourthMatch.redDelta).toBe(18);
  });

  it('guarantees winner always receives at least +1 even with anti-boosting penalty and enforces floor 1301', () => {
    const hugeGap = calculateMatchElo({
      redElo: 2500,
      redGames: 50,
      blackElo: 1301,
      blackGames: 50,
      outcome: 'red',
      redUid: 'u1',
      blackUid: 'u2',
      redRecentOpponents: ['u2', 'u2', 'u2', 'u2'],
    });
    expect(hugeGap.redDelta).toBeGreaterThanOrEqual(1);
    expect(hugeGap.blackAfter).toBe(1301);
  });

  it('evaluates 7-day decay (-20 once, floor 1301) and >14-day reset (to 1300 provisional & hidden)', () => {
    const dayMs = 86400000;
    const now = 1700000000000;

    // 7 days inactive: -20 once
    const decayRes = evaluateInactivityDecay(
      { elo: 1350, gamesPlayed: 12, lastRatedGameAt: now - 7 * dayMs, decayApplied: false },
      now
    );
    expect(decayRes.action).toBe('decay');
    expect(decayRes.afterElo).toBe(1330);
    expect(decayRes.decayApplied).toBe(true);

    // 7 days inactive near floor 1310: floors at 1301 and adds 11 to eloDebt
    const floorDecay = evaluateInactivityDecay(
      { elo: 1310, eloDebt: 0, gamesPlayed: 12, lastRatedGameAt: now - 7 * dayMs, decayApplied: false },
      now
    );
    expect(floorDecay.afterElo).toBe(1301);
    expect(floorDecay.eloDebt).toBe(11);

    // Already decayed at 8 days: no repeat deduction
    const noRepeat = evaluateInactivityDecay(
      { elo: 1330, gamesPlayed: 12, lastRatedGameAt: now - 8 * dayMs, decayApplied: true },
      now
    );
    expect(noRepeat.action).toBe('none');

    // 15 days inactive (>14 days): reset to 1300, provisional, hidden from leaderboard
    const resetRes = evaluateInactivityDecay(
      { elo: 1650, gamesPlayed: 45, lastRatedGameAt: now - 15 * dayMs, decayApplied: true },
      now
    );
    expect(resetRes.action).toBe('reset');
    expect(resetRes.afterElo).toBe(1300);
    expect(resetRes.eloDebt).toBe(0);
    expect(resetRes.provisional).toBe(true);
    expect(resetRes.hiddenFromLeaderboard).toBe(true);
  });

  it('maps Elo to Vietnamese rank titles accurately', () => {
    expect(getEloRankTitle(1300)).toBe('Unrank');
    expect(getEloRankTitle(1320)).toBe('Gián đất');
    expect(getEloRankTitle(1380)).toBe('Vịt chặt chân');
    expect(getEloRankTitle(1450)).toBe('Ngan');
    expect(getEloRankTitle(1550)).toBe('Ngỗng');
    expect(getEloRankTitle(1650)).toBe('Kỳ thủ');
    expect(getEloRankTitle(1750)).toBe('Cao thủ');
    expect(getEloRankTitle(1850)).toBe('Kỳ thủ');
    expect(getEloRankTitle(1950)).toBe('Đại sư');
    expect(getEloRankTitle(2250)).toBe('Kì tiên');
    expect(getEloRankTitle(1600, true)).toBe('Unrank');
  });
});


