const fs = require('fs');
const path = require('path');
const StockfishFactory = require('./stockfish.js');

let instance = null;
let isReady = false;
let currentSearch = null;
const queue = [];
let busy = false;

async function init() {
  try {
    const wasmPath = path.join(__dirname, 'stockfish.wasm');
    const jsPath = path.join(__dirname, 'stockfish.js');
    const wasmBinary = fs.readFileSync(wasmPath);

    instance = await StockfishFactory({
      wasmBinary,
      arguments: [],
      locateFile: (f) => path.join(__dirname, f),
      mainScriptUrlOrBlob: jsPath,
    });

    instance.addMessageListener((line) => {
      if (typeof line !== 'string') return;
      if (line === 'readyok') {
        isReady = true;
        processQueue();
      } else if (line.startsWith('bestmove')) {
        const parts = line.trim().split(/\s+/);
        const uci = parts[1] && parts[1] !== '(none)' ? parts[1] : null;
        if (currentSearch) {
          const { id, timer } = currentSearch;
          clearTimeout(timer);
          currentSearch = null;
          busy = false;
          if (process.send) {
            process.send({ id, uci });
          }
          processQueue();
        }
      }
    });

    instance.postMessage('uci');
    instance.postMessage('setoption name UCI_Variant value xiangqi');
    instance.postMessage('isready');
  } catch (err) {
    if (process.send) {
      process.send({ type: 'error', error: String(err) });
    }
  }
}

function processQueue() {
  if (!isReady || !instance || busy || queue.length === 0) return;
  const req = queue.shift();
  busy = true;

  const timer = setTimeout(() => {
    if (currentSearch && currentSearch.id === req.id) {
      currentSearch = null;
      busy = false;
      try {
        instance.postMessage('stop');
      } catch {}
      if (process.send) {
        process.send({ id: req.id, uci: null });
      }
      processQueue();
    }
  }, (req.time || 800) + 1800);

  currentSearch = { id: req.id, timer };

  instance.postMessage(`setoption name Skill Level value ${req.skill ?? 10}`);
  instance.postMessage(`position fen ${req.fen}`);
  instance.postMessage(`go depth ${req.depth || 4} movetime ${req.time || 500}`);
}

process.on('message', (msg) => {
  if (!msg || typeof msg !== 'object') return;
  if (msg.cmd === 'search') {
    queue.push(msg);
    processQueue();
  }
});

init();
