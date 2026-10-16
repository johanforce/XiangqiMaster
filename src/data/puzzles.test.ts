import { describe, it, expect } from 'vitest';
import { CLASSIC_PUZZLES } from './puzzles';
import {
  parseFen,
  findGeneral,
  areGeneralsFacing,
  inPalace,
  evaluateGameStatus,
} from '../shared/xiangqi';

describe('Xiangqi Puzzles Integrity & Validation', () => {
  it('should have valid FEN strings and legal positions for all curated puzzles', () => {
    expect(CLASSIC_PUZZLES.length).toBeGreaterThanOrEqual(10);

    for (const p of CLASSIC_PUZZLES) {
      const { board, turn } = parseFen(p.fen);
      expect(board).toBeDefined();
      expect(board.length).toBe(10);
      expect(board[0].length).toBe(9);

      // Verify Red King exists and is inside Red palace
      const redKing = findGeneral(board, 'r');
      expect(redKing).not.toBeNull();
      if (redKing) {
        expect(inPalace('r', redKing.row, redKing.col)).toBe(true);
      }

      // Verify Black King exists and is inside Black palace
      const blackKing = findGeneral(board, 'b');
      expect(blackKing).not.toBeNull();
      if (blackKing) {
        expect(inPalace('b', blackKing.row, blackKing.col)).toBe(true);
      }

      // Verify generals are not facing each other directly
      expect(areGeneralsFacing(board)).toBe(false);

      // Verify evaluateGameStatus runs without error
      const status = evaluateGameStatus(board, turn, [p.fen], []);
      expect(status).toBeDefined();
      expect(status.isOver).toBe(false);
    }
  });

  it('should categorize puzzles properly into tactics, classic, and endgame', () => {
    const categories = new Set(CLASSIC_PUZZLES.map((p) => p.category));
    expect(categories.has('tactics')).toBe(true);
    expect(categories.has('classic')).toBe(true);
    expect(categories.has('endgame')).toBe(true);
  });
});
