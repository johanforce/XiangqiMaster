import React, { useState, useEffect } from 'react';
import {
  SkipBack,
  ChevronLeft,
  Play,
  Pause,
  ChevronRight,
  SkipForward,
  RotateCcw,
  Copy,
  FileText,
  History,
  FolderOpen,
  Download,
  Upload,
  Share2,
} from 'lucide-react';
import {
  INITIAL_FEN,
  parseFen,
  FormattedMove,
  replayFromNotationText,
} from '../shared/xiangqi';
import { XiangqiBoard } from './XiangqiBoard';
import { BoardTheme } from '../utils/themes';
import { sound } from '../utils/sound';

interface NotationViewerViewProps {
  theme: BoardTheme;
  pieceCharMode: 'hanzi' | 'viet';
  uid?: string;
  initialPgnText?: string;
  onToast: (msg: string) => void;
}

export const NotationViewerView: React.FC<NotationViewerViewProps> = ({
  theme,
  pieceCharMode,
  uid,
  initialPgnText = '',
  onToast,
}) => {
  const [rawInput, setRawInput] = useState(
    initialPgnText || '1. C2.5 H8+7 2. H2+3 R9.8 3. R1.2 P7+1'
  );
  const [initialFen, setInitialFen] = useState(INITIAL_FEN);
  const [moves, setMoves] = useState<FormattedMove[]>([]);
  const [plyIndex, setPlyIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [notationFormat, setNotationFormat] = useState<'wxf' | 'viet' | 'iccs'>('wxf');
  const [savedGames, setSavedGames] = useState<any[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);

  const loadFromText = (text: string) => {
    const parsed = replayFromNotationText(text);
    setInitialFen(parsed.initialFen);
    setMoves(parsed.moves);
    setPlyIndex(0);
    setAutoPlay(false);
  };

  useEffect(() => {
    loadFromText(rawInput);
  }, []);

  useEffect(() => {
    if (initialPgnText) {
      setRawInput(initialPgnText);
      loadFromText(initialPgnText);
    }
  }, [initialPgnText]);

  useEffect(() => {
    setLoadingGames(true);
    const url = uid ? `/api/games?uid=${encodeURIComponent(uid)}` : '/api/games';
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.games) setSavedGames(d.games);
      })
      .catch(() => {})
      .finally(() => setLoadingGames(false));
  }, [uid]);

  useEffect(() => {
    if (!autoPlay) return;
    if (plyIndex >= moves.length) {
      setAutoPlay(false);
      return;
    }
    const timer = setTimeout(() => {
      sound.playMove();
      setPlyIndex((i) => Math.min(moves.length, i + 1));
    }, 900);
    return () => clearTimeout(timer);
  }, [autoPlay, plyIndex, moves.length]);

  const currentFen = plyIndex === 0 ? initialFen : moves[plyIndex - 1]?.fen || initialFen;
  const { board, turn } = parseFen(currentFen);
  const lastMove =
    plyIndex > 0 ? { from: moves[plyIndex - 1].from, to: moves[plyIndex - 1].to } : null;

  const handleCopyRecord = () => {
    const lines = moves.map((m, i) => {
      const text =
        notationFormat === 'wxf'
          ? m.wxf
          : notationFormat === 'viet'
          ? m.viet
          : m.iccs;
      return i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${text}` : text;
    });
    const full = `[FEN "${initialFen}"]\n${lines.join(' ')}`;
    navigator.clipboard.writeText(full);
    onToast('Đã sao chép kỳ phổ');
  };

  const handleDownloadFile = () => {
    const lines = moves.map((m, i) => {
      const text =
        notationFormat === 'wxf'
          ? m.wxf
          : notationFormat === 'viet'
          ? m.viet
          : m.iccs;
      return i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${text}` : text;
    });
    const content = `[Event "Xiangqi Match"]\n[FEN "${initialFen}"]\n[Format "${notationFormat.toUpperCase()}"]\n[Date "${new Date().toISOString().slice(0, 10)}"]\n\n${lines.join(' ')}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xiangqi_game_${Date.now()}.${notationFormat === 'wxf' ? 'pgn' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Đã tải kỳ phổ về máy');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setRawInput(text);
        loadFromText(text);
        onToast(`Đã nạp file: ${file.name}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Center Board Column */}
      <div className="lg:col-span-7 flex flex-col items-center justify-center">
        <XiangqiBoard
          board={board}
          turn={turn}
          theme={theme}
          pieceCharMode={pieceCharMode}
          flipped={flipped}
          interactive={false}
          lastMove={lastMove}
          onMove={() => {}}
        />

        {/* Playback Controls Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 bg-stone-900/90 border border-stone-800 rounded-2xl p-2 shadow-lg">
          <button
            onClick={() => {
              setAutoPlay(false);
              setPlyIndex(0);
            }}
            title="Về đầu ván"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-stone-300 hover:bg-stone-800 transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setAutoPlay(false);
              setPlyIndex((i) => Math.max(0, i - 1));
            }}
            title="Lùi 1 nước"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-stone-300 hover:bg-stone-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setAutoPlay((a) => !a)}
            title="Tự chạy"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-amber-600 text-white hover:bg-amber-500 transition-colors"
          >
            {autoPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => {
              setAutoPlay(false);
              setPlyIndex((i) => Math.min(moves.length, i + 1));
            }}
            title="Tới 1 nước"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-stone-300 hover:bg-stone-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setAutoPlay(false);
              setPlyIndex(moves.length);
            }}
            title="Tới cuối ván"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-stone-300 hover:bg-stone-800 transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
          <button
            onClick={() => setFlipped((f) => !f)}
            title="Lật bàn cờ"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-stone-300 hover:bg-stone-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopyRecord}
            title="Sao chép kỳ phổ"
            className="min-h-[44px] px-3 flex items-center gap-1.5 rounded-xl bg-stone-800 text-stone-200 hover:bg-stone-700 text-xs font-medium transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Sao chép</span>
          </button>
          <button
            onClick={handleDownloadFile}
            title="Tải tệp kỳ phổ (.pgn / .txt)"
            className="min-h-[44px] px-3 flex items-center gap-1.5 rounded-xl bg-stone-800 text-stone-200 hover:bg-stone-700 text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Tải về</span>
          </button>
          <label
            title="Mở tệp kỳ phổ từ máy tính"
            className="min-h-[44px] px-3 flex items-center gap-1.5 rounded-xl bg-stone-800 text-stone-200 hover:bg-stone-700 text-xs font-medium cursor-pointer transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span>Mở tệp</span>
            <input
              type="file"
              accept=".pgn,.txt,.xq,.che"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Side Panel: Notation Input, Move List & Saved History */}
      <div className="lg:col-span-5 space-y-4">
        {/* Paste Notation Box */}
        <div className="rounded-2xl bg-stone-900/90 border border-stone-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-200">
              <FileText className="w-4 h-4 text-amber-500" />
              <span>Trình xem kỳ phổ</span>
            </div>
            <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-lg text-xs">
              {(['wxf', 'viet', 'iccs'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setNotationFormat(fmt)}
                  className={`px-2.5 py-1 rounded-md font-medium uppercase transition-colors ${
                    notationFormat === fmt
                      ? 'bg-amber-600 text-white'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <textarea
            rows={3}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Dán kỳ phổ WXF / ICCS / FEN..."
            className="w-full rounded-xl bg-stone-950 border border-stone-800 p-3 text-xs font-mono-num text-stone-200 focus:outline-none focus:border-amber-500"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-stone-400 font-mono-num truncate flex-1" title={currentFen}>
              FEN: {currentFen}
            </span>
            <button
              onClick={() => {
                loadFromText(rawInput);
                onToast('Đã nạp kỳ phổ');
              }}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold whitespace-nowrap transition-colors"
            >
              Nạp kỳ phổ
            </button>
          </div>

          {/* Interactive Move List */}
          <div className="max-h-48 overflow-y-auto rounded-xl bg-stone-950/80 border border-stone-800/80 p-2 grid grid-cols-2 gap-1 text-xs font-mono-num">
            {moves.map((m, idx) => {
              const active = plyIndex === idx + 1;
              const label =
                notationFormat === 'wxf'
                  ? m.wxf
                  : notationFormat === 'viet'
                  ? m.viet
                  : m.iccs;
              return (
                <button
                  key={m.ply}
                  onClick={() => {
                    setAutoPlay(false);
                    setPlyIndex(idx + 1);
                  }}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    active
                      ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                      : 'text-stone-300 hover:bg-stone-800/70'
                  }`}
                >
                  <span className="text-stone-500">
                    {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}.` : '...'}
                  </span>
                  <span className="truncate ml-1.5">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Saved Games History */}
        <div className="rounded-2xl bg-stone-900/90 border border-stone-800 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-200">
            <History className="w-4 h-4 text-amber-500" />
            <span>Lịch sử ván đấu</span>
          </div>

          {loadingGames ? (
            <div className="space-y-2">
              <div className="h-10 rounded-xl bg-stone-800/60 animate-pulse" />
              <div className="h-10 rounded-xl bg-stone-800/60 animate-pulse" />
            </div>
          ) : savedGames.length === 0 ? (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-stone-500">
              <FolderOpen className="w-6 h-6" />
              <button
                onClick={() => loadFromText('1. C2.5 H8+7 2. H2+3 R9.8 3. R1.2 P7+1')}
                className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-stone-200 transition-colors"
              >
                Xem ván mẫu
              </button>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {savedGames.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    if (g.wxfText) {
                      setRawInput(g.wxfText);
                      loadFromText(g.wxfText);
                      onToast('Đã mở kỳ phổ ván đấu');
                    }
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-stone-950/70 hover:bg-stone-800 border border-stone-800/70 text-xs transition-colors"
                >
                  <div className="truncate font-medium text-stone-200">
                    {g.redName} · {g.blackName}
                  </div>
                  <div className="flex items-center gap-2 text-stone-400 font-mono-num shrink-0">
                    <span>{g.moveCount} nước</span>
                    <span>·</span>
                    <span
                      className={
                        g.winner === 'red'
                          ? 'text-red-400'
                          : g.winner === 'black'
                          ? 'text-sky-400'
                          : 'text-amber-400'
                      }
                    >
                      {g.winner === 'red' ? 'Đỏ thắng' : g.winner === 'black' ? 'Đen thắng' : 'Hòa'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
