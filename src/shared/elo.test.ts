import { describe, it, expect } from 'vitest';
import {
  getKFactor,
  calculateMatchElo,
  evaluateInactivityDecay,
  getEloRankTitle,
} from './elo';

describe('FIDE Elo, Anti-Boosting & Inactivity Decay Engine', () => {
  it('selects correct K-factor (40 for provisional/<30 games, 20 standard, 10 for >=2400)', () => {
    expect(getKFactor(1200, 0)).toBe(40);
    expect(getKFactor(1500, 29)).toBe(40);
    expect(getKFactor(1500, 30)).toBe(20);
    expect(getKFactor(2400, 50)).toBe(10);
    expect(getKFactor(2450, 50, true)).toBe(40); // Provisional overrides
  });

  it('calculates standard FIDE Elo changes for equal 1200 players', () => {
    const res = calculateMatchElo({
      redElo: 1200,
      redGames: 10,
      blackElo: 1200,
      blackGames: 10,
      outcome: 'red',
      redUid: 'u1',
      blackUid: 'u2',
    });
    expect(res.redDelta).toBe(20); // K=40 * (1 - 0.5) = +20
    expect(res.blackDelta).toBe(-20);
    expect(res.redBoostPenalty).toBe(0);
  });

  it('applies anti-boosting penalty on 3rd (n=2) and 4th+ (n>=3) matches in last 5 games', () => {
    // n = 2 (met twice in last 5 games -> 3rd match): winner loses 1 point from gain
    const thirdMatch = calculateMatchElo({
      redElo: 1200,
      redGames: 10,
      blackElo: 1200,
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
    expect(thirdMatch.blackDelta).toBe(-20); // Loser still loses full amount

    // n = 3 (met 3 times in last 5 games -> 4th match): winner loses 2 points from gain
    const fourthMatch = calculateMatchElo({
      redElo: 1200,
      redGames: 10,
      blackElo: 1200,
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

  it('guarantees winner always receives at least +1 even with anti-boosting penalty and enforces floor 100', () => {
    const hugeGap = calculateMatchElo({
      redElo: 2500,
      redGames: 50,
      blackElo: 110,
      blackGames: 50,
      outcome: 'red',
      redUid: 'u1',
      blackUid: 'u2',
      redRecentOpponents: ['u2', 'u2', 'u2', 'u2'],
    });
    expect(hugeGap.redDelta).toBeGreaterThanOrEqual(1);
    expect(hugeGap.blackAfter).toBeGreaterThanOrEqual(100);
  });

  it('evaluates 7-day decay (-20 once, floor 800) and >14-day reset (to 1300 provisional & hidden)', () => {
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
    expect(resetRes.provisional).toBe(true);
    expect(resetRes.hiddenFromLeaderboard).toBe(true);
  });

  it('maps Elo to Vietnamese rank titles accurately', () => {
    expect(getEloRankTitle(1050)).toBe('Tập sự');
    expect(getEloRankTitle(1200)).toBe('Nghiệp dư');
    expect(getEloRankTitle(1350)).toBe('Khá');
    expect(getEloRankTitle(1550)).toBe('Giỏi');
    expect(getEloRankTitle(1800)).toBe('Cao thủ');
    expect(getEloRankTitle(2100)).toBe('Kỳ thủ');
    expect(getEloRankTitle(2350)).toBe('Kiện tướng');
    expect(getEloRankTitle(1600, true)).toBe('Chưa xếp hạng');
  });
});
