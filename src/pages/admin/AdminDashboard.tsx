import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Wallet, TrendingUp, Activity, Shield,
  DollarSign, Gamepad2, AlertTriangle, ArrowUpRight,
  ArrowDownRight, RefreshCw,
} from 'lucide-react';

// MiniChart reserved for future use
import { StatCard } from '../../components/ui/GlassCard';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { formatCurrency, generateMockUsers, timeAgo } from '../../utils/helpers';
import toast from 'react-hot-toast';

const REVENUE_DATA = [45, 62, 38, 75, 90, 55, 82, 68, 94, 71, 88, 65];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// MiniChart is available for future inline chart usage

export const AdminDashboard: React.FC = () => {
  const [users] = useState(generateMockUsers());
  const [refreshing, setRefreshing] = useState(false);

  const adminStats = {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.status === 'active').length,
    totalDeposits: users.reduce((s, u) => s + u.wallet.totalDeposited, 0),
    totalWinnings: users.reduce((s, u) => s + u.wallet.totalWon, 0),
    activeTables: 4,
    onlinePlayers: 24,
    todayDeposits: 12500,
    todayWithdrawals: 4200,
    pendingWithdrawals: 3,
    blockedUsers: users.filter((u) => u.status === 'blocked').length,
  };

  const revenue = adminStats.totalDeposits - adminStats.totalWinnings;

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 1000));
    setRefreshing(false);
    toast.success('Dashboard refreshed!');
  };

  const recentActivity = [
    { type: 'deposit', user: 'ArjunKumar', amount: 1000, time: new Date(Date.now() - 300000).toISOString() },
    { type: 'win', user: 'PriyaSharma', amount: 850, time: new Date(Date.now() - 600000).toISOString() },
    { type: 'signup', user: 'RahulMehta', amount: 0, time: new Date(Date.now() - 1200000).toISOString() },
    { type: 'withdrawal', user: 'AnkitaSingh', amount: 2000, time: new Date(Date.now() - 1800000).toISOString() },
    { type: 'game', user: 'VikramPatel', amount: 500, time: new Date(Date.now() - 2400000).toISOString() },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-400" />
            Admin Dashboard
          </h1>
          <p className="text-gray-400 text-sm">RoyalFlush Demo Platform Overview</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="green" dot pulse>Live Data</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            loading={refreshing}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={adminStats.totalUsers.toLocaleString()}
          icon={<Users className="w-5 h-5" />}
          color="blue"
          delay={0.1}
          trend={{ value: 12, label: 'this week' }}
          subtitle={`${adminStats.activeUsers} active`}
        />
        <StatCard
          title="Total Deposits"
          value={formatCurrency(adminStats.totalDeposits)}
          icon={<DollarSign className="w-5 h-5" />}
          color="gold"
          delay={0.2}
          trend={{ value: 8, label: 'this week' }}
          subtitle={`Today: ${formatCurrency(adminStats.todayDeposits)}`}
        />
        <StatCard
          title="Net Revenue"
          value={formatCurrency(revenue)}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
          delay={0.3}
          trend={{ value: 5, label: 'vs last week' }}
        />
        <StatCard
          title="Active Tables"
          value={adminStats.activeTables}
          icon={<Gamepad2 className="w-5 h-5" />}
          color="purple"
          delay={0.4}
          subtitle={`${adminStats.onlinePlayers} players online`}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Deposits", value: formatCurrency(adminStats.todayDeposits), icon: '💳', color: 'emerald', trend: '+' },
          { label: "Today's Withdrawals", value: formatCurrency(adminStats.todayWithdrawals), icon: '💸', color: 'orange', trend: '-' },
          { label: 'Pending Withdrawals', value: adminStats.pendingWithdrawals, icon: '⏳', color: 'amber', urgent: true },
          { label: 'Blocked Users', value: adminStats.blockedUsers, icon: '🚫', color: 'red' },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.05 }}
            className={`glass rounded-xl p-4 ${item.urgent ? 'border border-amber-500/30' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs">{item.label}</p>
                <p className="text-white font-bold text-xl mt-1">{item.value}</p>
              </div>
              <div className={`text-2xl`}>{item.icon}</div>
            </div>
            {item.urgent && (
              <div className="mt-2 flex items-center gap-1 text-amber-400 text-xs">
                <AlertTriangle className="w-3 h-3" />
                Requires attention
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Revenue Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              Revenue Overview
            </h3>
            <Badge variant="gold" size="xs">2025</Badge>
          </div>

          {/* Simple bar chart */}
          <div className="space-y-2">
            <div className="flex items-end gap-1 h-32">
              {REVENUE_DATA.map((val, i) => {
                const max = Math.max(...REVENUE_DATA);
                const height = (val / max) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ delay: 0.6 + i * 0.04, duration: 0.6 }}
                      className={`w-full rounded-t-sm transition-all cursor-pointer ${
                        i === new Date().getMonth()
                          ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                          : 'bg-amber-500/30 hover:bg-amber-500/50'
                      }`}
                      title={`${MONTHS[i]}: ₹${(val * 1000).toLocaleString()}`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              {MONTHS.map((m, i) => (
                <span key={m} className={i % 2 === 0 ? '' : 'hidden sm:block'}>{m}</span>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-white/3">
            <div>
              <p className="text-gray-400 text-xs">Total Revenue</p>
              <p className="text-amber-400 font-mono font-bold">{formatCurrency(revenue)}</p>
            </div>
            <div className="flex items-center gap-1 text-emerald-400 text-sm">
              <ArrowUpRight className="w-4 h-4" />
              <span>+15.2%</span>
            </div>
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Recent Activity</h3>
            <Badge variant="green" dot pulse size="xs">Live</Badge>
          </div>

          <div className="space-y-3">
            {recentActivity.map((activity, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.08 }}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/3 transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base
                  ${activity.type === 'deposit' ? 'bg-emerald-500/15' :
                    activity.type === 'win' ? 'bg-amber-500/15' :
                    activity.type === 'signup' ? 'bg-blue-500/15' :
                    activity.type === 'withdrawal' ? 'bg-orange-500/15' :
                    'bg-purple-500/15'}
                `}>
                  {activity.type === 'deposit' ? '💳' :
                    activity.type === 'win' ? '🏆' :
                    activity.type === 'signup' ? '👤' :
                    activity.type === 'withdrawal' ? '💸' : '🎰'}
                </div>
                <div className="flex-1">
                  <p className="text-white text-xs font-medium">{activity.user}</p>
                  <p className="text-gray-500 text-xs capitalize">{activity.type}</p>
                </div>
                <div className="text-right">
                  {activity.amount > 0 && (
                    <p className={`text-xs font-mono font-bold ${
                      activity.type === 'withdrawal' ? 'text-red-400 flex items-center gap-0.5' : 'text-emerald-400 flex items-center gap-0.5'
                    }`}>
                      {activity.type === 'withdrawal'
                        ? <><ArrowDownRight className="w-3 h-3" /> {formatCurrency(activity.amount)}</>
                        : <><ArrowUpRight className="w-3 h-3" /> {formatCurrency(activity.amount)}</>
                      }
                    </p>
                  )}
                  <p className="text-gray-600 text-xs">{timeAgo(activity.time)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* User List Preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="glass rounded-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h3 className="text-white font-semibold">Recent Users</h3>
          <Button variant="ghost" size="xs" onClick={() => window.location.href = '/admin/users'}>
            View All →
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left p-4 text-xs text-gray-500 font-medium">User</th>
                <th className="text-left p-4 text-xs text-gray-500 font-medium hidden md:table-cell">Email</th>
                <th className="text-right p-4 text-xs text-gray-500 font-medium">Balance</th>
                <th className="text-center p-4 text-xs text-gray-500 font-medium hidden sm:table-cell">Status</th>
                <th className="text-center p-4 text-xs text-gray-500 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 5).map((user, i) => (
                <tr key={user.uid} className={`border-b border-white/3 hover:bg-white/2 transition-colors ${i === 4 ? 'border-0' : ''}`}>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Avatar username={user.username} avatarIndex={user.avatarIndex} size="sm" />
                      <span className="text-white text-sm">{user.username}</span>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <span className="text-gray-400 text-sm">{user.email}</span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-amber-400 font-mono text-sm">
                      {formatCurrency(user.wallet.depositBalance + user.wallet.winningBalance)}
                    </span>
                  </td>
                  <td className="p-4 text-center hidden sm:table-cell">
                    <Badge variant={user.status === 'active' ? 'green' : 'red'} size="xs" dot>
                      {user.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-center">
                    <Badge variant={user.role === 'admin' ? 'purple' : 'blue'} size="xs">
                      {user.role}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Alerts */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="glass rounded-2xl p-4 border border-amber-500/20"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-amber-400 text-sm font-medium">Demo Mode Active</p>
            <p className="text-gray-400 text-xs">
              This admin panel is running in demo mode. All data is simulated. Connect Firebase to enable real-time monitoring.
            </p>
          </div>
          <Wallet className="w-5 h-5 text-gray-600 flex-shrink-0 ml-auto" />
        </div>
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
