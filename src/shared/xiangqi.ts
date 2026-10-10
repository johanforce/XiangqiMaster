/**
 * Independent Xiangqi (Chinese Chess) & Dark Xiangqi (Cờ Úp) Rule Engine
 * Shared between Client, Web Worker AI, and Express/Socket.IO Server.
 *
 * Board representation:
 * 10 rows (0..9 from top/Black to bottom/Red), 9 columns (0..8 from left to right).
 * Red pieces (uppercase in FEN): K (General), A (Advisor), E (Elephant), H (Horse), R (Chariot), C (Cannon), P (Soldier)
 * Black pieces (lowercase in FEN): k, a, e, h, r, c, p
 * Note: Standard FEN also uses B/b for Elephant and N/n for Horse; we normalize both seamlessly.
 */

export type PieceColor = 'r' | 'b';
export type PieceType = 'k' | 'a' | 'e' | 'h' | 'r' | 'c' | 'p';

export interface Pos {
  row: number; // 0 (top, Black base) to 9 (bottom, Red base)
  col: number; // 0 (left) to 8 (right)
}

export interface Piece {
  id: string;
  color: PieceColor;
  type: PieceType; // True identity of the piece (or masked '?' on client in Dark Xiangqi before flip)
  isHidden?: boolean; // For Cờ Úp (Dark Xiangqi): true if still face-down
  originType?: PieceType; // The piece type corresponding to its starting square (used when moving while hidden)
}

export type Board = (Piece | null)[][];

export interface Move {
  from: Pos;
  to: Pos;
  captured?: Piece | null;
  wasHidden?: boolean;
  revealedType?: PieceType;
}

export interface FormattedMove extends Move {
  ply: number;
  color: PieceColor;
  wxf: string;
  viet: string;
  iccs: string;
  fen: string;
  isCheck: boolean;
}

export const INITIAL_FEN = 'rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RHEAKAEHR w - - 0 1';

export const PIECE_NAMES_HANZI: Record<PieceColor, Record<PieceType, string>> = {
  r: { k: '帥', a: '仕', e: '相', h: '傌', r: '俥', c: '炮', p: '兵' },
  b: { k: '將', a: '士', e: '象', h: '馬', r: '車', c: '砲', p: '卒' },
};

export const PIECE_NAMES_VIET: Record<PieceColor, Record<PieceType, string>> = {
  r: { k: 'Tướng', a: 'Sĩ', e: 'Tượng', h: 'Mã', r: 'Xe', c: 'Pháo', p: 'Binh' },
  b: { k: 'Tướng', a: 'Sĩ', e: 'Tượng', h: 'Mã', r: 'Xe', c: 'Pháo', p: 'Tốt' },
};

export const PIECE_SHORT_VIET: Record<PieceColor, Record<PieceType, string>> = {
  r: { k: 'Tg', a: 'S', e: 'T', h: 'M', r: 'X', c: 'P', p: 'B' },
  b: { k: 'Tg', a: 'S', e: 'T', h: 'M', r: 'X', c: 'P', p: 'Tốt' },
};

/**
 * Standard starting square map -> piece type (used for Cờ Úp first-move rules)
 */
export function getStartingSlotType(row: number, col: number): PieceType | null {
  if ((row === 0 || row === 9) && col === 4) return 'k';
  if ((row === 0 || row === 9) && (col === 3 || col === 5)) return 'a';
  if ((row === 0 || row === 9) && (col === 2 || col === 6)) return 'e';
  if ((row === 0 || row === 9) && (col === 1 || col === 7)) return 'h';
  if ((row === 0 || row === 9) && (col === 0 || col === 8)) return 'r';
  if ((row === 2 || row === 7) && (col === 1 || col === 7)) return 'c';
  if ((row === 3 || row === 6) && col % 2 === 0) return 'p';
  return null;
}

