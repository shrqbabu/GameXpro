import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Share2, Users, Gift, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/GlassCard';
import { formatCurrency } from '../utils/helpers';
import toast from 'react-hot-toast';

const REFERRAL_TIERS = [
  { count: 1, reward: 50, label: 'Starter', bonus: '₹50 per referral' },
  { count: 5, reward: 75, label: 'Recruiter', bonus: '₹75 per referral' },
  { count: 10, reward: 100, label: 'Ambassador', bonus: '₹100 per referral' },
  { count: 25, reward: 150, label: 'Elite', bonus: '₹150 per referral' },
];

export const ReferralPage: React.FC = () => {
  const { userProfile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState('');

  if (!userProfile) return null;

  const referralLink = `https://royalflush.demo/signup?ref=${userProfile.referralCode}`;
  const totalReferrals = 0;
  const totalEarned = 0;
  const currentTier = REFERRAL_TIERS[0];

  const copyCode = () => {
    navigator.clipboard.writeText(userProfile.referralCode).then(() => {
      setCopied(true);
      toast.success('Referral code copied!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      toast.success('Referral link copied!');
    });
  };

  const handleApplyCode = () => {
    if (!inputCode) { toast.error('Enter a referral code'); return; }
    toast.success('Demo: Referral code applied! (Demo mode)');
    setInputCode('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-4"
      >
        <div className="text-5xl mb-3">👥</div>
        <h1 className="text-3xl font-display font-bold text-white">Referral Program</h1>
        <p className="text-gray-400 mt-1">Invite friends and earn rewards together!</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="Total Referrals"
          value={totalReferrals}
          icon={<Users className="w-5 h-5" />}
          color="blue"
          delay={0.1}
        />
        <StatCard
          title="Total Earned"
          value={formatCurrency(totalEarned)}
          icon={<Gift className="w-5 h-5" />}
          color="gold"
          delay={0.2}
        />
        <StatCard
          title="Current Tier"
          value={currentTier.label}
          icon={<TrendingUp className="w-5 h-5" />}
          color="purple"
          delay={0.3}
        />
      </div>

      {/* Referral Code */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-2xl p-6"
      >
        <h3 className="text-white font-semibold mb-4">Your Referral Code</h3>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 font-mono text-2xl font-bold text-amber-400 text-center tracking-widest">
            {userProfile.referralCode}
          </div>
          <Button
            variant="outline"
            size="md"
            onClick={copyCode}
            icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          >
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-gray-400 text-sm">Referral Link:</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs font-mono truncate">
              {referralLink}
            </div>
            <button
              onClick={copyLink}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {['WhatsApp', 'Telegram', 'Twitter'].map((app) => (
            <Button key={app} variant="ghost" size="sm" fullWidth onClick={() => toast(`Share on ${app} (Demo)`)}>
              Share on {app}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-6"
      >
        <h3 className="text-white font-semibold mb-4">How It Works</h3>
        <div className="space-y-4">
          {[
            { step: '01', title: 'Share Your Code', desc: 'Share your unique referral code or link with friends', icon: '📤' },
            { step: '02', title: 'Friend Signs Up', desc: 'Your friend creates an account using your code', icon: '👤' },
            { step: '03', title: 'Friend Deposits', desc: 'Your friend makes their first deposit of ₹100+', icon: '💳' },
            { step: '04', title: 'You Both Win!', desc: 'You get ₹50 bonus, your friend gets ₹50 bonus!', icon: '🎉' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl flex-shrink-0">
                {item.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-mono text-xs">{item.step}</span>
                  <p className="text-white text-sm font-medium">{item.title}</p>
                </div>
                <p className="text-gray-400 text-xs mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Tiers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-2xl p-6"
      >
        <h3 className="text-white font-semibold mb-4">Reward Tiers</h3>
        <div className="space-y-3">
          {REFERRAL_TIERS.map((tier, i) => (
            <div
              key={i}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                totalReferrals >= tier.count
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-white/3 border-white/5 opacity-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`text-xl ${totalReferrals >= tier.count ? '' : 'grayscale'}`}>
                  {i === 0 ? '🥉' : i === 1 ? '🥈' : i === 2 ? '🥇' : '💎'}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{tier.label}</p>
                  <p className="text-gray-400 text-xs">{tier.count}+ referrals</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={totalReferrals >= tier.count ? 'green' : 'gray'} size="sm">
                  {tier.bonus}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Apply code */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-2xl p-5"
      >
        <h3 className="text-white font-semibold mb-3">Have a Friend's Code?</h3>
        <p className="text-gray-400 text-sm mb-4">Enter your friend's referral code to get ₹50 welcome bonus</p>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Enter referral code..."
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm font-mono focus:border-amber-400/50"
            maxLength={10}
          />
          <Button size="md" onClick={handleApplyCode}>
            Apply
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default ReferralPage;
