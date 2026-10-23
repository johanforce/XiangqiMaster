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
  Info,
} from 'lucide-react';
import { RatedMode, getEloRankTier, ELO_RANK_TIERS } from '../shared/elo';
import { navigateUrl, handleLinkClick } from '../utils/navigation';
import { BoardTheme } from '../utils/themes';

interface LeaderboardViewProps {
  onOpenViewer?: (notationText: string) => void;
  theme?: BoardTheme;
}

function parseLeaderboardUrl() {
  const path = window.location.pathname;
  const search = new URLSearchParams(window.location.search);
  let mode: RatedMode = 'standard';
  if (path.startsWith('/leaderboard/blitz')) mode = 'blitz';
  else if (path.startsWith('/leaderboard/dark')) mode = 'dark';
  else if (path.startsWith('/leaderboard/standard')) mode = 'standard';

  const p = search.get('period');
  const period: 'week' | 'month' | 'all' =
    p === 'week' || p === 'month' ? p : 'all';

  const playerMatch = path.match(/^\/leaderboard\/(?:blitz|standard|dark)\/player\/([^/?#]+)/);
  const playerUid = playerMatch ? decodeURIComponent(playerMatch[1]) : null;

  const t = search.get('tab');
  const playerTab: 'stats' | 'history' = t === 'history' ? 'history' : 'stats';

  return { mode, period, playerUid, playerTab };
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ onOpenViewer, theme }) => {
  const initialUrlState = parseLeaderboardUrl();
  const [mode, setMode] = useState<RatedMode>(initialUrlState.mode);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>(initialUrlState.period);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [playerTab, setPlayerTab] = useState<'stats' | 'history'>(initialUrlState.playerTab);
  const [playerGames, setPlayerGames] = useState<any[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [rankInfoOpen, setRankInfoOpen] = useState(false);

  const buildLeaderboardUrl = (
    m: RatedMode = mode,
    p: 'week' | 'month' | 'all' = period,
    uid?: string | null,
    tab?: 'stats' | 'history'
  ) => {
    const base = uid
      ? `/leaderboard/${m}/player/${encodeURIComponent(uid)}`
      : `/leaderboard/${m}`;
    const params = new URLSearchParams();
    if (p !== 'all') params.set('period', p);
    if (uid && tab && tab !== 'stats') params.set('tab', tab);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?mode=${mode}&period=${period}`, {
        cache: 'no-store',
      });
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

  const handleOpenProfile = async (
    player: any,
    initialTab: 'stats' | 'history' = 'stats',
    pushUrl = true
  ) => {
    setSelectedPlayer(player);
    setPlayerTab(initialTab);
    if (pushUrl && player?.uid) {
      navigateUrl(buildLeaderboardUrl(mode, period, player.uid, initialTab));
    }
    setLoadingGames(true);
    try {
      const res = await fetch(`/api/games?uid=${player.uid}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      setPlayerGames(data.games || []);
    } catch {
      setPlayerGames([]);
    } finally {
      setLoadingGames(false);
    }
  };

  const handleCloseProfile = () => {
    setSelectedPlayer(null);
    navigateUrl(buildLeaderboardUrl(mode, period, null));
  };

  // Sync URL -> state on popstate / app:locationchange or when entries load
  useEffect(() => {
    const syncFromUrl = () => {
      const parsed = parseLeaderboardUrl();
      if (parsed.mode !== mode) setMode(parsed.mode);
      if (parsed.period !== period) setPeriod(parsed.period);
      setPlayerTab(parsed.playerTab);
      if (!parsed.playerUid) {
        setSelectedPlayer(null);
      } else if (entries.length > 0) {
        const found = entries.find(
          (e) => String(e.uid).toLowerCase() === parsed.playerUid!.toLowerCase()
        );
        if (found && (!selectedPlayer || selectedPlayer.uid !== found.uid)) {
          void handleOpenProfile(found, parsed.playerTab, false);
        }
      }
    };

    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('app:locationchange', syncFromUrl);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('app:locationchange', syncFromUrl);
    };
  }, [entries, mode, period]);

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
          backgroundImage: `linear-gradient(to bottom, rgba(17, 15, 14, 0.82) 0%, rgba(12, 10, 9, 0.94) 100%), url('${theme?.images?.championHall || '/images/champion_hall.jpg'}')`,
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
                <button
                  type="button"
                  onClick={() => setRankInfoOpen(true)}
                  title="Xem bảng phân chia cấp bậc Elo"
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Tôn vinh các Đại Sư và Kì Tiên cờ tướng hàng đầu hệ thống
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Bộ lọc thể loại có đường dẫn trực tiếp */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-stone-950 border border-stone-800 text-xs">
              <a
                href={buildLeaderboardUrl('blitz', period)}
                onClick={(e) =>
                  handleLinkClick(e, buildLeaderboardUrl('blitz', period), () => setMode('blitz'))
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all ${
                  mode === 'blitz'
                    ? theme?.web.primaryBtnClass || 'bg-amber-600 text-white shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Cờ chớp</span>
              </a>
              <a
                href={buildLeaderboardUrl('standard', period)}
                onClick={(e) =>
                  handleLinkClick(e, buildLeaderboardUrl('standard', period), () =>
                    setMode('standard')
                  )
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all ${
                  mode === 'standard'
                    ? theme?.web.primaryBtnClass || 'bg-amber-600 text-white shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Tiêu chuẩn</span>
              </a>
              <a
                href={buildLeaderboardUrl('dark', period)}
                onClick={(e) =>
                  handleLinkClick(e, buildLeaderboardUrl('dark', period), () => setMode('dark'))
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all ${
                  mode === 'dark'
                    ? theme?.web.primaryBtnClass || 'bg-amber-600 text-white shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Cờ úp</span>
              </a>
            </div>

            {/* Bộ lọc thời gian có đường dẫn trực tiếp */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-stone-950 border border-stone-800 text-xs">
              {(
                [
                  ['week', 'Tuần'],
                  ['month', 'Tháng'],
                  ['all', 'Tất cả'],
                ] as const
              ).map(([key, label]) => {
                const pUrl = buildLeaderboardUrl(mode, key);
                return (
                  <a
                    key={key}
                    href={pUrl}
                    onClick={(e) => handleLinkClick(e, pUrl, () => setPeriod(key))}
                    className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                      period === key
                        ? 'bg-stone-800 text-stone-100 shadow-sm'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {label}
                  </a>
                );
              })}
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

        {/* 2. Bục vinh danh Top 3 (Championship Podium) có đường dẫn trực tiếp */}
        {!loading && top3.length > 0 && (
          <div className="pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
              {/* Hạng 2 (Bạc - Á Quân) */}
              {rank2 && (
                <a
                  href={buildLeaderboardUrl(mode, period, rank2.uid)}
                  onClick={(e) =>
                    handleLinkClick(e, buildLeaderboardUrl(mode, period, rank2.uid), () =>
                      handleOpenProfile(rank2, 'stats', false)
                    )
                  }
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
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${
                        getEloRankTier(rank2.elo, rank2.hiddenFromLeaderboard).badgeColor
                      }`}
                    >
                      {getEloRankTier(rank2.elo, rank2.hiddenFromLeaderboard).title}
                    </span>
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
                </a>
              )}

              {/* Hạng 1 (Vàng - Quán Quân Kỳ Đàn) */}
              {rank1 && (
                <a
                  href={buildLeaderboardUrl(mode, period, rank1.uid)}
                  onClick={(e) =>
                    handleLinkClick(e, buildLeaderboardUrl(mode, period, rank1.uid), () =>
                      handleOpenProfile(rank1, 'stats', false)
                    )
                  }
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
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                        getEloRankTier(rank1.elo, rank1.hiddenFromLeaderboard).badgeColor
                      }`}
                    >
                      {getEloRankTier(rank1.elo, rank1.hiddenFromLeaderboard).title}
                    </span>
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
                </a>
              )}

              {/* Hạng 3 (Đồng - Quý Quân) */}
              {rank3 && (
                <a
                  href={buildLeaderboardUrl(mode, period, rank3.uid)}
                  onClick={(e) =>
                    handleLinkClick(e, buildLeaderboardUrl(mode, period, rank3.uid), () =>
                      handleOpenProfile(rank3, 'stats', false)
                    )
                  }
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
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${
                        getEloRankTier(rank3.elo, rank3.hiddenFromLeaderboard).badgeColor
                      }`}
                    >
                      {getEloRankTier(rank3.elo, rank3.hiddenFromLeaderboard).title}
                    </span>
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
                </a>
              )}

            </div>
          </div>
        )}
      </div>

      {/* 3. Bảng xếp hạng chi tiết (Từ hạng 4 trở đi) */}
      <div
        className="relative rounded-3xl border border-stone-800/90 p-5 sm:p-6 shadow-2xl overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(20, 18, 17, 0.92) 0%, rgba(10, 9, 8, 0.97) 100%), url('${theme?.images?.leaderboardBg || '/images/leaderboard_bg.jpg'}')`,
        }}
      >
        <div className="flex items-center justify-between mb-4 border-b border-stone-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Medal className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-stone-200 uppercase tracking-wider">
              Danh Sách Xếp Hạng Kỳ Thủ
            </h3>
            <button
              type="button"
              onClick={() => setRankInfoOpen(true)}
              title="Bảng phân chia cấp bậc Elo"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-800/90 hover:bg-stone-700 border border-stone-700 text-amber-300 text-[11px] font-medium transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5" />
              <span>Cấp bậc</span>
            </button>
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
                  <th className="py-3 px-3 font-semibold">
                    <button
                      type="button"
                      onClick={() => setRankInfoOpen(true)}
                      className="inline-flex items-center gap-1 hover:text-amber-300 transition-colors cursor-pointer"
                      title="Xem bảng phân chia cấp bậc"
                    >
                      <span>Cấp bậc</span>
                      <Info className="w-3.5 h-3.5 text-amber-400/80" />
                    </button>
                  </th>
                  <th className="py-3 px-3 font-semibold text-right">Elo</th>
                  <th className="py-3 px-3 font-semibold text-right">Số ván</th>
                  <th className="py-3 px-3 font-semibold text-right">Tỷ lệ thắng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 font-mono-num">
                {entries.map((row, index) => {
                  const games = row.gamesPlayed || 0;
                  const winRate = games > 0 ? Math.round(((row.wins || 0) / games) * 100) : 0;
                  const rankTier = getEloRankTier(row.elo, row.hiddenFromLeaderboard);
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
                        <a
                          href={buildLeaderboardUrl(mode, period, row.uid)}
                          onClick={(e) =>
                            handleLinkClick(e, buildLeaderboardUrl(mode, period, row.uid), () =>
                              handleOpenProfile(row, 'stats', false)
                            )
                          }
                          className="flex items-center gap-2"
                        >
                          <span className="w-6 h-6 rounded-full bg-stone-800 flex items-center justify-center text-xs">
                            🐵
                          </span>
                          <span>{row.displayName || row.username}</span>
                        </a>
                      </td>

                      <td className="py-3 px-3 font-sans">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border whitespace-nowrap ${rankTier.badgeColor}`}
                        >
                          {rankTier.title}
                        </span>
                      </td>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl bg-stone-900 border border-stone-800 p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col my-auto">
            {/* Header hồ sơ with background banner */}
            <div
              className="relative rounded-2xl overflow-hidden p-4 border border-amber-900/40 bg-cover bg-center flex items-start justify-between"
              style={{
                backgroundImage: `linear-gradient(to right, rgba(24, 22, 20, 0.92) 0%, rgba(12, 10, 9, 0.8) 100%), url('${theme?.images?.championHall || '/images/champion_hall.jpg'}')`,
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
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                        getEloRankTier(selectedPlayer.elo, selectedPlayer.hiddenFromLeaderboard).badgeColor
                      }`}
                    >
                      {getEloRankTier(selectedPlayer.elo, selectedPlayer.hiddenFromLeaderboard).title}
                    </span>
                  </div>
                  <p className="text-xs text-stone-300 mt-1 font-mono-num">
                    Elo hiện tại: <span className="text-amber-400 font-extrabold">{selectedPlayer.elo}</span> · Thắng: {selectedPlayer.wins || 0} / {selectedPlayer.gamesPlayed || 0} ván
                  </p>
                </div>
              </div>

              <button
                onClick={handleCloseProfile}
                className="p-1.5 rounded-xl bg-stone-950/80 hover:bg-stone-800 text-stone-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab chuyển Thống kê / Lịch sử đấu có đường dẫn trực tiếp */}
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-stone-950 border border-stone-800 text-xs">
              <a
                href={buildLeaderboardUrl(mode, period, selectedPlayer.uid, 'stats')}
                onClick={(e) =>
                  handleLinkClick(
                    e,
                    buildLeaderboardUrl(mode, period, selectedPlayer.uid, 'stats'),
                    () => setPlayerTab('stats')
                  )
                }
                className={`flex-1 py-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  playerTab === 'stats'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Thống kê</span>
              </a>
              <a
                href={buildLeaderboardUrl(mode, period, selectedPlayer.uid, 'history')}
                onClick={(e) =>
                  handleLinkClick(
                    e,
                    buildLeaderboardUrl(mode, period, selectedPlayer.uid, 'history'),
                    () => setPlayerTab('history')
                  )
                }
                className={`flex-1 py-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  playerTab === 'history'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Lịch sử ({playerGames.length})</span>
              </a>
            </div>

            {/* Nội dung Tab Thống kê */}
            {playerTab === 'stats' && (() => {
              const uId = String(selectedPlayer.uid || '').toLowerCase();
              const uName = String(selectedPlayer.username || '').toLowerCase();
              const dName = String(selectedPlayer.displayName || '').toLowerCase();
              const pureUid = uId.startsWith('admin_')
                ? uId.slice(6)
                : uId.startsWith('u_')
                ? uId.slice(2)
                : uId;

              const modeGames = [...playerGames]
                .filter((g) => (g.mode || 'standard') === mode)
                .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

              let curStreak = 0;
              let maxStreakFromGames = 0;
              for (const g of modeGames) {
                const rUid = String(g.redUid || '').toLowerCase();
                const bUid = String(g.blackUid || '').toLowerCase();
                const rName = String(g.redName || '').toLowerCase();
                const bName = String(g.blackName || '').toLowerCase();

                const isRed =
                  (Boolean(rUid) &&
                    (rUid === uId ||
                      rUid === uName ||
                      rUid === `admin_${uName}` ||
                      rUid === `u_${uName}` ||
                      rUid === pureUid)) ||
                  (Boolean(uName) && rName === uName) ||
                  (Boolean(dName) && rName === dName);

                const isBlack =
                  (Boolean(bUid) &&
                    (bUid === uId ||
                      bUid === uName ||
                      bUid === `admin_${uName}` ||
                      bUid === `u_${uName}` ||
                      bUid === pureUid)) ||
                  (Boolean(uName) && bName === uName) ||
                  (Boolean(dName) && bName === dName);

                const winnerNorm = String(g.winner || '').trim().toLowerCase();
                const isRedWin = winnerNorm === 'r' || winnerNorm === 'red';
                const isBlackWin = winnerNorm === 'b' || winnerNorm === 'black';
                const isDrawResult =
                  winnerNorm === 'draw' ||
                  winnerNorm === 'd' ||
                  winnerNorm === 'tie' ||
                  winnerNorm === 'hòa' ||
                  winnerNorm === 'hoa';

                let outcome: 'win' | 'draw' | 'loss' = 'loss';
                if (isDrawResult) {
                  outcome = 'draw';
                } else if (isRed && isRedWin) {
                  outcome = 'win';
                } else if (isBlack && isBlackWin) {
                  outcome = 'win';
                } else if (isRed && isBlackWin) {
                  outcome = 'loss';
                } else if (isBlack && isRedWin) {
                  outcome = 'loss';
                } else {
                  const eloDelta = isRed ? g.redEloDelta : isBlack ? g.blackEloDelta : undefined;
                  if (typeof eloDelta === 'number') {
                    outcome = eloDelta > 0 ? 'win' : eloDelta < 0 ? 'loss' : 'draw';
                  } else {
                    outcome = 'draw';
                  }
                }

                if (outcome === 'win') {
                  curStreak += 1;
                  if (curStreak > maxStreakFromGames) maxStreakFromGames = curStreak;
                } else {
                  curStreak = 0;
                }
              }

              const longestWinStreak = Math.max(
                Number(selectedPlayer.longestWinStreak || 0),
                Number(selectedPlayer.winStreak || 0),
                maxStreakFromGames,
                Number(selectedPlayer.wins || 0) > 0 ? 1 : 0
              );

              return (
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
                        {longestWinStreak} ván
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Nội dung Tab Lịch sử đấu */}
            {playerTab === 'history' && (
              <div className="space-y-2 py-2 flex-1 overflow-y-auto max-h-[360px]">
                {loadingGames ? (
                  <div className="py-8 text-center text-xs text-stone-500">Đang tải lịch sử…</div>
                ) : playerGames.length === 0 ? (
                  <div className="py-8 text-center text-xs text-stone-500">Chưa có ván đấu nào được lưu</div>
                ) : (
                  playerGames.map((g) => {
                    const uId = String(selectedPlayer.uid || '').toLowerCase();
                    const uName = String(selectedPlayer.username || '').toLowerCase();
                    const dName = String(selectedPlayer.displayName || '').toLowerCase();

                    const rUid = String(g.redUid || '').toLowerCase();
                    const bUid = String(g.blackUid || '').toLowerCase();
                    const rName = String(g.redName || '').toLowerCase();
                    const bName = String(g.blackName || '').toLowerCase();

                    const isRed =
                      (Boolean(rUid) &&
                        (rUid === uId ||
                          rUid === uName ||
                          rUid === `admin_${uName}` ||
                          (uId.startsWith('admin_') && rUid === uId.replace('admin_', '')))) ||
                      (Boolean(uName) && rName === uName) ||
                      (Boolean(dName) && rName === dName);

                    const isBlack =
                      (Boolean(bUid) &&
                        (bUid === uId ||
                          bUid === uName ||
                          bUid === `admin_${uName}` ||
                          (uId.startsWith('admin_') && bUid === uId.replace('admin_', '')))) ||
                      (Boolean(uName) && bName === uName) ||
                      (Boolean(dName) && bName === dName);

                    // Check winner flag: handle 'r', 'red', 'b', 'black', 'draw', etc.
                    const winnerNorm = String(g.winner || '').trim().toLowerCase();
                    const isRedWin = winnerNorm === 'r' || winnerNorm === 'red';
                    const isBlackWin = winnerNorm === 'b' || winnerNorm === 'black';
                    const isDrawResult =
                      winnerNorm === 'draw' ||
                      winnerNorm === 'd' ||
                      winnerNorm === 'tie' ||
                      winnerNorm === 'hòa' ||
                      winnerNorm === 'hoa';

                    let outcome: 'win' | 'draw' | 'loss' = 'loss';
                    if (isDrawResult) {
                      outcome = 'draw';
                    } else if (isRed && isRedWin) {
                      outcome = 'win';
                    } else if (isBlack && isBlackWin) {
                      outcome = 'win';
                    } else if (isRed && isBlackWin) {
                      outcome = 'loss';
                    } else if (isBlack && isRedWin) {
                      outcome = 'loss';
                    } else {
                      // Fallback: check Elo delta if available
                      const eloDelta = isRed ? g.redEloDelta : isBlack ? g.blackEloDelta : undefined;
                      if (typeof eloDelta === 'number') {
                        if (eloDelta > 0) outcome = 'win';
                        else if (eloDelta < 0) outcome = 'loss';
                        else outcome = 'draw';
                      } else {
                        outcome = 'draw';
                      }
                    }

                    const isWin = outcome === 'win';
                    const isDraw = outcome === 'draw';
                    const opponentName = isRed ? g.blackName || 'Đối thủ' : g.redName || 'Đối thủ';
                    const playerColor = isRed ? 'Đỏ' : isBlack ? 'Đen' : '';
                    const eloDelta = isRed ? g.redEloDelta : isBlack ? g.blackEloDelta : undefined;

                    const viewerPayload =
                      g.initialFen && g.initialFen !== 'rnbakabnr/9/1c5c1/s1p1p1p1s/9/9/S1P1P1P1S/1C5C1/9/RNBAKABNR r - - 0 1'
                        ? `[FEN "${g.initialFen}"]\n${g.wxfText || ''}`
                        : (g.wxfText || '');

                    return (
                      <div
                        key={g.id}
                        className="p-3 rounded-2xl bg-stone-950/80 border border-stone-800/80 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                isWin
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : isDraw
                                  ? 'bg-stone-800 text-stone-300 border border-stone-700'
                                  : 'bg-red-500/20 text-red-300 border border-red-500/40'
                              }`}
                            >
                              {isWin ? 'THẮNG' : isDraw ? 'HÒA' : 'THUA'}
                            </span>
                            <span className="font-semibold text-stone-200 truncate">
                              vs {opponentName}
                            </span>
                            {playerColor && (
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                  playerColor === 'Đỏ'
                                    ? 'bg-red-950/60 text-red-400 border border-red-900/40'
                                    : 'bg-stone-800 text-stone-300 border border-stone-700'
                                }`}
                              >
                                {playerColor === 'Đỏ' ? 'Cầm Đỏ' : 'Cầm Đen'}
                              </span>
                            )}
                            {typeof eloDelta === 'number' && (
                              <span
                                className={`text-[10px] font-mono-num font-bold ${
                                  eloDelta > 0
                                    ? 'text-emerald-400'
                                    : eloDelta < 0
                                    ? 'text-red-400'
                                    : 'text-stone-400'
                                }`}
                              >
                                {eloDelta > 0 ? `+${eloDelta}` : eloDelta} Elo
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-stone-400 mt-1 flex items-center gap-2 flex-wrap">
                            <span>{g.mode === 'blitz' ? 'Cờ chớp' : g.mode === 'dark' ? 'Cờ úp' : 'Tiêu chuẩn'}</span>
                            {g.reason && (
                              <>
                                <span>·</span>
                                <span className="text-stone-300 font-medium">{g.reason}</span>
                              </>
                            )}
                            <span>·</span>
                            <span>{new Date(g.createdAt).toLocaleDateString('vi-VN')}</span>
                          </div>
                        </div>

                        {g.wxfText && onOpenViewer && (
                          <button
                            onClick={() => {
                              onOpenViewer(viewerPayload);
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

      {/* 5. Dialog Bảng Phân Chia Cấp Bậc Elo */}
      {rankInfoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
          onClick={() => setRankInfoOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl bg-stone-900 border border-stone-800 p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-stone-100">
                    Bảng Phân Chia Cấp Bậc Elo
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Hệ thống danh hiệu kỳ đàn theo điểm số Elo (từ cao xuống thấp)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRankInfoOpen(false)}
                className="p-1.5 rounded-xl bg-stone-950 hover:bg-stone-800 text-stone-400 hover:text-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto overflow-y-auto pr-1">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-stone-800 text-stone-400 text-xs whitespace-nowrap">
                    <th className="py-2.5 px-3 font-semibold">Mốc Elo</th>
                    <th className="py-2.5 px-3 font-semibold">Danh hiệu</th>
                    <th className="py-2.5 px-3 font-semibold">Mô tả</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60">
                  {ELO_RANK_TIERS.map((tier, idx) => (
                    <tr key={idx} className="hover:bg-stone-800/40 transition-colors whitespace-nowrap">
                      <td className="py-2.5 px-3 font-mono-num font-bold text-amber-300 whitespace-nowrap">
                        {tier.range}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border whitespace-nowrap ${tier.badgeColor}`}
                        >
                          {tier.title}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-stone-400 whitespace-nowrap">
                        {tier.desc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-[11px] text-stone-400">
              <span>Điểm khởi đầu mặc định: 1300 Elo (Unrank)</span>
              <button
                type="button"
                onClick={() => setRankInfoOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

