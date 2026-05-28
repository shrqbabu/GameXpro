import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet, TrendingUp, TrendingDown, Settings, Save,
  Plus, Minus, CheckCircle, AlertTriangle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { StatCard } from '../../components/ui/GlassCard';
import { formatCurrency, generateMockUsers } from '../../utils/helpers';
import { DEFAULT_BONUS_CONFIG } from '../../store/useAppStore';
import { useAppStore } from '../../store/useAppStore';
import toast from 'react-hot-toast';

export const AdminWallet: React.FC = () => {
  const { bonusConfig, setBonusConfig } = useAppStore();
  const [users] = useState(generateMockUsers());
  const [bonusSettings, setBonusSettings] = useState(bonusConfig);
  const [savingBonus, setSavingBonus] = useState(false);
  const [manualAmount, setManualAmount] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [creditType, setCreditType] = useState<'bonus' | 'chips'>('bonus');

  const totalDeposits = users.reduce((s, u) => s + u.wallet.totalDeposited, 0);
  const totalWon = users.reduce((s, u) => s + u.wallet.totalWon, 0);
  const totalBonus = users.reduce((s, u) => s + u.wallet.bonusBalance, 0);
  const totalDeposit = users.reduce((s, u) => s + u.wallet.depositBalance, 0);

  const pendingWithdrawals = [
    { id: 'w1', user: 'ArjunKumar', amount: 2000, method: 'UPI', time: '2h ago' },
    { id: 'w2', user: 'PriyaSharma', amount: 5000, method: 'Bank', time: '4h ago' },
    { id: 'w3', user: 'RahulMehta', amount: 1500, method: 'UPI', time: '6h ago' },
  ];

  const handleSaveBonusConfig = async () => {
    setSavingBonus(true);
    await new Promise((r) => setTimeout(r, 800));
    setBonusConfig(bonusSettings);
    setSavingBonus(false);
    toast.success('Bonus configuration saved! ✅');
  };

  const handleManualCredit = () => {
    const amount = parseFloat(manualAmount);
    if (!selectedUserId) { toast.error('Select a user'); return; }
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }

    toast.success(
      `Demo: ${formatCurrency(amount)} ${creditType === 'bonus' ? 'bonus' : 'chips'} added to ${selectedUserId}`
    );
    setManualAmount('');
  };

  const handleWithdrawalAction = (_id: string, action: 'approve' | 'reject') => {
    toast.success(`Withdrawal ${action === 'approve' ? 'approved' : 'rejected'} (Demo)`);
  };

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
            <Wallet className="w-6 h-6 text-amber-400" />
            Wallet Management
          </h1>
          <p className="text-gray-400 text-sm">Monitor and control all wallet activities</p>
        </div>
        <Badge variant="gold">Admin Only</Badge>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Deposits"
          value={formatCurrency(totalDeposits)}
          icon={<TrendingUp className="w-5 h-5" />}
          color="gold"
          delay={0.1}
        />
        <StatCard
          title="Total Payouts"
          value={formatCurrency(totalWon)}
          icon={<TrendingDown className="w-5 h-5" />}
          color="green"
          delay={0.2}
        />
        <StatCard
          title="Total Bonus Pool"
          value={formatCurrency(totalBonus)}
          icon={<Plus className="w-5 h-5" />}
          color="purple"
          delay={0.3}
        />
        <StatCard
          title="Total in Wallets"
          value={formatCurrency(totalDeposit)}
          icon={<Wallet className="w-5 h-5" />}
          color="blue"
          delay={0.4}
        />
      </div>

      {/* Bonus Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Settings className="w-4 h-4 text-amber-400" />
            Bonus Configuration
          </h3>
          <Badge variant="purple" size="xs">Live Settings</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Bonus Usage % Per Game
            </label>
            <div className="relative">
              <input
                type="number"
                min={1}
                max={100}
                value={bonusSettings.usagePercentage}
                onChange={(e) => setBonusSettings((p) => ({ ...p, usagePercentage: Number(e.target.value) }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
            </div>
            <p className="text-gray-500 text-xs mt-1">
              Current: Only {bonusSettings.usagePercentage}% of bonus usable per game
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Max Bonus Per Game (₹)
            </label>
            <input
              type="number"
              min={100}
              value={bonusSettings.maxBonusPerGame}
              onChange={(e) => setBonusSettings((p) => ({ ...p, maxBonusPerGame: Number(e.target.value) }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Wagering Requirement (x)
            </label>
            <input
              type="number"
              min={1}
              value={bonusSettings.wageringRequirement}
              onChange={(e) => setBonusSettings((p) => ({ ...p, wageringRequirement: Number(e.target.value) }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white"
            />
            <p className="text-gray-500 text-xs mt-1">
              Bonus must be wagered {bonusSettings.wageringRequirement}x before withdrawal
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Bonus Expiry (Days)
            </label>
            <input
              type="number"
              min={1}
              value={bonusSettings.expiryDays}
              onChange={(e) => setBonusSettings((p) => ({ ...p, expiryDays: Number(e.target.value) }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 mb-4">
          <p className="text-amber-400 text-sm font-medium mb-2">📊 Configuration Preview</p>
          <div className="text-gray-400 text-xs space-y-1">
            <p>• User has ₹1000 bonus → Can use only <strong className="text-white">
              ₹{Math.min((1000 * bonusSettings.usagePercentage) / 100, bonusSettings.maxBonusPerGame).toFixed(0)}
            </strong> per game</p>
            <p>• Must wager <strong className="text-white">{bonusSettings.wageringRequirement}x</strong> before withdrawal</p>
            <p>• Bonus expires after <strong className="text-white">{bonusSettings.expiryDays} days</strong></p>
          </div>
        </div>

        <Button
          fullWidth
          size="lg"
          loading={savingBonus}
          onClick={handleSaveBonusConfig}
          icon={<Save className="w-4 h-4" />}
        >
          Save Bonus Configuration
        </Button>
      </motion.div>

      {/* Manual Credit */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-2xl p-6"
      >
        <h3 className="text-white font-semibold mb-4">Manual Credit (Admin Only)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Select User</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white"
            >
              <option value="">-- Select User --</option>
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>{u.username}</option>
              ))}
            </select>
          </div>
          <Input
            label="Amount (₹)"
            type="number"
            placeholder="Enter amount"
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            icon={<Wallet className="w-4 h-4" />}
          />
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Credit Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setCreditType('bonus')}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  creditType === 'bonus'
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                    : 'bg-white/5 border-white/10 text-gray-400'
                }`}
              >
                Bonus
              </button>
              <button
                onClick={() => setCreditType('chips')}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  creditType === 'chips'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-white/5 border-white/10 text-gray-400'
                }`}
              >
                Chips
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <Button
            variant="green"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleManualCredit}
          >
            Credit Amount
          </Button>
          <Button
            variant="danger"
            size="md"
            icon={<Minus className="w-4 h-4" />}
            onClick={() => toast('Debit feature — backend integration required')}
          >
            Debit Amount
          </Button>
        </div>
      </motion.div>

      {/* Pending Withdrawals */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Pending Withdrawals
          </h3>
          <Badge variant="orange" size="xs" dot>{pendingWithdrawals.length} pending</Badge>
        </div>

        <div className="divide-y divide-white/5">
          {pendingWithdrawals.map((w) => (
            <div key={w.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-white text-sm font-medium">{w.user}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="blue" size="xs">{w.method}</Badge>
                  <span className="text-gray-500 text-xs">{w.time}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-amber-400 font-mono font-bold">{formatCurrency(w.amount)}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleWithdrawalAction(w.id, 'approve')}
                    className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    title="Approve"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleWithdrawalAction(w.id, 'reject')}
                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    title="Reject"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Default config reset */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-white/3 border border-white/5">
        <div>
          <p className="text-gray-400 text-sm">Reset to Default Configuration</p>
          <p className="text-gray-600 text-xs">This will reset all bonus settings to platform defaults</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setBonusSettings(DEFAULT_BONUS_CONFIG);
            toast.success('Reset to defaults');
          }}
        >
          Reset Defaults
        </Button>
      </div>
    </div>
  );
};

export default AdminWallet;
