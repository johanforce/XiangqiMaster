import React, { useState, useEffect, useMemo } from 'react';
import {
  Library,
  Search,
  BookOpen,
  SkipBack,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  FlipVertical,
  ArrowLeft,
  Calendar,
  User,
  Tag,
  Sparkles,
  Plus,
} from 'lucide-react';
import {
  INITIAL_FEN,
  parseFen,
  replayFromNotationText,
  FormattedMove,
  Pos,
} from '../shared/xiangqi';
import { XiangqiBoard } from './XiangqiBoard';
import { BoardTheme } from '../utils/themes';
import { sound } from '../utils/sound';
import { navigateUrl, handleLinkClick } from '../utils/navigation';

export interface LibraryArticle {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  initialFen: string;
  notationText: string;
  moves?: FormattedMove[];
  moveCount?: number;
  authorUid?: string;
  authorName?: string;
  createdAt: number;
  updatedAt: number;
}

interface LibraryViewProps {
  theme: BoardTheme;
  pieceCharMode: 'hanzi' | 'viet';
  isAdmin?: boolean;
  onToast?: (msg: string) => void;
}

const CATEGORIES = [
  'Tất cả',
  'Khai cuộc',
  'Trung cuộc',
  'Tàn cuộc',
  'Sát pháp',
  'Bình chú danh cục',
  'Cẩm nang chiến thuật',
];

