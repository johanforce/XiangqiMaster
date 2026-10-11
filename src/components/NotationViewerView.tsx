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
  ClipboardPaste,
  Trash2,
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
import { navigateUrl, handleLinkClick } from '../utils/navigation';

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
  initialPgnText = '',
  onToast,
}) => {
  const [rawInput, setRawInput] = useState(
    initialPgnText || ''
  );
  const [initialFen, setInitialFen] = useState(INITIAL_FEN);
  const [moves, setMoves] = useState<FormattedMove[]>([]);
  const [plyIndex, setPlyIndex] = useState<number>(() => {
    const p = Number(new URLSearchParams(window.location.search).get('ply'));
    return !Number.isNaN(p) && p >= 0 ? p : 0;
  });
  const [autoPlay, setAutoPlay] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [notationFormat, setNotationFormat] = useState<'wxf' | 'viet' | 'iccs'>(() => {
    const f = new URLSearchParams(window.location.search).get('format');
    return f === 'viet' || f === 'iccs' ? f : 'wxf';
  });

  const buildViewerUrl = (fmt = notationFormat, ply = plyIndex) => {
    const params = new URLSearchParams();
    if (fmt !== 'wxf') params.set('format', fmt);
    if (ply > 0) params.set('ply', String(ply));
    const qs = params.toString();
    return qs ? `/viewer?${qs}` : '/viewer';
  };

  const loadFromText = (text: string, keepUrlPly = false) => {
    const parsed = replayFromNotationText(text);
    setInitialFen(parsed.initialFen);
    setMoves(parsed.moves);
    const lastPly = parsed.moves.length;
    if (keepUrlPly) {
      const plyParam = new URLSearchParams(window.location.search).get('ply');
      const p = plyParam !== null ? Number(plyParam) : NaN;
      const validPly = !Number.isNaN(p) && p >= 0 ? Math.min(lastPly, p) : lastPly;
      setPlyIndex(validPly);
    } else {
      setPlyIndex(lastPly);
      navigateUrl(buildViewerUrl(notationFormat, lastPly), true);
    }
    setAutoPlay(false);
  };

  useEffect(() => {
    loadFromText(rawInput, true);
  }, []);

  useEffect(() => {
    const syncViewerUrl = () => {
      if (!window.location.pathname.startsWith('/viewer')) return;
      const params = new URLSearchParams(window.location.search);
      const f = params.get('format');
      if (f === 'wxf' || f === 'viet' || f === 'iccs') {
        setNotationFormat(f);
      } else {
        setNotationFormat('wxf');
      }
      const p = params.get('ply');
      if (p !== null && !Number.isNaN(Number(p))) {
        setPlyIndex(Math.max(0, Math.min(moves.length, Number(p))));
      }
    };
    window.addEventListener('popstate', syncViewerUrl);
    window.addEventListener('app:locationchange', syncViewerUrl);
    return () => {
      window.removeEventListener('popstate', syncViewerUrl);
      window.removeEventListener('app:locationchange', syncViewerUrl);
    };
  }, [moves.length]);

  useEffect(() => {
    if (initialPgnText) {
      setRawInput(initialPgnText);
      loadFromText(initialPgnText);
    }
  }, [initialPgnText]);

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

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setRawInput(text);
        loadFromText(text);
        onToast('Đã dán và nạp kỳ phổ từ bộ nhớ tạm');
      } else {
        onToast('Bộ nhớ tạm đang trống');
      }
    } catch {
      onToast('Vui lòng nhấn Ctrl+V vào ô nhập kỳ phổ');
    }
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
        </div>
      </div>

      {/* Side Panel: Paste Notation & Move List Only */}
      <div className="lg:col-span-5 space-y-4">
        <div className="rounded-2xl bg-stone-900/90 border border-stone-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-200">
              <FileText className="w-4 h-4 text-amber-500" />
              <span>Trình xem kỳ phổ</span>
            </div>
            <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-lg text-xs">
              {(['wxf', 'viet', 'iccs'] as const).map((fmt) => {
                const fmtUrl = buildViewerUrl(fmt, plyIndex);
                return (
                  <a
                    key={fmt}
                    href={fmtUrl}
                    onClick={(e) =>
                      handleLinkClick(e, fmtUrl, () => setNotationFormat(fmt))
                    }
                    className={`px-2.5 py-1 rounded-md font-medium uppercase transition-colors ${
                      notationFormat === fmt
                        ? 'bg-amber-600 text-white'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {fmt}
                  </a>
                );
              })}
            </div>
          </div>

          <textarea
            rows={5}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Dán kỳ phổ đã sao chép (WXF / ICCS / FEN) vào đây..."
            className="w-full rounded-xl bg-stone-950 border border-stone-800 p-3 text-xs font-mono-num text-stone-200 focus:outline-none focus:border-amber-500"
          />

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePasteFromClipboard}
                title="Dán nhanh từ bộ nhớ tạm"
                className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-amber-400" />
                <span>Dán kỳ phổ</span>
              </button>
              <button
                onClick={() => {
                  setRawInput('');
                  loadFromText('');
                }}
                title="Xóa nội dung"
                className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

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

          <div className="text-[11px] text-stone-400 font-mono-num truncate" title={currentFen}>
            FEN: {currentFen}
          </div>

          {/* Interactive Move List (Dedicated Scroll Container so rows never compress) */}
          <div className="h-72 max-h-72 overflow-y-auto overscroll-contain rounded-xl bg-stone-950/80 border border-stone-800/80 p-2.5 text-xs font-mono-num">
            {moves.length === 0 ? (
              <div className="h-full flex items-center justify-center py-8 text-center text-stone-500 font-sans">
                Dán kỳ phổ vào ô bên trên rồi bấm &ldquo;Nạp kỳ phổ&rdquo; để xem các nước đi
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 auto-rows-max content-start">
                {moves.map((m, idx) => {
                  const active = plyIndex === idx + 1;
                  const label =
                    notationFormat === 'wxf'
                      ? m.wxf
                      : notationFormat === 'viet'
                      ? m.viet
                      : m.iccs;
                  const moveUrl = buildViewerUrl(notationFormat, idx + 1);
                  return (
                    <a
                      key={m.ply}
                      href={moveUrl}
                      onClick={(e) =>
                        handleLinkClick(e, moveUrl, () => {
                          setAutoPlay(false);
                          setPlyIndex(idx + 1);
                        })
                      }
                      className={`min-h-[34px] shrink-0 flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                        active
                          ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                          : 'text-stone-300 hover:bg-stone-800/70'
                      }`}
                    >
                      <span className="text-stone-500 shrink-0">
                        {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}.` : '...'}
                      </span>
                      <span className="truncate ml-1.5">{label}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
