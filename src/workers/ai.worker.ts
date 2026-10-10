import {
  Board,
  PieceColor,
  PieceType,
  Move,
  parseFen,
  getAllLegalMoves,
  applyMove,
  isKingInCheck,
} from '../shared/xiangqi';

export type AIDifficulty = 'novice' | 'veteran' | 'master' | 'grandmaster';

interface WorkerRequest {
  id: number;
  fen: string;
  difficulty: AIDifficulty;
  isDarkXiangqi?: boolean;
}

const PIECE_VALUES: Record<PieceType, number> = {
  k: 10000,
  r: 900,
  c: 450,
  h: 400,
  e: 200,
  a: 200,
  p: 100,
};

/**
 * Positional bonus for pieces (Red perspective, row 0 is top enemy base, row 9 is bottom own base)
 */
function getPositionalBonus(type: PieceType, color: PieceColor, row: number, col: number): number {
  const r = color === 'r' ? row : 9 - row;
  switch (type) {
    case 'p': {
      // Soldiers become much stronger after crossing the river (r <= 4) and near the center
      if (r <= 4) {
        const centerBonus = 4 - Math.abs(4 - col);
        const advanceBonus = (5 - r) * 18;
        return 80 + advanceBonus + centerBonus * 10;
      }
      return r === 5 ? 15 : 0;
    }
    case 'h': {
      // Horses prefer central files and forward ranks
      const center = 4 - Math.abs(4 - col);
      const forward = 9 - r;
      return center * 8 + forward * 5;
    }
    case 'c': {
      // Cannons like central file (Pháo đầu) and clear lines
      return col === 4 ? 30 : 10;
    }
    case 'r': {
      // Chariots prefer active ranks and open files
      const activeRank = r <= 4 ? 25 : 10;
      return activeRank + (col !== 0 && col !== 8 ? 10 : 0);
    }
    case 'a':
    case 'e':
      return col === 4 ? 15 : 5;
    case 'k':
      return r === 9 && col === 4 ? 20 : 0;
  }
}

function evaluateBoard(board: Board, perspective: PieceColor): number {
  let score = 0;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (!p) continue;
      const base = PIECE_VALUES[p.type] || 100;
      const posBonus = getPositionalBonus(p.type, p.color, r, c);
      const val = base + posBonus;
      if (p.color === perspective) {
        score += val;
      } else {
        score -= val;
      }
    }
  }
  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return moves.sort((a, b) => {
    const scoreA = a.captured ? (PIECE_VALUES[a.captured.type] || 100) * 10 : 0;
    const scoreB = b.captured ? (PIECE_VALUES[b.captured.type] || 100) * 10 : 0;
    return scoreB - scoreA;
  });
}

function quiescence(
  board: Board,
  turn: PieceColor,
  alpha: number,
  beta: number,
  maximizingColor: PieceColor,
  qDepth: number,
  isDarkXiangqi: boolean
): number {
  const standPat = evaluateBoard(board, maximizingColor);
  const isMax = turn === maximizingColor;

  if (qDepth <= 0) return standPat;

  if (isMax) {
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
  } else {
    if (standPat <= alpha) return alpha;
    if (standPat < beta) beta = standPat;
  }

  const captureMoves = orderMoves(
    getAllLegalMoves(board, turn, isDarkXiangqi).filter((m) => Boolean(m.captured))
  );

  if (captureMoves.length === 0) return standPat;

  const nextTurn: PieceColor = turn === 'r' ? 'b' : 'r';

  if (isMax) {
    let best = standPat;
    for (const m of captureMoves) {
      const { nextBoard } = applyMove(board, m.from, m.to);
      const val = quiescence(nextBoard, nextTurn, alpha, beta, maximizingColor, qDepth - 1, isDarkXiangqi);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = standPat;
    for (const m of captureMoves) {
      const { nextBoard } = applyMove(board, m.from, m.to);
      const val = quiescence(nextBoard, nextTurn, alpha, beta, maximizingColor, qDepth - 1, isDarkXiangqi);
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (alpha >= beta) break;
    }
    return best;
  }
}

function alphaBeta(
  board: Board,
  turn: PieceColor,
  depth: number,
  alpha: number,
  beta: number,
  maximizingColor: PieceColor,
  useQuiescence: boolean,
  isDarkXiangqi: boolean
): number {
  if (depth === 0) {
    if (useQuiescence) {
      return quiescence(board, turn, alpha, beta, maximizingColor, 2, isDarkXiangqi);
    }
    return evaluateBoard(board, maximizingColor);
  }

  const legalMoves = orderMoves(getAllLegalMoves(board, turn, isDarkXiangqi));
  if (legalMoves.length === 0) {
    // In Xiangqi, having no legal moves (checkmate or stalemate) is a loss
    return turn === maximizingColor ? -99999 - depth * 100 : 99999 + depth * 100;
  }

  const nextTurn: PieceColor = turn === 'r' ? 'b' : 'r';
  const isMax = turn === maximizingColor;

  if (isMax) {
    let maxEval = -Infinity;
    for (const m of legalMoves) {
      const { nextBoard } = applyMove(board, m.from, m.to);
      const ev = alphaBeta(
        nextBoard,
        nextTurn,
        depth - 1,
        alpha,
        beta,
        maximizingColor,
        useQuiescence,
        isDarkXiangqi
      );
      if (ev > maxEval) maxEval = ev;
      if (ev > alpha) alpha = ev;
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of legalMoves) {
      const { nextBoard } = applyMove(board, m.from, m.to);
      const ev = alphaBeta(
        nextBoard,
        nextTurn,
        depth - 1,
        alpha,
        beta,
        maximizingColor,
        useQuiescence,
        isDarkXiangqi
      );
      if (ev < minEval) minEval = ev;
      if (ev < beta) beta = ev;
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

export function findBestMove(
  fen: string,
  difficulty: AIDifficulty,
  isDarkXiangqi = false
): Move | null {
  const { board, turn } = parseFen(fen);
  const legalMoves = orderMoves(getAllLegalMoves(board, turn, isDarkXiangqi));
  if (legalMoves.length === 0) return null;

  const configMap: Record<
    AIDifficulty,
    { depth: number; noise: number; useQuiescence: boolean }
  > = {
    novice: { depth: 1, noise: 160, useQuiescence: false }, // ~800 Elo
    veteran: { depth: 2, noise: 65, useQuiescence: false }, // ~1300 Elo
    master: { depth: 3, noise: 15, useQuiescence: true }, // ~1800 Elo
    grandmaster: { depth: 4, noise: 0, useQuiescence: true }, // ~2300 Elo
  };

  const cfg = configMap[difficulty] || configMap.veteran;
  const nextTurn: PieceColor = turn === 'r' ? 'b' : 'r';

  let bestMove = legalMoves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const m of legalMoves) {
    const { nextBoard } = applyMove(board, m.from, m.to);
    let score = alphaBeta(
      nextBoard,
      nextTurn,
      cfg.depth - 1,
      alpha,
      beta,
      turn,
      cfg.useQuiescence,
      isDarkXiangqi
    );
    // Slight bonus if move gives check
    if (isKingInCheck(nextBoard, nextTurn, isDarkXiangqi)) {
      score += 18;
    }
    if (cfg.noise > 0) {
      score += (Math.random() - 0.5) * cfg.noise;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
    if (score > alpha) {
      alpha = score;
    }
  }

  return bestMove;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, fen, difficulty, isDarkXiangqi } = e.data;
  const bestMove = findBestMove(fen, difficulty, Boolean(isDarkXiangqi));
  self.postMessage({ id, move: bestMove });
};
