import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Wallet, TrendingUp, Trophy, Users, Zap,
  ArrowRight, Gift, Clock, ChevronRight, Star,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { StatCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import {
  formatCurrency, formatChips, generateMockTransactions,
  generateLeaderboardData, timeAgo,
} from '../utils/helpers';
import type { Transaction, LeaderboardEntry } from '../types';

const QUICK_TABLES = [
  { id: '1', name: 'Beginner Tables', blinds: '₹5/₹10', players: '4/6', minBuyIn: 100, difficulty: 'Easy', color: 'emerald' },
  { id: '2', name: 'High Rollers', blinds: '₹50/₹100', players: '3/6', minBuyIn: 1000, difficulty: 'Hard', color: 'amber' },
  { id: '3', name: 'VIP Room', blinds: '₹200/₹400', players: '5/6', minBuyIn: 5000, difficulty: 'Expert', color: 'purple' },
  { id: '4', name: 'Turbo Texas', blinds: '₹25/₹50', players: '2/6', minBuyIn: 500, difficulty: 'Medium', color: 'blue' },
];

const difficultyColor: Record<string, string> = {
  Easy: 'green', Medium: 'blue', Hard: 'gold', Expert: 'purple',
};

export const DashboardPage: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [dailyClaimed, setDailyClaimed] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setTransactions(generateMockTransactions(userProfile.uid));
      setLeaderboard(generateLeaderboardData().slice(0, 5));
    }
  }, [userProfile]);

  if (!userProfile) return null;

  const totalBalance = userProfile.wallet.depositBalance + userProfile.wallet.winningBalance;
  const winRate = userProfile.gamesPlayed > 0
    ? Math.round((userProfile.gamesWon / userProfile.gamesPlayed) * 100)
    : 0;
  const xpProgress = (userProfile.xp % 1000) / 10;

  const handleDailyBonus = () => {
    setDailyClaimed(true);
    navigate('/bonus');
  };

  const getTransactionColor = (type: string) => {
    if (['deposit', 'win', 'bonus', 'referral', 'daily_bonus', 'game_cashout'].includes(type)) return 'text-emerald-400';
    return 'text-red-400';
  };

  const getTransactionIcon = (type: string) => {
    const icons: Record<string, string> = {
      deposit: '💳', win: '🏆', loss: '📉', bonus: '🎁', game_buy_in: '🎰',
      game_cashout: '💰', daily_bonus: '🌟', referral: '👥',
    };
    return icons[type] || '💸';
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-900/40 via-amber-800/30 to-amber-900/40 border border-amber-500/20 p-6"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-purple-500/10 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar
              username={userProfile.username}
              avatarIndex={userProfile.avatarIndex}
              size="lg"
              ring
              showStatus
              isOnline
            />
            <div>
              <p className="text-gray-400 text-sm">Welcome back,</p>
              <h2 className="text-2xl font-display font-bold text-white">{userProfile.username} 👋</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="gold" size="xs">Level {userProfile.level}</Badge>
                <div className="flex items-center gap-1">
                  <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full"
                      style={{ width: `${xpProgress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{userProfile.xp % 1000}/1000 XP</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <div className="text-right">
              <p className="text-xs text-gray-500">Total Balance</p>
              <p className="text-2xl font-mono font-bold text-gradient-gold">{formatCurrency(totalBalance)}</p>
            </div>
            {!dailyClaimed && (
              <Button size="sm" variant="green" onClick={handleDailyBonus} icon={<Gift className="w-4 h-4" />}>
                Claim Daily Bonus
              </Button>
            )}
          </div>
        </div>

        {/* XP bar mobile */}
        <div className="mt-4 sm:hidden">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Level {userProfile.level}</span>
            <span>{userProfile.xp % 1000}/1000 XP to Level {userProfile.level + 1}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${xpProgress}%` }}
              transition={{ delay: 0.5, duration: 1 }}
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full"
            />
          </div>
        </div>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          title="Deposit Balance"
          value={formatCurrency(userProfile.wallet.depositBalance)}
          icon={<Wallet className="w-5 h-5" />}
          color="gold"
          delay={0.1}
          subtitle="Main wallet"
        />
        <StatCard
          title="Winning Balance"
          value={formatCurrency(userProfile.wallet.winningBalance)}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
          delay={0.2}
          subtitle="From games"
        />
        <StatCard
          title="Demo Chips"
          value={formatChips(userProfile.demoChips)}
          icon={<Zap className="w-5 h-5" />}
          color="purple"
          delay={0.3}
          subtitle="Practice chips"
        />
        <StatCard
          title="Win Rate"
          value={`${winRate}%`}
          icon={<Trophy className="w-5 h-5" />}
          color="blue"
          delay={0.4}
          subtitle={`${userProfile.gamesWon}/${userProfile.gamesPlayed} games`}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Join Tables */}
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                🎰 Available Tables
              </h3>
              <button
                onClick={() => navigate('/table')}
                className="text-amber-400 text-sm hover:text-amber-300 flex items-center gap-1 transition-colors"
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {QUICK_TABLES.map((table, i) => (
                <motion.div
                  key={table.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="glass rounded-xl p-4 hover:bg-white/8 transition-all duration-200 cursor-pointer group"
                  onClick={() => navigate('/table', { state: { tableId: table.id } })}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl
                        ${table.color === 'emerald' ? 'bg-emerald-500/20' :
                          table.color === 'amber' ? 'bg-amber-500/20' :
                          table.color === 'purple' ? 'bg-purple-500/20' : 'bg-blue-500/20'}
                      `}>
                        ♠
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{table.name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <span>Blinds: {table.blinds}</span>
                          <span>•</span>
                          <span>Min: {formatCurrency(table.minBuyIn)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Users className="w-3 h-3" />
                          <span>{table.players}</span>
                        </div>
                        <Badge variant={difficultyColor[table.difficulty] as 'gold' | 'green' | 'blue' | 'purple'} size="xs">
                          {table.difficulty}
                        </Badge>
                      </div>
                      <Button size="xs" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        Join
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Recent Transactions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                💸 Recent Transactions
              </h3>
              <button
                onClick={() => navigate('/wallet')}
                className="text-amber-400 text-sm hover:text-amber-300 flex items-center gap-1 transition-colors"
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="glass rounded-xl overflow-hidden">
              {transactions.slice(0, 5).map((tx, i) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-4 ${i < 4 ? 'border-b border-white/5' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-base">
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{tx.description}</p>
                      <p className="text-gray-500 text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(tx.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-bold text-sm ${getTransactionColor(tx.type)}`}>
                      {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                    </p>
                    <Badge variant={tx.status === 'completed' ? 'green' : 'gray'} size="xs">
                      {tx.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-lg font-semibold text-white mb-4">⚡ Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Add Money', icon: '💳', path: '/add-money', color: 'bg-amber-500/15 border-amber-500/20 hover:bg-amber-500/25' },
                { label: 'Play Poker', icon: '♠', path: '/table', color: 'bg-emerald-500/15 border-emerald-500/20 hover:bg-emerald-500/25' },
                { label: 'Leaderboard', icon: '🏆', path: '/leaderboard', color: 'bg-purple-500/15 border-purple-500/20 hover:bg-purple-500/25' },
                { label: 'Referral', icon: '👥', path: '/referral', color: 'bg-blue-500/15 border-blue-500/20 hover:bg-blue-500/25' },
              ].map((action) => (
                <button
                  key={action.path}
                  onClick={() => navigate(action.path)}
                  className={`p-4 rounded-xl border transition-all duration-200 text-center group ${action.color}`}
                >
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">
                    {action.icon}
                  </div>
                  <p className="text-white text-xs font-medium">{action.label}</p>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Wallet Summary */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="glass rounded-2xl p-5"
          >
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-400" />
              Wallet Breakdown
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Deposit', value: userProfile.wallet.depositBalance, color: 'bg-amber-400', icon: '💳' },
                { label: 'Winnings', value: userProfile.wallet.winningBalance, color: 'bg-emerald-400', icon: '🏆' },
                { label: 'Bonus', value: userProfile.wallet.bonusBalance, color: 'bg-purple-400', icon: '🎁', note: '10% usable' },
              ].map((item) => {
                const total = userProfile.wallet.depositBalance +
                  userProfile.wallet.winningBalance +
                  userProfile.wallet.bonusBalance;
                const pct = total > 0 ? (item.value / total) * 100 : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-400 flex items-center gap-1.5">
                        <span>{item.icon}</span>
                        {item.label}
                        {item.note && <span className="text-xs text-purple-400">({item.note})</span>}
                      </span>
                      <span className="text-white font-mono font-medium">{formatCurrency(item.value)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.6, duration: 0.8 }}
                        className={`h-full ${item.color} rounded-full`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              fullWidth
              className="mt-4"
              onClick={() => navigate('/add-money')}
              icon={<ArrowRight className="w-3 h-3" />}
              iconPosition="right"
            >
              Add Money
            </Button>
          </motion.div>

          {/* Mini Leaderboard */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="glass rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                Top Players
              </h3>
              <button
                onClick={() => navigate('/leaderboard')}
                className="text-amber-400 text-xs hover:text-amber-300 transition-colors"
              >
                Full Board →
              </button>
            </div>
            <div className="space-y-3">
              {leaderboard.slice(0, 4).map((entry, i) => (
                <div key={entry.userId} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${i === 0 ? 'bg-amber-500 text-black' :
                      i === 1 ? 'bg-gray-400 text-black' :
                      i === 2 ? 'bg-orange-600 text-white' :
                      'bg-white/10 text-gray-400'}
                  `}>
                    {i + 1}
                  </div>
                  <Avatar username={entry.username} avatarIndex={entry.avatarIndex} size="xs" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{entry.username}</p>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(entry.level, 5) }).map((_, j) => (
                        <Star key={j} className="w-2.5 h-2.5 star-filled fill-current" />
                      ))}
                    </div>
                  </div>
                  <span className="text-amber-400 text-xs font-mono font-bold flex-shrink-0">
                    {formatCurrency(entry.totalWinnings)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
