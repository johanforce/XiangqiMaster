import React, { useState, useEffect } from 'react';
import {
  Swords,
  Bot,
  Trophy,
  BookOpen,
  Sparkles,
  Flame,
  Clock,
  EyeOff,
  ShieldCheck,
  ChevronRight,
  Palette,
  Volume2,
  Award,
  Zap,
  Target,
  ArrowRight,
  Crown,
  Users,
  Compass,
  CheckCircle2,
  Library,
} from 'lucide-react';
import { UserProfile } from './AuthModal';
import { getEloRankTitle } from '../shared/elo';
import { Logo } from './Logo';
import { handleLinkClick, MainTab } from '../utils/navigation';
import { BoardTheme } from '../utils/themes';

interface HomeViewProps {
  currentUser: UserProfile | null;
  onNavigate: (tab: MainTab) => void;
  onOpenAuth: () => void;
  theme?: BoardTheme;
}

export const HomeView: React.FC<HomeViewProps> = ({
  currentUser,
  onNavigate,
  onOpenAuth,
  theme,
}) => {
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  const [loadingTop, setLoadingTop] = useState(true);
  const [latestArticles, setLatestArticles] = useState<any[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);

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
      {/* 1. HERO SECTION WITH CINEMATIC BACKGROUND */}
      <section className="relative rounded-3xl overflow-hidden border border-stone-800 shadow-2xl bg-stone-900">
        {/* Hero Background Image with Atmospheric Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={theme?.images?.heroCover || '/images/hero_cover.jpg'}
            alt="Bàn cờ tướng cổ điển"
            className="w-full h-full object-cover object-center scale-105 filter brightness-[0.45] contrast-[1.1] transition-all duration-700"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/70 to-stone-950/30" />
          <div className="absolute inset-0 bg-radial-gradient from-transparent via-stone-950/40 to-stone-950/90" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 px-6 py-12 sm:px-12 sm:py-20 max-w-3xl space-y-6">
          <div className="mb-2">
            <Logo size="lg" variant="full" theme="dark" />
          </div>

          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border ${
              theme?.web.accentBadgeClass || 'bg-amber-500/15 border-amber-500/30 text-amber-300'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${theme?.web.textAccentClass || 'text-amber-400'}`} />
            <span>Fairy-Stockfish WASM · Kỳ Phổ WXF · Cờ Úp Dân Gian</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-stone-100 tracking-tight leading-tight sm:leading-none">
            KỲ ĐẠO ĐỈNH CAO
            <span
              className={`block text-2xl sm:text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${
                theme?.web.accentGradient || 'from-amber-400 via-amber-200 to-amber-500'
              } mt-2 font-serif`}
            >
              Tinh Hoa Cờ Tướng Việt Nam
            </span>
          </h1>

          <p className="text-sm sm:text-base text-stone-300 leading-relaxed max-w-2xl">
            Sân chơi cờ tướng trực tuyến chuyên nghiệp. Đấu trí cùng Engine AI quốc tế
            Fairy-Stockfish WASM, ghép phòng tranh tài xếp hạng Elo thời gian thực,
            và nghiên cứu kỳ phổ kinh điển chuẩn quốc tế WXF.
          </p>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href="/ranked"
              onClick={(e) => handleLinkClick(e, '/ranked')}
              className={`px-6 py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 transform hover:-translate-y-0.5 ${
                theme?.web.primaryBtnClass ||
                'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-[0_0_25px_rgba(245,158,11,0.35)]'
              }`}
            >
              <Swords className="w-4 h-4" />
              <span>Đấu Xếp Hạng ngay</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </a>

            <a
              href="/ai"
              onClick={(e) => handleLinkClick(e, '/ai')}
              className={`px-6 py-3.5 rounded-2xl font-bold text-sm backdrop-blur-md transition-all flex items-center gap-2 transform hover:-translate-y-0.5 ${
                theme?.web.secondaryBtnClass ||
                'bg-stone-900/90 hover:bg-stone-800 border border-stone-700 text-stone-100'
              }`}
            >
              <Bot className={`w-4 h-4 ${theme?.web.textAccentClass || 'text-amber-400'}`} />
              <span>Đấu với Máy (AI)</span>
            </a>

            <a
              href="/viewer"
              onClick={(e) => handleLinkClick(e, '/viewer')}
              className={`px-5 py-3.5 rounded-2xl text-sm font-medium transition-colors flex items-center gap-2 ${
                theme?.web.subtleBtnClass ||
                'bg-stone-950/60 hover:bg-stone-900 border border-stone-800 text-stone-300'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Xem Kỳ Phổ</span>
            </a>

            <a
              href="/library"
              onClick={(e) => handleLinkClick(e, '/library')}
              className={`px-5 py-3.5 rounded-2xl text-sm font-semibold transition-colors flex items-center gap-2 ${
                theme?.web.secondaryBtnClass ||
                'bg-amber-950/40 hover:bg-amber-900/40 border border-amber-500/40 text-amber-300'
              }`}
            >
              <Library className={`w-4 h-4 ${theme?.web.textAccentClass || 'text-amber-400'}`} />
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
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
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
            <div className="text-xs font-bold text-amber-500 uppercase tracking-widest font-mono">
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
            className="group relative rounded-2xl bg-gradient-to-br from-amber-950/40 via-stone-900 to-stone-900 hover:from-amber-950/60 border border-amber-500/60 hover:border-amber-400 p-5 transition-all duration-300 cursor-pointer flex flex-col justify-between shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-xl hover:-translate-y-1"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                  <Swords className="w-6 h-6" />
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500 text-stone-950 font-bold uppercase tracking-wider">
                  Nổi bật
                </span>
              </div>
              <h3 className="text-base font-bold text-amber-300 group-hover:text-amber-200 transition-colors">
                Đấu Xếp Hạng Online
              </h3>
              <p className="text-xs text-stone-300 leading-relaxed">
                Đấu trực tuyến thời gian thực với đồng hồ bấm giờ chuẩn quốc tế: Cờ chớp 5p+3s, Cờ tiêu chuẩn 30p. Ghép phòng nhanh qua mã.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-amber-500/30 flex items-center justify-between text-xs text-amber-400 font-semibold">
              <span>Tranh hạng ngay</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </a>

          {/* Card 2: AI Match */}
          <a
            href="/ai"
            onClick={(e) => handleLinkClick(e, '/ai')}
            className="group relative rounded-2xl bg-stone-900/80 hover:bg-stone-900 border border-stone-800 hover:border-amber-500/50 p-5 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:shadow-xl hover:-translate-y-1"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-stone-100 group-hover:text-amber-300 transition-colors">
                Đấu Với Máy (AI)
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Tích hợp Fairy-Stockfish WASM và Pikafish NNUE. 4 cấp độ từ Tân thủ đến Kỳ tiên (~2300+ Elo), có gợi ý nước đi và đi lại.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-stone-800/60 flex items-center justify-between text-xs text-amber-400 font-semibold">
              <span>Thử sức ngay</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </a>

          {/* Card 3: Dark Xiangqi (Cờ Úp) */}
          <a
            href="/ranked/dark"
            onClick={(e) => handleLinkClick(e, '/ranked/dark')}
            className="group relative rounded-2xl bg-stone-900/80 hover:bg-stone-900 border border-stone-800 hover:border-purple-500/50 p-5 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:shadow-xl hover:-translate-y-1"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                <EyeOff className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-stone-100 group-hover:text-purple-300 transition-colors">
                Cờ Úp Dân Gian
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Biến thể cờ úp đặc sắc Việt Nam. Các quân ẩn giấu bí ẩn, lật quân ngẫu nhiên đòi hỏi ứng biến chiến thuật linh hoạt và bất ngờ.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-stone-800/60 flex items-center justify-between text-xs text-purple-400 font-semibold">
              <span>Thử vận may & tài năng</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </a>

          {/* Card 4: Notation Viewer */}
          <a
            href="/viewer"
            onClick={(e) => handleLinkClick(e, '/viewer')}
            className="group relative rounded-2xl bg-stone-900/80 hover:bg-stone-900 border border-stone-800 hover:border-emerald-500/50 p-5 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:shadow-xl hover:-translate-y-1"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-stone-100 group-hover:text-emerald-300 transition-colors">
                Kỳ Phổ & Nghiên Cứu
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Nạp và phân tích biên bản WXF, PGN, ICCS. Tua tự động, xem từng nước đi để phân tích đòn thế sâu sắc.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-stone-800/60 flex items-center justify-between text-xs text-emerald-400 font-semibold">
              <span>Mở trình xem kỳ phổ</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </a>

          {/* Card 5: Tàng Thư (Library) */}
          <a
            href="/library"
            onClick={(e) => handleLinkClick(e, '/library')}
            className="group relative rounded-2xl bg-stone-900/80 hover:bg-stone-900 border border-stone-800 hover:border-amber-400/50 p-5 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 md:col-span-2 lg:col-span-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0 group-hover:scale-110 transition-transform">
                  <Library className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-stone-100 group-hover:text-amber-300 transition-colors">
                      Tàng Thư Kỳ Đạo (Bí Kíp & Bàn Cờ Minh Họa)
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                      Mới
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 leading-relaxed max-w-3xl">
                    Kho tàng bài viết chuyên sâu về Khai cuộc, Trung cuộc, Tàn cuộc, Sát pháp và bình chú danh cục. Kết hợp bàn cờ và ký phổ đi theo từng bước giúp kỳ thủ lĩnh hội trọn vẹn ý đồ chiến thuật.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold shrink-0">
                <span>Khám phá Tàng Thư</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </a>
        </div>
      </section>

      {/* 2B. TÀNG THƯ CÁC SHOWCASE ON HOME PAGE */}
      <section className="rounded-3xl bg-stone-900/90 border border-stone-800 p-6 sm:p-8 space-y-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
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
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
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
          <div className="rounded-2xl bg-stone-950/70 border border-stone-800/80 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
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
              className={`px-4 py-2.5 rounded-xl text-white text-xs font-semibold shrink-0 transition-colors ${
                theme?.web.primaryBtnClass || 'bg-amber-600 hover:bg-amber-500'
              }`}
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
                  className={`group rounded-2xl bg-stone-950/80 border p-4 flex flex-col justify-between transition-all hover:-translate-y-0.5 ${
                    theme?.web.cardBorderClass || 'border-stone-800 hover:border-amber-500/50'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`px-2 py-0.5 rounded border font-semibold ${
                        theme?.web.accentBadgeClass || 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}>
                        {art.category || 'Khai cuộc'}
                      </span>
                      <span className="font-mono-num text-stone-400">
                        {moveCount > 0 ? `${moveCount} bước` : 'Thế cờ'}
                      </span>
                    </div>
                    <h3 className={`text-sm font-bold text-stone-100 transition-colors line-clamp-2 group-hover:${theme?.web.textAccentClass || 'text-amber-300'}`}>
                      {art.title}
                    </h3>
                    <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed">
                      {art.summary || art.content}
                    </p>
                  </div>
                  <div className={`mt-3 pt-2.5 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-medium ${
                    theme?.web.textAccentClass || 'text-amber-400'
                  }`}>
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
      <section className="relative rounded-3xl overflow-hidden bg-stone-900/90 border border-stone-800 p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-xl">
        <div className="lg:col-span-6 space-y-4">
          <div className={`inline-flex items-center gap-2 text-xs font-semibold font-mono ${
            theme?.web.textAccentClass || 'text-amber-400'
          }`}>
            <Crown className="w-4 h-4" />
            <span>SỞ HÀ HÁN GIỚI · NGHỆ THUẬT CỜ TƯỚNG</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-100 tracking-tight">
            Giao Diện Bàn Cờ Thủ Công Đa Dạng
          </h2>

          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
            Mỗi ván cờ là một tác phẩm nghệ thuật. Tùy biến giữa 6 phong cách bàn cờ
            sang trọng: Gỗ Cổ Điển, Gỗ Mun Đen, Giấy Ngọc Xuyến, Đá Xanh Lục, Đỏ Hoàng Gia,
            và Tre Thanh Tịnh. Chuyển đổi chữ Hán chuẩn mực hoặc chữ Việt thuần thục chỉ với một cú nhấp.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-stone-950/80 border border-stone-800/80">
              <div className={`font-bold text-sm ${theme?.web.textAccentClass || 'text-amber-400'}`}>6 Chủ đề Bàn cờ</div>
              <div className="text-[11px] text-stone-400 mt-0.5">Vân gỗ & ánh sáng tinh xảo</div>
            </div>
            <div className="p-3.5 rounded-xl bg-stone-950/80 border border-stone-800/80">
              <div className={`font-bold text-sm ${theme?.web.textAccentClass || 'text-amber-400'}`}>Chữ Hán & Chữ Việt</div>
              <div className="text-[11px] text-stone-400 mt-0.5">Dễ đọc cho mọi người chơi</div>
            </div>
            <div className="p-3.5 rounded-xl bg-stone-950/80 border border-stone-800/80">
              <div className={`font-bold text-sm ${theme?.web.textAccentClass || 'text-amber-400'}`}>Âm thanh gỗ thật</div>
              <div className="text-[11px] text-stone-400 mt-0.5">Hiệu ứng gõ quân vang dội</div>
            </div>
            <div className="p-3.5 rounded-xl bg-stone-950/80 border border-stone-800/80">
              <div className={`font-bold text-sm ${theme?.web.textAccentClass || 'text-amber-400'}`}>Gợi ý & Đi lại</div>
              <div className="text-[11px] text-stone-400 mt-0.5">Thuận tiện học tập rèn luyện</div>
            </div>
          </div>

          <div className="pt-2">
            <a
              href="/ai"
              onClick={(e) => handleLinkClick(e, '/ai')}
              className={`inline-flex px-5 py-2.5 rounded-xl text-white font-semibold text-xs transition-colors items-center gap-2 ${
                theme?.web.primaryBtnClass || 'bg-amber-600 hover:bg-amber-500'
              }`}
            >
              <span>Trải nghiệm ván cờ mẫu</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="lg:col-span-6 relative rounded-2xl overflow-hidden border border-stone-800 shadow-2xl">
          <img
            src={theme?.images?.masterDuel || '/images/master_duel.jpg'}
            alt="Cận cảnh bàn cờ tướng truyền thống"
            className="w-full h-80 sm:h-96 object-cover object-center hover:scale-105 transition-all duration-700"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-3 left-4 right-4 text-xs text-stone-300 font-mono flex items-center justify-between">
            <span className={`font-semibold ${theme?.web.textAccentClass || 'text-amber-300'}`}>Sở Hà · Hán Giới</span>
            <span>Trí tuệ phương Đông</span>
          </div>
        </div>
      </section>

      {/* 4. LEADERBOARD PREVIEW & STATS */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Top 5 Master Preview */}
        <div className="lg:col-span-7 rounded-3xl bg-stone-900/90 border border-stone-800 p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Trophy className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-stone-100">Bảng Vàng Danh Dự (Top Kỳ Thủ)</h3>
            </div>
            <a
              href="/leaderboard/standard"
              onClick={(e) => handleLinkClick(e, '/leaderboard/standard')}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
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
                    className="flex items-center justify-between p-3 rounded-xl bg-stone-950/70 border border-stone-800/70 text-xs hover:border-amber-500/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[11px] ${
                          idx === 0
                            ? 'bg-amber-500 text-stone-950'
                            : idx === 1
                            ? 'bg-stone-300 text-stone-950'
                            : idx === 2
                            ? 'bg-amber-700 text-stone-100'
                            : 'bg-stone-800 text-stone-400'
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
                      <div className="text-amber-400 font-bold">{player.elo} Elo</div>
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
        <div className="lg:col-span-5 rounded-3xl bg-stone-900/90 border border-stone-800 p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2.5 border-b border-stone-800/80 pb-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Compass className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-stone-100">Quy Ước & Luật Thi Đấu</h3>
          </div>

          <div className="space-y-3 text-xs text-stone-300">
            <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/60 space-y-1">
              <div className="font-semibold text-amber-300">Luật Cấm Chiếu Dai (WXF Rules)</div>
              <p className="text-stone-400 leading-relaxed text-[11px]">
                Chiếu tướng liên tục lặp lại 3 lần không đổi nước sẽ bị xử thua. Đảm bảo tính công bằng và loại bỏ lối chơi tiêu cực.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/60 space-y-1">
              <div className="font-semibold text-amber-300">Biên Bản WXF Quốc Tế</div>
              <p className="text-stone-400 leading-relaxed text-[11px]">
                Ghi chép chuẩn hóa: Tên quân viết tắt (C: Pháo, R: Xe, H: Mã, E: Tượng, A: Sĩ, K: Tướng, P: Tốt) kết hợp dấu tiến (+), thoái (-), bình (.).
              </p>
            </div>

            <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/60 space-y-1">
              <div className="font-semibold text-amber-300">Hệ Thống Elo Real-time</div>
              <p className="text-stone-400 leading-relaxed text-[11px]">
                Mỗi người chơi bắt đầu từ 1300 Elo. Điểm số tăng giảm dựa trên chênh lệch Elo đối thủ, tích hợp cơ chế chống cày điểm lặp lại.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FOOTER CALL TO ACTION */}
      <section className={`rounded-3xl bg-gradient-to-r ${
        theme?.web.bannerGradient || 'from-amber-950/40 via-stone-900 to-stone-900'
      } border ${
        theme?.web.cardBorderClass || 'border-amber-500/30'
      } p-8 text-center space-y-4 shadow-2xl`}>
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
            className={`px-6 py-3 rounded-xl text-white font-bold text-xs shadow-lg transition-colors flex items-center gap-1.5 ${
              theme?.web.primaryBtnClass || 'bg-amber-600 hover:bg-amber-500'
            }`}
          >
            <Swords className="w-4 h-4" />
            <span>Đấu Xếp Hạng ngay</span>
          </a>
          <a
            href="/ai"
            onClick={(e) => handleLinkClick(e, '/ai')}
            className={`px-6 py-3 rounded-xl font-bold text-xs border transition-colors ${
              theme?.web.secondaryBtnClass || 'bg-stone-800 hover:bg-stone-700 text-stone-100 border-stone-700'
            }`}
          >
            Đấu với Máy (AI)
          </a>
          {!currentUser && (
            <button
              onClick={onOpenAuth}
              className={`px-6 py-3 rounded-xl font-bold text-xs border transition-colors ${
                theme?.web.subtleBtnClass || 'bg-stone-800 hover:bg-stone-700 text-amber-300 border-amber-500/40'
              }`}
            >
              Tạo tài khoản miễn phí
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
