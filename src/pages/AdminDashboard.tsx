import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Users, TrendingUp, TrendingDown, DollarSign, CheckCircle,
  XCircle, Clock, Eye, Loader2, Ban, UserCheck, Settings,
  BarChart3, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  subscribeDeposits, subscribeWithdrawals, approveDeposit, rejectDeposit,
  approveWithdrawal, rejectWithdrawal, subscribeAllUsers, banUser, adjustWallet, getAdminStats,
} from '../firebase/admin';
import { Deposit, Withdrawal } from '../types';
import { formatCurrency, formatDate } from '../utils/helpers';
import { Badge } from '../components/ui/Badge';
import toast from 'react-hot-toast';

type Tab = 'overview' | 'deposits' | 'withdrawals' | 'users' | 'adjust';

export const AdminDashboard: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectTarget, setRejectTarget] = useState<{ id: string; type: 'deposit' | 'withdrawal' } | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'add' | 'deduct'>('add');
  const [adjustNote, setAdjustNote] = useState('');

  useEffect(() => {
    const unsub1 = subscribeDeposits(setDeposits);
    const unsub2 = subscribeWithdrawals(setWithdrawals);
    const unsub3 = subscribeAllUsers(setUsers);
    getAdminStats().then(setStats);

    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const handleApproveDeposit = async (id: string) => {
    if (!firebaseUser) return;
    setProcessing(id);
    try {
      await approveDeposit(id, firebaseUser.uid);
      toast.success('Deposit approved!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectDeposit = async () => {
    if (!rejectTarget || !firebaseUser) return;
    setProcessing(rejectTarget.id);
    try {
      if (rejectTarget.type === 'deposit') {
        await rejectDeposit(rejectTarget.id, firebaseUser.uid, rejectNote || 'Rejected by admin');
      } else {
        await rejectWithdrawal(rejectTarget.id, firebaseUser.uid, rejectNote || 'Rejected by admin');
      }
      toast.success('Rejected successfully');
      setRejectTarget(null);
      setRejectNote('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleApproveWithdrawal = async (id: string) => {
    if (!firebaseUser) return;
    setProcessing(id);
    try {
      await approveWithdrawal(id, firebaseUser.uid);
      toast.success('Withdrawal approved!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleBan = async (uid: string, banned: boolean) => {
    if (!firebaseUser) return;
    try {
      await banUser(uid, banned, firebaseUser.uid);
      toast.success(banned ? 'User banned' : 'User unbanned');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAdjust = async () => {
    if (!firebaseUser || !adjustTarget || !adjustAmount) return;
    try {
      await adjustWallet(adjustTarget.uid, parseFloat(adjustAmount), adjustType, firebaseUser.uid, adjustNote);
      toast.success('Wallet adjusted!');
      setAdjustTarget(null);
      setAdjustAmount('');
      setAdjustNote('');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const pendingDeposits = deposits.filter(d => d.status === 'PENDING');
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'PENDING');

  const tabs: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'deposits', label: 'Deposits', icon: TrendingUp, badge: pendingDeposits.length },
    { id: 'withdrawals', label: 'Withdrawals', icon: TrendingDown, badge: pendingWithdrawals.length },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'adjust', label: 'Adjust', icon: Settings },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-4"
      >
        <Shield className="w-8 h-8 text-red-400" />
        <div>
          <h2 className="text-xl font-bold text-white">Admin Dashboard</h2>
          <p className="text-xs text-gray-400">Full platform control & management</p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all relative flex-shrink-0 border ${
              tab === t.id
                ? 'bg-red-500/20 border-red-500/30 text-red-400'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {(t.badge || 0) > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Overview */}
        {tab === 'overview' && stats && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { label: 'Total Deposited', value: formatCurrency(stats.totalDeposited), icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
                { label: 'Total Withdrawn', value: formatCurrency(stats.totalWithdrawn), icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10' },
                { label: 'Revenue', value: formatCurrency(stats.revenue), icon: DollarSign, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                { label: 'Pending Deposits', value: stats.pendingDeposits, icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                { label: 'Pending Withdrawals', value: stats.pendingWithdrawals, icon: AlertTriangle, color: 'text-purple-400', bg: 'bg-purple-500/10' },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className={`${bg} border border-white/10 rounded-xl p-4`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-xs text-gray-400">{label}</span>
                  </div>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Deposits */}
        {tab === 'deposits' && (
          <motion.div key="deposits" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-400">Pending: {pendingDeposits.length}</span>
            </div>
            {deposits.length === 0 ? (
              <p className="text-center text-gray-500 py-10">No deposits</p>
            ) : deposits.map(deposit => (
              <motion.div
                key={deposit.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 border border-white/10 rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-white">{deposit.userName}</p>
                    <p className="text-xs text-gray-400">{deposit.userEmail}</p>
                    <p className="text-xs text-gray-500">{formatDate(deposit.createdAt)}</p>
                    {deposit.utrNumber && (
                      <p className="text-xs text-blue-400">UTR: {deposit.utrNumber}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-400">{formatCurrency(deposit.amount)}</p>
                    <Badge status={deposit.status} />
                  </div>
                </div>

                {deposit.screenshotUrl && (
                  <a href={deposit.screenshotUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:underline mb-3">
                    <Eye className="w-3 h-3" /> View Screenshot
                  </a>
                )}

                {deposit.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveDeposit(deposit.id!)}
                      disabled={processing === deposit.id}
                      className="flex-1 flex items-center justify-center gap-1 bg-green-500/20 border border-green-500/30 text-green-400 py-2 rounded-lg text-sm hover:bg-green-500/30 transition-all disabled:opacity-50"
                    >
                      {processing === deposit.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectTarget({ id: deposit.id!, type: 'deposit' })}
                      className="flex-1 flex items-center justify-center gap-1 bg-red-500/20 border border-red-500/30 text-red-400 py-2 rounded-lg text-sm hover:bg-red-500/30 transition-all"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )}
                {deposit.adminNote && (
                  <p className="text-xs text-yellow-400 mt-2">Note: {deposit.adminNote}</p>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Withdrawals */}
        {tab === 'withdrawals' && (
          <motion.div key="withdrawals" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {withdrawals.length === 0 ? (
              <p className="text-center text-gray-500 py-10">No withdrawals</p>
            ) : withdrawals.map(w => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 border border-white/10 rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-white">{w.userName}</p>
                    <p className="text-xs text-gray-400">{w.userEmail}</p>
                    <p className="text-xs text-blue-400">UPI: {w.upiId}</p>
                    <p className="text-xs text-gray-500">{formatDate(w.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-orange-400">-{formatCurrency(w.amount)}</p>
                    <Badge status={w.status} />
                  </div>
                </div>

                {w.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveWithdrawal(w.id!)}
                      disabled={processing === w.id}
                      className="flex-1 flex items-center justify-center gap-1 bg-green-500/20 border border-green-500/30 text-green-400 py-2 rounded-lg text-sm hover:bg-green-500/30 transition-all disabled:opacity-50"
                    >
                      {processing === w.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectTarget({ id: w.id!, type: 'withdrawal' })}
                      className="flex-1 flex items-center justify-center gap-1 bg-red-500/20 border border-red-500/30 text-red-400 py-2 rounded-lg text-sm hover:bg-red-500/30 transition-all"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Users */}
        {tab === 'users' && (
          <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {users.map(u => (
              <div key={u.uid || u.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {u.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white text-sm">{u.name}</p>
                      {u.isAdmin && <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Admin</span>}
                      {u.isBanned && <span className="text-xs bg-red-800/40 text-red-300 px-1.5 py-0.5 rounded">Banned</span>}
                    </div>
                    <p className="text-xs text-gray-400">{u.email}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${u.isOnline ? 'bg-green-400' : 'bg-gray-500'}`} />
                      <span className="text-xs text-gray-500">{u.isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAdjustTarget(u)}
                    className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all"
                    title="Adjust Wallet"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  {!u.isAdmin && (
                    <button
                      onClick={() => handleBan(u.uid, !u.isBanned)}
                      className={`p-2 rounded-lg transition-all ${
                        u.isBanned
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      }`}
                      title={u.isBanned ? 'Unban' : 'Ban'}
                    >
                      {u.isBanned ? <UserCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Adjust Wallet */}
        {tab === 'adjust' && (
          <motion.div key="adjust" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-400" />
                Manual Wallet Adjustment
              </h3>
              <p className="text-sm text-gray-400 mb-4">Select a user from the Users tab to adjust their wallet.</p>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                <p className="text-xs text-yellow-400">Click the ⚙️ icon next to a user in the Users tab to adjust their wallet.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-[#1a0f2e] border border-white/20 rounded-2xl p-6 w-full max-w-sm"
            >
              <h3 className="font-bold text-white mb-3">Reject {rejectTarget.type === 'deposit' ? 'Deposit' : 'Withdrawal'}</h3>
              <textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="Reason for rejection..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 text-sm focus:outline-none resize-none mb-4"
              />
              <div className="flex gap-3">
                <button onClick={() => setRejectTarget(null)} className="flex-1 py-2.5 bg-white/10 text-gray-300 rounded-xl hover:bg-white/20">Cancel</button>
                <button onClick={handleRejectDeposit} className="flex-1 py-2.5 bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/40">Reject</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Adjust Wallet Modal */}
      <AnimatePresence>
        {adjustTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-[#1a0f2e] border border-white/20 rounded-2xl p-6 w-full max-w-sm"
            >
              <h3 className="font-bold text-white mb-1">Adjust Wallet</h3>
              <p className="text-sm text-gray-400 mb-4">{adjustTarget.name} ({adjustTarget.email})</p>

              <div className="flex gap-2 mb-3">
                <button onClick={() => setAdjustType('add')} className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${adjustType === 'add' ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-white/5 border-white/10 text-gray-400'}`}>+ Add</button>
                <button onClick={() => setAdjustType('deduct')} className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${adjustType === 'deduct' ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-gray-400'}`}>- Deduct</button>
              </div>
              <input
                type="number"
                value={adjustAmount}
                onChange={e => setAdjustAmount(e.target.value)}
                placeholder="Amount"
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 text-sm focus:outline-none mb-3"
              />
              <input
                type="text"
                value={adjustNote}
                onChange={e => setAdjustNote(e.target.value)}
                placeholder="Reason / Note"
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 text-sm focus:outline-none mb-4"
              />
              <div className="flex gap-3">
                <button onClick={() => setAdjustTarget(null)} className="flex-1 py-2.5 bg-white/10 text-gray-300 rounded-xl">Cancel</button>
                <button onClick={handleAdjust} className="flex-1 py-2.5 bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-xl">Apply</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