function renderFormattedArticleContent(text: string) {
  const lines = String(text || '').split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={idx} className="h-3" />;
    }
    if (trimmed.startsWith('### ')) {
      return (
        <h4
          key={idx}
          className="text-base font-display font-bold text-amber-300 mt-4 mb-1.5"
        >
          {trimmed.slice(4)}
        </h4>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h3
          key={idx}
          className="text-lg font-display font-bold text-amber-400 mt-5 mb-2 border-b border-stone-800/80 pb-1"
        >
          {trimmed.slice(3)}
        </h3>
      );
    }
    if (trimmed.startsWith('# ')) {
      return (
        <h2
          key={idx}
          className="text-xl font-display font-bold text-stone-100 mt-5 mb-2"
        >
          {trimmed.slice(2)}
        </h2>
      );
    }
    if (trimmed.startsWith('> ')) {
      return (
        <blockquote
          key={idx}
          className="my-2.5 pl-3.5 py-2 border-l-2 border-amber-500/70 bg-amber-950/15 rounded-r-xl text-stone-300 italic text-sm"
        >
          {trimmed.slice(2)}
        </blockquote>
      );
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      return (
        <div key={idx} className="flex items-start gap-2 text-sm text-stone-200 my-1 pl-1">
          <span className="text-amber-400 font-bold mt-0.5">•</span>
          <span className="leading-relaxed">{trimmed.slice(2)}</span>
        </div>
      );
    }

    // Inline bold **...**
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={idx} className="text-sm text-stone-200 leading-relaxed my-1.5">
        {parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} className="font-semibold text-amber-300">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <React.Fragment key={pIdx}>{part}</React.Fragment>;
        })}
      </p>
    );
  });
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  theme,
  pieceCharMode,
  isAdmin,
  onToast,
}) => {
  const [articles, setArticles] = useState<LibraryArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<LibraryArticle | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Step-by-step replay states (Strictly non-editable board)
  const [plyIndex, setPlyIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [notationFormat, setNotationFormat] = useState<'wxf' | 'viet' | 'iccs'>('viet');

  // Sync with URL (/library, /library?q=...&category=..., /library/:articleId?ply=...&format=...)
  useEffect(() => {
    const syncFromUrl = () => {
      const path = window.location.pathname.replace(/\/+$/, '');
      const params = new URLSearchParams(window.location.search);

      const qParam = params.get('q');
      if (qParam !== null) setSearchQuery(qParam);

      const catParam = params.get('category');
      if (catParam) setSelectedCategory(catParam);

      const fmtParam = params.get('format');
      if (fmtParam === 'wxf' || fmtParam === 'viet' || fmtParam === 'iccs') {
        setNotationFormat(fmtParam);
      }

      const plyParam = params.get('ply');
      if (plyParam !== null && !Number.isNaN(Number(plyParam))) {
        setPlyIndex(Math.max(0, Number(plyParam)));
      }

      const match = path.match(/^\/library\/([^/]+)$/);
      if (match) {
        const artId = decodeURIComponent(match[1]);
        setSelectedArticleId(artId);
      } else {
        setSelectedArticleId(null);
        setSelectedArticle(null);
      }
    };

    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('app:locationchange', syncFromUrl);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('app:locationchange', syncFromUrl);
    };
  }, []);

  // Load articles list
  const fetchArticles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/articles');
      const data = await res.json();
      if (data.articles) {
        setArticles(data.articles);
      }
    } catch {
      onToast?.('Không thể tải danh sách Tàng Thư');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchArticles();
  }, []);

  // Load single article when selectedArticleId changes
  useEffect(() => {
    if (!selectedArticleId) {
      setSelectedArticle(null);
      return;
    }

    const existingInList = articles.find((a) => a.id === selectedArticleId);
    if (existingInList) {
      setSelectedArticle(existingInList);
    }

    let cancelled = false;
    setDetailLoading(true);
    fetch(`/api/articles/${encodeURIComponent(selectedArticleId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.article) {
          setSelectedArticle(data.article);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedArticleId]);

  // Filter articles client-side by search query and category
  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return articles.filter((a) => {
      if (selectedCategory !== 'Tất cả' && a.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      const hay = [
        a.title || '',
        a.summary || '',
        a.content || '',
        a.category || '',
        a.authorName || '',
        a.notationText || '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [articles, searchQuery, selectedCategory]);

  // Compute parsed moves for the currently opened article
  const articleMoves: FormattedMove[] = useMemo(() => {
    if (!selectedArticle) return [];
    if (Array.isArray(selectedArticle.moves) && selectedArticle.moves.length > 0) {
      return selectedArticle.moves;
    }
    if (selectedArticle.notationText?.trim()) {
      const fenPrefix =
        selectedArticle.initialFen && selectedArticle.initialFen !== INITIAL_FEN
          ? `[FEN "${selectedArticle.initialFen}"]\n`
          : '';
      const parsed = replayFromNotationText(fenPrefix + selectedArticle.notationText);
      return parsed.moves;
    }
    return [];
  }, [selectedArticle]);

  // When an article is opened or its moves finish loading, default to the last move unless URL explicitly specifies ?ply=...
  useEffect(() => {
    if (!selectedArticle) return;
    const plyParam = new URLSearchParams(window.location.search).get('ply');
    if (plyParam !== null && !Number.isNaN(Number(plyParam))) {
      setPlyIndex(Math.max(0, Math.min(articleMoves.length, Number(plyParam))));
    } else {
      setPlyIndex(articleMoves.length);
    }
  }, [selectedArticle?.id, articleMoves.length]);

  const clampedPly = Math.min(plyIndex, articleMoves.length);

  const currentFen = useMemo(() => {
    if (!selectedArticle) return INITIAL_FEN;
    const baseFen = selectedArticle.initialFen || INITIAL_FEN;
    if (clampedPly === 0 || articleMoves.length === 0) return baseFen;
    return articleMoves[clampedPly - 1]?.fen || baseFen;
  }, [selectedArticle, clampedPly, articleMoves]);

  const { board, turn } = useMemo(() => {
    try {
      return parseFen(currentFen || INITIAL_FEN);
    } catch {
      return parseFen(INITIAL_FEN);
    }
  }, [currentFen]);

  const lastMove: { from: Pos; to: Pos } | null = useMemo(() => {
    if (clampedPly === 0 || !articleMoves[clampedPly - 1]) return null;
    return {
      from: articleMoves[clampedPly - 1].from,
      to: articleMoves[clampedPly - 1].to,
    };
  }, [clampedPly, articleMoves]);

  const stepTo = (targetPly: number) => {
    const clamped = Math.max(0, Math.min(articleMoves.length, targetPly));
    setPlyIndex(clamped);
    if (selectedArticle) {
      navigateUrl(
        `/library/${encodeURIComponent(selectedArticle.id)}?format=${notationFormat}&ply=${clamped}`,
        true
      );
    }
    if (clamped > 0 && articleMoves[clamped - 1]) {
      const m = articleMoves[clamped - 1];
      if (m.isCheck) sound.playCheck();
      else if (m.captured) sound.playCapture();
      else sound.playMove();
    }
  };

  // ==================== VIEW 1: ARTICLE DETAIL VIEW ====================
  if (selectedArticleId) {
    if (detailLoading && !selectedArticle) {
      return (
        <div className="w-full max-w-6xl mx-auto rounded-2xl bg-stone-900/80 border border-stone-800 p-12 text-center text-stone-400">
          Đang mở bí kíp trong Tàng Thư Các...
        </div>
      );
    }

    if (!selectedArticle) {
      return (
        <div className="w-full max-w-4xl mx-auto rounded-2xl bg-stone-900/80 border border-stone-800 p-8 text-center space-y-4">
          <div className="text-lg font-display font-bold text-stone-200">
            Không tìm thấy bài viết trong Tàng Thư
          </div>
          <a
            href="/library"
            onClick={(e) =>
              handleLinkClick(e, '/library', () => {
                setSelectedArticleId(null);
                setSelectedArticle(null);
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại Tàng Thư</span>
          </a>
        </div>
      );
    }

    return (
      <div className="w-full max-w-7xl mx-auto space-y-5">
        {/* Top Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-900/90 border border-stone-800 rounded-2xl px-4 py-3 shadow-lg">
          <a
            href="/library"
            onClick={(e) =>
              handleLinkClick(e, '/library', () => {
                setSelectedArticleId(null);
                setSelectedArticle(null);
                setPlyIndex(0);
              })
            }
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span>Danh mục Tàng Thư</span>
          </a>

          <div className="flex items-center gap-2 text-xs text-stone-400">
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
              {selectedArticle.category || 'Bí kíp'}
            </span>
            {isAdmin && (
              <a
                href={`/admin/library?edit=${encodeURIComponent(selectedArticle.id)}`}
                onClick={(e) =>
                  handleLinkClick(
                    e,
                    `/admin/library?edit=${encodeURIComponent(selectedArticle.id)}`
                  )
                }
                className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/30 font-medium transition-colors"
              >
                Sửa bài viết (Admin)
              </a>
            )}
          </div>
        </div>

        {/* Main 2-column Layout: Article Reading + Step-by-Step Board & Notation */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT: Article Content */}
          <div className="lg:col-span-6 rounded-2xl bg-stone-900/90 border border-stone-800 p-5 sm:p-7 shadow-xl space-y-4">
            <div className="space-y-2 border-b border-stone-800 pb-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400">
                <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                  <Tag className="w-3.5 h-3.5" />
                  {selectedArticle.category || 'Khai cuộc'}
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-stone-500" />
                  {selectedArticle.authorName || 'Kỳ Đàn Quản Trị'}
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1 font-mono-num">
                  <Calendar className="w-3.5 h-3.5 text-stone-500" />
                  {new Date(
                    selectedArticle.updatedAt || selectedArticle.createdAt || Date.now()
                  ).toLocaleDateString('vi-VN')}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-display font-bold text-stone-100 leading-tight">
                {selectedArticle.title}
              </h1>

              {selectedArticle.summary && (
                <p className="text-xs sm:text-sm text-stone-400 italic pt-1">
                  {selectedArticle.summary}
                </p>
              )}
            </div>

            <div className="prose prose-invert max-w-none pt-1">
              {renderFormattedArticleContent(selectedArticle.content)}
            </div>
          </div>

          {/* RIGHT: Non-editable Xiangqi Board + Step-by-step Notation */}
          <div className="lg:col-span-6 space-y-4 lg:sticky lg:top-20">
            <div className="rounded-2xl bg-stone-900/90 border border-stone-800 p-4 shadow-xl flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-stone-200 uppercase tracking-wider">
                    Bàn Cờ Minh Họa (Chỉ Xem Theo Bước)
                  </span>
                </div>
                <span className="text-[11px] font-mono-num px-2.5 py-0.5 rounded-md bg-stone-950 border border-stone-800 text-amber-300">
                  Bước {clampedPly} / {articleMoves.length}
                </span>
              </div>

              {/* Board is strictly interactive={false} */}
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

              {/* Step Controls */}
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => stepTo(0)}
                  disabled={clampedPly === 0}
                  className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 transition-colors"
                  title="Về thế cờ ban đầu"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={() => stepTo(clampedPly - 1)}
                  disabled={clampedPly === 0}
                  className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 flex items-center gap-1 text-xs font-medium transition-colors"
                  title="Lùi 1 bước"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Trước</span>
                </button>
                <button
                  onClick={() => stepTo(clampedPly + 1)}
                  disabled={clampedPly >= articleMoves.length}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white flex items-center gap-1 text-xs font-semibold transition-colors shadow"
                  title="Tiến 1 bước"
                >
                  <span>Tiếp</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => stepTo(articleMoves.length)}
                  disabled={clampedPly >= articleMoves.length}
                  className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 transition-colors"
                  title="Tới nước cuối"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setFlipped((f) => !f)}
                  className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 ml-1 transition-colors"
                  title="Xoay bàn cờ"
                >
                  <FlipVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Step-by-Step Notation List */}
            <div className="rounded-2xl bg-stone-900/90 border border-stone-800 p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-300">
                  Ký Phổ Diễn Biến ({articleMoves.length} nước)
                </span>
                <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-lg border border-stone-800 text-[11px]">
                  {(['viet', 'wxf', 'iccs'] as const).map((fmt) => {
                    const fmtUrl = `/library/${encodeURIComponent(
                      selectedArticle.id
                    )}?format=${fmt}&ply=${clampedPly}`;
                    return (
                      <a
                        key={fmt}
                        href={fmtUrl}
                        onClick={(e) =>
                          handleLinkClick(e, fmtUrl, () => setNotationFormat(fmt))
                        }
                        className={`px-2 py-0.5 rounded uppercase font-semibold transition-colors ${
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

              <div className="h-60 max-h-60 overflow-y-auto overscroll-contain rounded-xl bg-stone-950/90 border border-stone-800 p-2.5 text-xs font-mono-num">
                {articleMoves.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-stone-500 text-center py-6 font-sans">
                    Bài viết này chỉ hiển thị thế cờ tĩnh (không có nước đi kèm theo).
                  </div>
                ) : (
                  <div className="space-y-1">
                    {Array.from({ length: Math.ceil(articleMoves.length / 2) }).map((_, idx) => {
                      const rMove = articleMoves[idx * 2];
                      const bMove = articleMoves[idx * 2 + 1];
                      const rPly = idx * 2 + 1;
                      const bPly = idx * 2 + 2;
                      const rUrl = `/library/${encodeURIComponent(
                        selectedArticle.id
                      )}?format=${notationFormat}&ply=${rPly}`;
                      const bUrl = `/library/${encodeURIComponent(
                        selectedArticle.id
                      )}?format=${notationFormat}&ply=${bPly}`;

                      return (
                        <div
                          key={idx}
                          className="min-h-[32px] shrink-0 grid grid-cols-7 items-center py-1 px-2 rounded hover:bg-stone-900/70"
                        >
                          <span className="col-span-1 text-stone-500">{idx + 1}.</span>
                          <a
                            href={rUrl}
                            onClick={(e) => handleLinkClick(e, rUrl, () => stepTo(rPly))}
                            className={`col-span-3 text-left px-2 py-1 rounded truncate transition-colors ${
                              clampedPly === rPly
                                ? 'bg-red-900/50 text-red-200 font-bold border border-red-500/30'
                                : 'text-red-400 hover:bg-stone-800'
                            }`}
                          >
                            {rMove?.[notationFormat]}
                          </a>
                          {bMove ? (
                            <a
                              href={bUrl}
                              onClick={(e) => handleLinkClick(e, bUrl, () => stepTo(bPly))}
                              className={`col-span-3 text-left px-2 py-1 rounded truncate transition-colors ${
                                clampedPly === bPly
                                  ? 'bg-stone-700 text-stone-100 font-bold border border-stone-500/30'
                                  : 'text-stone-300 hover:bg-stone-800'
                              }`}
                            >
                              {bMove[notationFormat]}
                            </a>
                          ) : (
                            <span className="col-span-3" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== VIEW 2: LIBRARY LIST & SEARCH VIEW ====================
  return (
    <div className="w-full max-w-6xl mx-auto space-y-5">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-stone-900 shadow-2xl p-6 sm:p-8">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 pointer-events-none"
          style={{ backgroundImage: `url('/images/ranked_lobby_pavilion.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/90 to-stone-900/75 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
              <Library className="w-3.5 h-3.5" />
              <span>Tàng Thư Các · Kho Tàng Bí Kíp Cờ Tướng</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-display font-bold text-stone-100">
              Tàng Thư Kỳ Đạo
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
              Nơi lưu trữ các chuyên đề Khai cuộc, Trung cuộc, Tàn cuộc, Sát pháp và bình chú danh
              cục kinh điển kèm bàn cờ minh họa trực quan từng nước đi.
            </p>
          </div>

          {isAdmin && (
            <a
              href="/admin/library"
              onClick={(e) => handleLinkClick(e, '/admin/library')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-red-700 hover:from-amber-500 hover:to-red-600 text-white text-xs font-semibold shadow-lg transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Viết bài mới trong Quản trị</span>
            </a>
          )}
        </div>

        {/* Search & Category Filter Bar */}
        <div className="relative z-10 mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                const params = new URLSearchParams();
                if (val.trim()) params.set('q', val.trim());
                if (selectedCategory !== 'Tất cả') params.set('category', selectedCategory);
                const qs = params.toString();
                navigateUrl(qs ? `/library?${qs}` : '/library', true);
              }}
              placeholder="Tìm kiếm tiêu đề bài viết, khai cuộc, sát pháp, tác giả..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-950/90 border border-stone-700/80 text-xs sm:text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="relative z-10 mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => {
            const params = new URLSearchParams();
            if (searchQuery.trim()) params.set('q', searchQuery.trim());
            if (cat !== 'Tất cả') params.set('category', cat);
            const catUrl = params.toString() ? `/library?${params.toString()}` : '/library';

            return (
              <a
                key={cat}
                href={catUrl}
                onClick={(e) =>
                  handleLinkClick(e, catUrl, () => setSelectedCategory(cat))
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-stone-950/80 text-stone-400 hover:text-stone-200 border border-stone-800'
                }`}
              >
                {cat}
              </a>
            );
          })}
        </div>
      </div>

      {/* Articles Grid */}
      {loading ? (
        <div className="rounded-2xl bg-stone-900/80 border border-stone-800 p-12 text-center text-sm text-stone-400">
          Đang tải dữ liệu Tàng Thư...
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="rounded-2xl bg-stone-900/80 border border-stone-800 p-12 text-center space-y-3">
          <Sparkles className="w-8 h-8 text-amber-400/60 mx-auto" />
          <div className="text-base font-display font-bold text-stone-200">
            {searchQuery.trim() || selectedCategory !== 'Tất cả'
              ? 'Không tìm thấy bài viết phù hợp với từ khóa'
              : 'Tàng Thư hiện chưa có bài viết nào'}
          </div>
          <p className="text-xs text-stone-400 max-w-md mx-auto">
            {isAdmin
              ? 'Bạn có thể vào mục Quản trị -> Tàng Thư để biên soạn bài viết kèm bàn cờ và ký phổ minh họa.'
              : 'Quản trị viên sẽ sớm cập nhật các bí kíp cờ tướng vào Tàng Thư.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredArticles.map((art) => {
            const artUrl = `/library/${encodeURIComponent(art.id)}`;
            const moveTotal =
              art.moveCount ?? (Array.isArray(art.moves) ? art.moves.length : 0);

            return (
              <a
                key={art.id}
                href={artUrl}
                onClick={(e) =>
                  handleLinkClick(e, artUrl, () => {
                    setSelectedArticleId(art.id);
                    setSelectedArticle(art);
                    const totalSteps =
                      Array.isArray(art.moves) && art.moves.length > 0
                        ? art.moves.length
                        : art.moveCount || 0;
                    setPlyIndex(totalSteps);
                  })
                }
                className="group rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-amber-500/50 p-5 flex flex-col justify-between transition-all hover:-translate-y-0.5 shadow-lg"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                      {art.category || 'Khai cuộc'}
                    </span>
                    <span className="font-mono-num text-stone-400">
                      {moveTotal > 0 ? `${moveTotal} bước kỳ phổ` : 'Thế cờ minh họa'}
                    </span>
                  </div>

                  <h3 className="text-lg font-display font-bold text-stone-100 group-hover:text-amber-300 transition-colors line-clamp-2">
                    {art.title}
                  </h3>

                  <p className="text-xs text-stone-400 line-clamp-3 leading-relaxed">
                    {art.summary || art.content}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-800/80 flex items-center justify-between text-[11px] text-stone-500">
                  <span>{art.authorName || 'Kỳ Đàn Quản Trị'}</span>
                  <span className="text-amber-400 font-medium group-hover:translate-x-0.5 transition-transform">
                    Đọc & Xem bàn cờ →
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};
