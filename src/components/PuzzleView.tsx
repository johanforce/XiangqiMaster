import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Puzzle,
  PlusCircle,
  Play,
  RotateCcw,
  Undo2,
  Lightbulb,
  Copy,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ArrowLeft,
  Trash2,
  Compass,
  Trophy,
  Swords,
  Languages,
  Sparkles,
  Share2,
} from 'lucide-react';
import {
  Board,
  Pos,
  PieceColor,
  PieceType,
  INITIAL_FEN,
  parseFen,
  boardToFen,
  createEmptyBoard,
  cloneBoard,
  findGeneral,
  areGeneralsFacing,
  inPalace,
  hasCrossedRiver,
  applyMove,
  evaluateGameStatus,
  formatMoveNotation,
  FormattedMove,
  PIECE_NAMES_HANZI,
  PIECE_NAMES_VIET,
} from '../shared/xiangqi';
import { BoardTheme, BOARD_THEMES } from '../utils/themes';
import { sound } from '../utils/sound';
import { XiangqiBoard } from './XiangqiBoard';
import {
  PuzzleItem,
  CLASSIC_PUZZLES,
  getStoredCustomPuzzles,
  saveCustomPuzzleToStorage,
  deleteCustomPuzzleFromStorage,
} from '../data/puzzles';

interface PuzzleViewProps {
  theme: BoardTheme;
  pieceCharMode: 'hanzi' | 'viet';
  onSetPieceCharMode: (mode: 'hanzi' | 'viet') => void;
  requestEngineMove: (fen: string, difficulty: 'grandmaster') => Promise<{ from: Pos; to: Pos } | null>;
  onNavigateToViewer: (fen: string) => void;
  showToast: (msg: string) => void;
  initialPuzzleFen?: string | null;
}

