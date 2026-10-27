import React, { useState, useEffect } from 'react';
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
import { BoardTheme, BOARD_THEMES } from '../utils/themes';
import { sound } from '../utils/sound';

interface XiangqiBoardProps {
  board: Board;
  turn: PieceColor;
  theme?: BoardTheme;
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
  theme = BOARD_THEMES.classic_wood,
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
  const [captureEffectPos, setCaptureEffectPos] = useState<Pos | null>(null);

  // Trigger capture ripple when lastMove lands on a square that had a piece
  useEffect(() => {
    if (lastMove?.to) {
      setCaptureEffectPos(lastMove.to);
      const timer = setTimeout(() => setCaptureEffectPos(null), 500);
      return () => clearTimeout(timer);
    }
  }, [lastMove]);

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

  // Render fiducial L-marks around cannon/soldier points
  const renderFiducialMark = (r: number, c: number) => {
    const x = c * 100;
    const y = r * 100;
    const g = 9; // gap from intersection
    const l = 16; // arm length
    const segments: string[] = [];

    if (c > 0) {
      segments.push(`M ${x - g - l} ${y - g} L ${x - g} ${y - g} L ${x - g} ${y - g - l}`);
      segments.push(`M ${x - g - l} ${y + g} L ${x - g} ${y + g} L ${x - g} ${y + g + l}`);
    }
    if (c < 8) {
      segments.push(`M ${x + g + l} ${y - g} L ${x + g} ${y - g} L ${x + g} ${y - g - l}`);
      segments.push(`M ${x + g + l} ${y + g} L ${x + g} ${y + g} L ${x + g} ${y + g + l}`);
    }

    return (
      <path
        key={`fid_${r}_${c}`}
        d={segments.join(' ')}
        stroke={theme.gridLine}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    );
  };

