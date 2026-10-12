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

/**
 * Convert Fairy-Stockfish UCI coordinate string ('b1c3', 'b3b10', 'a10a9', 'd10e9')
 * into a verified legal Xiangqi Move on our 0..9 board (row 0 = rank 10 Black, row 9 = rank 1 Red).
 */
export function parseUciMove(
  uci: string,
  board: Board,
  turn?: PieceColor
): { from: { row: number; col: number }; to: { row: number; col: number } } | null {
  if (!uci || uci.length < 4) return null;
  const match = /^([a-i])(10|[1-9])([a-i])(10|[1-9])/i.exec(uci.trim());
  if (!match) return null;

  const fCol = match[1].toLowerCase().charCodeAt(0) - 97;
  const fRank = parseInt(match[2], 10);
  const tCol = match[3].toLowerCase().charCodeAt(0) - 97;
  const tRank = parseInt(match[4], 10);

  const from = { row: 10 - fRank, col: fCol };
  const to = { row: 10 - tRank, col: tCol };

  if (
    from.row < 0 ||
    from.row > 9 ||
    from.col < 0 ||
    from.col > 8 ||
    to.row < 0 ||
    to.row > 9 ||
    to.col < 0 ||
    to.col > 8
  ) {
    return null;
  }

  if (turn) {
    const legal = getAllLegalMoves(board, turn, false);
    const isLegal = legal.some(
      (m) =>
        m.from.row === from.row &&
        m.from.col === from.col &&
        m.to.row === to.row &&
        m.to.col === to.col
    );
    if (!isLegal) return null;
  }

  return { from, to };
}

// Global Fairy-Stockfish instance state in Worker
let fairyInstance: any = null;
let fairyReady = false;
let fairyUnsupportedInWorker = false;
let fairyInitPromise: Promise<boolean> | null = null;
let currentUciResolve: ((val: string | null) => void) | null = null;

async function initFairyEngine(): Promise<boolean> {
  if (fairyReady && fairyInstance) return true;
  if (fairyUnsupportedInWorker) return false;
  if (fairyInitPromise) return fairyInitPromise;

  fairyInitPromise = (async () => {
    try {
      // Emscripten pthread build of Fairy-Stockfish requires crossOriginIsolated + SharedArrayBuffer
      if (
        typeof SharedArrayBuffer === 'undefined' ||
        (typeof self !== 'undefined' && !(self as any).crossOriginIsolated)
      ) {
        fairyUnsupportedInWorker = true;
        return false;
      }

      const [wasmRes, jsRes] = await Promise.all([
        fetch('/engine/fairy/stockfish.wasm'),
        fetch('/engine/fairy/stockfish.js'),
      ]);
      if (!wasmRes.ok || !jsRes.ok) {
        fairyUnsupportedInWorker = true;
        return false;
      }

      const [wasmBinary, jsCode] = await Promise.all([
        wasmRes.arrayBuffer(),
        jsRes.text(),
      ]);

      const factoryGetter = new Function('exports', 'module', `${jsCode}\nreturn Stockfish;`);
      const StockfishFactory = factoryGetter({}, {});
      if (typeof StockfishFactory !== 'function') {
        fairyUnsupportedInWorker = true;
        return false;
      }

      const instancePromise = StockfishFactory({
        wasmBinary,
        arguments: [],
        locateFile: (file: string) => `/engine/fairy/${file}`,
        mainScriptUrlOrBlob: '/engine/fairy/stockfish.js',
      });

      fairyInstance = await Promise.race([
        instancePromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);

      if (!fairyInstance) {
        fairyUnsupportedInWorker = true;
        return false;
      }

      fairyInstance.addMessageListener((line: string) => {
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

      fairyInstance.postMessage('uci');
      fairyInstance.postMessage('setoption name UCI_Variant value xiangqi');
      fairyInstance.postMessage('isready');

      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          if (!fairyReady) fairyUnsupportedInWorker = true;
          resolve(false);
        }, 1500);
        const check = setInterval(() => {
          if (fairyReady) {
            clearTimeout(timeout);
            clearInterval(check);
            resolve(true);
          }
        }, 40);
      });
    } catch {
      fairyUnsupportedInWorker = true;
      return false;
    }
  })();

  return fairyInitPromise;
}

