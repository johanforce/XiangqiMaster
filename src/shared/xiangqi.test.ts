import { describe, it, expect } from 'vitest';
import {
  INITIAL_FEN,
  parseFen,
  boardToFen,
  getLegalMovesForSquare,
  getAllLegalMoves,
  applyMove,
  isKingInCheck,
  areGeneralsFacing,
  evaluateGameStatus,
  formatMoveNotation,
  replayFromNotationText,
  createDarkXiangqiBoard,
} from './xiangqi';

describe('Xiangqi Rule Engine (Standard & Dark Xiangqi)', () => {
  it('parses initial FEN and generates 44 opening legal moves for Red', () => {
    const { board, turn } = parseFen(INITIAL_FEN);
    expect(turn).toBe('r');
    const moves = getAllLegalMoves(board, 'r');
    expect(moves.length).toBe(44);
  });

  it('enforces Flying General (Tướng đối mặt) rule', () => {
    // Only Red General at (9,4) and Black General at (0,4) separated by Red Chariot at (5,4)
    const { board } = parseFen('4k4/9/9/9/9/4R4/9/9/9/4K4 w - - 0 1');
    expect(areGeneralsFacing(board)).toBe(false);
    // Red Chariot at (5,4) cannot move horizontally to (5,3) because it exposes Flying Generals
    const chariotMoves = getLegalMovesForSquare(board, { row: 5, col: 4 });
    expect(chariotMoves.some((m) => m.col !== 4)).toBe(false);
    expect(chariotMoves.every((m) => m.col === 4)).toBe(true);
  });

  it('enforces Horse leg blocking (Cản chân mã)', () => {
    // Black General at (0,3) so generals do not face on file 4; Red Horse at (9,1) blocked at (8,1)
    const { board } = parseFen('3k5/9/9/9/9/9/9/9/1P7/1H2K4 w - - 0 1');
    const horseMoves = getLegalMovesForSquare(board, { row: 9, col: 1 });
    // Upward jumps to (7,0) and (7,2) are blocked by (8,1); only (8,3) is free
    expect(horseMoves).toEqual([{ row: 8, col: 3 }]);
  });

  it('enforces Elephant eye blocking (Cản mắt tượng) and river restriction', () => {
    // Red Elephant at (9,2) with piece at (8,3) blocking (7,4)
    const { board } = parseFen('3k5/9/9/9/9/9/9/9/3P5/2E1K4 w - - 0 1');
    const elephantMoves = getLegalMovesForSquare(board, { row: 9, col: 2 });
    expect(elephantMoves).toEqual([{ row: 7, col: 0 }]);

    // Red Elephant at (5,2) cannot cross the river to row 3 in standard Xiangqi
    const { board: riverBoard } = parseFen('3k5/9/9/9/9/2E6/9/9/9/4K4 w - - 0 1');
    const riverMoves = getLegalMovesForSquare(riverBoard, { row: 5, col: 2 }, false);
    expect(riverMoves.some((m) => m.row < 5)).toBe(false);
  });

  it('enforces Cannon screen capture rule (Pháo ăn qua đúng 1 ngòi)', () => {
    // Red Cannon at (7,1), Black piece at (4,1) as screen, Black piece at (1,1) as target
    const { board } = parseFen('3k5/1r7/9/9/1p7/9/9/1C7/9/4K4 w - - 0 1');
    const cannonMoves = getLegalMovesForSquare(board, { row: 7, col: 1 });
    // Can capture (1,1), cannot capture (4,1)
    expect(cannonMoves.some((m) => m.row === 1 && m.col === 1)).toBe(true);
    expect(cannonMoves.some((m) => m.row === 4 && m.col === 1)).toBe(false);
  });

  it('enforces Soldier river crossing rule (Tốt qua sông mới đi ngang)', () => {
    // Red Soldier at (6,0) before river vs (4,0) after river
    const { board } = parseFen('3k5/9/9/9/P8/9/P8/9/9/4K4 w - - 0 1');
    const beforeRiver = getLegalMovesForSquare(board, { row: 6, col: 0 });
    expect(beforeRiver).toEqual([{ row: 5, col: 0 }]);

    const afterRiver = getLegalMovesForSquare(board, { row: 4, col: 0 });
    expect(afterRiver.length).toBe(2); // (3,0) forward and (4,1) sideways
  });

  it('treats Stalemate (Hết nước đi hợp lệ) as LOSS for the side to move', () => {
    // Black General at (0,3) is not in check, but moving to (1,3) is controlled by Red Pawn at (1,2)
    // and moving to (0,4) faces Red General at (9,4)
    const { board } = parseFen('3k5/2P6/9/9/9/9/9/9/9/4K4 b - - 0 1');
    expect(isKingInCheck(board, 'b')).toBe(false);
    const status = evaluateGameStatus(board, 'b');
    expect(status.isOver).toBe(true);
    expect(status.winner).toBe('red');
  });

  it('formats WXF, Vietnamese, and ICCS notation and replays notation text', () => {
    const { board } = parseFen(INITIAL_FEN);
    // Red Cannon at (7,7) (file 2) to (7,4) (file 5) => C2.5 / Pháo 2 bình 5 / H2-E2
    const notation = formatMoveNotation(board, { row: 7, col: 7 }, { row: 7, col: 4 });
    expect(notation.wxf).toBe('C2.5');
    expect(notation.viet).toBe('Pháo 2 bình 5');
    expect(notation.iccs).toBe('H2-E2');

    const replay = replayFromNotationText('1. C2.5 H8+7 2. H2+3 R9.8');
    expect(replay.moves.length).toBe(4);
    expect(replay.moves[0].wxf).toBe('C2.5');
    expect(replay.moves[1].wxf).toBe('H8+7');
  });

  it('implements Dark Xiangqi (Cờ Úp) shuffling, origin-slot movement, and flip on first move', () => {
    const { board } = createDarkXiangqiBoard(() => 0.42);
    // Generals at (9,4) and (0,4) are face-up
    expect(board[9][4]?.isHidden).toBeFalsy();
    expect(board[0][4]?.isHidden).toBeFalsy();
    // Cannon slot at (7,7) is hidden and moves like a Cannon on its first move
    const hiddenPiece = board[7][7]!;
    expect(hiddenPiece.isHidden).toBe(true);
    expect(hiddenPiece.originType).toBe('c');

    const firstMoves = getLegalMovesForSquare(board, { row: 7, col: 7 }, true);
    expect(firstMoves.some((m) => m.row === 7 && m.col === 4)).toBe(true);

    // After moving from (7,7) to (7,4), the piece flips face-up
    const { nextBoard, move } = applyMove(board, { row: 7, col: 7 }, { row: 7, col: 4 });
    expect(move.wasHidden).toBe(true);
    expect(nextBoard[7][4]?.isHidden).toBe(false);

    // boardToFen with maskHiddenForClient masks unflipped pieces
    const maskedFen = boardToFen(nextBoard, 'b', true);
    expect(maskedFen).toContain('*');
  });
});
