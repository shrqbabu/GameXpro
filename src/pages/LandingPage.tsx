import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useAnimation } from 'framer-motion';
import {
  ArrowRight, Shield, Zap, Trophy, Star, Users,
  ChevronDown, Play
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';

const PokerCard: React.FC<{ suit: string; value: string; delay: number; className?: string }> = ({
  suit, value, delay, className = ''
}) => (
  <motion.div
    initial={{ opacity: 0, rotateY: 180, scale: 0.5 }}
    animate={{ opacity: 1, rotateY: 0, scale: 1 }}
    transition={{ delay, duration: 0.8, type: 'spring' }}
    whileHover={{ y: -10, rotate: -3, scale: 1.05 }}
    className={`
      relative w-20 h-28 md:w-28 md:h-40 bg-white rounded-xl md:rounded-2xl
      shadow-2xl cursor-pointer select-none flex-shrink-0
      ${className}
    `}
    style={{ perspective: 1000 }}
  >
    <div className="absolute top-2 left-2 text-sm md:text-lg font-bold leading-none">
      <div className={suit === '♥' || suit === '♦' ? 'text-red-500' : 'text-gray-800'}>{value}</div>
      <div className={`text-xs md:text-base ${suit === '♥' || suit === '♦' ? 'text-red-500' : 'text-gray-800'}`}>{suit}</div>
    </div>
    <div className={`absolute inset-0 flex items-center justify-center text-3xl md:text-5xl font-bold ${suit === '♥' || suit === '♦' ? 'text-red-500' : 'text-gray-800'}`}>
      {suit}
    </div>
    <div className="absolute bottom-2 right-2 text-sm md:text-lg font-bold leading-none rotate-180">
      <div className={suit === '♥' || suit === '♦' ? 'text-red-500' : 'text-gray-800'}>{value}</div>
      <div className={`text-xs md:text-base ${suit === '♥' || suit === '♦' ? 'text-red-500' : 'text-gray-800'}`}>{suit}</div>
    </div>
    {/* Shine effect */}
    <div className="absolute inset-0 rounded-xl md:rounded-2xl bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
  </motion.div>
);

const FloatingChip: React.FC<{ color: string; top: string; left: string; delay: number; size?: string }> = ({
  color, top, left, delay, size = 'w-10 h-10'
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 0.6, y: [0, -15, 0] }}
    transition={{ delay, duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    className={`absolute ${size} rounded-full border-4 border-dashed ${color} hidden md:block`}
    style={{ top, left }}
  />
);

const StatCounter: React.FC<{ end: number; suffix: string; label: string; delay: number }> = ({
  end, suffix, label, delay
}) => {
  const [count, setCount] = useState(0);
  const controls = useAnimation();

  useEffect(() => {
    const timer = setTimeout(() => {
      let start = 0;
      const increment = end / 60;
      const interval = setInterval(() => {
        start += increment;
        if (start >= end) {
          setCount(end);
          clearInterval(interval);
        } else {
          setCount(Math.floor(start));
        }
      }, 30);
      return () => clearInterval(interval);
    }, delay * 1000);
    return () => clearTimeout(timer);
  }, [end, delay]);

  useEffect(() => {
    controls.start({ opacity: 1, y: 0 });
  }, [controls]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={controls}
      transition={{ delay, duration: 0.6 }}
      className="text-center"
    >
      <div className="text-3xl md:text-4xl font-bold font-display text-gradient-gold">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="text-gray-400 text-sm mt-1">{label}</div>
    </motion.div>
  );
};

const features = [
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Lightning Fast',
    desc: 'Real-time multiplayer powered by Firebase for zero-lag gameplay',
    color: 'from-yellow-500/20 to-amber-500/10',
    border: 'border-yellow-500/20',
    iconColor: 'text-yellow-400',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Bank-Level Security',
    desc: 'End-to-end encrypted transactions and secure wallet management',
    color: 'from-emerald-500/20 to-green-500/10',
    border: 'border-emerald-500/20',
    iconColor: 'text-emerald-400',
  },
  {
    icon: <Trophy className="w-6 h-6" />,
    title: 'Epic Tournaments',
    desc: 'Weekly tournaments with massive prize pools and exclusive rewards',
    color: 'from-purple-500/20 to-indigo-500/10',
    border: 'border-purple-500/20',
    iconColor: 'text-purple-400',
  },
  {
    icon: <Star className="w-6 h-6" />,
    title: 'VIP Rewards',
    desc: 'Earn exclusive bonuses, cashbacks and special privileges as you play',
    color: 'from-amber-500/20 to-orange-500/10',
    border: 'border-amber-500/20',
    iconColor: 'text-amber-400',
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Global Players',
    desc: 'Play with thousands of skilled players from around the world 24/7',
    color: 'from-blue-500/20 to-cyan-500/10',
    border: 'border-blue-500/20',
    iconColor: 'text-blue-400',
  },
  {
    icon: <Play className="w-6 h-6" />,
    title: 'Demo Mode',
    desc: 'Practice with 10,000 free demo chips before playing with real money',
    color: 'from-rose-500/20 to-pink-500/10',
    border: 'border-rose-500/20',
    iconColor: 'text-rose-400',
  },
];

export const LandingPage: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const handleCTA = () => {
    if (userProfile) {
      navigate('/dashboard');
    } else {
      navigate('/signup');
    }
  };

  return (
    <div className="min-h-screen animated-bg overflow-x-hidden">
      {/* Navigation */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-0 left-0 right-0 z-50 glass-dark border-b border-white/5"
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center text-xl font-bold shadow-[0_0_15px_rgba(245,158,11,0.5)]">
              ♠
            </div>
            <span className="text-xl font-display font-bold text-gradient-gold">RoyalFlush</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#leaderboard" className="hover:text-white transition-colors">Leaderboard</a>
          </div>

          <div className="flex items-center gap-3">
            {userProfile ? (
              <Button size="sm" onClick={() => navigate('/dashboard')}>
                Dashboard <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:block">
                  Login
                </Link>
                <Button size="sm" onClick={() => navigate('/signup')}>
                  Play Now
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/3 rounded-full blur-3xl" />
        </div>

        {/* Floating chips */}
        <FloatingChip color="border-amber-500" top="15%" left="8%" delay={0} />
        <FloatingChip color="border-red-500" top="70%" left="5%" delay={1} size="w-8 h-8" />
        <FloatingChip color="border-blue-500" top="25%" left="90%" delay={0.5} />
        <FloatingChip color="border-emerald-500" top="75%" left="88%" delay={1.5} size="w-8 h-8" />
        <FloatingChip color="border-purple-500" top="50%" left="92%" delay={2} size="w-6 h-6" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-gold text-amber-400 text-sm font-medium mb-8"
          >
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            🎰 India's #1 Premium Poker Platform
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="text-5xl md:text-7xl lg:text-8xl font-display font-black leading-tight mb-6"
          >
            <span className="text-white">Play Like a</span>
            <br />
            <span className="text-gradient-gold">Royal</span>
            <span className="text-white"> Champion</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10"
          >
            Experience the thrill of premium Texas Hold'em Poker with stunning visuals,
            real-time multiplayer, and massive prize pools. Join 50,000+ players today!
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Button size="xl" onClick={handleCTA} className="font-display text-lg">
              {userProfile ? 'Go to Dashboard' : 'Start Playing Free'}
              <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
            <Button variant="ghost" size="xl" onClick={() => navigate('/login')} className="font-display">
              <Play className="w-5 h-5" />
              Watch Demo
            </Button>
          </motion.div>

          {/* Floating Cards */}
          <div className="flex items-center justify-center gap-3 md:gap-4 mb-16">
            <PokerCard suit="♠" value="A" delay={0.3} className="-rotate-12" />
            <PokerCard suit="♥" value="K" delay={0.5} className="-rotate-6" />
            <PokerCard suit="♦" value="Q" delay={0.7} />
            <PokerCard suit="♣" value="J" delay={0.9} className="rotate-6" />
            <PokerCard suit="♥" value="10" delay={1.1} className="rotate-12" />
          </div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto"
          >
            <StatCounter end={50000} suffix="+" label="Active Players" delay={1} />
            <StatCounter end={2} suffix="Cr+" label="Prize Pool" delay={1.2} />
            <StatCounter end={99} suffix="%" label="Uptime" delay={1.4} />
            <StatCounter end={4} suffix="★" label="App Rating" delay={1.6} />
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="mt-16 flex justify-center"
          >
            <ChevronDown className="w-6 h-6 text-gray-600" />
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm mb-6">
              ✨ Premium Features
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
              Why Choose RoyalFlush?
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Built with cutting-edge technology for the ultimate poker experience
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
                className={`p-6 rounded-2xl bg-gradient-to-br ${feature.color} border ${feature.border} backdrop-blur-sm`}
              >
                <div className={`inline-flex p-3 rounded-xl bg-white/5 ${feature.iconColor} mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="text-white text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/3 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
              Start Playing in Minutes
            </h2>
            <p className="text-gray-400 text-lg">Simple. Fast. Rewarding.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Create Account', desc: 'Sign up free and get ₹100 welcome bonus + 10,000 demo chips instantly', icon: '👤' },
              { step: '02', title: 'Add Money', desc: 'Deposit safely using UPI, card, or net banking. Min ₹100 to start', icon: '💰' },
              { step: '03', title: 'Play & Win', desc: 'Join tables, play hands, win pots and withdraw your winnings anytime', icon: '🏆' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="relative text-center"
              >
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px border-t border-dashed border-white/10 -translate-y-0.5 z-0" />
                )}
                <div className="relative z-10 inline-flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl glass-gold flex items-center justify-center text-3xl mb-4 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                    {item.icon}
                  </div>
                  <div className="text-amber-400 font-mono text-sm font-bold mb-2">{item.step}</div>
                  <h3 className="text-white text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed max-w-xs">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Poker Table Preview */}
      <section id="leaderboard" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
              Premium Table Experience
            </h2>
          </motion.div>

          {/* Mock poker table */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="poker-felt rounded-[60px] border-8 border-amber-800/50 p-8 shadow-[0_0_60px_rgba(0,0,0,0.8),inset_0_0_40px_rgba(0,0,0,0.4)]">
              {/* Table inner border */}
              <div className="poker-felt rounded-[50px] border-4 border-amber-700/30 p-6 md:p-10">
                {/* Community cards area */}
                <div className="text-center mb-6">
                  <p className="text-emerald-300/50 text-xs mb-3 font-medium tracking-widest uppercase">Community Cards</p>
                  <div className="flex items-center justify-center gap-2 md:gap-3">
                    {[
                      { s: '♥', v: 'A' }, { s: '♣', v: 'K' }, { s: '♦', v: 'Q' },
                      { s: '♠', v: '10' }, { s: '♥', v: '7' }
                    ].map((card, i) => (
                      <motion.div
                        key={i}
                        initial={{ rotateY: 180 }}
                        whileInView={{ rotateY: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.15 + 0.5, duration: 0.5 }}
                        className="w-10 h-14 md:w-14 md:h-20 bg-white rounded-lg flex flex-col items-center justify-between p-1 shadow-lg"
                      >
                        <span className={`text-xs md:text-sm font-bold ${card.s === '♥' || card.s === '♦' ? 'text-red-500' : 'text-gray-800'}`}>{card.v}</span>
                        <span className={`text-lg md:text-2xl ${card.s === '♥' || card.s === '♦' ? 'text-red-500' : 'text-gray-800'}`}>{card.s}</span>
                        <span className={`text-xs md:text-sm font-bold rotate-180 ${card.s === '♥' || card.s === '♦' ? 'text-red-500' : 'text-gray-800'}`}>{card.v}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Pot */}
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/30 border border-amber-500/30 text-amber-400 font-mono font-bold">
                    🏆 POT: ₹2,450
                  </div>
                </div>

                {/* Player positions */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  {[
                    { name: 'AceKing', chips: '₹5,200', action: 'FOLD', color: 'text-red-400' },
                    { name: 'BluffPro', chips: '₹8,100', action: 'ALL-IN', color: 'text-amber-400' },
                    { name: 'You', chips: '₹3,600', action: 'RAISE', color: 'text-emerald-400' },
                  ].map((p, i) => (
                    <div key={i} className={`${p.name === 'You' ? 'ring-2 ring-amber-400' : ''} p-2 md:p-3 rounded-xl bg-black/30 border border-white/10`}>
                      <div className="text-xs text-gray-400">{p.name}</div>
                      <div className="text-amber-400 font-mono text-xs font-bold">{p.chips}</div>
                      <div className={`text-xs font-bold mt-1 ${p.color}`}>{p.action}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-3xl p-12 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-purple-500/10 pointer-events-none" />
            <div className="relative">
              <div className="text-6xl mb-4">🎰</div>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
                Ready to Win Big?
              </h2>
              <p className="text-gray-400 text-lg mb-8">
                Join 50,000+ players. Get ₹100 welcome bonus + 10,000 demo chips on signup.
              </p>
              <Button size="xl" onClick={handleCTA} className="font-display text-lg">
                {userProfile ? 'Enter Dashboard' : 'Create Free Account'}
                <ArrowRight className="w-5 h-5" />
              </Button>
              <p className="text-gray-500 text-xs mt-4">
                🔒 Demo mode • No real money required to start
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center text-base font-bold">
              ♠
            </div>
            <span className="font-display font-bold text-gradient-gold">RoyalFlush</span>
          </div>
          <div className="text-gray-500 text-sm text-center">
            ⚠️ This is a DEMO platform. Not for real money gambling. Play responsibly.
          </div>
          <div className="text-gray-600 text-xs">© 2025 RoyalFlush. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
