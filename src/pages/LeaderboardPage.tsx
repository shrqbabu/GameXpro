import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Users, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { formatCurrency, generateLeaderboardData } from '../utils/helpers';
import type { LeaderboardEntry } from '../types';

const TABS = ['Weekly', 'Monthly', 'All Time'];

// podiumColors used for rank styling
const podiumBg = ['bg-gray-500/20', 'bg-amber-500/20', 'bg-orange-600/20'];

export const LeaderboardPage: React.FC = () => {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('Weekly');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    setLeaderboard(generateLeaderboardData());
  }, [activeTab]);

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-4"
      >
        <div className="text-5xl mb-3">🏆</div>
        <h1 className="text-3xl font-display font-bold text-white">Leaderboard</h1>
        <p className="text-gray-400 text-sm mt-1">Top players by total winnings</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center justify-center gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-gray-400 hover:text-white bg-white/5'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Podium */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-end justify-center gap-4 py-6"
      >
        {[top3[1], top3[0], top3[2]].map((entry, idx) => {
          if (!entry) return null;
          const actualRank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
          const heights = [24, 32, 20];
          const rankIcons = ['🥈', '🥇', '🥉'];

          return (
            <motion.div
              key={entry.userId}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + idx * 0.1 }}
              className={`flex flex-col items-center gap-2 ${idx === 1 ? 'order-first md:order-none' : ''}`}
            >
              <div className="text-2xl">{rankIcons[idx]}</div>
              <Avatar
                username={entry.username}
                avatarIndex={entry.avatarIndex}
                size={idx === 1 ? 'xl' : 'lg'}
                ring={idx === 1}
              />
              <p className="text-white text-sm font-bold">{entry.username}</p>
              <p className="text-amber-400 font-mono text-xs">{formatCurrency(entry.totalWinnings)}</p>
              <div
                className={`w-20 rounded-t-lg flex items-end justify-center pb-2 ${podiumBg[actualRank - 1]}`}
                style={{ height: `${heights[idx]}px` }}
              >
                <span className="text-xl font-bold text-gray-400">#{actualRank}</span>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Full leaderboard list */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-2xl overflow-hidden"
      >
        <div className="grid grid-cols-12 gap-2 p-4 border-b border-white/5 text-xs text-gray-500 font-medium uppercase">
          <span className="col-span-1">Rank</span>
          <span className="col-span-5">Player</span>
          <span className="col-span-2 text-center">Wins</span>
          <span className="col-span-2 text-center">Win%</span>
          <span className="col-span-2 text-right">Earnings</span>
        </div>

        {rest.map((entry, i) => {
          const isCurrentUser = entry.username === userProfile?.username;
          return (
            <motion.div
              key={entry.userId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`grid grid-cols-12 gap-2 items-center p-4 hover:bg-white/3 transition-colors
                ${i < rest.length - 1 ? 'border-b border-white/5' : ''}
                ${isCurrentUser ? 'bg-amber-500/5 border-l-2 border-l-amber-400' : ''}
              `}
            >
              <div className="col-span-1">
                <span className="text-gray-400 font-mono text-sm font-bold">
                  #{entry.rank}
                </span>
              </div>

              <div className="col-span-5 flex items-center gap-2">
                <Avatar
                  username={entry.username}
                  avatarIndex={entry.avatarIndex}
                  size="sm"
                />
                <div>
                  <p className={`text-sm font-medium ${isCurrentUser ? 'text-amber-400' : 'text-white'}`}>
                    {entry.username}
                    {isCurrentUser && <span className="ml-1 text-xs text-amber-500">(You)</span>}
                  </p>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: Math.min(Math.floor(entry.level / 8), 5) }).map((_, j) => (
                      <Star key={j} className="w-2.5 h-2.5 star-filled fill-current" />
                    ))}
                    <span className="text-gray-600 text-xs ml-1">Lv.{entry.level}</span>
                  </div>
                </div>
              </div>

              <div className="col-span-2 text-center">
                <p className="text-white text-sm font-mono">{entry.gamesWon.toLocaleString()}</p>
              </div>

              <div className="col-span-2 text-center">
                <Badge
                  variant={entry.winRate >= 60 ? 'green' : entry.winRate >= 40 ? 'gold' : 'gray'}
                  size="xs"
                >
                  {entry.winRate}%
                </Badge>
              </div>

              <div className="col-span-2 text-right">
                <p className="text-amber-400 font-mono text-sm font-bold">
                  {formatCurrency(entry.totalWinnings)}
                </p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Current user position */}
      {userProfile && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="glass-gold rounded-2xl p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-white text-sm font-medium">Your Current Ranking</p>
              <div className="flex items-center gap-2">
                <Users className="w-3 h-3 text-gray-500" />
                <span className="text-gray-400 text-xs">Play more games to climb the leaderboard!</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-amber-400 font-bold text-lg">Unranked</p>
            <div className="flex items-center gap-1 justify-end">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 text-xs">Keep Playing!</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default LeaderboardPage;
