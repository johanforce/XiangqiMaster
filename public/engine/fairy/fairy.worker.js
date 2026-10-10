/* Fairy-Stockfish Web Worker for Xiangqi Master */

let stockfish = null;
let isReady = false;
let queuedCommands = [];

function uciToMove(uci) {
  if (!uci || uci.length < 4) return null;
  // Format: 'b0c2' or 'b2e2' or 'h9g7'
  const fCol = uci.charCodeAt(0) - 97;
  const fRank = parseInt(uci.slice(1, -2), 10);
  const tCol = uci.charCodeAt(uci.length - 2) - 97;
  const tRank = parseInt(uci.slice(-1), 10);
  if (isNaN(fRank) || isNaN(tRank)) return null;
  return {
    from: { r: 9 - fRank, c: fCol },
    to: { r: 9 - tRank, c: tCol },
  };
}

let pendingRequest = null;

async function initEngine() {
  try {
    const wasmRes = await fetch('/engine/fairy/stockfish.wasm');
    if (!wasmRes.ok) throw new Error('WASM fetch failed');
    const wasmBinary = await wasmRes.arrayBuffer();

    importScripts('/engine/fairy/stockfish.js');
    if (typeof Stockfish !== 'function') {
      throw new Error('Stockfish factory not found in worker');
    }

    stockfish = await Stockfish({ wasmBinary });
    stockfish.addMessageListener((line) => {
      // Handle banner / init line
      if (line.includes('Fairy-Stockfish') && !isReady) {
        stockfish.postMessage('uci');
        stockfish.postMessage('setoption name UCI_Variant value xiangqi');
        stockfish.postMessage('isready');
      }

      if (line === 'readyok') {
        isReady = true;
        self.postMessage({ type: 'ready' });
        // Process any queued commands
        while (queuedCommands.length > 0) {
          const cmd = queuedCommands.shift();
          stockfish.postMessage(cmd);
        }
      }

      if (line.startsWith('bestmove')) {
        const parts = line.split(' ');
        const bestmoveUci = parts[1];
        if (pendingRequest) {
          const { id, resolve } = pendingRequest;
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

    const searchDepth = depth || (difficulty === 'grandmaster' ? 8 : difficulty === 'master' ? 6 : difficulty === 'veteran' ? 4 : 2);
    const searchMoveTime = movetime || (difficulty === 'grandmaster' ? 1200 : difficulty === 'master' ? 800 : difficulty === 'veteran' ? 500 : 300);

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
