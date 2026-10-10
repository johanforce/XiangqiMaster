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
} from 'lucide-react';
import { UserProfile } from './AuthModal';
import { getEloRankTitle } from '../shared/elo';

interface HomeViewProps {
  currentUser: UserProfile | null;
  onNavigate: (tab: 'home' | 'ai' | 'ranked' | 'viewer' | 'leaderboard') => void;
  onOpenAuth: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  currentUser,
  onNavigate,
  onOpenAuth,
}) => {
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  const [loadingTop, setLoadingTop] = useState(true);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/leaderboard?mode=blitz&period=all')
      .then((res) => res.json())
      .then((data) => {
        if (data.leaderboard) {
          setTopPlayers(data.leaderboard.slice(0, 5));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTop(false));
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-12 pb-12 animate-fade-in">
      {/* 1. HERO SECTION WITH CINEMATIC BACKGROUND */}
      <section className="relative rounded-3xl overflow-hidden border border-stone-800 shadow-2xl bg-stone-900">
        {/* Hero Background Image with Atmospheric Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="/src/assets/images/xiangqi_hero_cover_1791653377623.jpg"
            alt="Bàn cờ tướng cổ điển"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center scale-105 filter brightness-[0.45] contrast-[1.1]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/70 to-stone-950/30" />
          <div className="absolute inset-0 bg-radial-gradient from-transparent via-stone-950/40 to-stone-950/90" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 px-6 py-12 sm:px-12 sm:py-20 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Fairy-Stockfish WASM · Kỳ Phổ WXF · Cờ Úp Dân Gian</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-stone-100 tracking-tight leading-tight sm:leading-none">
            KỲ ĐẠO ĐỈNH CAO
            <span className="block text-2xl sm:text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 mt-2 font-serif">
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
            <button
              onClick={() => onNavigate('ai')}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-sm shadow-[0_0_25px_rgba(245,158,11,0.35)] hover:shadow-[0_0_35px_rgba(245,158,11,0.5)] transition-all flex items-center gap-2 transform hover:-translate-y-0.5"
            >
              <Bot className="w-4 h-4" />
              <span>Đấu với AI ngay</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              onClick={() => {
                if (!currentUser) {
                  onOpenAuth();
                } else {
                  onNavigate('ranked');
                }
              }}
              className="px-6 py-3.5 rounded-2xl bg-stone-900/90 hover:bg-stone-800 border border-stone-700 text-stone-100 font-bold text-sm backdrop-blur-md transition-all flex items-center gap-2 transform hover:-translate-y-0.5"
            >
              <Swords className="w-4 h-4 text-amber-400" />
              <span>Đấu Xếp Hạng</span>
            </button>

            <button
              onClick={() => onNavigate('viewer')}
              className="px-5 py-3.5 rounded-2xl bg-stone-950/60 hover:bg-stone-900 border border-stone-800 text-stone-300 text-sm font-medium transition-colors flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>Xem Kỳ Phổ</span>
            </button>
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
          {/* Card 1: AI Match */}
          <div
            onClick={() => onNavigate('ai')}
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
          </div>

          {/* Card 2: Ranked Online */}
          <div
            onClick={() => {
              if (!currentUser) onOpenAuth();
              else onNavigate('ranked');
            }}
            className="group relative rounded-2xl bg-stone-900/80 hover:bg-stone-900 border border-stone-800 hover:border-red-500/50 p-5 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:shadow-xl hover:-translate-y-1"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
                <Swords className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-stone-100 group-hover:text-red-300 transition-colors">
                Đấu Xếp Hạng Online
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Đấu trực tuyến thời gian thực với đồng hồ bấm giờ chuẩn quốc tế: Cờ chớp 5p+3s, Cờ tiêu chuẩn 30p. Ghép phòng nhanh qua mã.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-stone-800/60 flex items-center justify-between text-xs text-red-400 font-semibold">
              <span>Tranh hạng ngay</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 3: Dark Xiangqi (Cờ Úp) */}
          <div
            onClick={() => {
              if (!currentUser) onOpenAuth();
              else onNavigate('ranked');
            }}
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
          </div>

          {/* Card 4: Notation Viewer */}
          <div
            onClick={() => onNavigate('viewer')}
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
                Nạp và phân tích biên bản WXF, PGN, ICCS. Tua tự động, xem từng nước đi, lưu trữ ván đấu để phân tích đòn thế sâu sắc.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-stone-800/60 flex items-center justify-between text-xs text-emerald-400 font-semibold">
              <span>Mở thư viện kỳ phổ</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </section>

      {/* 3. SPOTLIGHT: SO TÀI ĐỈNH CAO & THẨM MỸ NGHỆ THUẬT */}
      <section className="relative rounded-3xl overflow-hidden bg-stone-900/90 border border-stone-800 p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-xl">
        <div className="lg:col-span-6 space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 font-mono">
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
              <div className="text-amber-400 font-bold text-sm">6 Chủ đề Bàn cờ</div>
              <div className="text-[11px] text-stone-400 mt-0.5">Vân gỗ & ánh sáng tinh xảo</div>
            </div>
            <div className="p-3.5 rounded-xl bg-stone-950/80 border border-stone-800/80">
              <div className="text-amber-400 font-bold text-sm">Chữ Hán & Chữ Việt</div>
              <div className="text-[11px] text-stone-400 mt-0.5">Dễ đọc cho mọi người chơi</div>
            </div>
            <div className="p-3.5 rounded-xl bg-stone-950/80 border border-stone-800/80">
              <div className="text-amber-400 font-bold text-sm">Âm thanh gỗ thật</div>
              <div className="text-[11px] text-stone-400 mt-0.5">Hiệu ứng gõ quân vang dội</div>
            </div>
            <div className="p-3.5 rounded-xl bg-stone-950/80 border border-stone-800/80">
              <div className="text-amber-400 font-bold text-sm">Gợi ý & Đi lại</div>
              <div className="text-[11px] text-stone-400 mt-0.5">Thuận tiện học tập rèn luyện</div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onNavigate('ai')}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors flex items-center gap-2"
            >
              <span>Trải nghiệm ván cờ mẫu</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="lg:col-span-6 relative rounded-2xl overflow-hidden border border-stone-800 shadow-2xl">
          <img
            src="/src/assets/images/xiangqi_master_duel_1791653388676.jpg"
            alt="Cận cảnh bàn cờ tướng truyền thống"
            referrerPolicy="no-referrer"
            className="w-full h-80 sm:h-96 object-cover object-center hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-3 left-4 right-4 text-xs text-stone-300 font-mono flex items-center justify-between">
            <span className="font-semibold text-amber-300">Chu Hà · Hán Giới</span>
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
            <button
              onClick={() => onNavigate('leaderboard')}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
            >
              <span>Xem tất cả</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
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
              {topPlayers.map((player, idx) => (
                <div
                  key={player.uid || idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-stone-950/70 border border-stone-800/70 text-xs hover:border-amber-500/30 transition-colors"
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
                      <span className="font-semibold text-stone-100">{player.username}</span>
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
                </div>
              ))}
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
                Mỗi người chơi bắt đầu từ 1200 Elo. Điểm số tăng giảm dựa trên chênh lệch Elo đối thủ, tích hợp cơ chế chống cày điểm lặp lại.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FOOTER CALL TO ACTION */}
      <section className="rounded-3xl bg-gradient-to-r from-amber-950/40 via-stone-900 to-stone-900 border border-amber-500/30 p-8 text-center space-y-4 shadow-2xl">
        <h3 className="text-xl sm:text-2xl font-black text-stone-100">
          Sẵn Sàng Khai Cuộc Trận Đấu Đầu Tiên?
        </h3>
        <p className="text-xs sm:text-sm text-stone-300 max-w-xl mx-auto">
          Dù bạn là tân thủ đang tìm hiểu nước đi hay kiện tướng muốn chinh phục đỉnh cao Elo, Kỳ Đạo luôn là nơi lý tưởng để rèn luyện tư duy.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigate('ai')}
            className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg transition-colors"
          >
            Đấu với Máy ngay
          </button>
          {!currentUser && (
            <button
              onClick={onOpenAuth}
              className="px-6 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 font-bold text-xs border border-stone-700 transition-colors"
            >
              Tạo tài khoản miễn phí
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
