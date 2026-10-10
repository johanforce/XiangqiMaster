import React, { useState, useEffect } from 'react';
import { Trophy, Flame, Clock, EyeOff, RefreshCw } from 'lucide-react';
import { RatedMode, getEloRankTitle } from '../shared/elo';

export const LeaderboardView: React.FC = () => {
  const [mode, setMode] = useState<RatedMode>('blitz');
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('all');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl bg-stone-900/90 border border-stone-800 p-4 sm:p-6 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-base font-semibold text-stone-100">
          <Trophy className="w-5 h-5 text-amber-500" />
          <span>Bảng xếp hạng</span>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-950 border border-stone-800 text-xs">
          <button
            onClick={() => setMode('blitz')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
              mode === 'blitz' ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Cờ chớp</span>
          </button>
          <button
            onClick={() => setMode('standard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
              mode === 'standard'
                ? 'bg-amber-600 text-white'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Tiêu chuẩn</span>
          </button>
          <button
            onClick={() => setMode('dark')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
              mode === 'dark' ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Cờ úp</span>
          </button>
        </div>

        {/* Period Filter */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-950 border border-stone-800 text-xs">
          {(
            [
              ['week', 'Tuần'],
              ['month', 'Tháng'],
              ['all', 'Mọi thời đại'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                period === key ? 'bg-stone-800 text-stone-100' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-11 rounded-xl bg-stone-800/50 animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-stone-500">
          <Trophy className="w-8 h-8 stroke-1" />
          <button
            onClick={fetchLeaderboard}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs text-stone-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tải lại</span>
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-stone-800 text-stone-400 text-xs">
                <th className="py-2.5 px-3 font-medium">Hạng</th>
                <th className="py-2.5 px-3 font-medium">Kỳ thủ</th>
                <th className="py-2.5 px-3 font-medium">Cấp bậc</th>
                <th className="py-2.5 px-3 font-medium text-right">Elo</th>
                <th className="py-2.5 px-3 font-medium text-right">Số ván</th>
                <th className="py-2.5 px-3 font-medium text-right">Tỷ lệ thắng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 font-mono-num">
              {entries.map((row, index) => {
                const games = row.gamesPlayed || 0;
                const winRate = games > 0 ? Math.round(((row.wins || 0) / games) * 100) : 0;
                const rankTitle = getEloRankTitle(row.elo, row.hiddenFromLeaderboard);
                return (
                  <tr key={row.id} className="hover:bg-stone-800/40 transition-colors">
                    <td className="py-3 px-3 font-bold text-amber-400">#{index + 1}</td>
                    <td className="py-3 px-3 font-sans font-semibold text-stone-100">
                      {row.username}
                    </td>
                    <td className="py-3 px-3 font-sans text-stone-400">{rankTitle}</td>
                    <td className="py-3 px-3 text-right font-bold text-amber-300">{row.elo}</td>
                    <td className="py-3 px-3 text-right text-stone-300">{games}</td>
                    <td className="py-3 px-3 text-right text-stone-300">{winRate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