export const PuzzleView: React.FC<PuzzleViewProps> = ({
  theme,
  pieceCharMode,
  onSetPieceCharMode,
  requestEngineMove,
  onNavigateToViewer,
  showToast,
  initialPuzzleFen,
}) => {
  // Sub-tab: 'solve' (Danh sách thế cờ & giải) | 'create' (Tạo thế cờ / Xếp cờ)
  const [subTab, setSubTab] = useState<'solve' | 'create'>('solve');

  // Stored custom puzzles
  const [customPuzzles, setCustomPuzzles] = useState<PuzzleItem[]>(() => getStoredCustomPuzzles());

  // Category filter in solve mode
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Currently active puzzle being solved (null = in catalog/list view)
  const [activePuzzle, setActivePuzzle] = useState<PuzzleItem | null>(null);

  // Active puzzle gameplay state
  const [puzzleFenHistory, setPuzzleFenHistory] = useState<string[]>([INITIAL_FEN]);
  const [puzzleMoves, setPuzzleMoves] = useState<FormattedMove[]>([]);
  const [puzzleHintMove, setPuzzleHintMove] = useState<{ from: Pos; to: Pos } | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [puzzleStatus, setPuzzleStatus] = useState<{
    solved: boolean;
    failed: boolean;
    reason: string;
  }>({ solved: false, failed: false, reason: '' });

  // -------------------------------------------------------------
  // BOARD EDITOR ("Tạo thế") STATE
  // -------------------------------------------------------------
  const [editorBoard, setEditorBoard] = useState<Board>(() => {
    if (initialPuzzleFen) {
      try {
        return parseFen(initialPuzzleFen).board;
      } catch {
        return createEmptyBoard();
      }
    }
    return createEmptyBoard();
  });
  const [editorTurn, setEditorTurn] = useState<PieceColor>('r');
  const [selectedPalettePiece, setSelectedPalettePiece] = useState<{
    color: PieceColor;
    type: PieceType;
  } | null>({ color: 'r', type: 'k' });
  const [isEraserActive, setIsEraserActive] = useState(false);
  const [editorFlipped, setEditorFlipped] = useState(false);
  const [customTitleInput, setCustomTitleInput] = useState('');
  const [customGoalInput, setCustomGoalInput] = useState('Đỏ đi trước giành thắng thế');
  const [fenPasteInput, setFenPasteInput] = useState('');

  // Combine classic and custom puzzles
  const allPuzzles = useMemo(() => {
    return [...customPuzzles, ...CLASSIC_PUZZLES];
  }, [customPuzzles]);

  const filteredPuzzles = useMemo(() => {
    if (selectedCategory === 'all') return allPuzzles;
    if (selectedCategory === 'custom') return customPuzzles;
    return allPuzzles.filter((p) => p.category === selectedCategory);
  }, [allPuzzles, customPuzzles, selectedCategory]);

  // Current solving state derivations
  const currentPuzzleFen = puzzleFenHistory[puzzleFenHistory.length - 1];
  const { board: currentPuzzleBoard, turn: currentPuzzleTurn } = useMemo(() => {
    try {
      return parseFen(currentPuzzleFen);
    } catch {
      return parseFen(INITIAL_FEN);
    }
  }, [currentPuzzleFen]);

  const lastPuzzleMove =
    puzzleMoves.length > 0
      ? { from: puzzleMoves[puzzleMoves.length - 1].from, to: puzzleMoves[puzzleMoves.length - 1].to }
      : null;

  // Handle entering puzzle solving mode
  const startSolvingPuzzle = useCallback((puzzle: PuzzleItem) => {
    setActivePuzzle(puzzle);
    setPuzzleFenHistory([puzzle.fen]);
    setPuzzleMoves([]);
    setPuzzleHintMove(null);
    setAiThinking(false);
    setPuzzleStatus({ solved: false, failed: false, reason: '' });
    setSubTab('solve');
  }, []);

  // When initialPuzzleFen is provided on load
  useEffect(() => {
    if (initialPuzzleFen) {
      const matched = CLASSIC_PUZZLES.find((p) => p.fen === initialPuzzleFen);
      if (matched) {
        startSolvingPuzzle(matched);
      }
    }
  }, [initialPuzzleFen, startSolvingPuzzle]);

  // Execute user move in puzzle mode
  const handlePuzzleBoardMove = useCallback(
    async (from: Pos, to: Pos) => {
      if (aiThinking || puzzleStatus.solved || puzzleStatus.failed || !activePuzzle) return;
      if (currentPuzzleTurn !== 'r') return; // User plays Red

      try {
        const { nextBoard, move } = applyMove(currentPuzzleBoard, from, to);
        const formatted = formatMoveNotation(currentPuzzleBoard, move, 'r', pieceCharMode);
        const nextFen = boardToFen(nextBoard, 'b');

        // Play move sound
        if (move.captured) {
          sound.playCapture();
        } else {
          sound.playMove();
        }

        const nextFenList = [...puzzleFenHistory, nextFen];
        const nextMovesList = [...puzzleMoves, formatted];
        setPuzzleFenHistory(nextFenList);
        setPuzzleMoves(nextMovesList);
        setPuzzleHintMove(null);

        // Check if Black is checkmated or stalemated
        const postStatus = evaluateGameStatus(nextBoard, 'b', nextFenList, []);
        if (postStatus.isOver) {
          if (postStatus.winner === 'red') {
            sound.playGameEnd(true);
            setPuzzleStatus({
              solved: true,
              failed: false,
              reason: 'Xuất sắc! Bạn đã chiếu bí đối phương và phá giải thế cờ thành công!',
            });
            showToast('🎉 Chúc mừng bạn đã giải thành công thế cờ!');
            return;
          } else {
            sound.playGameEnd(false);
            setPuzzleStatus({
              solved: false,
              failed: true,
              reason: 'Thế cờ thất bại! Đen đã thủ hòa hoặc phản sát.',
            });
            return;
          }
        }

        // Opponent (Black) AI moves using Fairy-Stockfish at maximum Elo
        setAiThinking(true);
        const aiBest = await requestEngineMove(nextFen, 'grandmaster');
        setAiThinking(false);

        if (!aiBest) {
          // If AI has no legal move or engine resigned -> User wins!
          sound.playGameEnd(true);
          setPuzzleStatus({
            solved: true,
            failed: false,
            reason: 'Máy không còn nước đi khả dĩ. Bạn đã giải thành công!',
          });
          showToast('🎉 Chúc mừng bạn đã giải thành công thế cờ!');
          return;
        }

        // Apply AI move
        const { nextBoard: aiBoard, move: aiMoveObj } = applyMove(nextBoard, aiBest.from, aiBest.to);
        const aiFormatted = formatMoveNotation(nextBoard, aiMoveObj, 'b', pieceCharMode);
        const aiFen = boardToFen(aiBoard, 'r');

        if (aiMoveObj.captured) {
          sound.playCapture();
        } else {
          sound.playMove();
        }

        const afterAiFenList = [...nextFenList, aiFen];
        const afterAiMovesList = [...nextMovesList, aiFormatted];
        setPuzzleFenHistory(afterAiFenList);
        setPuzzleMoves(afterAiMovesList);

        // Check if Red was checkmated or stalemated by AI
        const finalStatus = evaluateGameStatus(aiBoard, 'r', afterAiFenList, []);
        if (finalStatus.isOver) {
          if (finalStatus.winner === 'black') {
            sound.playGameEnd(false);
            setPuzzleStatus({
              solved: false,
              failed: true,
              reason: 'Đối phương đã phản sát! Hãy bấm "Đi lại" hoặc "Đặt lại thế cờ" để thử phương án khác.',
            });
            showToast('Thế cờ thất bại! Hãy thử lại nước đi khác.');
          } else if (finalStatus.winner === 'draw') {
            setPuzzleStatus({
              solved: false,
              failed: true,
              reason: 'Ván cờ rơi vào thế hòa bất phân thắng bại.',
            });
          }
        }
      } catch (err) {
        console.error('Error applying puzzle move:', err);
      }
    },
    [
      aiThinking,
      puzzleStatus,
      activePuzzle,
      currentPuzzleTurn,
      currentPuzzleBoard,
      pieceCharMode,
      puzzleFenHistory,
      puzzleMoves,
      requestEngineMove,
      showToast,
    ]
  );

  // Undo move in puzzle mode (undoes 2 plies back to Red's turn)
  const handlePuzzleUndo = () => {
    if (aiThinking || puzzleFenHistory.length < 3) return;
    setPuzzleFenHistory((prev) => prev.slice(0, -2));
    setPuzzleMoves((prev) => prev.slice(0, -2));
    setPuzzleHintMove(null);
    setPuzzleStatus({ solved: false, failed: false, reason: '' });
    showToast('Đã đi lại nước cờ');
  };

  // Reset puzzle to initial FEN
  const handlePuzzleReset = () => {
    if (!activePuzzle) return;
    setPuzzleFenHistory([activePuzzle.fen]);
    setPuzzleMoves([]);
    setPuzzleHintMove(null);
    setAiThinking(false);
    setPuzzleStatus({ solved: false, failed: false, reason: '' });
    showToast('Đã đặt lại thế cờ ban đầu');
  };

  // Hint in puzzle mode
  const handlePuzzleHint = async () => {
    if (aiThinking || puzzleStatus.solved || puzzleStatus.failed || currentPuzzleTurn !== 'r') return;
    setAiThinking(true);
    const best = await requestEngineMove(currentPuzzleFen, 'grandmaster');
    setAiThinking(false);
    if (best) {
      setPuzzleHintMove(best);
      showToast('Đã hiển thị gợi ý nước đi tốt nhất của Fairy-Stockfish');
    } else {
      showToast('Không tìm thấy gợi ý cho thế cờ này');
    }
  };

  // Next puzzle in list
  const handleNextPuzzle = () => {
    if (!activePuzzle) return;
    const currentIndex = filteredPuzzles.findIndex((p) => p.id === activePuzzle.id);
    if (currentIndex >= 0 && currentIndex < filteredPuzzles.length - 1) {
      startSolvingPuzzle(filteredPuzzles[currentIndex + 1]);
    } else if (filteredPuzzles.length > 0) {
      startSolvingPuzzle(filteredPuzzles[0]);
    }
  };

  // -------------------------------------------------------------
  // BOARD EDITOR ("Tạo thế") LOGIC
  // -------------------------------------------------------------
  const editorFen = useMemo(() => {
    return boardToFen(editorBoard, editorTurn);
  }, [editorBoard, editorTurn]);

  // Validation details
  const editorValidation = useMemo(() => {
    const redKing = findGeneral(editorBoard, 'r');
    const blackKing = findGeneral(editorBoard, 'b');

    const hasRedKing = Boolean(redKing && inPalace('r', redKing.row, redKing.col));
    const hasBlackKing = Boolean(blackKing && inPalace('b', blackKing.row, blackKing.col));
    const generalsFacing = areGeneralsFacing(editorBoard);

    let redPieceCount = 0;
    let blackPieceCount = 0;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = editorBoard[r][c];
        if (p) {
          if (p.color === 'r') redPieceCount++;
          else blackPieceCount++;
        }
      }
    }

    const isValid = hasRedKing && hasBlackKing && !generalsFacing;
    return {
      isValid,
      hasRedKing,
      hasBlackKing,
      generalsFacing,
      redPieceCount,
      blackPieceCount,
    };
  }, [editorBoard]);

  // Click square on editor board
  const handleEditorSquareClick = (row: number, col: number) => {
    const next = cloneBoard(editorBoard);
    if (isEraserActive) {
      next[row][col] = null;
      sound.playMove();
    } else if (selectedPalettePiece) {
      next[row][col] = {
        color: selectedPalettePiece.color,
        type: selectedPalettePiece.type,
      };
      sound.playMove();
    } else {
      // Toggle / remove if clicking existing piece
      next[row][col] = null;
    }
    setEditorBoard(next);
  };

  // Clear board
  const handleClearEditorBoard = () => {
    setEditorBoard(createEmptyBoard());
    sound.playMove();
    showToast('Đã dọn sạch bàn cờ');
  };

  // Reset to standard starting board
  const handleResetStandardBoard = () => {
    setEditorBoard(parseFen(INITIAL_FEN).board);
    setEditorTurn('r');
    sound.playMove();
    showToast('Đã xếp bàn cờ tiêu chuẩn ban đầu');
  };

  // Paste / Load FEN
  const handleLoadPastedFen = () => {
    const target = (fenPasteInput || '').trim();
    if (!target) {
      showToast('Vui lòng nhập chuỗi FEN cần nạp');
      return;
    }
    try {
      const parsed = parseFen(target);
      setEditorBoard(parsed.board);
      setEditorTurn(parsed.turn);
      showToast('Nạp thế cờ từ FEN thành công!');
    } catch {
      showToast('Chuỗi FEN không hợp lệ, vui lòng kiểm tra lại');
    }
  };

  // Launch directly into solving against Fairy-Stockfish from custom board
  const handlePlayCreatedPuzzle = () => {
    if (!editorValidation.isValid) {
      showToast('Vui lòng đảm bảo bàn cờ có đủ 1 Tướng Đỏ và 1 Tướng Đen hợp lệ trong cung');
      return;
    }
    const tempPuzzle: PuzzleItem = {
      id: `custom-play-${Date.now()}`,
      title: customTitleInput.trim() || 'Thế cờ tự tạo',
      category: 'classic',
      categoryLabel: 'Thế cờ tự tạo',
      difficulty: 'Trung cấp',
      turn: editorTurn,
      fen: editorFen,
      goal: customGoalInput.trim() || 'Đỏ đi trước giành thắng thế',
      description: 'Thế cờ do người chơi tự xếp và thử nghiệm kỳ lực với Fairy-Stockfish.',
      hint: 'Vận dụng tính toán cẩn thận từng nước để phá thế.',
    };
    startSolvingPuzzle(tempPuzzle);
    showToast('Đã chuyển sang chế độ Giải Thế Với Máy');
  };

  // Save to stored custom puzzles
  const handleSaveCustomPuzzle = () => {
    if (!editorValidation.isValid) {
      showToast('Vui lòng xếp đủ Tướng Đỏ và Tướng Đen hợp lệ trước khi lưu');
      return;
    }
    const title = customTitleInput.trim() || `Thế cờ #${customPuzzles.length + 1}`;
    const newPuzzle: PuzzleItem = {
      id: `puzzle-${Date.now()}`,
      title,
      category: 'classic',
      categoryLabel: 'Thế cờ của tôi',
      difficulty: 'Trung cấp',
      turn: editorTurn,
      fen: editorFen,
      goal: customGoalInput.trim() || 'Đỏ đi trước giành thắng thế',
      description: 'Thế cờ được biên soạn và lưu trữ trong bộ sưu tập cá nhân.',
      hint: 'Tính toán các đòn công thủ chính xác.',
    };
    const updated = saveCustomPuzzleToStorage(newPuzzle);
    setCustomPuzzles(updated);
    showToast(`Đã lưu thế cờ "${title}" vào kho của bạn!`);
  };

  // Delete custom puzzle
  const handleDeleteCustomPuzzle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteCustomPuzzleFromStorage(id);
    setCustomPuzzles(updated);
    if (activePuzzle?.id === id) {
      setActivePuzzle(null);
    }
    showToast('Đã xóa thế cờ khỏi bộ sưu tập');
  };

  // PALETTE PIECES LIST
  const RED_PALETTE_PIECES: PieceType[] = ['k', 'a', 'e', 'r', 'h', 'c', 'p'];
  const BLACK_PALETTE_PIECES: PieceType[] = ['k', 'a', 'e', 'r', 'h', 'c', 'p'];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 py-2">
      {/* TOP HEADER & SUB-MODE SELECTOR */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-stone-900 shadow-2xl p-5 sm:p-6">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-15 pointer-events-none"
          style={{ backgroundImage: `url('/images/ranked_arena_gate.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/90 to-stone-900/80 pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
              <Puzzle className="w-3.5 h-3.5" />
              <span>Cờ Thế & Tàn Cuộc Nghệ Thuật</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-stone-100 flex items-center gap-2.5">
              <span>Kho Cờ Thế & Biên Soạn Thế Cờ</span>
            </h1>
            <p className="text-xs text-stone-400">
              Giải các danh cục giang hồ, sát pháp kinh điển hoặc tự tạo thế cờ để thách đấu Fairy-Stockfish WASM Max Elo.
            </p>
          </div>

          {/* Sub-tab Switcher: Giải thế / Tạo thế */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-stone-950 border border-stone-800 self-start sm:self-center shrink-0">
            <button
              onClick={() => {
                setSubTab('solve');
              }}
              className={`min-h-[44px] px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                subTab === 'solve'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Swords className="w-4 h-4" />
              <span>Giải Thế Cờ ({allPuzzles.length})</span>
            </button>
            <button
              onClick={() => {
                setSubTab('create');
                setActivePuzzle(null);
              }}
              className={`min-h-[44px] px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                subTab === 'create'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tạo Thế Cờ Mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: GIẢI THẾ (SOLVE PUZZLE) */}
      {/* ========================================================================= */}
      {subTab === 'solve' && (
        <>
          {activePuzzle ? (
            /* ACTIVE PUZZLE SOLVING BOARD VIEW */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left/Center Column: Board & Primary Controls */}
              <div className="lg:col-span-7 flex flex-col items-center justify-center w-full space-y-3">
                {/* Puzzle Header Bar */}
                <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-stone-900 border border-stone-800">
                  <button
                    onClick={() => setActivePuzzle(null)}
                    className="min-h-[44px] px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 text-amber-400" />
                    <span>Danh sách thế cờ</span>
                  </button>

                  <div className="text-right">
                    <div className="text-sm font-bold text-amber-300 truncate max-w-[200px] sm:max-w-xs">
                      {activePuzzle.title}
                    </div>
                    <div className="text-[11px] text-stone-400">{activePuzzle.goal}</div>
                  </div>
                </div>

                {/* Solving Status Alert */}
                {puzzleStatus.solved && (
                  <div className="w-full p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/80 text-emerald-200 text-xs flex items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-2.5">
                      <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <div className="font-bold text-emerald-300">THẮNG LỢI XUẤT SẮC!</div>
                        <div>{puzzleStatus.reason}</div>
                      </div>
                    </div>
                    <button
                      onClick={handleNextPuzzle}
                      className="min-h-[44px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 transition-colors"
                    >
                      Thế tiếp theo
                    </button>
                  </div>
                )}

                {puzzleStatus.failed && (
                  <div className="w-full p-3.5 rounded-2xl bg-red-950/80 border border-red-500/80 text-red-200 text-xs flex items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                      <div>
                        <div className="font-bold text-red-300">CHƯA PHÁ ĐƯỢC THẾ CỜ</div>
                        <div>{puzzleStatus.reason}</div>
                      </div>
                    </div>
                    <button
                      onClick={handlePuzzleReset}
                      className="min-h-[44px] px-3.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs shrink-0 transition-colors"
                    >
                      Thử lại
                    </button>
                  </div>
                )}

                {/* The Interactive Xiangqi Board */}
                <XiangqiBoard
                  board={currentPuzzleBoard}
                  turn={currentPuzzleTurn}
                  theme={theme}
                  pieceCharMode={pieceCharMode}
                  flipped={false}
                  interactive={!puzzleStatus.solved && !puzzleStatus.failed && !aiThinking}
                  allowedColor="r"
                  lastMove={lastPuzzleMove}
                  hintMove={puzzleHintMove}
                  onMove={handlePuzzleBoardMove}
                />

                {/* Action Bar (Touch targets >= 44px) */}
                <div className="w-full flex flex-wrap items-center justify-center gap-2 bg-stone-900/90 border border-stone-800 rounded-2xl p-2 shadow-lg">
                  <button
                    onClick={handlePuzzleReset}
                    title="Đặt lại thế cờ ban đầu"
                    className="min-h-[44px] px-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Đặt lại thế</span>
                  </button>

                  <button
                    onClick={handlePuzzleUndo}
                    disabled={puzzleFenHistory.length < 3 || aiThinking}
                    title="Đi lại nước trước"
                    className="min-h-[44px] px-3.5 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Đi lại</span>
                  </button>

                  <button
                    onClick={handlePuzzleHint}
                    disabled={puzzleStatus.solved || puzzleStatus.failed || aiThinking}
                    title="Gợi ý từ Fairy-Stockfish"
                    className="min-h-[44px] px-3.5 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-amber-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>Gợi ý AI</span>
                  </button>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentPuzzleFen);
                      showToast('Đã sao chép FEN thế cờ');
                    }}
                    title="Sao chép chuỗi FEN"
                    className="min-h-[44px] px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>FEN</span>
                  </button>

                  <button
                    onClick={() => onNavigateToViewer(currentPuzzleFen)}
                    title="Chuyển sang phân tích chuyên sâu trong Ký phổ"
                    className="min-h-[44px] px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Phân tích</span>
                  </button>

                  <button
                    onClick={handleNextPuzzle}
                    title="Chuyển sang thế cờ tiếp theo"
                    className="min-h-[44px] px-3.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors ml-auto"
                  >
                    <span>Thế kế tiếp</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Right Column: Puzzle Details & Move List */}
              <div className="lg:col-span-5 space-y-4">
                {/* Puzzle Information Box */}
                <div className="rounded-2xl bg-stone-900 border border-stone-800 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Mục Tiêu Thế Cờ
                    </span>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                      {activePuzzle.difficulty}
                    </span>
                  </div>

                  <p className="text-xs text-stone-300 leading-relaxed">
                    {activePuzzle.description}
                  </p>

                  <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-xs text-amber-200/90 space-y-1">
                    <div className="font-semibold text-amber-300">Gợi ý chiến thuật:</div>
                    <div>{activePuzzle.hint}</div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-stone-800/80 text-xs">
                    <span className="text-stone-400">Kiểu chữ cờ:</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onSetPieceCharMode('hanzi')}
                        className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors ${
                          pieceCharMode === 'hanzi'
                            ? 'bg-amber-600 text-white'
                            : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        Chữ Hán
                      </button>
                      <button
                        onClick={() => onSetPieceCharMode('viet')}
                        className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors ${
                          pieceCharMode === 'viet'
                            ? 'bg-amber-600 text-white'
                            : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        Chữ Việt
                      </button>
                    </div>
                  </div>
                </div>

                {/* Move List Replay */}
                <div className="rounded-2xl bg-stone-900 border border-stone-800 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
                    <span className="text-xs font-bold text-stone-200 uppercase tracking-wider">
                      Diễn Biến Nước Đi ({puzzleMoves.length})
                    </span>
                    {aiThinking && (
                      <span className="text-[11px] text-amber-400 animate-pulse font-semibold">
                        Fairy-Stockfish đang tính...
                      </span>
                    )}
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1 font-mono-num text-xs">
                    {puzzleMoves.length === 0 ? (
                      <div className="text-stone-500 italic text-center py-4">
                        Chưa có nước đi nào. Bạn cầm quân Đỏ đi trước!
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        {Array.from({ length: Math.ceil(puzzleMoves.length / 2) }).map((_, idx) => {
                          const mRed = puzzleMoves[idx * 2];
                          const mBlack = puzzleMoves[idx * 2 + 1];
                          return (
                            <React.Fragment key={idx}>
                              <div className="p-2 rounded-lg bg-stone-950 border border-stone-800/80 flex items-center justify-between">
                                <span className="text-stone-500 font-bold">{idx + 1}.</span>
                                <span className="text-red-400 font-semibold">{mRed?.wxf}</span>
                              </div>
                              <div className="p-2 rounded-lg bg-stone-950 border border-stone-800/80 flex items-center justify-between">
                                <span className="text-stone-500 font-bold">{idx + 1}...</span>
                                <span className="text-stone-300 font-semibold">{mBlack?.wxf || '—'}</span>
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* PUZZLE CATALOG / SELECTION GRID */
            <div className="space-y-4">
              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'all', label: 'Tất cả thế cờ', count: allPuzzles.length },
                  {
                    id: 'tactics',
                    label: 'Sát pháp kinh điển',
                    count: allPuzzles.filter((p) => p.category === 'tactics').length,
                  },
                  {
                    id: 'endgame',
                    label: 'Tàn cuộc thực chiến',
                    count: allPuzzles.filter((p) => p.category === 'endgame').length,
                  },
                  {
                    id: 'classic',
                    label: 'Danh cục giang hồ',
                    count: allPuzzles.filter((p) => p.category === 'classic').length,
                  },
                  ...(customPuzzles.length > 0
                    ? [{ id: 'custom', label: 'Thế cờ của tôi', count: customPuzzles.length }]
                    : []),
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      selectedCategory === cat.id
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-800/80 text-stone-300">
                      {cat.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Grid of Puzzle Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPuzzles.map((p) => {
                  const isCustom = p.id.startsWith('puzzle-');
                  return (
                    <div
                      key={p.id}
                      className="group p-5 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-amber-500/50 hover:bg-stone-900 transition-all flex flex-col justify-between space-y-4 shadow-lg hover:shadow-amber-500/5 relative overflow-hidden"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                            {p.categoryLabel}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-stone-800 text-stone-400 font-mono-num font-semibold">
                              {p.difficulty}
                            </span>
                            {isCustom && (
                              <button
                                onClick={(e) => handleDeleteCustomPuzzle(p.id, e)}
                                title="Xóa thế cờ này"
                                className="p-1 rounded text-stone-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <h3 className="text-base font-bold text-stone-100 group-hover:text-amber-300 transition-colors line-clamp-1">
                          {p.title}
                        </h3>
                        {p.subtitle && (
                          <div className="text-xs text-amber-400/90 font-medium line-clamp-1">
                            {p.subtitle}
                          </div>
                        )}
                        <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-stone-800 flex items-center justify-between">
                        <div className="text-[11px] text-stone-500 font-medium">
                          🎯 {p.goal}
                        </div>
                        <button
                          onClick={() => startSolvingPuzzle(p)}
                          className="min-h-[40px] px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Vào giải</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: TẠO THẾ CỜ (BOARD EDITOR) */}
      {/* ========================================================================= */}
      {subTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Interactive Placement Board */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center w-full space-y-3">
            {/* Quick Action Top Bar */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-stone-900 border border-stone-800">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleClearEditorBoard}
                  className="min-h-[40px] px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-stone-400" />
                  <span>Dọn sạch</span>
                </button>
                <button
                  onClick={handleResetStandardBoard}
                  className="min-h-[40px] px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-stone-400" />
                  <span>Xếp cờ chuẩn</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditorTurn((t) => (t === 'r' ? 'b' : 'r'))}
                  className={`min-h-[40px] px-3 rounded-xl font-bold text-xs border transition-colors flex items-center gap-1.5 ${
                    editorTurn === 'r'
                      ? 'bg-red-950/70 border-red-500/80 text-red-300'
                      : 'bg-stone-800 border-stone-700 text-stone-200'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      editorTurn === 'r' ? 'bg-red-500' : 'bg-stone-400'
                    }`}
                  />
                  <span>Lượt đi: {editorTurn === 'r' ? 'Quân Đỏ' : 'Quân Đen'}</span>
                </button>

                <button
                  onClick={() => setEditorFlipped((f) => !f)}
                  className="min-h-[40px] px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <span>Xoay bàn</span>
                </button>
              </div>
            </div>

            {/* Custom Interactive 10x9 Placement Board */}
            <div className="relative p-2 sm:p-4 rounded-3xl bg-stone-900 border-2 border-stone-800 shadow-2xl overflow-hidden max-w-[480px] w-full">
              {/* Xiangqi Board SVG with interactive click intersections */}
              <div className="relative aspect-[9/10] w-full select-none">
                {/* Board Graphic Display using XiangqiBoard (non-interactive pure board display) */}
                <XiangqiBoard
                  board={editorBoard}
                  turn={editorTurn}
                  theme={theme}
                  pieceCharMode={pieceCharMode}
                  flipped={editorFlipped}
                  interactive={false}
                  onMove={() => {}}
                />

                {/* Invisible 10x9 Click Layer Overlay for Piece Placement */}
                <div className="absolute inset-0 grid grid-rows-10 grid-cols-9 z-30">
                  {Array.from({ length: 10 }).map((_, rIdx) => {
                    const row = editorFlipped ? 9 - rIdx : rIdx;
                    return Array.from({ length: 9 }).map((_, cIdx) => {
                      const col = editorFlipped ? 8 - cIdx : cIdx;
                      return (
                        <div
                          key={`${row}-${col}`}
                          onClick={() => handleEditorSquareClick(row, col)}
                          title={`Ô (${row}, ${col}) - Bấm để đặt hoặc xóa quân`}
                          className="w-full h-full cursor-pointer hover:bg-amber-400/20 active:bg-amber-500/30 transition-colors rounded-full"
                        />
                      );
                    });
                  })}
                </div>
              </div>
            </div>

            {/* Editor Bottom Actions */}
            <div className="w-full flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-stone-900 border border-stone-800">
              <div className="text-xs text-stone-400 flex items-center gap-2">
                <span>Quân trên bàn:</span>
                <span className="text-red-400 font-bold">Đỏ ({editorValidation.redPieceCount})</span>
                <span>·</span>
                <span className="text-stone-300 font-bold">Đen ({editorValidation.blackPieceCount})</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveCustomPuzzle}
                  disabled={!editorValidation.isValid}
                  className="min-h-[44px] px-4 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Lưu thế cờ</span>
                </button>

                <button
                  onClick={handlePlayCreatedPuzzle}
                  disabled={!editorValidation.isValid}
                  className="min-h-[44px] px-5 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-red-600 hover:from-amber-500 hover:to-red-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-amber-600/30 transition-all flex items-center gap-2"
                >
                  <Swords className="w-4 h-4" />
                  <span>Giải với máy ngay</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Piece Palette, FEN controls, and Validation */}
          <div className="lg:col-span-5 space-y-4">
            {/* Piece Palette Box */}
            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
                <span className="text-xs font-bold text-stone-200 uppercase tracking-wider">
                  Hộp Quân Cờ Để Đặt
                </span>
                <span className="text-[11px] text-amber-400">
                  {isEraserActive
                    ? 'Đang bật: Xóa quân'
                    : selectedPalettePiece
                    ? `Đang chọn: ${
                        selectedPalettePiece.color === 'r' ? 'Đỏ' : 'Đen'
                      } ${
                        pieceCharMode === 'viet'
                          ? PIECE_NAMES_VIET[selectedPalettePiece.type]
                          : PIECE_NAMES_HANZI[selectedPalettePiece.color][selectedPalettePiece.type]
                      }`
                    : 'Bấm ô để gỡ quân'}
                </span>
              </div>

              {/* Red Pieces Palette */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-red-400">Quân Đỏ (Tiên):</div>
                <div className="flex flex-wrap gap-2">
                  {RED_PALETTE_PIECES.map((type) => {
                    const active =
                      !isEraserActive &&
                      selectedPalettePiece?.color === 'r' &&
                      selectedPalettePiece?.type === type;
                    const label =
                      pieceCharMode === 'viet'
                        ? PIECE_NAMES_VIET[type]
                        : PIECE_NAMES_HANZI.r[type];
                    return (
                      <button
                        key={`r-${type}`}
                        onClick={() => {
                          setIsEraserActive(false);
                          setSelectedPalettePiece({ color: 'r', type });
                        }}
                        className={`w-11 h-11 rounded-full font-bold text-base border-2 transition-all flex items-center justify-center shadow-md ${
                          active
                            ? 'bg-red-600 border-white text-white ring-2 ring-amber-400 scale-105'
                            : 'bg-red-950/80 border-red-500/60 text-red-300 hover:scale-105'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Black Pieces Palette */}
              <div className="space-y-1.5 pt-2 border-t border-stone-800">
                <div className="text-[11px] font-bold text-stone-400">Quân Đen (Hậu):</div>
                <div className="flex flex-wrap gap-2">
                  {BLACK_PALETTE_PIECES.map((type) => {
                    const active =
                      !isEraserActive &&
                      selectedPalettePiece?.color === 'b' &&
                      selectedPalettePiece?.type === type;
                    const label =
                      pieceCharMode === 'viet'
                        ? PIECE_NAMES_VIET[type]
                        : PIECE_NAMES_HANZI.b[type];
                    return (
                      <button
                        key={`b-${type}`}
                        onClick={() => {
                          setIsEraserActive(false);
                          setSelectedPalettePiece({ color: 'b', type });
                        }}
                        className={`w-11 h-11 rounded-full font-bold text-base border-2 transition-all flex items-center justify-center shadow-md ${
                          active
                            ? 'bg-stone-800 border-amber-400 text-amber-300 ring-2 ring-amber-400 scale-105'
                            : 'bg-stone-950 border-stone-700 text-stone-300 hover:scale-105'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Eraser Tool */}
              <div className="pt-2 border-t border-stone-800 flex items-center justify-between">
                <button
                  onClick={() => {
                    setIsEraserActive(true);
                    setSelectedPalettePiece(null);
                  }}
                  className={`min-h-[44px] px-4 rounded-xl border font-bold text-xs transition-all flex items-center gap-2 ${
                    isEraserActive
                      ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                      : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Công cụ xóa quân (Erase)</span>
                </button>

                <div className="text-[11px] text-stone-500">
                  Mẹo: Bấm vào ô trên bàn để đặt hoặc xóa
                </div>
              </div>
            </div>

            {/* Position Validation Box */}
            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-4 space-y-2.5">
              <span className="text-xs font-bold text-stone-200 uppercase tracking-wider block border-b border-stone-800 pb-2">
                Kiểm Tra Tính Hợp Lệ Của Thế Cờ
              </span>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  {editorValidation.hasRedKing ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <span className={editorValidation.hasRedKing ? 'text-stone-300' : 'text-amber-300'}>
                    Tướng Đỏ: {editorValidation.hasRedKing ? 'Hợp lệ trong cung' : 'Thiếu hoặc nằm ngoài cung'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {editorValidation.hasBlackKing ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <span className={editorValidation.hasBlackKing ? 'text-stone-300' : 'text-amber-300'}>
                    Tướng Đen: {editorValidation.hasBlackKing ? 'Hợp lệ trong cung' : 'Thiếu hoặc nằm ngoài cung'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {!editorValidation.generalsFacing ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span className={!editorValidation.generalsFacing ? 'text-stone-300' : 'text-red-400'}>
                    Mặt Tướng: {!editorValidation.generalsFacing ? 'Không bị lộ' : 'Hai Tướng đang nhìn mặt nhau trực tiếp!'}
                  </span>
                </div>
              </div>

              {editorValidation.isValid ? (
                <div className="mt-2 p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Thế cờ hoàn toàn hợp lệ để thi đấu và lưu trữ.</span>
                </div>
              ) : (
                <div className="mt-2 p-2 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Vui lòng điều chỉnh để bàn cờ hợp lệ trước khi bắt đầu.</span>
                </div>
              )}
            </div>

            {/* Custom Puzzle Info (Title & Goal) */}
            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-4 space-y-3">
              <span className="text-xs font-bold text-stone-200 uppercase tracking-wider block border-b border-stone-800 pb-2">
                Thông Tin Thế Cờ
              </span>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-stone-400 block mb-1">Tên thế cờ:</label>
                  <input
                    type="text"
                    value={customTitleInput}
                    onChange={(e) => setCustomTitleInput(e.target.value)}
                    placeholder="Ví dụ: Đơn Xe Khéo Thắng Song Mã..."
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-stone-400 block mb-1">Mục tiêu giải:</label>
                  <input
                    type="text"
                    value={customGoalInput}
                    onChange={(e) => setCustomGoalInput(e.target.value)}
                    placeholder="Ví dụ: Đỏ đi trước sát cục trong 5 nước..."
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* FEN String Import & Export */}
            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                <span className="text-xs font-bold text-stone-200 uppercase tracking-wider">
                  FEN Thế Cờ
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(editorFen);
                    showToast('Đã sao chép FEN vào clipboard');
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép FEN</span>
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 font-mono-num text-[11px] text-stone-300 break-all select-all">
                {editorFen}
              </div>

              <div className="pt-2 border-t border-stone-800/80 space-y-2">
                <div className="text-[11px] text-stone-400">Nạp thế cờ từ FEN ngoài:</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={fenPasteInput}
                    onChange={(e) => setFenPasteInput(e.target.value)}
                    placeholder="Dán chuỗi FEN vào đây..."
                    className="flex-1 px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs font-mono-num placeholder-stone-600 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={handleLoadPastedFen}
                    className="min-h-[40px] px-3.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold shrink-0 transition-colors"
                  >
                    Nạp FEN
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
