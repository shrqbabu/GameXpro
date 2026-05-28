import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Clock, Sword } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { StatCard } from '../components/ui/GlassCard';
import { Badge } from '../components/ui/Badge';
import { formatCurrency, generateMockMatchHistory, formatDateTime } from '../utils/helpers';
import type { MatchHistory } from '../types';

export const MatchHistoryPage: React.FC = () => {
  const { userProfile } = useAuth();
  const [history, setHistory] = useState<MatchHistory[]>([]);

  useEffect(() => {
    if (userProfile) {
      setHistory(generateMockMatchHistory(userProfile.uid));
    }
  }, [userProfile]);

  if (!userProfile) return null;

  const totalProfit = history.reduce((sum, h) => sum + h.profit, 0);
  const wins = history.filter((h) => h.profit > 0).length;
  const losses = history.filter((h) => h.profit < 0).length;
  const winRate = history.length > 0 ? Math.round((wins / history.length) * 100) : 0;
  const biggestWin = Math.max(...history.map((h) => h.profit), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-2xl">
          📊
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Match History</h1>
          <p className="text-gray-400 text-sm">{history.length} games played</p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total P&L"
          value={`${totalProfit >= 0 ? '+' : ''}${formatCurrency(totalProfit)}`}
          icon={totalProfit >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          color={totalProfit >= 0 ? 'green' : 'red'}
          delay={0.1}
        />
        <StatCard
          title="Win Rate"
          value={`${winRate}%`}
          icon={<Trophy className="w-5 h-5" />}
          color="gold"
          delay={0.2}
          subtitle={`${wins}W / ${losses}L`}
        />
        <StatCard
          title="Games Played"
          value={history.length}
          icon={<Sword className="w-5 h-5" />}
          color="purple"
          delay={0.3}
        />
        <StatCard
          title="Biggest Win"
          value={formatCurrency(biggestWin)}
          icon={<Trophy className="w-5 h-5" />}
          color="blue"
          delay={0.4}
        />
      </div>

      {/* Match list */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-2xl overflow-hidden"
      >
        <div className="p-4 border-b border-white/5">
          <h3 className="text-white font-semibold">Recent Games</h3>
        </div>

        {history.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">🎰</div>
            <p className="text-gray-400">No games played yet</p>
            <p className="text-gray-600 text-sm mt-1">Join a poker table to start playing!</p>
          </div>
        ) : (
          history.map((match, i) => (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`p-4 hover:bg-white/3 transition-colors ${i < history.length - 1 ? 'border-b border-white/5' : ''}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0
                    ${match.profit > 0 ? 'bg-emerald-500/15' : 'bg-red-500/15'}
                  `}>
                    {match.profit > 0 ? '🏆' : '📉'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium">{match.tableName}</p>
                      {match.bestHand && (
                        <Badge variant="purple" size="xs">{match.bestHand}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(match.createdAt)}
                      </span>
                      <span>{match.handsPlayed} hands</span>
                      <span>{match.duration}min</span>
                      <span>#{match.position}/{match.totalPlayers}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 sm:flex-col sm:items-end">
                  <div className="text-right">
                    <p className="text-gray-400 text-xs">Buy-in / Cashout</p>
                    <p className="text-white text-sm font-mono">
                      {formatCurrency(match.buyIn)} → {formatCurrency(match.cashOut)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold font-mono ${match.profit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {match.profit > 0 ? '+' : ''}{formatCurrency(match.profit)}
                    </p>
                    <Badge variant={match.profit > 0 ? 'green' : 'red'} size="xs">
                      {match.profit > 0 ? 'Win' : 'Loss'}
                    </Badge>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </motion.div>
    </div>
  );
};

export default MatchHistoryPage;
