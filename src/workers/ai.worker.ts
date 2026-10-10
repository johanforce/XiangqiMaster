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

export type AIEngineType = 'fairy_stockfish' | 'pikafish' | 'builtin';
export type AIDifficulty = 'novice' | 'veteran' | 'master' | 'grandmaster';

interface WorkerRequest {
  id: number;
  fen: string;
  difficulty: AIDifficulty;
  engine?: AIEngineType;
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

function getPositionalBonus(type: PieceType, color: PieceColor, row: number, col: number): number {
  const r = color === 'r' ? row : 9 - row;
  switch (type) {
    case 'p': {
      if (r <= 4) {
        const centerBonus = 4 - Math.abs(4 - col);
        const advanceBonus = (5 - r) * 18;
        return 80 + advanceBonus + centerBonus * 10;
      }
      return r === 5 ? 15 : 0;
    }
    case 'h': {
      const center = 4 - Math.abs(4 - col);
      const forward = 9 - r;
      return center * 8 + forward * 5;
    }
    case 'c': {
      return col === 4 ? 30 : 10;
    }
    case 'r': {
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
    novice: { depth: 1, noise: 160, useQuiescence: false },
    veteran: { depth: 2, noise: 65, useQuiescence: false },
    master: { depth: 3, noise: 15, useQuiescence: true },
    grandmaster: { depth: 4, noise: 0, useQuiescence: true },
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

// Convert UCI coordinate string ('b0c2', 'b2e2') to Xiangqi Move
function parseUciMove(uci: string, board: Board): { from: { row: number; col: number }; to: { row: number; col: number } } | null {
  if (!uci || uci.length < 4) return null;
  const fCol = uci.charCodeAt(0) - 97;
  const fRank = parseInt(uci.slice(1, -2), 10);
  const tCol = uci.charCodeAt(uci.length - 2) - 97;
  const tRank = parseInt(uci.slice(-1), 10);
  if (isNaN(fRank) || isNaN(tRank)) return null;

  const from = { row: 9 - fRank, col: fCol };
  const to = { row: 9 - tRank, col: tCol };

  return { from, to };
}

// Global Fairy-Stockfish instance state in Worker
let fairyInstance: any = null;
let fairyReady = false;
let fairyInitPromise: Promise<boolean> | null = null;
let currentUciResolve: ((val: string | null) => void) | null = null;

async function initFairyEngine(): Promise<boolean> {
  if (fairyReady && fairyInstance) return true;
  if (fairyInitPromise) return fairyInitPromise;

  fairyInitPromise = (async () => {
    try {
      const wasmRes = await fetch('/engine/fairy/stockfish.wasm');
      if (!wasmRes.ok) return false;
      const wasmBinary = await wasmRes.arrayBuffer();

      (self as any).importScripts('/engine/fairy/stockfish.js');
      const StockfishFactory = (self as any).Stockfish;
      if (typeof StockfishFactory !== 'function') return false;

      fairyInstance = await StockfishFactory({ wasmBinary });
      fairyInstance.addMessageListener((line: string) => {
        if (line.includes('Fairy-Stockfish') && !fairyReady) {
          fairyInstance.postMessage('uci');
          fairyInstance.postMessage('setoption name UCI_Variant value xiangqi');
          fairyInstance.postMessage('isready');
        }
        if (line === 'readyok') {
          fairyReady = true;
        }
        if (line.startsWith('bestmove')) {
          const parts = line.split(' ');
          const moveUci = parts[1];
          if (currentUciResolve) {
            const cb = currentUciResolve;
            currentUciResolve = null;
            cb(moveUci);
          }
        }
      });

      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 4000);
        const check = setInterval(() => {
          if (fairyReady) {
            clearTimeout(timeout);
            clearInterval(check);
            resolve(true);
          }
        }, 80);
      });
    } catch {
      return false;
    }
  })();

  return fairyInitPromise;
}

async function requestFairyMove(
  fen: string,
  difficulty: AIDifficulty
): Promise<{ from: { row: number; col: number }; to: { row: number; col: number } } | null> {
  const ready = await initFairyEngine();
  if (!ready || !fairyInstance) return null;

  const { board } = parseFen(fen);
  const depthMap: Record<AIDifficulty, { depth: number; time: number }> = {
    novice: { depth: 2, time: 250 },
    veteran: { depth: 4, time: 500 },
    master: { depth: 6, time: 900 },
    grandmaster: { depth: 8, time: 1400 },
  };
  const cfg = depthMap[difficulty] || depthMap.master;

  return new Promise((resolve) => {
    currentUciResolve = (bestUci) => {
      if (!bestUci || bestUci === '(none)') {
        resolve(null);
      } else {
        resolve(parseUciMove(bestUci, board));
      }
    };

    fairyInstance.postMessage(`position fen ${fen}`);
    fairyInstance.postMessage(`go depth ${cfg.depth} movetime ${cfg.time}`);

    setTimeout(() => {
      if (currentUciResolve) {
        currentUciResolve = null;
        resolve(null);
      }
    }, cfg.time + 3500);
  });
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, fen, difficulty, engine = 'fairy_stockfish', isDarkXiangqi = false } = e.data;

  // Dark Xiangqi (Cờ Úp) uses the dedicated native engine with face-down rule modeling
  if (isDarkXiangqi || engine === 'builtin') {
    const move = findBestMove(fen, difficulty, isDarkXiangqi);
    self.postMessage({ id, move, engineUsed: 'builtin' });
    return;
  }

  // Standard Xiangqi: Try Fairy-Stockfish WASM first!
  let engineMove = await requestFairyMove(fen, difficulty);

  if (engineMove) {
    self.postMessage({
      id,
      move: { from: engineMove.from, to: engineMove.to },
      engineUsed: 'fairy_stockfish',
    });
  } else {
    // Graceful fallback to built-in positional AlphaBeta if WASM environment lacks features
    const fallbackMove = findBestMove(fen, difficulty, false);
    self.postMessage({
      id,
      move: fallbackMove ? { from: fallbackMove.from, to: fallbackMove.to } : null,
      engineUsed: 'builtin_fallback',
    });
  }
};