  return (
    <div
      className={`relative aspect-[9/10] w-full max-w-[min(92vw,560px)] select-none rounded-[22px] p-2 sm:p-3.5 shadow-2xl transition-all duration-200 flex items-center justify-center ${
        redInCheck || blackInCheck ? 'animate-check-shake' : ''
      }`}
      style={{
        background: `linear-gradient(145deg, ${theme.frameBgGrad[0]}, ${theme.frameBgGrad[1]})`,
        border: `3px solid ${theme.frameBorder}`,
        boxShadow: theme.web.isLight
          ? '0 12px 32px -4px rgba(60,64,67,0.18), 0 4px 12px -2px rgba(60,64,67,0.12), inset 0 1px 2px rgba(255,255,255,0.6)'
          : '0 24px 50px -12px rgba(0,0,0,0.85), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -3px 6px rgba(0,0,0,0.5)',
      }}
    >
      {/* Outer Wood Frame Inner Bevel */}
      <div
        className="relative w-full h-full rounded-[14px] p-1.5 sm:p-2.5 flex items-center justify-center shadow-inner"
        style={{
          background: `linear-gradient(160deg, ${theme.boardBgGrad[0]} 0%, ${theme.boardBgGrad[1]} 100%)`,
          boxShadow: theme.web.isLight
            ? 'inset 0 0 15px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.05)'
            : 'inset 0 0 25px rgba(0,0,0,0.45), 0 1px 2px rgba(255,255,255,0.12)',
          border: `1.5px solid ${theme.gridLine}55`,
        }}
      >
        {/* Zero-padding 9:10 Coordinate Lock Wrapper:
            viewBox="-50 -50 900 1000" maps x in [-50..850] (width 900 = 9 cols * 100)
            and y in [-50..950] (height 1000 = 10 rows * 100).
            Every intersection (c*100, r*100) is strictly at ((c+0.5)/9, (r+0.5)/10),
            which is 100% identical to the center of cell (r, c) in a 10x9 inset-0 CSS grid. */}
        <div className="relative w-full h-full aspect-[9/10]">
          {/* SVG Board Graphic with Grid & Calligraphy */}
          <svg
            viewBox="-50 -50 900 1000"
            preserveAspectRatio="none"
            className="block w-full h-full pointer-events-none"
            aria-label="Bàn cờ tướng"
          >
            <defs>
              {/* Wood Grain Texture Pattern */}
              <pattern id="board-grain" width="100" height="40" patternUnits="userSpaceOnUse">
                <path
                  d="M0 10 Q 50 12, 100 10 M0 25 Q 50 23, 100 25 M0 38 Q 50 40, 100 38"
                  stroke="rgba(0,0,0,0.04)"
                  strokeWidth="1.5"
                  fill="none"
                />
              </pattern>

              {/* Rivet Gradient */}
              <radialGradient id="rivet-grad" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor={theme.web.isLight ? '#FFFFFF' : '#FFF2A3'} />
                <stop offset="60%" stopColor={theme.rivetColor} />
                <stop offset="100%" stopColor={theme.web.isLight ? '#0D47A1' : '#785012'} />
              </radialGradient>

              {/* Piece Drop Shadow */}
              <filter id="piece-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation={theme.web.isLight ? "3" : "4.5"} floodColor="#000000" floodOpacity={theme.web.isLight ? "0.22" : "0.55"} />
              </filter>
            </defs>

            {/* Board Grain Overlay */}
            <rect x="-50" y="-50" width="900" height="1000" fill="url(#board-grain)" opacity={theme.web.isLight ? 0.15 : 0.6} />

            {/* Decorative Corner Rivets */}
            <circle cx="-32" cy="-32" r="5.5" fill="url(#rivet-grad)" stroke="#3A2008" strokeWidth="1" />
            <circle cx="832" cy="-32" r="5.5" fill="url(#rivet-grad)" stroke="#3A2008" strokeWidth="1" />
            <circle cx="-32" cy="932" r="5.5" fill="url(#rivet-grad)" stroke="#3A2008" strokeWidth="1" />
            <circle cx="832" cy="932" r="5.5" fill="url(#rivet-grad)" stroke="#3A2008" strokeWidth="1" />

            {/* Outer Border Double Line */}
            <rect
              x="-20"
              y="-20"
              width="840"
              height="940"
              rx="6"
              fill="none"
              stroke={theme.gridLine}
              strokeWidth="3.5"
              opacity="0.85"
            />
            <rect
              x="-12"
              y="-12"
              width="824"
              height="924"
              rx="4"
              fill="none"
              stroke={theme.gridLine}
              strokeWidth="1"
              opacity="0.55"
            />

            {/* Inner Grid Outer Boundary */}
            <rect
              x="0"
              y="0"
              width="800"
              height="900"
              fill="none"
              stroke={theme.gridLine}
              strokeWidth="2.5"
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
                strokeWidth="2.2"
                opacity="0.9"
              />
            ))}

            {/* 9 Vertical File Lines */}
            {Array.from({ length: 9 }, (_, c) =>
              c === 0 || c === 8 ? (
                <line
                  key={`v_${c}`}
                  x1={c * 100}
                  y1="0"
                  x2={c * 100}
                  y2="900"
                  stroke={theme.gridLine}
                  strokeWidth="2.5"
                  opacity="0.9"
                />
              ) : (
                <g key={`v_${c}`}>
                  <line
                    x1={c * 100}
                    y1="0"
                    x2={c * 100}
                    y2="400"
                    stroke={theme.gridLine}
                    strokeWidth="2.2"
                    opacity="0.9"
                  />
                  <line
                    x1={c * 100}
                    y1="500"
                    x2={c * 100}
                    y2="900"
                    stroke={theme.gridLine}
                    strokeWidth="2.2"
                    opacity="0.9"
                  />
                </g>
              )
            )}

            {/* Top & Bottom Palace Diagonals (Cung Tướng) */}
            <line x1="300" y1="0" x2="500" y2="200" stroke={theme.gridLine} strokeWidth="2.2" opacity="0.85" />
            <line x1="500" y1="0" x2="300" y2="200" stroke={theme.gridLine} strokeWidth="2.2" opacity="0.85" />
            <line x1="300" y1="700" x2="500" y2="900" stroke={theme.gridLine} strokeWidth="2.2" opacity="0.85" />
            <line x1="500" y1="700" x2="300" y2="900" stroke={theme.gridLine} strokeWidth="2.2" opacity="0.85" />

            {/* Cannon & Soldier Fiducial Marks */}
            {FIDUCIAL_POSITIONS.map(([r, c]) => renderFiducialMark(r, c))}

            {/* River Calligraphy: 楚 河 (left) 漢 界 (right) */}
            <text
              x="225"
              y="464"
              textAnchor="middle"
              fill={theme.riverText}
              className="font-hanzi font-bold"
              fontSize="46"
              letterSpacing="28"
              opacity="0.82"
              style={{ textShadow: '0 1px 2px rgba(255,255,255,0.25)' }}
            >
              楚河
            </text>
            <text
              x="575"
              y="464"
              textAnchor="middle"
              fill={theme.riverText}
              className="font-hanzi font-bold"
              fontSize="46"
              letterSpacing="28"
              opacity="0.82"
              style={{ textShadow: '0 1px 2px rgba(255,255,255,0.25)' }}
            >
              漢界
            </text>

            {/* Last Move Origin Marker rendered directly on the SVG intersection (100% exact coordinate lock & theme-aware palette) */}
            {lastMove && (() => {
              const fromCol = flipped ? 8 - lastMove.from.col : lastMove.from.col;
              const fromRow = flipped ? 9 - lastMove.from.row : lastMove.from.row;
              const cx = fromCol * 100;
              const cy = fromRow * 100;
              return (
                <g key="last-move-from-svg">
                  {/* Subtle contrast backdrop disc so the marker separates cleanly from the board background */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r="24"
                    fill={theme.moveFromBg}
                  />
                  {/* Outer theme-colored dashed ring */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r="22"
                    fill="none"
                    stroke={theme.moveFromRing}
                    strokeWidth="3"
                    strokeDasharray="7 4"
                    strokeLinecap="round"
                  />
                  {/* Inner crisp high-contrast ring */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r="14"
                    fill="none"
                    stroke={theme.moveFromInner}
                    strokeWidth="1.5"
                    opacity="0.9"
                  />
                  {/* Center intersection pin */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r="5.5"
                    fill={theme.moveFromDot}
                    stroke={theme.moveFromInner}
                    strokeWidth="1.5"
                  />
                </g>
              );
            })()}
          </svg>

          {/* Interactive 10x9 Grid Overlay (Locked 1:1 with viewBox="-50 -50 900 1000") */}
          <div className="absolute inset-0 grid grid-rows-10 grid-cols-9">
            {Array.from({ length: 10 }, (_, dRow) =>
              Array.from({ length: 9 }, (_, dCol) => {
                const row = flipped ? 9 - dRow : dRow;
                const col = flipped ? 8 - dCol : dCol;
                const piece = board[row][col];
                const isSelected =
                  selectedPos?.row === row && selectedPos?.col === col;
                const isLegal = isTargetLegal(row, col);
                const isLastTo =
                  lastMove?.to.row === row && lastMove?.to.col === col;
                const isHintFrom =
                  hintMove?.from.row === row && hintMove?.from.col === col;
                const isHintTo =
                  hintMove?.to.row === row && hintMove?.to.col === col;
                const isKingCheckedHere =
                  (redKingPos?.row === row && redKingPos?.col === col) ||
                  (blackKingPos?.row === row && blackKingPos?.col === col);
                const hasCaptureRipple =
                  captureEffectPos?.row === row && captureEffectPos?.col === col;

                const isRed = piece?.color === 'r';
                const pieceBgGrad = isRed ? theme.pieceRedBgGrad : theme.pieceBlackBgGrad;
                const pieceBorder = isRed ? theme.pieceRedBorder : theme.pieceBlackBorder;
                const pieceText = isRed ? theme.pieceRedText : theme.pieceBlackText;

                let label = '';
                if (piece) {
                  if (piece.isHidden) {
                    label = '?';
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
                    className="relative flex items-center justify-center w-full h-full cursor-pointer group"
                  >
                    {/* Last Move Destination Halo (Theme-matched ring around the moved piece) */}
                    {isLastTo && (
                      <span
                        className="pointer-events-none absolute w-[92%] aspect-square rounded-full border-2"
                        style={{
                          borderColor: theme.moveToBorder,
                          backgroundColor: theme.moveToBg,
                        }}
                      />
                    )}

                    {/* AI Hint Move Indicator */}
                    {(isHintFrom || isHintTo) && (
                      <span className="pointer-events-none absolute w-[92%] aspect-square rounded-full border-2 border-amber-400/80 bg-amber-400/15" />
                    )}

                    {/* King Danger Check Pulse Halo */}
                    {isKingCheckedHere && (
                      <span className="pointer-events-none absolute w-[95%] aspect-square rounded-full animate-check-pulse border-2 border-red-500 z-20" />
                    )}

                    {/* Piece Capture Particle/Ink Burst Effect */}
                    {hasCaptureRipple && (
                      <span className="pointer-events-none absolute w-[95%] aspect-square rounded-full animate-capture-burst border-2 border-amber-300 z-20" />
                    )}

                    {/* 3D Chess Piece Disc (Natural Wood/Ivory Shadow without glare) */}
                    {piece && (
                      <div
                        draggable={canControlColor(piece.color)}
                        onDragStart={(e) => handleDragStart(e, row, col)}
                        className={`relative w-[88%] aspect-square rounded-full flex items-center justify-center select-none transition-transform duration-200 ease-out ${
                          isSelected
                            ? 'scale-110 -translate-y-1 z-30 ring-2 ring-amber-400/90'
                            : 'hover:scale-[1.04] z-10'
                        }`}
                        style={{
                          background: piece.isHidden
                            ? isRed
                              ? 'radial-gradient(circle at 35% 35%, #7F1D1D, #450A0A 80%)'
                              : 'radial-gradient(circle at 35% 35%, #292524, #141210 80%)'
                            : `radial-gradient(circle at 36% 34%, ${pieceBgGrad[0]}, ${pieceBgGrad[1]} 85%)`,
                          border: `1.5px solid ${piece.isHidden ? (isRed ? '#991B1B' : '#44403C') : pieceBorder}`,
                          boxShadow: isSelected
                            ? '0 10px 18px -3px rgba(0,0,0,0.7), inset 0 1px 1.5px rgba(255,255,255,0.28), inset 0 -2px 3px rgba(0,0,0,0.35)'
                            : '0 4px 7px -1px rgba(0,0,0,0.55), inset 0 1px 1px rgba(255,255,255,0.22), inset 0 -1.5px 2px rgba(0,0,0,0.28)',
                        }}
                      >
                        {/* Single Elegant Recessed Groove Ring */}
                        <div
                          className="w-[82%] h-[82%] rounded-full flex items-center justify-center relative"
                          style={{
                            border: `1.5px solid ${
                              piece.isHidden
                                ? isRed
                                  ? 'rgba(239, 68, 68, 0.4)'
                                  : 'rgba(212, 175, 55, 0.4)'
                                : piece.color === 'r'
                                ? 'rgba(185, 28, 28, 0.32)'
                                : 'rgba(212, 175, 55, 0.32)'
                            }`,
                            boxShadow: 'inset 0 1px 1.5px rgba(0,0,0,0.2)',
                          }}
                        >
                          {piece.isHidden ? (
                            <div className="flex flex-col items-center justify-center">
                              <span className="w-2.5 h-2.5 rounded-full border border-amber-300/60 bg-amber-400/20" />
                            </div>
                          ) : (
                            <span
                              className={
                                pieceCharMode === 'hanzi'
                                  ? 'font-hanzi font-black text-[21px] sm:text-[25px] md:text-[28px] leading-none select-none tracking-tight'
                                  : 'font-extrabold text-[11px] sm:text-[13px] md:text-[15px] tracking-tight leading-none text-center px-0.5 select-none'
                              }
                              style={{
                                color: pieceText,
                                textShadow: isRed
                                  ? '0 1px 1px rgba(0,0,0,0.18)'
                                  : '0 1px 1.5px rgba(0,0,0,0.75)',
                              }}
                            >
                              {label}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Legal Move Indicator (Material Design Soft Dot & Clean Capture Ring) */}
                    {isLegal && !piece && (
                      <span className="pointer-events-none z-20 flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-teal-500/20 transition-transform duration-150 group-hover:scale-125">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#26A69A] border border-white/60 shadow-xs" />
                      </span>
                    )}
                    {isLegal && piece && (
                      <span className="pointer-events-none absolute w-[92%] aspect-square rounded-full border-2 border-[#EF5350]/85 bg-[#EF5350]/10 z-20 transition-transform duration-150 group-hover:scale-105" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
