import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, CheckCircle, Lock, Zap, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { formatCurrency } from '../utils/helpers';
import toast from 'react-hot-toast';

const DAILY_REWARDS = [
  { day: 1, bonus: 10, chips: 500, claimed: false },
  { day: 2, bonus: 20, chips: 750, claimed: false },
  { day: 3, bonus: 30, chips: 1000, claimed: false },
  { day: 4, bonus: 50, chips: 1500, claimed: false },
  { day: 5, bonus: 75, chips: 2000, claimed: false },
  { day: 6, bonus: 100, chips: 2500, claimed: false },
  { day: 7, bonus: 200, chips: 5000, claimed: false, special: true },
];

export const DailyBonusPage: React.FC = () => {
  const { userProfile, updateWallet, addDemoChips } = useAuth();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);

  const currentDay = 1; // In real app, calculate from lastClaimed date
  const todayReward = DAILY_REWARDS[currentDay - 1];

  const handleClaim = async () => {
    if (claiming || claimed) return;
    setClaiming(true);
    setShowAnimation(true);

    await new Promise((r) => setTimeout(r, 1500));

    // Credit bonus
    if (userProfile) {
      await updateWallet({
        bonusBalance: userProfile.wallet.bonusBalance + todayReward.bonus,
      });
      await addDemoChips(todayReward.chips);
    }

    setClaiming(false);
    setClaimed(true);
    toast.success(`🎁 Day ${currentDay} bonus claimed! +₹${todayReward.bonus} + ${todayReward.chips} chips!`, {
      duration: 5000,
    });
  };

  if (!userProfile) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-4"
      >
        <motion.div
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 1, delay: 0.5 }}
          className="text-6xl mb-4"
        >
          🎁
        </motion.div>
        <h1 className="text-3xl font-display font-bold text-white">Daily Bonus</h1>
        <p className="text-gray-400 mt-1">Come back every day to earn bigger rewards!</p>
      </motion.div>

      {/* Streak banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="glass-gold rounded-2xl p-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl">
            🔥
          </div>
          <div>
            <p className="text-white font-semibold">Current Streak</p>
            <p className="text-amber-400 text-sm">Day {currentDay} of 7</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-xs">Next reset in</p>
          <div className="flex items-center gap-1 text-white font-mono">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>23:45:12</span>
          </div>
        </div>
      </motion.div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-2">
        {DAILY_REWARDS.map((reward, i) => {
          const isCurrent = i + 1 === currentDay;
          const isPast = i + 1 < currentDay;
          const isFuture = i + 1 > currentDay;

          return (
            <motion.div
              key={reward.day}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`relative flex flex-col items-center p-2 rounded-xl border text-center transition-all
                ${isCurrent && !claimed
                  ? 'bg-amber-500/20 border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                  : isPast || (isCurrent && claimed)
                  ? 'bg-emerald-500/10 border-emerald-500/20 opacity-60'
                  : 'bg-white/5 border-white/10 opacity-40'}
                ${reward.special ? 'col-span-1' : ''}
              `}
            >
              {reward.special && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <Badge variant="gold" size="xs">Special</Badge>
                </div>
              )}
              <div className="text-xs text-gray-500 mb-1">Day {reward.day}</div>
              <div className="text-lg">
                {isPast || (isCurrent && claimed) ? '✅' :
                  isCurrent ? '🎁' :
                  isFuture ? <Lock className="w-4 h-4 text-gray-600" /> : '🎁'}
              </div>
              <div className="text-xs text-amber-400 font-mono mt-1">₹{reward.bonus}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Today's reward */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className={`glass rounded-2xl p-6 text-center relative overflow-hidden ${
          claimed ? 'border border-emerald-500/30' : ''
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-purple-500/5 pointer-events-none" />

        <h3 className="text-white font-bold text-xl mb-2">
          {claimed ? 'Today\'s Reward Claimed! 🎉' : `Day ${currentDay} Reward`}
        </h3>

        <div className="flex items-center justify-center gap-8 my-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center text-3xl mx-auto mb-2">
              💰
            </div>
            <p className="text-amber-400 font-bold text-2xl font-mono">
              {formatCurrency(todayReward.bonus)}
            </p>
            <p className="text-gray-400 text-xs">Bonus Credit</p>
          </div>
          <div className="text-3xl text-gray-600">+</div>
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-3xl mx-auto mb-2">
              🪙
            </div>
            <p className="text-emerald-400 font-bold text-2xl font-mono">
              {todayReward.chips.toLocaleString()}
            </p>
            <p className="text-gray-400 text-xs">Demo Chips</p>
          </div>
        </div>

        {!claimed ? (
          <Button
            fullWidth
            size="xl"
            loading={claiming}
            onClick={handleClaim}
            icon={<Gift className="w-5 h-5" />}
          >
            Claim Day {currentDay} Reward!
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2 text-emerald-400">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Reward Claimed Successfully!</span>
          </div>
        )}
      </motion.div>

      {/* Upcoming rewards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-2xl p-5"
      >
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Upcoming Rewards
        </h3>
        <div className="space-y-3">
          {DAILY_REWARDS.slice(currentDay).map((reward, i) => (
            <div key={reward.day} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm">
                  {i === DAILY_REWARDS.slice(currentDay).length - 1 ? '⭐' : `${currentDay + i + 1}`}
                </div>
                <span className="text-gray-400 text-sm">Day {reward.day}</span>
                {reward.special && <Badge variant="gold" size="xs">Special!</Badge>}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-amber-400 font-mono">₹{reward.bonus}</span>
                <span className="text-gray-600">+</span>
                <span className="text-emerald-400 font-mono">{reward.chips.toLocaleString()} chips</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Claim animation overlay */}
      <AnimatePresence>
        {showAnimation && claiming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              animate={{
                scale: [1, 1.5, 1],
                rotate: [0, 360],
              }}
              transition={{ duration: 1.5, ease: 'easeInOut' }}
              className="text-8xl"
            >
              🎁
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DailyBonusPage;
