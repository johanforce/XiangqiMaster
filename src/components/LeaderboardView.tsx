import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Flame,
  Clock,
  EyeOff,
  RefreshCw,
  Crown,
  Medal,
  Swords,
  TrendingUp,
  X,
  History,
  BarChart2,
  Calendar,
  User,
} from 'lucide-react';
import { RatedMode, getEloRankTitle } from '../shared/elo';

interface LeaderboardViewProps {
  onOpenViewer?: (notationText: string) => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ onOpenViewer }) => {
  const [mode, setMode] = useState<RatedMode>('standard');
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('all');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [playerTab, setPlayerTab] = useState<'stats' | 'history'>('stats');
  const [playerGames, setPlayerGames] = useState<any[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?mode=${mode}&period=${period}`);
      const data = await res.json();
      setEntries(data.leaderboard || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [mode, period]);

  const handleOpenProfile = async (player: any) => {
    setSelectedPlayer(player);
    setPlayerTab('stats');
    setLoadingGames(true);
    try {
      const res = await fetch(`/api/games?uid=${player.uid}`);
      const data = await res.json();
      setPlayerGames(data.games || []);
    } catch {
      setPlayerGames([]);
    } finally {
      setLoadingGames(false);
    }
  };

  const top3 = entries.slice(0, 3);
  const rank1 = top3[0];
  const rank2 = top3[1];
  const rank3 = top3[2];
  const restEntries = entries.slice(3);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* 1. Thanh tiêu đề & Bộ lọc thể loại */}
      <div
        className="relative rounded-3xl border border-amber-900/40 p-5 sm:p-7 shadow-2xl space-y-5 overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(17, 15, 14, 0.82) 0%, rgba(12, 10, 9, 0.94) 100%), url('/images/champion_hall.jpg')`,
        }}
      >
        <div className="absolute -right-8 -bottom-10 font-hanzi text-8xl font-black text-amber-500/5 select-none pointer-events-none">
          楚河漢界
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-950/80 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.3)] backdrop-blur-sm">
              <Trophy className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-stone-100 tracking-tight">
                  Bảng Vàng Danh Dự
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                  Kỳ Đàn Đỉnh Cao
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Tôn vinh các Đại Sư và Kiện Tướng cờ tướng hàng đầu hệ thống
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Bộ lọc thể loại */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-stone-950 border border-stone-800 text-xs">
              <button
                onClick={() => setMode('blitz')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all ${
                  mode === 'blitz'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Cờ chớp</span>
              </button>
              <button
                onClick={() => setMode('standard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all ${
                  mode === 'standard'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Tiêu chuẩn</span>
              </button>
              <button
                onClick={() => setMode('dark')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all ${
                  mode === 'dark'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Cờ úp</span>
              </button>
            </div>

            {/* Bộ lọc thời gian */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-stone-950 border border-stone-800 text-xs">
              {(
                [
                  ['week', 'Tuần'],
                  ['month', 'Tháng'],
                  ['all', 'Tất cả'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                    period === key
                      ? 'bg-stone-800 text-stone-100 shadow-sm'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={fetchLeaderboard}
              title="Làm mới"
              className="p-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Bục vinh danh Top 3 (Championship Podium) */}
        {!loading && top3.length > 0 && (
          <div className="pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
              {/* Hạng 2 (Bạc - Á Quân) */}
              {rank2 && (
                <div
                  onClick={() => handleOpenProfile(rank2)}
                  className="order-2 md:order-1 rounded-3xl bg-gradient-to-b from-stone-800/90 via-stone-900/95 to-stone-950 border border-slate-400/40 p-5 flex flex-col items-center text-center cursor-pointer hover:border-slate-300 transition-all shadow-xl hover:-translate-y-1 group relative overflow-hidden"
                >
                  <div className="relative mb-2.5">
                    <div className="w-15 h-15 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-slate-300 flex items-center justify-center text-2xl shadow-lg ring-4 ring-slate-400/20">
                      🥈
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-300 text-stone-950 text-xs font-black flex items-center justify-center shadow-md">
                      2
                    </span>
                  </div>
                  <div className="text-sm font-extrabold text-stone-100 group-hover:text-amber-300 transition-colors truncate max-w-[180px]">
                    {rank2.displayName || rank2.username}
                  </div>
                  <div className="text-[11px] text-slate-300 font-semibold mt-0.5">
                    {getEloRankTitle(rank2.elo)}
                  </div>
                  <div className="mt-2 text-lg font-black font-mono-num text-amber-300">
                    {rank2.elo} <span className="text-xs font-normal text-stone-400">Elo</span>
                  </div>
                  <div className="text-[10px] text-stone-400 mt-1 font-mono-num">
                    {rank2.gamesPlayed || 0} ván · Thắng{' '}
                    {rank2.gamesPlayed
                      ? Math.round(((rank2.wins || 0) / rank2.gamesPlayed) * 100)
                      : 0}
                    %
                  </div>
                </div>
              )}

              {/* Hạng 1 (Vàng - Quán Quân Kỳ Đàn) */}
              {rank1 && (
                <div
                  onClick={() => handleOpenProfile(rank1)}
                  className="order-1 md:order-2 rounded-3xl bg-gradient-to-b from-amber-950/70 via-stone-900/95 to-stone-950 border-2 border-amber-500/90 p-6 flex flex-col items-center text-center cursor-pointer hover:border-amber-400 transition-all shadow-[0_0_35px_rgba(245,158,11,0.3)] hover:-translate-y-1.5 group relative overflow-hidden"
                >
                  <div className="absolute -top-3.5 flex items-center gap-1 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 text-[11px] font-black shadow-lg">
                    <Crown className="w-3.5 h-3.5 fill-current" />
                 
                  </div>

                  <div className="relative mt-2 mb-3">
                    <div className="w-18 h-18 rounded-full bg-gradient-to-br from-amber-500 via-amber-600 to-amber-950 border-2 border-amber-400 flex items-center justify-center text-3xl shadow-2xl ring-4 ring-amber-400/30">
                      👑
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-6.5 h-6.5 rounded-full bg-amber-400 text-stone-950 text-xs font-black flex items-center justify-center shadow-md">
                      1
                    </span>
                  </div>

                  <div className="text-base font-black text-amber-200 group-hover:text-amber-300 transition-colors truncate max-w-[200px]">
                    {rank1.displayName || rank1.username}
                  </div>
                  <div className="text-xs text-amber-400/90 font-bold mt-0.5">
                    {getEloRankTitle(rank1.elo)}
                  </div>
                  <div className="mt-2 text-2xl font-black font-mono-num text-amber-300">
                    {rank1.elo} <span className="text-xs font-normal text-stone-400">Elo</span>
                  </div>
                  <div className="text-[11px] text-stone-300 mt-1.5 font-mono-num flex items-center gap-2">
                    <span>{rank1.gamesPlayed || 0} ván</span>
                    <span>·</span>
                    <span className="text-emerald-400 font-bold">
                      Thắng{' '}
                      {rank1.gamesPlayed
                        ? Math.round(((rank1.wins || 0) / rank1.gamesPlayed) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                </div>
              )}

              {/* Hạng 3 (Đồng - Quý Quân) */}
              {rank3 && (
                <div
                  onClick={() => handleOpenProfile(rank3)}
                  className="order-3 rounded-3xl bg-gradient-to-b from-stone-800/90 via-stone-900/95 to-stone-950 border border-amber-800/60 p-5 flex flex-col items-center text-center cursor-pointer hover:border-amber-700 transition-all shadow-xl hover:-translate-y-1 group relative overflow-hidden"
                >
                  <div className="relative mb-2.5">
                    <div className="w-15 h-15 rounded-full bg-stone-800 border-2 border-amber-700 flex items-center justify-center text-2xl shadow-lg ring-4 ring-amber-700/20">
                      🥉
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-700 text-white text-xs font-black flex items-center justify-center shadow-md">
                      3
                    </span>
                  </div>
                  <div className="text-sm font-extrabold text-stone-100 group-hover:text-amber-300 transition-colors truncate max-w-[180px]">
                    {rank3.displayName || rank3.username}
                  </div>
                  <div className="text-[11px] text-amber-600/90 font-semibold mt-0.5">
                    {getEloRankTitle(rank3.elo)}
                  </div>
                  <div className="mt-2 text-lg font-black font-mono-num text-amber-300">
                    {rank3.elo} <span className="text-xs font-normal text-stone-400">Elo</span>
                  </div>
                  <div className="text-[10px] text-stone-400 mt-1 font-mono-num">
                    {rank3.gamesPlayed || 0} ván · Thắng{' '}
                    {rank3.gamesPlayed
                      ? Math.round(((rank3.wins || 0) / rank3.gamesPlayed) * 100)
                      : 0}
                    %
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      {/* 3. Bảng xếp hạng chi tiết (Từ hạng 4 trở đi) */}
      <div
        className="relative rounded-3xl border border-stone-800/90 p-5 sm:p-6 shadow-2xl overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(20, 18, 17, 0.92) 0%, rgba(10, 9, 8, 0.97) 100%), url('/images/leaderboard_bg.jpg')`,
        }}
      >
        <div className="flex items-center justify-between mb-4 border-b border-stone-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Medal className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-stone-200 uppercase tracking-wider">
              Danh Sách Xếp Hạng Kỳ Thủ
            </h3>
          </div>
          <span className="text-xs text-stone-400 font-mono-num">
            Tổng cộng: {entries.length} kỳ thủ
          </span>
        </div>

        {loading ? (
          <div className="space-y-2 py-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-stone-800/50 animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-stone-500">
            <Trophy className="w-10 h-10 stroke-1 text-stone-600" />
            <p className="text-xs text-stone-400">Chưa có kỳ thủ nào trong bảng này</p>
          </div>
        ) : (
          <div className="overflow-x-auto pt-1">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-stone-800 text-stone-400 text-xs">
                  <th className="py-3 px-3 font-semibold">Hạng</th>
                  <th className="py-3 px-3 font-semibold">Kỳ thủ</th>
                  <th className="py-3 px-3 font-semibold">Cấp bậc</th>
                  <th className="py-3 px-3 font-semibold text-right">Elo</th>
                  <th className="py-3 px-3 font-semibold text-right">Số ván</th>
                  <th className="py-3 px-3 font-semibold text-right">Tỷ lệ thắng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 font-mono-num">
                {entries.map((row, index) => {
                  const games = row.gamesPlayed || 0;
                  const winRate = games > 0 ? Math.round(((row.wins || 0) / games) * 100) : 0;
                  const rankTitle = getEloRankTitle(row.elo, row.hiddenFromLeaderboard);
                  const isTop3 = index < 3;

                  return (
                    <tr
                      key={row.id || row.uid}
                      onClick={() => handleOpenProfile(row)}
                      className="hover:bg-stone-800/50 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-3 font-bold text-stone-400">
                        {index === 0 && <span className="text-amber-400 text-sm">🥇 #1</span>}
                        {index === 1 && <span className="text-slate-300 text-sm">🥈 #2</span>}
                        {index === 2 && <span className="text-amber-700 text-sm">🥉 #3</span>}
                        {index >= 3 && <span>#{index + 1}</span>}
                      </td>

                      <td className="py-3 px-3 font-sans font-semibold text-stone-100 group-hover:text-amber-300 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-stone-800 flex items-center justify-center text-xs">
                            🐵
                          </span>
                          <span>{row.displayName || row.username}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-sans text-stone-400 text-xs">{rankTitle}</td>

                      <td className="py-3 px-3 text-right font-extrabold text-amber-300">
                        {row.elo}
                      </td>

                      <td className="py-3 px-3 text-right text-stone-300">{games}</td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-14 h-1.5 rounded-full bg-stone-800 overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${winRate}%` }}
                            />
                          </div>
                          <span className="text-stone-300">{winRate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Sheet Hồ Sơ Kỳ Thủ (Player Profile Sheet / Drawer) */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-3xl bg-stone-900 border border-stone-800 p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            {/* Header hồ sơ with background banner */}
            <div
              className="relative rounded-2xl overflow-hidden p-4 border border-amber-900/40 bg-cover bg-center flex items-start justify-between"
              style={{
                backgroundImage: `linear-gradient(to right, rgba(24, 22, 20, 0.92) 0%, rgba(12, 10, 9, 0.8) 100%), url('/images/champion_hall.jpg')`,
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-13 h-13 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl shadow-inner backdrop-blur-xs">
                  👑
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-stone-100">
                      {selectedPlayer.displayName || selectedPlayer.username}
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/35 font-bold">
                      {getEloRankTitle(selectedPlayer.elo)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-300 mt-1 font-mono-num">
                    Elo hiện tại: <span className="text-amber-400 font-extrabold">{selectedPlayer.elo}</span> · Thắng: {selectedPlayer.wins || 0} / {selectedPlayer.gamesPlayed || 0} ván
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedPlayer(null)}
                className="p-1.5 rounded-xl bg-stone-950/80 hover:bg-stone-800 text-stone-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab chuyển Thống kê / Lịch sử đấu */}
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-stone-950 border border-stone-800 text-xs">
              <button
                onClick={() => setPlayerTab('stats')}
                className={`flex-1 py-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  playerTab === 'stats'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Thống kê</span>
              </button>
              <button
                onClick={() => setPlayerTab('history')}
                className={`flex-1 py-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  playerTab === 'history'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Lịch sử ({playerGames.length})</span>
              </button>
            </div>

            {/* Nội dung Tab Thống kê */}
            {playerTab === 'stats' && (
              <div className="space-y-4 py-2 overflow-y-auto">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-2xl bg-stone-950/80 border border-stone-800">
                    <div className="text-lg font-black text-emerald-400 font-mono-num">
                      {selectedPlayer.wins || 0}
                    </div>
                    <div className="text-[11px] text-stone-400 mt-0.5">Thắng</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-stone-950/80 border border-stone-800">
                    <div className="text-lg font-black text-stone-300 font-mono-num">
                      {selectedPlayer.draws || 0}
                    </div>
                    <div className="text-[11px] text-stone-400 mt-0.5">Hòa</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-stone-950/80 border border-stone-800">
                    <div className="text-lg font-black text-red-400 font-mono-num">
                      {selectedPlayer.losses || 0}
                    </div>
                    <div className="text-[11px] text-stone-400 mt-0.5">Thua</div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-stone-950/70 border border-stone-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-stone-300">
                    <span>Tổng số trận đã đấu:</span>
                    <span className="font-bold font-mono-num">{selectedPlayer.gamesPlayed || 0} ván</span>
                  </div>
                  <div className="flex items-center justify-between text-stone-300">
                    <span>Tỷ lệ thắng:</span>
                    <span className="font-bold text-emerald-400 font-mono-num">
                      {selectedPlayer.gamesPlayed
                        ? Math.round(((selectedPlayer.wins || 0) / selectedPlayer.gamesPlayed) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-stone-300">
                    <span>Chuỗi thắng dài nhất:</span>
                    <span className="font-bold text-amber-400 font-mono-num">
                      {selectedPlayer.winStreak ?? 0} ván
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Nội dung Tab Lịch sử đấu */}
            {playerTab === 'history' && (
              <div className="space-y-2 py-2 flex-1 overflow-y-auto max-h-[360px]">
                {loadingGames ? (
                  <div className="py-8 text-center text-xs text-stone-500">Đang tải lịch sử…</div>
                ) : playerGames.length === 0 ? (
                  <div className="py-8 text-center text-xs text-stone-500">Chưa có ván đấu nào được lưu</div>
                ) : (
                  playerGames.map((g) => {
                    const isRedPlayer = g.redUid === selectedPlayer.uid;
                    const opponentName = isRedPlayer ? g.blackName : g.redName;
                    const isWin =
                      (g.winner === 'red' && isRedPlayer) ||
                      (g.winner === 'black' && !isRedPlayer);
                    const isDraw = g.winner === 'draw';

                    return (
                      <div
                        key={g.id}
                        className="p-3 rounded-2xl bg-stone-950/80 border border-stone-800/80 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                isWin
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : isDraw
                                  ? 'bg-stone-800 text-stone-300'
                                  : 'bg-red-500/20 text-red-300 border border-red-500/40'
                              }`}
                            >
                              {isWin ? 'THẮNG' : isDraw ? 'HÒA' : 'THUA'}
                            </span>
                            <span className="font-semibold text-stone-200 truncate">
                              vs {opponentName}
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-400 mt-1 flex items-center gap-2">
                            <span>{g.mode === 'blitz' ? 'Cờ chớp' : g.mode === 'dark' ? 'Cờ úp' : 'Tiêu chuẩn'}</span>
                            <span>·</span>
                            <span>{new Date(g.createdAt).toLocaleDateString('vi-VN')}</span>
                          </div>
                        </div>

                        {g.wxfText && onOpenViewer && (
                          <button
                            onClick={() => {
                              onOpenViewer(g.wxfText);
                              setSelectedPlayer(null);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium whitespace-nowrap transition-colors"
                          >
                            Xem kỳ phổ
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