const FAIRY_DIFFICULTY_CONFIG: Record<
  AIDifficulty,
  { depth: number; time: number; skill: number }
> = {
  novice: { depth: 2, time: 200, skill: 0 },
  veteran: { depth: 4, time: 380, skill: 7 },
  master: { depth: 6, time: 650, skill: 14 },
  grandmaster: { depth: 7, time: 950, skill: 20 },
};

async function requestClientFairyMove(
  fen: string,
  difficulty: AIDifficulty
): Promise<{ from: { row: number; col: number }; to: { row: number; col: number } } | null> {
  const ready = await initFairyEngine();
  if (!ready || !fairyInstance) return null;

  const { board, turn } = parseFen(fen);
  const cfg = FAIRY_DIFFICULTY_CONFIG[difficulty] || FAIRY_DIFFICULTY_CONFIG.master;

  return new Promise((resolve) => {
    currentUciResolve = (bestUci) => {
      if (!bestUci || bestUci === '(none)') {
        resolve(null);
      } else {
        resolve(parseUciMove(bestUci, board, turn));
      }
    };

    fairyInstance.postMessage(`setoption name Skill Level value ${cfg.skill}`);
    fairyInstance.postMessage(`position fen ${fen}`);
    fairyInstance.postMessage(`go depth ${cfg.depth} movetime ${cfg.time}`);

    setTimeout(() => {
      if (currentUciResolve) {
        currentUciResolve = null;
        resolve(null);
      }
    }, cfg.time + 1500);
  });
}

async function requestServerFairyMove(
  fen: string,
  difficulty: AIDifficulty,
  engine: AIEngineType
): Promise<{ from: { row: number; col: number }; to: { row: number; col: number } } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch('/api/ai/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
      body: JSON.stringify({ fen, difficulty, engine }),
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.move?.from && data?.move?.to) {
      return { from: data.move.from, to: data.move.to };
    }
    return null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function requestFairyMove(
  fen: string,
  difficulty: AIDifficulty,
  engine: AIEngineType = 'fairy_stockfish'
): Promise<{
  move: { from: { row: number; col: number }; to: { row: number; col: number } };
  engineUsed: string;
} | null> {
  // 1. Try client-side WebAssembly Fairy-Stockfish first (when crossOriginIsolated is enabled)
  const clientMove = await requestClientFairyMove(fen, difficulty);
  if (clientMove) {
    return { move: clientMove, engineUsed: 'fairy_stockfish_wasm_client' };
  }

  // 2. If browser iframe restricts SharedArrayBuffer, run Fairy-Stockfish WASM via isolated backend runner
  const serverMove = await requestServerFairyMove(fen, difficulty, engine);
  if (serverMove) {
    return { move: serverMove, engineUsed: 'fairy_stockfish_wasm_server' };
  }

  return null;
}

if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function') {
  self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
    const { id, fen, difficulty, engine = 'fairy_stockfish', isDarkXiangqi = false } = e.data;

    // Dark Xiangqi (Cờ Úp) or explicit builtin mode uses the dedicated native engine
    if (isDarkXiangqi || engine === 'builtin') {
      const move = findBestMove(fen, difficulty, isDarkXiangqi);
      self.postMessage({ id, move, engineUsed: 'builtin' });
      return;
    }

    // Standard Xiangqi: Use Fairy-Stockfish WASM
    const fairyResult = await requestFairyMove(fen, difficulty, engine);

    if (fairyResult) {
      self.postMessage({
        id,
        move: fairyResult.move,
        engineUsed: fairyResult.engineUsed,
      });
    } else {
      // Graceful offline fallback to built-in positional AlphaBeta
      const fallbackMove = findBestMove(fen, difficulty, false);
      self.postMessage({
        id,
        move: fallbackMove ? { from: fallbackMove.from, to: fallbackMove.to } : null,
        engineUsed: 'builtin_fallback',
      });
    }
  };
}
