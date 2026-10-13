import React, { useState, useEffect, useRef } from 'react';
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
  Undo2,
  Lock,
  Sparkles,
  CornerDownRight,
} from 'lucide-react';
import {
  INITIAL_FEN,
  Pos,
  PieceColor,
  parseFen,
  boardToFen,
  applyMove,
  isKingInCheck,
  formatMoveNotation,
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
  const [rawInput, setRawInput] = useState(initialPgnText || '');
  const [initialFen, setInitialFen] = useState(INITIAL_FEN);
  // baseMoves stores the immutable moves parsed from the pasted notation
  const [baseMoves, setBaseMoves] = useState<FormattedMove[]>([]);
  // moves stores baseMoves + any continuation moves researched by the user
  const [moves, setMoves] = useState<FormattedMove[]>([]);
  const movesLengthRef = useRef<number>(0);
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

  const baseMoveCount = baseMoves.length;
  const researchMoveCount = Math.max(0, moves.length - baseMoveCount);
  const canResearchMove = plyIndex >= baseMoveCount;

  const buildViewerUrl = (fmt = notationFormat, ply = plyIndex) => {
    const params = new URLSearchParams();
    if (fmt !== 'wxf') params.set('format', fmt);
    if (ply > 0) params.set('ply', String(ply));
    const qs = params.toString();
    return qs ? `/viewer?${qs}` : '/viewer';
  };

  const loadFromText = (text: string, keepUrlPly = false) => {
    const parsed = replayFromNotationText(text);
    const lastPly = parsed.moves.length;
    movesLengthRef.current = lastPly;
    setInitialFen(parsed.initialFen);
    setBaseMoves(parsed.moves);
    setMoves(parsed.moves);
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
    movesLengthRef.current = moves.length;
  }, [moves.length]);

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
        setPlyIndex(Math.max(0, Math.min(movesLengthRef.current, Number(p))));
      }
    };
    window.addEventListener('popstate', syncViewerUrl);
    return () => {
      window.removeEventListener('popstate', syncViewerUrl);
    };
  }, []);

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
    plyIndex > 0 && moves[plyIndex - 1]
      ? { from: moves[plyIndex - 1].from, to: moves[plyIndex - 1].to }
      : null;

  // Execute a user research move on the board (only allowed at or after baseMoveCount)
  const handleBoardResearchMove = (from: Pos, to: Pos) => {
    if (plyIndex < baseMoveCount) {
      onToast('Không thể sửa nước đi của kỳ phổ gốc. Hãy về cuối kỳ phổ gốc để đi tiếp!');
      return;
    }
    setAutoPlay(false);

    const { board: curBoard, turn: curTurn } = parseFen(currentFen);
    const notation = formatMoveNotation(curBoard, from, to);
    const { nextBoard, move } = applyMove(curBoard, from, to);
    const nextTurn: PieceColor = curTurn === 'r' ? 'b' : 'r';
    const nextFen = boardToFen(nextBoard, nextTurn);
    const gaveCheck = isKingInCheck(nextBoard, nextTurn);

    if (gaveCheck) {
      sound.playCheck();
    } else if (move.captured) {
      sound.playCapture();
    } else {
      sound.playMove();
    }

    const nextPly = plyIndex + 1;
    const formatted: FormattedMove = {
      ...move,
      ply: nextPly,
      color: curTurn,
      ...notation,
      fen: nextFen,
      isCheck: gaveCheck,
    };

    // Preserve all baseMoves and any research moves up to current plyIndex
    const nextMoves = [...moves.slice(0, plyIndex), formatted];
    movesLengthRef.current = nextMoves.length;
    setMoves(nextMoves);
    setPlyIndex(nextPly);
    navigateUrl(buildViewerUrl(notationFormat, nextPly), true);
  };

  // Roll back 1 researched move without ever modifying baseMoves
  const handleRollbackResearchMove = () => {
    setAutoPlay(false);
    if (moves.length <= baseMoveCount) {
      onToast('Đang ở kỳ phổ gốc — không thể xóa nước đi có sẵn trong kỳ phổ vừa dán');
      return;
    }
    const activeResearchPly = plyIndex > baseMoveCount ? plyIndex : moves.length;
    const targetPly = Math.max(baseMoveCount, activeResearchPly - 1);
    const nextMoves = moves.slice(0, targetPly);
    movesLengthRef.current = nextMoves.length;
    setMoves(nextMoves);
    setPlyIndex(targetPly);
    navigateUrl(buildViewerUrl(notationFormat, targetPly), true);
  };

  // Clear all researched moves and return to the end of the pasted notation
  const handleResetResearchBranch = () => {
    if (moves.length <= baseMoveCount) return;
    setAutoPlay(false);
    movesLengthRef.current = baseMoves.length;
    setMoves(baseMoves);
    setPlyIndex(baseMoveCount);
    navigateUrl(buildViewerUrl(notationFormat, baseMoveCount), true);
    onToast('Đã xóa nhánh nghiên cứu, quay về cuối kỳ phổ gốc');
  };

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
    onToast(
      researchMoveCount > 0
        ? `Đã sao chép kỳ phổ (gồm ${baseMoveCount} nước gốc + ${researchMoveCount} nước nghiên cứu)`
        : 'Đã sao chép kỳ phổ'
    );
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setRawInput(text);
        loadFromText(text);
        onToast('Đã dán kỳ phổ — bạn có thể đi tiếp trên bàn cờ để nghiên cứu!');
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
        {/* Research Status Banner */}
        <div className="w-full max-w-[min(92vw,560px)] mb-3 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-stone-900/90 border border-stone-800 text-xs">
          {canResearchMove ? (
            <div className="flex items-center gap-2 text-emerald-300 font-medium">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Chế độ nghiên cứu: Lượt{' '}
                <strong className={turn === 'r' ? 'text-red-400' : 'text-sky-300'}>
                  {turn === 'r' ? 'Đỏ' : 'Đen'}
                </strong>{' '}
                đi tiếp trên bàn cờ
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-300 font-medium">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Đang xem kỳ phổ gốc (Nước {plyIndex}/{baseMoveCount} — Chỉ đọc)
              </span>
            </div>
          )}

          {!canResearchMove ? (
            <button
              onClick={() => {
                setAutoPlay(false);
                setPlyIndex(baseMoveCount);
                navigateUrl(buildViewerUrl(notationFormat, baseMoveCount), true);
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors"
            >
              Tới cuối kỳ phổ gốc để đi tiếp
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
              <span>Gốc: {baseMoveCount} nước</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">
                Nghiên cứu: +{researchMoveCount} nước
              </span>
            </div>
          )}
        </div>

        <XiangqiBoard
          board={board}
          turn={turn}
          theme={theme}
          pieceCharMode={pieceCharMode}
          flipped={flipped}
          interactive={canResearchMove}
          allowedColor="both"
          lastMove={lastMove}
          onMove={handleBoardResearchMove}
        />

        {/* Playback & Research Rollback Controls Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 bg-stone-900/90 border border-stone-800 rounded-2xl p-2 shadow-lg">
          <button
            onClick={() => {
              setAutoPlay(false);
              setPlyIndex(0);
              navigateUrl(buildViewerUrl(notationFormat, 0), true);
            }}
            title="Về đầu ván"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-stone-300 hover:bg-stone-800 transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setAutoPlay(false);
              const next = Math.max(0, plyIndex - 1);
              setPlyIndex(next);
              navigateUrl(buildViewerUrl(notationFormat, next), true);
            }}
            title="Xem nước trước"
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
              const next = Math.min(moves.length, plyIndex + 1);
              setPlyIndex(next);
              navigateUrl(buildViewerUrl(notationFormat, next), true);
            }}
            title="Xem nước tiếp"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-stone-300 hover:bg-stone-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setAutoPlay(false);
              setPlyIndex(moves.length);
              navigateUrl(buildViewerUrl(notationFormat, moves.length), true);
            }}
            title="Tới nước cuối cùng"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-stone-300 hover:bg-stone-800 transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Rollback Research Move Button (Never touches baseMoves) */}
          <button
            onClick={handleRollbackResearchMove}
            disabled={moves.length <= baseMoveCount}
            title="Roll back (Hoàn tác) 1 nước đi nghiên cứu — không ảnh hưởng kỳ phổ gốc"
            className={`min-h-[44px] px-3 flex items-center gap-1.5 rounded-xl text-xs font-semibold transition-colors ${
              moves.length > baseMoveCount
                ? 'bg-emerald-600/25 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/40'
                : 'bg-stone-800/50 text-stone-500 cursor-not-allowed'
            }`}
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Lùi nước nghiên cứu</span>
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

      {/* Side Panel: Paste Notation & Move List */}
      <div className="lg:col-span-5 space-y-4">
        <div className="rounded-2xl bg-stone-900/90 border border-stone-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-200">
              <FileText className="w-4 h-4 text-amber-500" />
              <span>Kỳ phổ & Nghiên cứu nước đi</span>
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
            rows={4}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Dán kỳ phổ đã sao chép (WXF / ICCS / FEN) vào đây để nạp và đi tiếp..."
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
                title="Xóa toàn bộ kỳ phổ về bàn cờ đầu"
                className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => {
                loadFromText(rawInput);
                onToast('Đã nạp kỳ phổ — bạn có thể đi tiếp trên bàn cờ!');
              }}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold whitespace-nowrap transition-colors"
            >
              Nạp kỳ phổ
            </button>
          </div>

          {/* Research Controls Summary */}
          {researchMoveCount > 0 && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-950/30 border border-emerald-700/40 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-300">
                <CornerDownRight className="w-3.5 h-3.5 shrink-0" />
                <span>Đang có {researchMoveCount} nước nghiên cứu thêm</span>
              </div>
              <button
                onClick={handleResetResearchBranch}
                className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-medium transition-colors"
              >
                Về cuối kỳ phổ gốc
              </button>
            </div>
          )}

          <div className="text-[11px] text-stone-400 font-mono-num truncate" title={currentFen}>
            FEN: {currentFen}
          </div>

          {/* Interactive Move List (Original Locked Moves + User Research Moves) */}
          <div className="h-72 max-h-72 overflow-y-auto overscroll-contain rounded-xl bg-stone-950/80 border border-stone-800/80 p-2.5 text-xs font-mono-num">
            {moves.length === 0 ? (
              <div className="h-full flex items-center justify-center py-8 px-4 text-center text-stone-500 font-sans">
                Dán kỳ phổ vào ô bên trên rồi bấm &ldquo;Nạp kỳ phổ&rdquo; hoặc đi trực tiếp trên bàn cờ để bắt đầu nghiên cứu nước đi
              </div>
            ) : (
              <div className="space-y-2">
                {baseMoveCount > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1 text-[11px] font-sans text-stone-400">
                      <span className="flex items-center gap-1 font-medium">
                        <Lock className="w-3 h-3 text-amber-500" />
                        Kỳ phổ gốc ({baseMoveCount} nước — cố định)
                      </span>
                      {plyIndex < baseMoveCount && (
                        <button
                          onClick={() => {
                            setAutoPlay(false);
                            setPlyIndex(baseMoveCount);
                            navigateUrl(buildViewerUrl(notationFormat, baseMoveCount), true);
                          }}
                          className="text-amber-400 hover:underline"
                        >
                          Tới cuối kỳ phổ gốc
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 auto-rows-max content-start">
                      {moves.slice(0, baseMoveCount).map((m, idx) => {
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
                            key={`base_${m.ply}`}
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
                  </div>
                )}

                {researchMoveCount > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-stone-800/90">
                    <div className="flex items-center justify-between px-1 text-[11px] font-sans text-emerald-400">
                      <span className="flex items-center gap-1 font-medium">
                        <Sparkles className="w-3 h-3" />
                        Nước đi nghiên cứu (+{researchMoveCount} nước)
                      </span>
                      <button
                        onClick={handleRollbackResearchMove}
                        className="text-emerald-300 hover:underline flex items-center gap-1"
                      >
                        <Undo2 className="w-3 h-3" />
                        Roll back 1 nước
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 auto-rows-max content-start">
                      {moves.slice(baseMoveCount).map((m, offsetIdx) => {
                        const idx = baseMoveCount + offsetIdx;
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
                            key={`res_${m.ply}_${idx}`}
                            href={moveUrl}
                            onClick={(e) =>
                              handleLinkClick(e, moveUrl, () => {
                                setAutoPlay(false);
                                setPlyIndex(idx + 1);
                              })
                            }
                            className={`min-h-[34px] shrink-0 flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                              active
                                ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/50'
                                : 'bg-emerald-950/20 text-emerald-300/90 border border-emerald-900/40 hover:bg-emerald-900/30'
                            }`}
                          >
                            <span className="text-emerald-500/70 shrink-0">
                              {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}.` : '...'}
                            </span>
                            <span className="truncate ml-1.5">{label}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
