import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Wallet, TrendingUp, Gift, ArrowUpRight, ArrowDownLeft,
  Plus, Clock, Filter, Search
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/GlassCard';
import {
  formatCurrency, generateMockTransactions, timeAgo, getBonusUsableAmount,
} from '../utils/helpers';
import { DEFAULT_BONUS_CONFIG } from '../store/useAppStore';
import type { Transaction } from '../types';

const TX_FILTERS = ['All', 'Deposit', 'Win', 'Loss', 'Bonus', 'Game'];

export const WalletPage: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (userProfile) {
      setTransactions(generateMockTransactions(userProfile.uid));
    }
  }, [userProfile]);

  if (!userProfile) return null;

  const { wallet } = userProfile;
  const totalBalance = wallet.depositBalance + wallet.winningBalance;
  const usableBonus = getBonusUsableAmount(wallet.bonusBalance, DEFAULT_BONUS_CONFIG);

  const filteredTx = transactions.filter((tx) => {
    const matchFilter = filter === 'All' ||
      (filter === 'Deposit' && tx.type === 'deposit') ||
      (filter === 'Win' && tx.type === 'win') ||
      (filter === 'Loss' && tx.type === 'loss') ||
      (filter === 'Bonus' && (tx.type === 'bonus' || tx.type === 'daily_bonus')) ||
      (filter === 'Game' && (tx.type === 'game_buy_in' || tx.type === 'game_cashout'));
    const matchSearch = tx.description.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const isCredit = (tx: Transaction) =>
    ['deposit', 'win', 'bonus', 'referral', 'daily_bonus', 'game_cashout'].includes(tx.type);

  const getTxIcon = (type: string) => {
    const icons: Record<string, string> = {
      deposit: '💳', win: '🏆', loss: '📉', bonus: '🎁',
      game_buy_in: '🎰', game_cashout: '💰', daily_bonus: '🌟', referral: '👥',
    };
    return icons[type] || '💸';
  };

  const getTxBadgeColor = (tx: Transaction): 'green' | 'red' | 'gold' | 'purple' | 'blue' | 'gray' => {
    if (isCredit(tx)) return 'green';
    return 'red';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border border-emerald-500/20 p-6"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <Wallet className="w-4 h-4" /> My Wallet
            </p>
            <p className="text-4xl font-bold font-mono text-white mt-1">
              {formatCurrency(totalBalance)}
            </p>
            <p className="text-gray-500 text-sm mt-1">Available Balance</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              size="md"
              onClick={() => navigate('/add-money')}
              icon={<Plus className="w-4 h-4" />}
            >
              Add Money
            </Button>
            <Button
              variant="ghost"
              size="md"
              icon={<ArrowUpRight className="w-4 h-4" />}
            >
              Withdraw
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Wallet Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Deposit Balance"
          value={formatCurrency(wallet.depositBalance)}
          icon={<ArrowDownLeft className="w-5 h-5" />}
          color="gold"
          delay={0.1}
          subtitle={`Total deposited: ${formatCurrency(wallet.totalDeposited)}`}
        />
        <StatCard
          title="Winning Balance"
          value={formatCurrency(wallet.winningBalance)}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
          delay={0.2}
          subtitle={`Total won: ${formatCurrency(wallet.totalWon)}`}
        />
        <StatCard
          title="Bonus Balance"
          value={formatCurrency(wallet.bonusBalance)}
          icon={<Gift className="w-5 h-5" />}
          color="purple"
          delay={0.3}
          subtitle={`Usable: ${formatCurrency(usableBonus)} (${DEFAULT_BONUS_CONFIG.usagePercentage}%/game)`}
        />
      </div>

      {/* Bonus Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20"
      >
        <div className="flex items-start gap-3">
          <Gift className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-purple-400 font-medium text-sm">Bonus Usage Policy</p>
            <p className="text-gray-400 text-xs mt-1 leading-relaxed">
              Your bonus balance is <strong className="text-white">₹{wallet.bonusBalance.toFixed(2)}</strong>.
              Per game, only <strong className="text-purple-300">{DEFAULT_BONUS_CONFIG.usagePercentage}%</strong> of bonus can be used
              (max ₹{DEFAULT_BONUS_CONFIG.maxBonusPerGame}). Currently usable: <strong className="text-emerald-400">{formatCurrency(usableBonus)}</strong>.
              Bonus requires {DEFAULT_BONUS_CONFIG.wageringRequirement}x wagering before withdrawal.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Transaction History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-white">Transaction History</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 w-40"
              />
            </div>
            <button className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {TX_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                filter === f
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-gray-400 hover:text-white bg-white/5'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Transaction List */}
        <div className="glass rounded-2xl overflow-hidden">
          {filteredTx.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-gray-400">No transactions found</p>
            </div>
          ) : (
            filteredTx.map((tx, i) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center justify-between p-4 hover:bg-white/3 transition-colors ${
                  i < filteredTx.length - 1 ? 'border-b border-white/5' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0
                    ${isCredit(tx) ? 'bg-emerald-500/10' : 'bg-red-500/10'}
                  `}>
                    {getTxIcon(tx.type)}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{tx.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-gray-500 text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(tx.createdAt)}
                      </p>
                      <Badge variant={getTxBadgeColor(tx)} size="xs">
                        {tx.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className={`font-mono font-bold text-sm ${isCredit(tx) ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isCredit(tx) ? '+' : ''}{formatCurrency(tx.amount)}
                  </p>
                  {tx.balanceAfter !== undefined && (
                    <p className="text-gray-600 text-xs">
                      Bal: {formatCurrency(tx.balanceAfter)}
                    </p>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default WalletPage;
