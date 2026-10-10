import React, { useState } from 'react';
import {
  Board,
  Pos,
  PieceColor,
  PIECE_NAMES_HANZI,
  PIECE_NAMES_VIET,
  getLegalMovesForSquare,
  isKingInCheck,
  findGeneral,
} from '../shared/xiangqi';
import { BoardTheme } from '../utils/themes';
import { sound } from '../utils/sound';

interface XiangqiBoardProps {
  board: Board;
  turn: PieceColor;
  theme: BoardTheme;
  pieceCharMode: 'hanzi' | 'viet';
  flipped?: boolean;
  interactive?: boolean;
  allowedColor?: PieceColor | 'both';
  isDarkXiangqi?: boolean;
  lastMove?: { from: Pos; to: Pos } | null;
  hintMove?: { from: Pos; to: Pos } | null;
  onMove: (from: Pos, to: Pos) => void;
}

const FIDUCIAL_POSITIONS: [number, number][] = [
  [2, 1],
  [2, 7],
  [7, 1],
  [7, 7],
  [3, 0],
  [3, 2],
  [3, 4],
  [3, 6],
  [3, 8],
  [6, 0],
  [6, 2],
  [6, 4],
  [6, 6],
  [6, 8],
];

export const XiangqiBoard: React.FC<XiangqiBoardProps> = ({
  board,
  turn,
  theme,
  pieceCharMode,
  flipped = false,
  interactive = true,
  allowedColor = 'both',
  isDarkXiangqi = false,
  lastMove,
  hintMove,
  onMove,
}) => {
  const [selectedPos, setSelectedPos] = useState<Pos | null>(null);
  const [dragFrom, setDragFrom] = useState<Pos | null>(null);

  const canControlColor = (color: PieceColor) => {
    if (!interactive) return false;
    if (color !== turn) return false;
    if (allowedColor === 'both') return true;
    return allowedColor === color;
  };

  const activeOrigin = selectedPos || dragFrom;
  const legalTargets: Pos[] = activeOrigin
    ? getLegalMovesForSquare(board, activeOrigin, isDarkXiangqi)
    : [];

  const isTargetLegal = (r: number, c: number) =>
    legalTargets.some((t) => t.row === r && t.col === c);

  const redInCheck = isKingInCheck(board, 'r', isDarkXiangqi);
  const blackInCheck = isKingInCheck(board, 'b', isDarkXiangqi);
  const redKingPos = redInCheck ? findGeneral(board, 'r') : null;
  const blackKingPos = blackInCheck ? findGeneral(board, 'b') : null;

  const handleSquareClick = (r: number, c: number) => {
    if (!interactive) return;

    if (selectedPos) {
      if (selectedPos.row === r && selectedPos.col === c) {
        setSelectedPos(null);
        return;
      }
      if (isTargetLegal(r, c)) {
        const from = selectedPos;
        setSelectedPos(null);
        onMove(from, { row: r, col: c });
        return;
      }
    }

    const piece = board[r][c];
    if (piece && canControlColor(piece.color)) {
      sound.playSelect();
      setSelectedPos({ row: r, col: c });
    } else {
      setSelectedPos(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, r: number, c: number) => {
    const piece = board[r][c];
    if (!piece || !canControlColor(piece.color)) {
      e.preventDefault();
      return;
    }
    sound.playSelect();
    setSelectedPos({ row: r, col: c });
    setDragFrom({ row: r, col: c });
    e.dataTransfer.setData('text/plain', `${r},${c}`);
  };

  const handleDrop = (e: React.DragEvent, r: number, c: number) => {
    e.preventDefault();
    const origin = dragFrom || selectedPos;
    setDragFrom(null);
    if (!origin) return;
    const targets = getLegalMovesForSquare(board, origin, isDarkXiangqi);
    if (targets.some((t) => t.row === r && t.col === c)) {
      setSelectedPos(null);
      onMove(origin, { row: r, col: c });
    }
  };

  // Map logical (row, col) to display grid (0..9, 0..8)
  const toDisplay = (row: number, col: number) => ({
    dRow: flipped ? 9 - row : row,
    dCol: flipped ? 8 - col : col,
  });

  // Render fiducial L-marks around cannon/soldier points
  const renderFiducialMark = (r: number, c: number) => {
    const x = c * 100;
    const y = r * 100;
    const g = 8; // gap from intersection
    const l = 18; // arm length
    const segments: string[] = [];

    if (c > 0) {
      // Top-left & Bottom-left L ticks
      segments.push(`M ${x - g - l} ${y - g} L ${x - g} ${y - g} L ${x - g} ${y - g - l}`);
      segments.push(`M ${x - g - l} ${y + g} L ${x - g} ${y + g} L ${x - g} ${y + g + l}`);
    }
    if (c < 8) {
      // Top-right & Bottom-right L ticks
      segments.push(`M ${x + g + l} ${y - g} L ${x + g} ${y - g} L ${x + g} ${y - g - l}`);
      segments.push(`M ${x + g + l} ${y + g} L ${x + g} ${y + g} L ${x + g} ${y + g + l}`);
    }

    return (
      <path
        key={`fid_${r}_${c}`}
        d={segments.join(' ')}
        stroke={theme.gridLine}
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
    );
  };

  return (
    <div
      className={`relative aspect-square w-full max-w-[min(86vw,74vh)] select-none rounded-2xl p-2 sm:p-3.5 shadow-2xl transition-colors duration-200 flex items-center justify-center ${
        redInCheck || blackInCheck ? 'animate-check-shake' : ''
      }`}
      style={{
        backgroundColor: theme.boardBg,
        border: `3px solid ${theme.boardBorder}`,
        boxShadow: '0 20px 45px -15px rgba(0, 0, 0, 0.55), inset 0 1px 2px rgba(255,255,255,0.2)',
      }}
    >
      {/* Inner 9:10 Board Proportional Frame */}
      <div className="relative h-full aspect-[9/10] max-w-full flex items-center justify-center">
        {/* SVG Traditional Xiangqi Grid */}
        <svg
          viewBox="-55 -55 910 1010"
          className="w-full h-full pointer-events-none"
          aria-label="Bàn cờ tướng"
        >
          {/* Outer decorative frame */}
          <rect
            x="-14"
            y="-14"
            width="828"
            height="928"
            fill="none"
            stroke={theme.gridLine}
            strokeWidth="6"
            rx="4"
          />
          <rect
            x="0"
            y="0"
            width="800"
            height="900"
            fill="none"
            stroke={theme.gridLine}
            strokeWidth="3.5"
          />

          {/* 10 Horizontal Rank Lines */}
          {Array.from({ length: 10 }, (_, r) => (
            <line
              key={`h_${r}`}
              x1="0"
              y1={r * 100}
              x2="800"
              y2={r * 100}
              stroke={theme.gridLine}
              strokeWidth="3"
            />
          ))}

          {/* 9 Vertical File Lines (split across the River except outer files 0 and 8) */}
          {Array.from({ length: 9 }, (_, c) =>
            c === 0 || c === 8 ? (
              <line
                key={`v_${c}`}
                x1={c * 100}
                y1="0"
                x2={c * 100}
                y2="900"
                stroke={theme.gridLine}
                strokeWidth="3.5"
              />
            ) : (
              <g key={`v_${c}`}>
                <line
                  x1={c * 100}
                  y1="0"
                  x2={c * 100}
                  y2="400"
                  stroke={theme.gridLine}
                  strokeWidth="3"
                />
                <line
                  x1={c * 100}
                  y1="500"
                  x2={c * 100}
                  y2="900"
                  stroke={theme.gridLine}
                  strokeWidth="3"
                />
              </g>
            )
          )}

          {/* Top & Bottom Palace Diagonals (Cửu cung) */}
          <line x1="300" y1="0" x2="500" y2="200" stroke={theme.gridLine} strokeWidth="3" />
          <line x1="500" y1="0" x2="300" y2="200" stroke={theme.gridLine} strokeWidth="3" />
          <line x1="300" y1="700" x2="500" y2="900" stroke={theme.gridLine} strokeWidth="3" />
          <line x1="500" y1="700" x2="300" y2="900" stroke={theme.gridLine} strokeWidth="3" />

          {/* Cannon & Soldier Fiducial Marks */}
          {FIDUCIAL_POSITIONS.map(([r, c]) => renderFiducialMark(r, c))}

          {/* River Calligraphy: 楚河 漢界 */}
          <text
            x="200"
            y="466"
            textAnchor="middle"
            fill={theme.riverText}
            className="font-hanzi font-bold tracking-[0.35em]"
            fontSize="46"
            opacity="0.85"
          >
            楚河
          </text>
          <text
            x="600"
            y="466"
            textAnchor="middle"
            fill={theme.riverText}
            className="font-hanzi font-bold tracking-[0.35em]"
            fontSize="46"
            opacity="0.85"
          >
            漢界
          </text>
        </svg>

        {/* Interactive 10x9 Grid Overlay (Touch targets >= 44px) */}
        <div
          className="absolute inset-0 grid grid-rows-10 grid-cols-9"
          style={{
            padding: '0.5%',
          }}
        >
          {Array.from({ length: 10 }, (_, dRow) =>
            Array.from({ length: 9 }, (_, dCol) => {
              const row = flipped ? 9 - dRow : dRow;
              const col = flipped ? 8 - dCol : dCol;
              const piece = board[row][col];
              const isSelected =
                selectedPos?.row === row && selectedPos?.col === col;
              const isLegal = isTargetLegal(row, col);
              const isLastFrom =
                lastMove?.from.row === row && lastMove?.from.col === col;
              const isLastTo =
                lastMove?.to.row === row && lastMove?.to.col === col;
              const isHintFrom =
                hintMove?.from.row === row && hintMove?.from.col === col;
              const isHintTo =
                hintMove?.to.row === row && hintMove?.to.col === col;
              const isKingCheckedHere =
                (redKingPos?.row === row && redKingPos?.col === col) ||
                (blackKingPos?.row === row && blackKingPos?.col === col);

              const isRed = piece?.color === 'r';
              const pieceBg = isRed ? theme.pieceRedBg : theme.pieceBlackBg;
              const pieceBorder = isRed ? theme.pieceRedBorder : theme.pieceBlackBorder;
              const pieceText = isRed ? theme.pieceRedText : theme.pieceBlackText;

              let label = '';
              if (piece) {
                if (piece.isHidden) {
                  label = '暗';
                } else if (pieceCharMode === 'hanzi') {
                  label = PIECE_NAMES_HANZI[piece.color][piece.type];
                } else {
                  label = PIECE_NAMES_VIET[piece.color][piece.type];
                }
              }

              return (
                <div
                  key={`sq_${row}_${col}`}
                  onClick={() => handleSquareClick(row, col)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, row, col)}
                  className="relative flex items-center justify-center min-w-[32px] min-h-[32px] cursor-pointer group"
                >
                  {/* Last Move / Hint Square Indicator */}
                  {(isLastFrom || isLastTo) && (
                    <span className="absolute inset-1.5 rounded-full border-2 border-amber-500/75 bg-amber-400/15 pointer-events-none" />
                  )}
                  {(isHintFrom || isHintTo) && (
                    <span className="absolute inset-1 rounded-full border-2 border-emerald-400 bg-emerald-400/20 pointer-events-none" />
                  )}

                  {/* Check Danger Halo */}
                  {isKingCheckedHere && (
                    <span className="absolute inset-0.5 rounded-full bg-red-600/45 ring-4 ring-red-500 pointer-events-none" />
                  )}

                  {/* Piece Disc */}
                  {piece && (
                    <div
                      draggable={canControlColor(piece.color)}
                      onDragStart={(e) => handleDragStart(e, row, col)}
                      className={`relative w-[88%] h-[88%] rounded-full flex items-center justify-center transition-transform duration-150 select-none ${
                        isSelected
                          ? 'scale-110 -translate-y-1 ring-3 ring-amber-400 z-20'
                          : 'hover:scale-105 z-10'
                      }`}
                      style={{
                        backgroundColor: piece.isHidden
                          ? isRed
                            ? '#7F1D1D'
                            : '#1E293B'
                          : pieceBg,
                        border: `2.5px solid ${pieceBorder}`,
                        color: piece.isHidden ? '#FDE68A' : pieceText,
                        boxShadow: isSelected
                          ? '0 10px 18px -3px rgba(0,0,0,0.5), inset 0 2px 3px rgba(255,255,255,0.4)'
                          : '0 4px 7px -1px rgba(0,0,0,0.42), inset 0 2px 2px rgba(255,255,255,0.35)',
                      }}
                    >
                      {/* Inner carved ring */}
                      <div
                        className="w-[84%] h-[84%] rounded-full flex items-center justify-center border"
                        style={{
                          borderColor: piece.isHidden
                            ? 'rgba(253, 230, 138, 0.45)'
                            : `${pieceBorder}66`,
                        }}
                      >
                        {piece.isHidden ? (
                          <span
                            className="font-hanzi font-bold text-xs sm:text-sm md:text-base tracking-tight opacity-90"
                            title="Quân úp (nước đầu đi theo vị trí xuất phát)"
                          >
                            ?
                          </span>
                        ) : (
                          <span
                            className={
                              pieceCharMode === 'hanzi'
                                ? 'font-hanzi font-bold text-base sm:text-xl md:text-2xl leading-none'
                                : 'font-bold text-[10px] sm:text-xs md:text-sm tracking-tight leading-none text-center px-0.5'
                            }
                          >
                            {label}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Legal Move Target Dot / Capture Ring */}
                  {isLegal && !piece && (
                    <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-emerald-500/85 shadow-md ring-2 ring-white/60 pointer-events-none z-20" />
                  )}
                  {isLegal && piece && (
                    <span className="absolute inset-0.5 rounded-full border-3 border-emerald-400 bg-emerald-500/20 pointer-events-none z-20" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
