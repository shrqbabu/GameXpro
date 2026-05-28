import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, DollarSign, Gamepad2, Activity } from 'lucide-react';
import { StatCard } from '../../components/ui/GlassCard';
import { formatCurrency } from '../../utils/helpers';

const WEEKLY_DATA = [
  { day: 'Mon', deposits: 45000, withdrawals: 12000, players: 120 },
  { day: 'Tue', deposits: 62000, withdrawals: 18000, players: 145 },
  { day: 'Wed', deposits: 38000, withdrawals: 9000, players: 98 },
  { day: 'Thu', deposits: 75000, withdrawals: 22000, players: 178 },
  { day: 'Fri', deposits: 90000, withdrawals: 28000, players: 210 },
  { day: 'Sat', deposits: 125000, withdrawals: 35000, players: 285 },
  { day: 'Sun', deposits: 108000, withdrawals: 30000, players: 248 },
];

const GAME_STATS = [
  { table: 'Beginner Table', games: 842, avgPot: 450, revenue: 12400 },
  { table: 'Classic Texas', games: 523, avgPot: 1200, revenue: 28600 },
  { table: 'High Rollers', games: 187, avgPot: 5800, revenue: 85400 },
  { table: 'VIP Room', games: 64, avgPot: 18000, revenue: 142000 },
];

export const AdminAnalytics: React.FC = () => {
  const maxDeposit = Math.max(...WEEKLY_DATA.map((d) => d.deposits));

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-blue-400" />
          Analytics
        </h1>
        <p className="text-gray-400 text-sm">Platform performance metrics (Demo Data)</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Weekly Revenue" value={formatCurrency(543000)} icon={<DollarSign className="w-5 h-5" />} color="gold" delay={0.1} trend={{ value: 12, label: 'vs last week' }} />
        <StatCard title="Active Players" value="1,284" icon={<Users className="w-5 h-5" />} color="blue" delay={0.2} trend={{ value: 8, label: 'vs last week' }} />
        <StatCard title="Tables Active" value="18" icon={<Gamepad2 className="w-5 h-5" />} color="purple" delay={0.3} />
        <StatCard title="Avg Session" value="47 min" icon={<TrendingUp className="w-5 h-5" />} color="green" delay={0.4} />
      </div>

      {/* Weekly Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-6"
      >
        <h3 className="text-white font-semibold mb-6">Weekly Deposits vs Withdrawals</h3>
        <div className="space-y-4">
          {WEEKLY_DATA.map((day, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 w-8">{day.day}</span>
                <span className="text-amber-400 font-mono">{formatCurrency(day.deposits)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(day.deposits / maxDeposit) * 100}%` }}
                    transition={{ delay: 0.4 + i * 0.05, duration: 0.8 }}
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8" />
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(day.withdrawals / maxDeposit) * 100}%` }}
                    transition={{ delay: 0.5 + i * 0.05, duration: 0.8 }}
                    className="h-full bg-red-500/60 rounded-full"
                  />
                </div>
                <span className="text-red-400 font-mono text-xs w-20 text-right">{formatCurrency(day.withdrawals)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-6 mt-4 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            Deposits
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            Withdrawals
          </div>
        </div>
      </motion.div>

      {/* Table Performance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-2xl overflow-hidden"
      >
        <div className="p-4 border-b border-white/5">
          <h3 className="text-white font-semibold">Table Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Table', 'Games Played', 'Avg Pot', 'Revenue'].map((h) => (
                  <th key={h} className="text-left p-4 text-xs text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GAME_STATS.map((row, i) => (
                <tr key={i} className="border-b border-white/3 hover:bg-white/2">
                  <td className="p-4 text-white text-sm font-medium">{row.table}</td>
                  <td className="p-4 text-gray-400 text-sm">{row.games.toLocaleString()}</td>
                  <td className="p-4 text-blue-400 font-mono text-sm">{formatCurrency(row.avgPot)}</td>
                  <td className="p-4 text-amber-400 font-mono text-sm font-bold">{formatCurrency(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminAnalytics;
