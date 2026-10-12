/* Fairy-Stockfish Web Worker for Xiangqi Master */

let stockfish = null;
let isReady = false;
let queuedCommands = [];

function uciToMove(uci) {
  if (!uci || uci.length < 4) return null;
  // Fairy-Stockfish Xiangqi UCI format uses files 'a'..'i' and 1-indexed ranks '1'..'10'
  // e.g. 'b1c3', 'b3b10', 'a10a9', 'h1g3'
  const match = /^([a-i])(10|[1-9])([a-i])(10|[1-9])/i.exec(uci.trim());
  if (!match) return null;
  const fCol = match[1].toLowerCase().charCodeAt(0) - 97;
  const fRank = parseInt(match[2], 10);
  const tCol = match[3].toLowerCase().charCodeAt(0) - 97;
  const tRank = parseInt(match[4], 10);
  return {
    from: { row: 10 - fRank, col: fCol },
    to: { row: 10 - tRank, col: tCol },
  };
}

let pendingRequest = null;

async function initEngine() {
  try {
    const wasmRes = await fetch('/engine/fairy/stockfish.wasm');
    if (!wasmRes.ok) throw new Error('WASM fetch failed');
    const wasmBinary = await wasmRes.arrayBuffer();

    if (typeof importScripts === 'function') {
      importScripts('/engine/fairy/stockfish.js');
    } else {
      const jsRes = await fetch('/engine/fairy/stockfish.js');
      const code = await jsRes.text();
      const fn = new Function('exports', 'module', code + '\nreturn Stockfish;');
      self.Stockfish = fn({}, {});
    }

    const StockfishFactory = self.Stockfish;
    if (typeof StockfishFactory !== 'function') {
      throw new Error('Stockfish factory not found in worker');
    }

    stockfish = await StockfishFactory({
      wasmBinary,
      locateFile: (file) => `/engine/fairy/${file}`,
      mainScriptUrlOrBlob: '/engine/fairy/stockfish.js',
    });

    stockfish.addMessageListener((line) => {
      if (line === 'readyok') {
        isReady = true;
        self.postMessage({ type: 'ready' });
        while (queuedCommands.length > 0) {
          const cmd = queuedCommands.shift();
          stockfish.postMessage(cmd);
        }
      }

      if (line.startsWith('bestmove')) {
        const parts = line.split(' ');
        const bestmoveUci = parts[1];
        if (pendingRequest) {
          const { id } = pendingRequest;
          pendingRequest = null;
          const coords = uciToMove(bestmoveUci);
          self.postMessage({
            type: 'bestmove',
            id,
            uci: bestmoveUci,
            move: coords,
          });
        }
      }
    });

    stockfish.postMessage('uci');
    stockfish.postMessage('setoption name UCI_Variant value xiangqi');
    stockfish.postMessage('isready');
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

self.onmessage = async (e) => {
  const data = e.data;
  if (!data) return;

  if (data.type === 'init') {
    if (!stockfish) {
      await initEngine();
    }
    return;
  }

  if (data.type === 'search') {
    const { id, fen, difficulty, depth, movetime } = data;
    pendingRequest = { id };

    const searchDepth =
      depth ||
      (difficulty === 'grandmaster'
        ? 8
        : difficulty === 'master'
          ? 6
          : difficulty === 'veteran'
            ? 4
            : 2);
    const searchMoveTime =
      movetime ||
      (difficulty === 'grandmaster'
        ? 1200
        : difficulty === 'master'
          ? 800
          : difficulty === 'veteran'
            ? 500
            : 300);

    const commands = [
      `position fen ${fen}`,
      `go depth ${searchDepth} movetime ${searchMoveTime}`,
    ];

    if (!isReady || !stockfish) {
      queuedCommands.push(...commands);
    } else {
      for (const cmd of commands) {
        stockfish.postMessage(cmd);
      }
    }
  }
};
