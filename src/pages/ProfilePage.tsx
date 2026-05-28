import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Edit3, Save, Camera, Copy, Check, Calendar,
  Trophy, Gamepad2, TrendingUp, Star
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Avatar, ChipBadge } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/GlassCard';
import { AVATAR_EMOJIS, AVATAR_COLORS, formatCurrency, formatDate } from '../utils/helpers';
import toast from 'react-hot-toast';

export const ProfilePage: React.FC = () => {
  const { userProfile, updateUserProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    username: userProfile?.username || '',
    displayName: userProfile?.displayName || '',
  });
  const [selectedAvatar, setSelectedAvatar] = useState(userProfile?.avatarIndex || 0);

  if (!userProfile) return null;

  const winRate = userProfile.gamesPlayed > 0
    ? Math.round((userProfile.gamesWon / userProfile.gamesPlayed) * 100)
    : 0;

  const totalBalance = userProfile.wallet.depositBalance + userProfile.wallet.winningBalance;

  const copyReferral = () => {
    navigator.clipboard.writeText(userProfile.referralCode).then(() => {
      setCopied(true);
      toast.success('Referral code copied!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserProfile({
        username: formData.username,
        displayName: formData.displayName,
        avatarIndex: selectedAvatar,
      });
      toast.success('Profile updated! ✨');
      setEditing(false);
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const xpProgress = (userProfile.xp % 1000) / 10;

  const achievements = [
    { label: 'First Win', earned: userProfile.gamesWon > 0, icon: '🏆' },
    { label: 'Poker Rookie', earned: userProfile.gamesPlayed >= 10, icon: '🃏' },
    { label: 'Lucky Streak', earned: false, icon: '🍀' },
    { label: 'High Roller', earned: userProfile.wallet.totalDeposited >= 1000, icon: '💎' },
    { label: 'All-In King', earned: false, icon: '👑' },
    { label: 'Bluff Master', earned: false, icon: '🎭' },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-purple-500/5 pointer-events-none" />

        {/* Edit button */}
        <div className="absolute top-4 right-4">
          {editing ? (
            <div className="flex gap-2">
              <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="xs" loading={saving} onClick={handleSave} icon={<Save className="w-3 h-3" />}>
                Save
              </Button>
            </div>
          ) : (
            <Button size="xs" variant="ghost" onClick={() => setEditing(true)} icon={<Edit3 className="w-3 h-3" />}>
              Edit Profile
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar Section */}
          <div className="relative">
            <Avatar
              username={userProfile.username}
              avatarIndex={editing ? selectedAvatar : userProfile.avatarIndex}
              size="2xl"
              ring
              showStatus
              isOnline
            />
            {editing && (
              <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shadow-lg hover:bg-amber-400 transition-colors">
                <Camera className="w-4 h-4 text-black" />
              </button>
            )}
            {/* Level badge */}
            <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center text-xs font-bold text-black shadow-lg">
              {userProfile.level}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            {editing ? (
              <div className="space-y-3">
                <Input
                  label="Username"
                  value={formData.username}
                  onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
                  placeholder="Username"
                />
                <Input
                  label="Display Name"
                  value={formData.displayName}
                  onChange={(e) => setFormData((p) => ({ ...p, displayName: e.target.value }))}
                  placeholder="Display Name"
                />
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-display font-bold text-white">{userProfile.displayName || userProfile.username}</h2>
                <p className="text-amber-400 font-mono text-sm">@{userProfile.username}</p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                  <Badge variant="gold" size="sm">Level {userProfile.level}</Badge>
                  <Badge variant={userProfile.role === 'admin' ? 'purple' : 'blue'} size="sm">
                    {userProfile.role}
                  </Badge>
                  <Badge variant={userProfile.status === 'active' ? 'green' : 'red'} size="sm" dot>
                    {userProfile.status}
                  </Badge>
                </div>

                <p className="text-gray-500 text-sm mt-2 flex items-center justify-center sm:justify-start gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Joined {formatDate(userProfile.joinDate)}
                </p>
              </>
            )}

            {/* XP Progress */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Level {userProfile.level}</span>
                <span>{userProfile.xp % 1000}/1000 XP → Level {userProfile.level + 1}</span>
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
          </div>
        </div>

        {/* Avatar picker (edit mode) */}
        {editing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-6"
          >
            <p className="text-gray-400 text-sm mb-3">Choose Avatar</p>
            <div className="flex gap-3 flex-wrap">
              {AVATAR_EMOJIS.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedAvatar(i)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-xl
                    bg-gradient-to-br ${AVATAR_COLORS[i]}
                    ${selectedAvatar === i ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-gray-900 scale-110' : 'opacity-60 hover:opacity-100'}
                    transition-all
                  `}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Games Played"
          value={userProfile.gamesPlayed}
          icon={<Gamepad2 className="w-5 h-5" />}
          color="blue"
          delay={0.1}
        />
        <StatCard
          title="Games Won"
          value={userProfile.gamesWon}
          icon={<Trophy className="w-5 h-5" />}
          color="gold"
          delay={0.2}
        />
        <StatCard
          title="Win Rate"
          value={`${winRate}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
          delay={0.3}
        />
        <StatCard
          title="Total Earnings"
          value={formatCurrency(userProfile.totalEarnings)}
          icon={<Star className="w-5 h-5" />}
          color="purple"
          delay={0.4}
        />
      </div>

      {/* Wallet + Referral */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Wallet Summary */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-2xl p-5"
        >
          <h3 className="text-white font-semibold mb-4">💰 Wallet Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">Total Balance</span>
              <span className="text-amber-400 font-mono font-bold">{formatCurrency(totalBalance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">Deposit Balance</span>
              <span className="text-white font-mono">{formatCurrency(userProfile.wallet.depositBalance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">Winning Balance</span>
              <span className="text-emerald-400 font-mono">{formatCurrency(userProfile.wallet.winningBalance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">Bonus Balance</span>
              <span className="text-purple-400 font-mono">{formatCurrency(userProfile.wallet.bonusBalance)}</span>
            </div>
            <div className="h-px bg-white/10" />
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">Demo Chips</span>
              <ChipBadge amount={userProfile.demoChips} />
            </div>
          </div>
        </motion.div>

        {/* Referral */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-2xl p-5"
        >
          <h3 className="text-white font-semibold mb-4">👥 Referral Code</h3>
          <div className="text-center mb-4">
            <div className="inline-block px-6 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 font-mono text-2xl font-bold text-amber-400 tracking-widest">
              {userProfile.referralCode}
            </div>
          </div>
          <p className="text-gray-400 text-xs text-center mb-4">
            Share this code and earn ₹50 for every friend who joins and deposits!
          </p>
          <Button
            variant="outline"
            fullWidth
            size="md"
            icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            onClick={copyReferral}
          >
            {copied ? 'Copied!' : 'Copy Code'}
          </Button>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="p-3 rounded-xl bg-white/5">
              <p className="text-gray-400 text-xs">Total Referrals</p>
              <p className="text-white font-bold">0</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5">
              <p className="text-gray-400 text-xs">Earned</p>
              <p className="text-amber-400 font-bold">₹0</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Achievements */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-2xl p-5"
      >
        <h3 className="text-white font-semibold mb-4">🏅 Achievements</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {achievements.map((ach, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                ach.earned
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-white/3 border-white/5 opacity-40 grayscale'
              }`}
            >
              <span className="text-2xl">{ach.icon}</span>
              <div>
                <p className={`text-sm font-medium ${ach.earned ? 'text-white' : 'text-gray-500'}`}>
                  {ach.label}
                </p>
                <p className={`text-xs ${ach.earned ? 'text-amber-400' : 'text-gray-600'}`}>
                  {ach.earned ? 'Earned' : 'Locked'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default ProfilePage;