export function normalizeFenChar(ch: string): { color: PieceColor; type: PieceType } | null {
  const lower = ch.toLowerCase();
  const color: PieceColor = ch === lower ? 'b' : 'r';
  const map: Record<string, PieceType> = {
    k: 'k',
    a: 'a',
    e: 'e',
    b: 'e',
    h: 'h',
    n: 'h',
    r: 'r',
    c: 'c',
    p: 'p',
  };
  const type = map[lower];
  return type ? { color, type } : null;
}

export function createEmptyBoard(): Board {
  return Array.from({ length: 10 }, () => Array<Piece | null>(9).fill(null));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function parseFen(fen: string = INITIAL_FEN): { board: Board; turn: PieceColor } {
  const parts = fen.trim().split(/\s+/);
  const rows = parts[0].split('/');
  const turn: PieceColor = parts[1] === 'b' ? 'b' : 'r';
  const board = createEmptyBoard();

  for (let r = 0; r < 10; r++) {
    const rowStr = rows[r] || '';
    let c = 0;
    for (let i = 0; i < rowStr.length && c < 9; i++) {
      const ch = rowStr[i];
      if (ch >= '1' && ch <= '9') {
        c += parseInt(ch, 10);
      } else {
        // Support Dark Xiangqi extended token e.g. *r or ?r if present
        let isHidden = false;
        let actualChar = ch;
        if (ch === '*' || ch === '?') {
          isHidden = true;
          actualChar = rowStr[++i] || 'p';
        }
        const parsed = normalizeFenChar(actualChar);
        if (parsed) {
          const slotType = getStartingSlotType(r, c) || parsed.type;
          board[r][c] = {
            id: `${parsed.color}_${parsed.type}_${r}_${c}`,
            color: parsed.color,
            type: parsed.type,
            isHidden,
            originType: slotType,
          };
        }
        c++;
      }
    }
  }

  return { board, turn };
}

export function boardToFen(board: Board, turn: PieceColor, maskHiddenForClient = false): string {
  const rowStrings: string[] = [];
  for (let r = 0; r < 10; r++) {
    let empty = 0;
    let str = '';
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (!p) {
        empty++;
      } else {
        if (empty > 0) {
          str += empty;
          empty = 0;
        }
        const effectiveType = maskHiddenForClient && p.isHidden ? (p.originType || 'p') : p.type;
        const ch = p.color === 'r' ? effectiveType.toUpperCase() : effectiveType;
        str += p.isHidden ? `*${ch}` : ch;
      }
    }
    if (empty > 0) str += empty;
    rowStrings.push(str);
  }
  return `${rowStrings.join('/')} ${turn === 'r' ? 'w' : 'b'} - - 0 1`;
}

/**
 * Create a randomized Dark Xiangqi (Cờ Úp) starting board.
 * 2 Generals are face-up at their standard positions; 15 remaining pieces per side are shuffled face-down.
 */
export function createDarkXiangqiBoard(rng: () => number = Math.random): { board: Board; turn: PieceColor } {
  const { board } = parseFen(INITIAL_FEN);

  const shuffleSide = (color: PieceColor) => {
    const pool: PieceType[] = ['a', 'a', 'e', 'e', 'h', 'h', 'r', 'r', 'c', 'c', 'p', 'p', 'p', 'p', 'p'];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let idx = 0;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.color === color && p.type !== 'k') {
          const originType = getStartingSlotType(r, c) || p.type;
          board[r][c] = {
            id: `${color}_${idx}_${r}_${c}`,
            color,
            type: pool[idx++],
            isHidden: true,
            originType,
          };
        }
      }
    }
  };

  shuffleSide('r');
  shuffleSide('b');
  return { board, turn: 'r' };
}

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < 10 && col >= 0 && col < 9;
}

export function inPalace(color: PieceColor, row: number, col: number): boolean {
  if (col < 3 || col > 5) return false;
  return color === 'r' ? row >= 7 && row <= 9 : row >= 0 && row <= 2;
}

export function hasCrossedRiver(color: PieceColor, row: number): boolean {
  return color === 'r' ? row <= 4 : row >= 5;
}

/**
 * Generates pseudo-legal moves for a single piece (without filtering self-check or flying general).
 * Supports both Standard Xiangqi and Dark Xiangqi (Cờ Úp).
 */
