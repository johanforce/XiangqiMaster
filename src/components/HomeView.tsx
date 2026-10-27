import React, { useState, useEffect } from 'react';
import {
  Swords,
  Bot,
  Trophy,
  BookOpen,
  Sparkles,
  ChevronRight,
  Palette,
  CheckCircle2,
  Library,
  Crown,
  Compass,
  EyeOff,
  ArrowRight,
} from 'lucide-react';
import { UserProfile } from './AuthModal';
import { getEloRankTitle } from '../shared/elo';
import { Logo } from './Logo';
import { handleLinkClick, MainTab } from '../utils/navigation';
import { BoardTheme, BoardThemeId, THEME_LIST } from '../utils/themes';

interface HomeViewProps {
  currentUser: UserProfile | null;
  onNavigate: (tab: MainTab) => void;
  onOpenAuth: () => void;
  theme?: BoardTheme;
  onSelectTheme?: (themeId: BoardThemeId) => void;
  onOpenThemeDrawer?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  currentUser,
  onNavigate,
  onOpenAuth,
  theme,
  onSelectTheme,
  onOpenThemeDrawer,
}) => {
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  const [loadingTop, setLoadingTop] = useState(true);
  const [latestArticles, setLatestArticles] = useState<any[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);

  // Semantic UI color tokens for the selected board & web theme
  const primaryBtn =
    theme?.web.primaryBtnClass ||
    'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-md';
  const secondaryBtn =
    theme?.web.secondaryBtnClass ||
    'bg-stone-900/90 hover:bg-stone-800 border border-stone-700 text-stone-100';
  const subtleBtn =
    theme?.web.subtleBtnClass ||
    'bg-stone-950/60 hover:bg-stone-900 border border-stone-800 text-stone-300';
  const textAccent = theme?.web.textAccentClass || 'text-amber-400';
  const badgeAccent =
    theme?.web.accentBadgeClass ||
    'bg-amber-500/15 border border-amber-500/30 text-amber-300';
  const borderAccent = theme?.web.borderAccentClass || 'border-amber-500/40';
  const borderCard = theme?.web.cardBorderClass || 'border-stone-800 hover:border-amber-500/50';
  const inputFocus =
    theme?.web.inputFocusClass ||
    'focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40';
  const accentBg = theme?.web.accentBgClass || 'bg-amber-500/15';
  const accentGradient =
    theme?.web.accentGradient || 'from-amber-400 via-amber-200 to-amber-500';
  const bannerGradient =
    theme?.web.bannerGradient || 'from-amber-950/40 via-stone-900 to-stone-900';
  const accentColor = theme?.web.accentColor || '#f59e0b';
  const accentGlow = theme?.web.accentGlow || 'rgba(245, 158, 11, 0.35)';

  useEffect(() => {
    fetch('/api/leaderboard?mode=standard&period=all', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.leaderboard) {
          setTopPlayers(data.leaderboard.slice(0, 5));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTop(false));

    fetch('/api/articles', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.articles) {
          setLatestArticles(data.articles.slice(0, 3));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingArticles(false));
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-12 pb-12 animate-fade-in">
      {/* 1. HERO SECTION WITH CINEMATIC THEME BACKGROUND */}
      <section
        className={`relative rounded-3xl overflow-hidden border ${borderAccent} transition-all duration-500 ${
          theme?.web?.isLight
            ? 'bg-white shadow-[0_1px_3px_rgba(60,64,67,0.12),0_4px_12px_rgba(60,64,67,0.08)]'
            : 'bg-stone-900 shadow-2xl'
        }`}
      >
        {/* Hero Background Image with Atmospheric Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={theme?.images?.heroCover || '/images/hero_cover.jpg'}
            alt="Bàn cờ tướng nghệ thuật"
            className={`w-full h-full object-cover object-center scale-105 filter transition-all duration-700 ${
              theme?.web?.isLight ? 'brightness-[0.95] opacity-35' : 'brightness-[0.45] contrast-[1.1]'
            }`}
            referrerPolicy="no-referrer"
          />
          <div
            className={`absolute inset-0 transition-colors duration-500 ${
              theme?.web?.isLight
                ? 'bg-gradient-to-t from-white via-white/80 to-white/40'
                : 'bg-gradient-to-t from-stone-950 via-stone-950/70 to-stone-950/30'
            }`}
          />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 px-6 py-12 sm:px-12 sm:py-20 max-w-3xl space-y-6">
          <div className="mb-2">
            <Logo size="lg" variant="full" theme={theme?.web?.isLight ? 'light' : 'dark'} />
          </div>

          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border ${badgeAccent}`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${textAccent}`} />
            <span>Fairy-Stockfish WASM · Kỳ Phổ WXF · Cờ Úp Dân Gian</span>
          </div>

          <h1 className={`text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight sm:leading-none ${
            theme?.web?.isLight ? 'text-[#202124]' : 'text-stone-100'
          }`}>
            KỲ ĐẠO ĐỈNH CAO
            <span
              className={`block text-2xl sm:text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${accentGradient} mt-2 font-serif`}
            >
              Tinh Hoa Cờ Tướng Việt Nam
            </span>
          </h1>

          <p className={`text-sm sm:text-base leading-relaxed max-w-2xl ${
            theme?.web?.isLight ? 'text-[#5F6368]' : 'text-stone-300'
          }`}>
            Sân chơi cờ tướng trực tuyến chuyên nghiệp. Đấu trí cùng Engine AI quốc tế
            Fairy-Stockfish WASM, ghép phòng tranh tài xếp hạng Elo thời gian thực,
            và nghiên cứu kỳ phổ kinh điển chuẩn quốc tế WXF.
          </p>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href="/ranked"
              onClick={(e) => handleLinkClick(e, '/ranked')}
              className={`px-6 py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 transform hover:-translate-y-0.5 ${primaryBtn}`}
            >
              <Swords className="w-4 h-4" />
              <span>Đấu Xếp Hạng ngay</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </a>

            <a
              href="/ai"
              onClick={(e) => handleLinkClick(e, '/ai')}
              className={`px-6 py-3.5 rounded-2xl font-bold text-sm backdrop-blur-md transition-all flex items-center gap-2 transform hover:-translate-y-0.5 ${secondaryBtn}`}
            >
              <Bot className={`w-4 h-4 ${textAccent}`} />
              <span>Đấu với Máy (AI)</span>
            </a>

            <a
              href="/viewer"
              onClick={(e) => handleLinkClick(e, '/viewer')}
              className={`px-5 py-3.5 rounded-2xl text-sm font-medium transition-colors flex items-center gap-2 ${subtleBtn}`}
            >
              <BookOpen className={`w-4 h-4 ${textAccent}`} />
              <span>Xem Kỳ Phổ</span>
            </a>

            <a
              href="/library"
              onClick={(e) => handleLinkClick(e, '/library')}
              className={`px-5 py-3.5 rounded-2xl text-sm font-semibold transition-colors flex items-center gap-2 ${secondaryBtn}`}
            >
              <Library className={`w-4 h-4 ${textAccent}`} />
              <span>Tàng Thư Các</span>
            </a>
          </div>

          {/* Feature Highlights Metadata (Zero-pill style) */}
          <div className="pt-6 border-t border-stone-800/80 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-stone-400 font-medium">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>100% WebAssembly không cần cài đặt</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className={`w-4 h-4 ${textAccent}`} />
              <span>Elo Real-time chống cày điểm</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-sky-400" />
              <span>6 Giao diện Bàn cờ thủ công</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. GAME MODES GRID (CHẾ ĐỘ CHƠI ĐẶC SẮC) */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-stone-800/80 pb-4">
          <div>
            <div className={`text-xs font-bold ${textAccent} uppercase tracking-widest font-mono`}>
              GAME MODES
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-stone-100 mt-1">
              Chế Độ Chơi & Tính Năng Đỉnh Cao
            </h2>
          </div>
          <p className="text-xs text-stone-400 max-w-md">
            Từ rèn luyện thuật toán với siêu AI đến so tài kỳ nghệ đỉnh cao cùng người chơi khác.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Ranked Online (Highlighted Primary Mode) */}
          <a
            href="/ranked"
            onClick={(e) => handleLinkClick(e, '/ranked')}
            className={`group relative rounded-2xl bg-gradient-to-br ${bannerGradient} hover:brightness-105 border ${borderAccent} p-5 transition-all duration-300 cursor-pointer flex flex-col justify-between shadow-xl hover:-translate-y-1`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div
                  className={`w-12 h-12 rounded-xl ${accentBg} border ${borderAccent} flex items-center justify-center ${textAccent} group-hover:scale-110 transition-transform`}
                >
                  <Swords className="w-6 h-6" />
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${primaryBtn}`}
                >
                  Nổi bật
                </span>
              </div>
              <h3 className={`text-base font-bold ${textAccent} group-hover:brightness-125 transition-colors`}>
                Đấu Xếp Hạng Online
              </h3>
              <p className="text-xs text-stone-300 leading-relaxed">
                Đấu trực tuyến thời gian thực với đồng hồ bấm giờ chuẩn quốc tế: Cờ chớp 5p+3s, Cờ tiêu chuẩn 30p. Ghép phòng nhanh qua mã.
              </p>
            </div>
            <div
              className={`pt-4 mt-2 border-t ${borderAccent} flex items-center justify-between text-xs ${textAccent} font-semibold`}
            >
              <span>Tranh hạng ngay</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </a>

          {/* Card 2: AI Match */}
          <a
            href="/ai"
            onClick={(e) => handleLinkClick(e, '/ai')}
            className={`group relative rounded-2xl bg-stone-900/80 hover:bg-stone-900 border ${borderCard} p-5 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:shadow-xl hover:-translate-y-1`}
          >
            <div className="space-y-3">
              <div
                className={`w-12 h-12 rounded-xl ${accentBg} border ${borderAccent} flex items-center justify-center ${textAccent} group-hover:scale-110 transition-transform`}
              >
                <Bot className="w-6 h-6" />
              </div>
              <h3 className={`text-base font-bold text-stone-100 group-hover:${textAccent} transition-colors`}>
                Đấu Với Máy (AI)
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Tích hợp Fairy-Stockfish WASM và Pikafish NNUE kỳ lực tối thượng. Có gợi ý nước đi và đi lại linh hoạt.
              </p>
            </div>
            <div
              className={`pt-4 mt-2 border-t border-stone-800/60 flex items-center justify-between text-xs ${textAccent} font-semibold`}
            >
              <span>Thử sức ngay</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </a>

          {/* Card 3: Dark Xiangqi (Cờ Úp) */}
          <a
            href="/ranked/dark"
            onClick={(e) => handleLinkClick(e, '/ranked/dark')}
            className={`group relative rounded-2xl bg-stone-900/80 hover:bg-stone-900 border ${borderCard} p-5 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:shadow-xl hover:-translate-y-1`}
          >
            <div className="space-y-3">
              <div
                className={`w-12 h-12 rounded-xl ${accentBg} border ${borderAccent} flex items-center justify-center ${textAccent} group-hover:scale-110 transition-transform`}
              >
                <EyeOff className="w-6 h-6" />
              </div>
              <h3 className={`text-base font-bold text-stone-100 group-hover:${textAccent} transition-colors`}>
                Cờ Úp Dân Gian
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Biến thể cờ úp đặc sắc Việt Nam. Các quân ẩn giấu bí ẩn, lật quân ngẫu nhiên đòi hỏi ứng biến chiến thuật linh hoạt và bất ngờ.
              </p>
            </div>
            <div
              className={`pt-4 mt-2 border-t border-stone-800/60 flex items-center justify-between text-xs ${textAccent} font-semibold`}
            >
              <span>Thử vận may & tài năng</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </a>

          {/* Card 4: Notation Viewer */}
          <a
            href="/viewer"
            onClick={(e) => handleLinkClick(e, '/viewer')}
            className={`group relative rounded-2xl bg-stone-900/80 hover:bg-stone-900 border ${borderCard} p-5 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:shadow-xl hover:-translate-y-1`}
          >
            <div className="space-y-3">
              <div
                className={`w-12 h-12 rounded-xl ${accentBg} border ${borderAccent} flex items-center justify-center ${textAccent} group-hover:scale-110 transition-transform`}
              >
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className={`text-base font-bold text-stone-100 group-hover:${textAccent} transition-colors`}>
                Kỳ Phổ & Nghiên Cứu
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Nạp và phân tích biên bản WXF, PGN, ICCS. Tua tự động, xem từng nước đi để phân tích đòn thế sâu sắc.
              </p>
            </div>
            <div
              className={`pt-4 mt-2 border-t border-stone-800/60 flex items-center justify-between text-xs ${textAccent} font-semibold`}
            >
              <span>Mở trình xem kỳ phổ</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </a>

          {/* Card 5: Tàng Thư (Library) */}
          <a
            href="/library"
            onClick={(e) => handleLinkClick(e, '/library')}
            className={`group relative rounded-2xl bg-stone-900/80 hover:bg-stone-900 border ${borderCard} p-5 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 md:col-span-2 lg:col-span-4`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-xl ${accentBg} border ${borderAccent} flex items-center justify-center ${textAccent} shrink-0 group-hover:scale-110 transition-transform`}
                >
                  <Library className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-base font-bold text-stone-100 group-hover:${textAccent} transition-colors`}>
                      Tàng Thư Kỳ Đạo (Bí Kíp & Bàn Cờ Minh Họa)
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${badgeAccent}`}>
                      Mới
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 leading-relaxed max-w-3xl">
                    Kho tàng bài viết chuyên sâu về Khai cuộc, Trung cuộc, Tàn cuộc, Sát pháp và bình chú danh cục. Kết hợp bàn cờ và ký phổ đi theo từng bước giúp kỳ thủ lĩnh hội trọn vẹn ý đồ chiến thuật.
                  </p>
                </div>
              </div>
              <div className={`flex items-center gap-1.5 text-xs ${textAccent} font-semibold shrink-0`}>
                <span>Khám phá Tàng Thư</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </a>
        </div>
      </section>

      {/* 2B. TÀNG THƯ CÁC SHOWCASE ON HOME PAGE */}
      <section className={`rounded-3xl bg-stone-900/90 border ${borderCard} p-6 sm:p-8 space-y-5 shadow-xl`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl ${accentBg} border ${borderAccent} flex items-center justify-center ${textAccent}`}
            >
              <Library className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-stone-100">
                Tàng Thư Kỳ Đạo · Bài Viết & Ký Phổ Mới Nhất
              </h2>
              <p className="text-xs text-stone-400">
                Nghiên cứu lý thuyết kèm bàn cờ minh họa trực quan từng bước
              </p>
            </div>
          </div>

          <a
            href="/library"
            onClick={(e) => handleLinkClick(e, '/library')}
            className={`px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 ${textAccent} border ${borderAccent} text-xs font-semibold flex items-center gap-1.5 transition-colors`}
          >
            <span>Vào Tàng Thư Các</span>
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>

        {loadingArticles ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-36 rounded-2xl bg-stone-800/50 animate-pulse" />
            <div className="h-36 rounded-2xl bg-stone-800/50 animate-pulse" />
            <div className="h-36 rounded-2xl bg-stone-800/50 animate-pulse" />
          </div>
        ) : latestArticles.length === 0 ? (
          <div className={`rounded-2xl bg-stone-950/70 border ${borderAccent} p-6 flex flex-col sm:flex-row items-center justify-between gap-4`}>
            <div className="space-y-1 text-center sm:text-left">
              <div className="text-sm font-bold text-stone-200">
                Kho tàng bí kíp Khai cuộc · Trung cuộc · Tàn cuộc · Sát pháp
              </div>
              <p className="text-xs text-stone-400">
                Tra cứu các bài viết phân tích thế trận có kèm bàn cờ và ký phổ diễn biến theo từng bước đi.
              </p>
            </div>
            <a
              href="/library"
              onClick={(e) => handleLinkClick(e, '/library')}
              className={`px-4 py-2.5 rounded-xl text-white text-xs font-semibold shrink-0 transition-colors ${primaryBtn}`}
            >
              Mở Tàng Thư
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {latestArticles.map((art) => {
              const artUrl = `/library/${encodeURIComponent(art.id)}`;
              const moveCount = art.moveCount ?? (Array.isArray(art.moves) ? art.moves.length : 0);
              return (
                <a
                  key={art.id}
                  href={artUrl}
                  onClick={(e) => handleLinkClick(e, artUrl)}
                  className={`group rounded-2xl bg-stone-950/80 border p-4 flex flex-col justify-between transition-all hover:-translate-y-0.5 ${borderCard}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`px-2 py-0.5 rounded border font-semibold ${badgeAccent}`}>
                        {art.category || 'Khai cuộc'}
                      </span>
                      <span className="font-mono-num text-stone-400">
                        {moveCount > 0 ? `${moveCount} bước` : 'Thế cờ'}
                      </span>
                    </div>
                    <h3
                      className={`text-sm font-bold text-stone-100 transition-colors line-clamp-2 group-hover:${textAccent}`}
                    >
                      {art.title}
                    </h3>
                    <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed">
                      {art.summary || art.content}
                    </p>
                  </div>
                  <div
                    className={`mt-3 pt-2.5 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-medium ${textAccent}`}
                  >
                    <span>{art.authorName || 'Kỳ Đàn'}</span>
                    <span>Xem bài & bàn cờ →</span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. SPOTLIGHT: SO TÀI ĐỈNH CAO & THẨM MỸ NGHỆ THUẬT */}
      <section
        className={`relative rounded-3xl overflow-hidden bg-stone-900/90 border ${borderCard} p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-xl`}
      >
        <div className="lg:col-span-6 space-y-4">
          <div className={`inline-flex items-center gap-2 text-xs font-semibold font-mono ${textAccent}`}>
            <Crown className="w-4 h-4" />
            <span>SỞ HÀ HÁN GIỚI · NGHỆ THUẬT CỜ TƯỚNG</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-100 tracking-tight">
            Giao Diện Bàn Cờ Thủ Công Đa Dạng
          </h2>

          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
            Mỗi ván cờ là một tác phẩm nghệ thuật. Tùy biến giữa 6 phong cách bàn cờ
            sang trọng: Gỗ Cổ Điển, Đá Ngọc Bích, Tranh Thủy Mặc, Hoàng Cung Đại Nội, Đêm Huyền Ảo,
            và Tối Giản Tinh Tế. Chuyển đổi chữ Hán chuẩn mực hoặc chữ Việt thuần thục chỉ với một cú nhấp.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className={`p-3.5 rounded-xl bg-stone-950/80 border ${borderAccent} transition-colors`}>
              <div className={`font-bold text-sm ${textAccent}`}>6 Chủ đề Bàn cờ</div>
              <div className="text-[11px] text-stone-400 mt-0.5">Vân gỗ & ánh sáng tinh xảo</div>
            </div>
            <div className={`p-3.5 rounded-xl bg-stone-950/80 border ${borderAccent} transition-colors`}>
              <div className={`font-bold text-sm ${textAccent}`}>Chữ Hán & Chữ Việt</div>
              <div className="text-[11px] text-stone-400 mt-0.5">Dễ đọc cho mọi người chơi</div>
            </div>
            <div className={`p-3.5 rounded-xl bg-stone-950/80 border ${borderAccent} transition-colors`}>
              <div className={`font-bold text-sm ${textAccent}`}>Âm thanh gỗ thật</div>
              <div className="text-[11px] text-stone-400 mt-0.5">Hiệu ứng gõ quân vang dội</div>
            </div>
            <div className={`p-3.5 rounded-xl bg-stone-950/80 border ${borderAccent} transition-colors`}>
              <div className={`font-bold text-sm ${textAccent}`}>Gợi ý & Đi lại</div>
              <div className="text-[11px] text-stone-400 mt-0.5">Thuận tiện học tập rèn luyện</div>
            </div>
          </div>

          {/* System Theme Info Display (Theme is centrally managed by Admin) */}
          <div className="pt-2 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-300 font-medium flex items-center gap-1.5">
                <Palette className={`w-3.5 h-3.5 ${textAccent}`} />
                <span>Giao diện hệ thống hiện tại:</span>
              </span>
              <div className="flex items-center gap-2">
                <span className={`font-bold ${textAccent}`}>{theme?.name || 'Gỗ cổ điển'}</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextIdx = (THEME_LIST.findIndex(t => t.id === theme?.id) + 1) % THEME_LIST.length;
                    onSelectTheme?.(THEME_LIST[nextIdx].id);
                  }}
                  className="text-[10px] text-amber-500 hover:underline font-semibold cursor-pointer"
                >
                  (Bấm để đổi giao diện)
                </button>
              </div>
            </div>

            {/* Swatch Badges for all 7 themes */}
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {THEME_LIST.map((t) => {
                const isCurrent = (theme?.id || 'classic_wood') === t.id;

                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      if (onSelectTheme) {
                        onSelectTheme(t.id);
                      }
                    }}
                    style={{
                      borderColor: isCurrent ? t.web.accentColor : undefined,
                      boxShadow: isCurrent ? `0 0 12px ${t.web.accentGlow}` : undefined,
                    }}
                    className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer hover:scale-[1.03] ${
                      isCurrent
                        ? `${t.web.accentBadgeClass} font-bold ring-1`
                        : theme?.web?.isLight
                        ? 'bg-white/80 border-stone-200 text-stone-700 hover:border-amber-400'
                        : 'bg-stone-950/80 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center -space-x-1">
                      {t.swatchColors.map((col, idx) => (
                        <span
                          key={idx}
                          className="w-2.5 h-2.5 rounded-full border border-black/60 shadow-xs"
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] leading-tight truncate w-full">
                      {t.name}
                      {isCurrent ? ' ✓' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <a
              href="/ai"
              onClick={(e) => handleLinkClick(e, '/ai')}
              className={`inline-flex px-5 py-2.5 rounded-xl font-semibold text-xs transition-colors items-center gap-2 ${primaryBtn}`}
            >
              <span>Trải nghiệm ván cờ mẫu</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className={`lg:col-span-6 relative rounded-2xl overflow-hidden border ${borderAccent} shadow-2xl`}>
          <img
            src={theme?.images?.masterDuel || '/images/master_duel.jpg'}
            alt="Cận cảnh bàn cờ tướng truyền thống"
            className="w-full h-80 sm:h-96 object-cover object-center hover:scale-105 transition-all duration-700"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-3 left-4 right-4 text-xs text-stone-300 font-mono flex items-center justify-between">
            <span className={`font-semibold ${textAccent}`}>Sở Hà · Hán Giới</span>
            <span>Trí tuệ phương Đông</span>
          </div>
        </div>
      </section>

      {/* 4. LEADERBOARD PREVIEW & STATS */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Top 5 Master Preview */}
        <div className={`lg:col-span-7 rounded-3xl bg-stone-900/90 border ${borderCard} p-6 space-y-4 shadow-xl`}>
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg ${accentBg} border ${borderAccent} flex items-center justify-center ${textAccent}`}
              >
                <Trophy className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-stone-100">Bảng Vàng Danh Dự (Top Kỳ Thủ)</h3>
            </div>
            <a
              href="/leaderboard/standard"
              onClick={(e) => handleLinkClick(e, '/leaderboard/standard')}
              className={`text-xs ${textAccent} hover:underline font-semibold flex items-center gap-1`}
            >
              <span>Xem tất cả</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {loadingTop ? (
            <div className="space-y-2 py-4">
              <div className="h-10 rounded-xl bg-stone-800/60 animate-pulse" />
              <div className="h-10 rounded-xl bg-stone-800/60 animate-pulse" />
              <div className="h-10 rounded-xl bg-stone-800/60 animate-pulse" />
            </div>
          ) : topPlayers.length === 0 ? (
            <div className="py-8 text-center text-xs text-stone-500">
              Chưa có kỳ thủ nào hoàn thành trận đấu xếp hạng. Hãy là người đầu tiên ghi danh!
            </div>
          ) : (
            <div className="space-y-2">
              {topPlayers.map((player, idx) => {
                const playerUrl = `/leaderboard/standard/player/${encodeURIComponent(player.uid)}`;
                return (
                  <a
                    key={player.uid || idx}
                    href={playerUrl}
                    onClick={(e) => handleLinkClick(e, playerUrl)}
                    className={`flex items-center justify-between p-3 rounded-xl bg-stone-950/70 border text-xs transition-colors cursor-pointer ${borderCard}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[11px] ${
                          idx === 0
                            ? `${primaryBtn} font-bold`
                            : idx === 1
                            ? 'bg-stone-300 text-stone-950 font-bold'
                            : idx === 2
                            ? 'bg-amber-800 text-stone-100 font-bold'
                            : 'bg-stone-800 text-stone-400 font-bold'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-semibold text-stone-100">
                          {player.displayName || player.username}
                        </span>
                        <div className="text-[10px] text-stone-400">
                          {getEloRankTitle(player.elo)} · {player.gamesPlayed || 0} ván
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono-num">
                      <div className={`font-bold ${textAccent}`}>{player.elo} Elo</div>
                      <div className="text-[10px] text-emerald-400">
                        Thắng: {player.wins || 0}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Platform Rules & Tactical Pointers */}
        <div className={`lg:col-span-5 rounded-3xl bg-stone-900/90 border ${borderCard} p-6 space-y-4 shadow-xl`}>
          <div className="flex items-center gap-2.5 border-b border-stone-800/80 pb-3">
            <div
              className={`w-8 h-8 rounded-lg ${accentBg} border ${borderAccent} flex items-center justify-center ${textAccent}`}
            >
              <Compass className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-stone-100">Quy Ước & Luật Thi Đấu</h3>
          </div>

          <div className="space-y-3 text-xs text-stone-300">
            <div className={`p-3 rounded-xl bg-stone-950/60 border ${borderAccent} space-y-1`}>
              <div className={`font-semibold ${textAccent}`}>Luật Cấm Chiếu Dai (WXF Rules)</div>
              <p className="text-stone-400 leading-relaxed text-[11px]">
                Chiếu tướng liên tục lặp lại 3 lần không đổi nước sẽ bị xử thua. Đảm bảo tính công bằng và loại bỏ lối chơi tiêu cực.
              </p>
            </div>

            <div className={`p-3 rounded-xl bg-stone-950/60 border ${borderAccent} space-y-1`}>
              <div className={`font-semibold ${textAccent}`}>Biên Bản WXF Quốc Tế</div>
              <p className="text-stone-400 leading-relaxed text-[11px]">
                Ghi chép chuẩn hóa: Tên quân viết tắt (C: Pháo, R: Xe, H: Mã, E: Tượng, A: Sĩ, K: Tướng, P: Tốt) kết hợp dấu tiến (+), thoái (-), bình (.).
              </p>
            </div>

            <div className={`p-3 rounded-xl bg-stone-950/60 border ${borderAccent} space-y-1`}>
              <div className={`font-semibold ${textAccent}`}>Hệ Thống Elo Real-time</div>
              <p className="text-stone-400 leading-relaxed text-[11px]">
                Mỗi người chơi bắt đầu từ 1300 Elo. Điểm số tăng giảm dựa trên chênh lệch Elo đối thủ, tích hợp cơ chế chống cày điểm lặp lại.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FOOTER CALL TO ACTION */}
      <section
        className={`rounded-3xl bg-gradient-to-r ${bannerGradient} border ${borderAccent} p-8 text-center space-y-4 shadow-2xl`}
      >
        <h3 className="text-xl sm:text-2xl font-black text-stone-100">
          Sẵn Sàng Khai Cuộc Trận Đấu Đầu Tiên?
        </h3>
        <p className="text-xs sm:text-sm text-stone-300 max-w-xl mx-auto">
          Dù bạn là tân thủ đang tìm hiểu nước đi hay kiện tướng muốn chinh phục đỉnh cao Elo, Kỳ Đạo luôn là nơi lý tưởng để rèn luyện tư duy.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <a
            href="/ranked"
            onClick={(e) => handleLinkClick(e, '/ranked')}
            className={`px-6 py-3 rounded-xl font-bold text-xs shadow-lg transition-colors flex items-center gap-1.5 ${primaryBtn}`}
          >
            <Swords className="w-4 h-4" />
            <span>Đấu Xếp Hạng ngay</span>
          </a>
          <a
            href="/ai"
            onClick={(e) => handleLinkClick(e, '/ai')}
            className={`px-6 py-3 rounded-xl font-bold text-xs border transition-colors ${secondaryBtn}`}
          >
            Đấu với Máy (AI)
          </a>
          {!currentUser && (
            <button
              onClick={onOpenAuth}
              className={`px-6 py-3 rounded-xl font-bold text-xs border transition-colors ${subtleBtn}`}
            >
              Tạo tài khoản miễn phí
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