export function getPseudoLegalMovesForPiece(
  board: Board,
  pos: Pos,
  isDarkXiangqi = false
): Pos[] {
  const piece = board[pos.row][pos.col];
  if (!piece) return [];

  const moves: Pos[] = [];
  const { row, col } = pos;
  const { color } = piece;
  // In Dark Xiangqi, a face-down piece moves according to its starting square's role (originType)
  const activeType: PieceType = piece.isHidden ? (piece.originType || getStartingSlotType(row, col) || piece.type) : piece.type;

  const canStepTo = (r: number, c: number): boolean => {
    if (!inBounds(r, c)) return false;
    const target = board[r][c];
    return !target || target.color !== color;
  };

  switch (activeType) {
    case 'k': {
      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (inPalace(color, nr, nc) && canStepTo(nr, nc)) {
          moves.push({ row: nr, col: nc });
        }
      }
      break;
    }

    case 'a': {
      const dirs = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ];
      for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (!canStepTo(nr, nc)) continue;
        // In Standard Xiangqi, Advisors must stay in the palace.
        // In Dark Xiangqi (Cờ Úp Việt Nam), revealed Advisors (which may have been flipped outside the palace) can move 1 step diagonally anywhere on the board.
        if (!isDarkXiangqi && !inPalace(color, nr, nc)) continue;
        if (isDarkXiangqi && piece.isHidden && !inPalace(color, nr, nc)) continue;
        moves.push({ row: nr, col: nc });
      }
      break;
    }

    case 'e': {
      const dirs = [
        [-2, -2, -1, -1],
        [-2, 2, -1, 1],
        [2, -2, 1, -1],
        [2, 2, 1, 1],
      ];
      for (const [dr, dc, er, ec] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        const eyeR = row + er;
        const eyeC = col + ec;
        if (!canStepTo(nr, nc)) continue;
        // Elephant eye block check (cản mắt tượng)
        if (board[eyeR][eyeC] !== null) continue;
        // In Standard Xiangqi, Elephants cannot cross the river.
        if (!isDarkXiangqi && hasCrossedRiver(color, nr)) continue;
        moves.push({ row: nr, col: nc });
      }
      break;
    }

    case 'h': {
      const jumps = [
        [-2, -1, -1, 0],
        [-2, 1, -1, 0],
        [2, -1, 1, 0],
        [2, 1, 1, 0],
        [-1, -2, 0, -1],
        [1, -2, 0, -1],
        [-1, 2, 0, 1],
        [1, 2, 0, 1],
      ];
      for (const [dr, dc, lr, lc] of jumps) {
        const nr = row + dr;
        const nc = col + dc;
        const legR = row + lr;
        const legC = col + lc;
        if (!canStepTo(nr, nc)) continue;
        // Horse leg block check (cản chân mã)
        if (board[legR][legC] !== null) continue;
        moves.push({ row: nr, col: nc });
      }
      break;
    }

    case 'r': {
      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (const [dr, dc] of dirs) {
        let nr = row + dr;
        let nc = col + dc;
        while (inBounds(nr, nc)) {
          const target = board[nr][nc];
          if (!target) {
            moves.push({ row: nr, col: nc });
          } else {
            if (target.color !== color) {
              moves.push({ row: nr, col: nc });
            }
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
      break;
    }

    case 'c': {
      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (const [dr, dc] of dirs) {
        let nr = row + dr;
        let nc = col + dc;
        let jumpedScreen = false;
        while (inBounds(nr, nc)) {
          const target = board[nr][nc];
          if (!jumpedScreen) {
            if (!target) {
              moves.push({ row: nr, col: nc });
            } else {
              jumpedScreen = true; // Found the single screen (ngòi pháo)
            }
          } else {
            if (target) {
              if (target.color !== color) {
                moves.push({ row: nr, col: nc });
              }
              break;
            }
          }
          nr += dr;
          nc += dc;
        }
      }
      break;
    }

    case 'p': {
      const forward = color === 'r' ? -1 : 1;
      const fr = row + forward;
      if (canStepTo(fr, col)) {
        moves.push({ row: fr, col });
      }
      if (hasCrossedRiver(color, row)) {
        if (canStepTo(row, col - 1)) moves.push({ row, col: col - 1 });
        if (canStepTo(row, col + 1)) moves.push({ row, col: col + 1 });
      }
      break;
    }
  }

  return moves;
}

export function findGeneral(board: Board, color: PieceColor): Pos | null {
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p && p.color === color && !p.isHidden && p.type === 'k') {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

/**
 * Checks if the two Generals face each other directly on the same file with zero intervening pieces.
 */
export function areGeneralsFacing(board: Board): boolean {
  const redK = findGeneral(board, 'r');
  const blackK = findGeneral(board, 'b');
  if (!redK || !blackK || redK.col !== blackK.col) return false;

  const minR = Math.min(redK.row, blackK.row);
  const maxR = Math.max(redK.row, blackK.row);
  for (let r = minR + 1; r < maxR; r++) {
    if (board[r][redK.col] !== null) return false;
  }
  return true;
}

/**
 * Checks whether `color`'s General is currently under attack (in check) or facing the opposing General.
 */
export function isKingInCheck(board: Board, color: PieceColor, isDarkXiangqi = false): boolean {
  if (areGeneralsFacing(board)) return true;
  const kingPos = findGeneral(board, color);
  if (!kingPos) return true;

  const opponent: PieceColor = color === 'r' ? 'b' : 'r';
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p && p.color === opponent) {
        const pseudo = getPseudoLegalMovesForPiece(board, { row: r, col: c }, isDarkXiangqi);
        if (pseudo.some((m) => m.row === kingPos.row && m.col === kingPos.col)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Applies a move to a cloned board and returns the resulting board and move metadata.
 */
export function applyMove(board: Board, from: Pos, to: Pos): { nextBoard: Board; move: Move } {
  const nextBoard = cloneBoard(board);
  const moving = nextBoard[from.row][from.col];
  if (!moving) {
    throw new Error('No piece at source square');
  }
  const captured = nextBoard[to.row][to.col];
  const wasHidden = Boolean(moving.isHidden);
  if (moving.isHidden) {
    moving.isHidden = false;
  }
  nextBoard[to.row][to.col] = moving;
  nextBoard[from.row][from.col] = null;

  return {
    nextBoard,
    move: {
      from: { ...from },
      to: { ...to },
      captured: captured ? { ...captured } : null,
      wasHidden,
      revealedType: wasHidden ? moving.type : undefined,
    },
  };
}

/**
 * Returns all strictly legal moves for a given piece at `pos`.
 */
export function getLegalMovesForSquare(
  board: Board,
  pos: Pos,
  isDarkXiangqi = false
): Pos[] {
  const piece = board[pos.row][pos.col];
  if (!piece) return [];

  const pseudo = getPseudoLegalMovesForPiece(board, pos, isDarkXiangqi);
  const legal: Pos[] = [];

  for (const target of pseudo) {
    const { nextBoard } = applyMove(board, pos, target);
    if (!isKingInCheck(nextBoard, piece.color, isDarkXiangqi)) {
      legal.push(target);
    }
  }
  return legal;
}

/**
 * Returns all strictly legal moves for `color` on `board`.
 */
export function getAllLegalMoves(
  board: Board,
  color: PieceColor,
  isDarkXiangqi = false
): Move[] {
  const allMoves: Move[] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p && p.color === color) {
        const targets = getLegalMovesForSquare(board, { row: r, col: c }, isDarkXiangqi);
        for (const to of targets) {
          allMoves.push({
            from: { row: r, col: c },
            to,
            captured: board[to.row][to.col],
            wasHidden: Boolean(p.isHidden),
            revealedType: p.isHidden ? p.type : undefined,
          });
        }
      }
    }
  }
  return allMoves;
}

/**
 * Evaluates terminal game status according to Xiangqi rules & Asian Rules:
 * - No legal moves (Checkmate OR Stalemate) = LOSS for the side to move!
 * - Asian Rules repetition:
 *   If a position repeats 3 times:
 *   - If one side perpetually checked during the cycle -> that side LOSES.
 *   - If both sides checked or neither checked -> DRAW.
 */
export interface GameStatusResult {
  isOver: boolean;
  winner: 'red' | 'black' | 'draw' | 'ongoing';
  reason: string;
}

export function evaluateGameStatus(
  board: Board,
  turn: PieceColor,
  fenHistory: string[] = [],
  checkHistory: { color: PieceColor; gaveCheck: boolean }[] = [],
  isDarkXiangqi = false
): GameStatusResult {
  const legalMoves = getAllLegalMoves(board, turn, isDarkXiangqi);
  if (legalMoves.length === 0) {
    const inCheck = isKingInCheck(board, turn, isDarkXiangqi);
    const winner = turn === 'r' ? 'black' : 'red';
    return {
      isOver: true,
      winner,
      reason: inCheck ? 'Chiếu bí' : 'Hết nước đi (Stalemate xử thua)',
    };
  }

  // Asian Rules 3-fold repetition check
  if (fenHistory.length >= 8) {
    const currentSignature = boardToFen(board, turn).split(' ').slice(0, 2).join(' ');
    let occurrences = 0;
    for (const f of fenHistory) {
      const sig = f.split(' ').slice(0, 2).join(' ');
      if (sig === currentSignature) occurrences++;
    }
    if (occurrences >= 3) {
      const recent = checkHistory.slice(-8);
      const redChecks = recent.filter((x) => x.color === 'r' && x.gaveCheck).length;
      const blackChecks = recent.filter((x) => x.color === 'b' && x.gaveCheck).length;
      if (redChecks >= 3 && blackChecks === 0) {
        return { isOver: true, winner: 'black', reason: 'Vi phạm chiếu trường (Asian Rules)' };
      }
      if (blackChecks >= 3 && redChecks === 0) {
        return { isOver: true, winner: 'red', reason: 'Vi phạm chiếu trường (Asian Rules)' };
      }
      return { isOver: true, winner: 'draw', reason: 'Hòa do lặp thế 3 lần (Asian Rules)' };
    }
  }

  return { isOver: false, winner: 'ongoing', reason: '' };
}

/**
 * Formats a move into WXF, Vietnamese, and ICCS notations.
 * File numbering in Xiangqi:
 * - Red (bottom): files 1..9 from RIGHT to LEFT -> file = 9 - col
 * - Black (top): files 1..9 from LEFT to RIGHT -> file = col + 1
 */
export function formatMoveNotation(
  boardBefore: Board,
  from: Pos,
  to: Pos
): { wxf: string; viet: string; iccs: string } {
  const piece = boardBefore[from.row][from.col];
  if (!piece) {
    return { wxf: '', viet: '', iccs: '' };
  }

  const color = piece.color;
  const effectiveType: PieceType = piece.isHidden
    ? piece.originType || getStartingSlotType(from.row, from.col) || piece.type
    : piece.type;

  const wxfPieceMap: Record<PieceType, string> = {
    k: 'K',
    a: 'A',
    e: 'E',
    h: 'H',
    r: 'R',
    c: 'C',
    p: 'P',
  };

  const vietPieceName = PIECE_NAMES_VIET[color][effectiveType];
  const wxfChar = wxfPieceMap[effectiveType];

  const fileFrom = color === 'r' ? 9 - from.col : from.col + 1;
  const fileTo = color === 'r' ? 9 - to.col : to.col + 1;

  // Check if another identical piece of the same color exists on the same file (tandem piece)
  const sameFileRows: number[] = [];
  for (let r = 0; r < 10; r++) {
    const p = boardBefore[r][from.col];
    if (p && p.color === color) {
      const t = p.isHidden ? p.originType || getStartingSlotType(r, from.col) || p.type : p.type;
      if (t === effectiveType) {
        sameFileRows.push(r);
      }
    }
  }

  let prefixWxf = `${wxfChar}${fileFrom}`;
  let prefixViet = `${vietPieceName} ${fileFrom}`;
  if (sameFileRows.length === 2 && effectiveType !== 'k') {
    // For Red (moving up, smaller row is front): smaller row is '+' (Tiền), larger row is '-' (Hậu)
    // For Black (moving down, larger row is front): larger row is '+' (Tiền), smaller row is '-' (Hậu)
    const isFront =
      color === 'r'
        ? from.row === Math.min(...sameFileRows)
        : from.row === Math.max(...sameFileRows);
    prefixWxf = `${wxfChar}${isFront ? '+' : '-'}`;
    prefixViet = `${isFront ? 'Tiền' : 'Hậu'} ${vietPieceName.toLowerCase()}`;
  }

  let opWxf = '.';
  let opViet = 'bình';
  let destVal = fileTo;

  if (from.row !== to.row) {
    const isAdvance = color === 'r' ? to.row < from.row : to.row > from.row;
    opWxf = isAdvance ? '+' : '-';
    opViet = isAdvance ? 'tấn' : 'thoái';
    // Straight moving pieces (K, R, C, P) use distance; diagonal/knight pieces (A, E, H) use target file
    if (effectiveType === 'k' || effectiveType === 'r' || effectiveType === 'c' || effectiveType === 'p') {
      destVal = Math.abs(to.row - from.row);
    } else {
      destVal = fileTo;
    }
  }

  const wxf = `${prefixWxf}${opWxf}${destVal}`;
  const viet = `${prefixViet} ${opViet} ${destVal}`;

  // ICCS coordinates: Columns A..I (0..8), Rows 0..9 from bottom (Red=0..9) -> rank = 9 - row
  const files = 'ABCDEFGHI';
  const iccs = `${files[from.col]}${9 - from.row}-${files[to.col]}${9 - to.row}`;

  return { wxf, viet, iccs };
}

function normalizeVietString(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\btien\b/g, 'tan')
    .replace(/\blui\b/g, 'thoai')
    .replace(/\bchot\b/g, 'tot')
    .replace(/\bbinh\b(?=\s+\d)/g, 'tot')
    .replace(/\bvoi\b/g, 'tuong')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses ICCS, WXF, or Vietnamese move string against the current board and returns the matching legal Move.
 */
export function parseMoveText(
  board: Board,
  turn: PieceColor,
  token: string,
  isDarkXiangqi = false
): Move | null {
  const clean = token.trim().replace(/[#?!,\(\)]/g, '');
  if (!clean) return null;

  const legalMoves = getAllLegalMoves(board, turn, isDarkXiangqi);
  if (legalMoves.length === 0) return null;

  // 1. Try ICCS match (e.g. H2-E2 or h2e2 or H2E2)
  const iccsMatch = clean.toUpperCase().match(/^([A-I])(\d)-?([A-I])(\d)$/);
  if (iccsMatch) {
    const fromCol = iccsMatch[1].charCodeAt(0) - 65;
    const fromRow = 9 - parseInt(iccsMatch[2], 10);
    const toCol = iccsMatch[3].charCodeAt(0) - 65;
    const toRow = 9 - parseInt(iccsMatch[4], 10);
    const found = legalMoves.find(
      (m) =>
        m.from.row === fromRow &&
        m.from.col === fromCol &&
        m.to.row === toRow &&
        m.to.col === toCol
    );
    if (found) return found;
  }

  // Normalize input string: replace '=' with '.' and standardise spaces
  const normInput = clean
    .toLowerCase()
    .replace(/=/g, '.')
    .replace(/\s+/g, ' ');

  // Standardize WXF aliases (N->H, B->E, G->K, tandem prefixes like +C.5 -> C+.5)
  const normWxfInput = normInput
    .replace(/^n/i, 'h')
    .replace(/^b/i, 'e')
    .replace(/^g/i, 'k')
    .replace(/^\+([chepar])/i, '$1+')
    .replace(/^-([chepar])/i, '$1-');

  const normVietInput = normalizeVietString(normInput);

  for (const m of legalMoves) {
    const formatted = formatMoveNotation(board, m.from, m.to);

    const normWxf = formatted.wxf.toLowerCase().replace(/=/g, '.');
    const normIccs = formatted.iccs.toLowerCase();
    const normViet = formatted.viet.toLowerCase();
    const normVietClean = normalizeVietString(normViet);

    // Direct match against WXF, ICCS, or Vietnamese
    if (
      normWxf === normInput ||
      normWxf === normWxfInput ||
      normIccs === normInput ||
      normIccs.replace(/-/g, '') === normInput.replace(/-/g, '') ||
      normViet === normInput ||
      normVietClean === normVietInput
    ) {
      return m;
    }

    // Support WXF aliases in formatted output (e.g. N for H, B for E)
    const altWxf = normWxf.replace(/^h/, 'n').replace(/^e/, 'b').replace(/^k/, 'g');
    if (altWxf === normInput || altWxf === normWxfInput) {
      return m;
    }
  }

  return null;
}

/**
 * Parses a pasted game record (WXF, ICCS, or Vietnamese move list) and returns the full replay steps.
 */
export function replayFromNotationText(text: string): {
  initialFen: string;
  moves: FormattedMove[];
  headers: Record<string, string>;
} {
  const headers: Record<string, string> = {};
  let initialFen = INITIAL_FEN;

  const lines = text.split(/\r?\n/);
  const moveLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const headerMatch = line.match(/^\[(\w+)\s+"([^"]+)"\]$/);
    if (headerMatch) {
      headers[headerMatch[1]] = headerMatch[2];
      if (headerMatch[1].toUpperCase() === 'FEN') {
        initialFen = headerMatch[2];
      }
      continue;
    }
    if (line.startsWith('#') || line.startsWith('//')) continue;
    moveLines.push(line);
  }

  let body = moveLines.join(' ');
  // Remove PGN comments in braces { ... } or semicolons
  body = body.replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');

  // Remove standalone move numbers like "1.", "12.", "1.C2.5" -> " C2.5", "1/ ", "1) ", "(1)"
  const cleaned = body
    .replace(/(?:^|\s)\(?\d+[\.\:\)\/\-]+\s*/g, ' ')
    .replace(/(?:^|\s)\d+\.\.\.\s*/g, ' ')
    .replace(/(?:^|\s)(?:1-0|0-1|1\/2-1\/2|\*)(?=\s|$)/g, ' ');

  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  let { board, turn } = parseFen(initialFen);
  const moves: FormattedMove[] = [];
  let i = 0;

  while (i < tokens.length) {
    let matchedMove: Move | null = null;
    let consumedCount = 0;

    // Try multi-word window from 5 down to 1 (handles Vietnamese multi-word phrases as well as single-word WXF/ICCS)
    const maxWindow = Math.min(5, tokens.length - i);
    for (let len = maxWindow; len >= 1; len--) {
      const phrase = tokens.slice(i, i + len).join(' ');
      const m = parseMoveText(board, turn, phrase, false);
      if (m) {
        matchedMove = m;
        consumedCount = len;
        break;
      }
    }

    if (matchedMove) {
      const notation = formatMoveNotation(board, matchedMove.from, matchedMove.to);
      const { nextBoard } = applyMove(board, matchedMove.from, matchedMove.to);
      const nextTurn: PieceColor = turn === 'r' ? 'b' : 'r';
      const nextFen = boardToFen(nextBoard, nextTurn);
      const inCheck = isKingInCheck(nextBoard, nextTurn);

      moves.push({
        ...matchedMove,
        ply: moves.length + 1,
        color: turn,
        ...notation,
        fen: nextFen,
        isCheck: inCheck,
      });

      board = nextBoard;
      turn = nextTurn;
      i += consumedCount;
    } else {
      // Advance by 1 if token is unrecognized (e.g. "!?", "...", etc.)
      i++;
    }
  }

  return { initialFen, moves, headers };
}
