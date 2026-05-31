import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, Clock, Users, Zap, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts/MainLayout';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { colorPredictionController } from '../../controllers/ColorPredictionController';
import { debitWallet } from '../../firebase/userService';
import { ColorRound, ColorOption } from '../../types';

const BET_AMOUNTS = [10, 20, 50, 100, 200, 500];
const COLORS: { value: ColorOption; label: string; emoji: string; multiplier: string; class: string; glow: string }[] = [
  { value: 'red', label: 'Red', emoji: '🔴', multiplier: '2x', class: 'bg-game-red', glow: 'glow-red' },
  { value: 'green', label: 'Green', emoji: '🟢', multiplier: '2x', class: 'bg-game-green', glow: 'glow-green' },
  { value: 'violet', label: 'Violet', emoji: '🟣', multiplier: '9x', class: 'bg-game-violet', glow: '' },
];

const COLOR_BG: Record<ColorOption, string> = {
  red: 'bg-red-500',
  green: 'bg-green-500',
  violet: 'bg-purple-600',
};

export const ColorPredictionPage = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [activeRound, setActiveRound] = useState<ColorRound | null>(null);
  const [history, setHistory] = useState<ColorRound[]>([]);
  const [selectedColor, setSelectedColor] = useState<ColorOption | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [hasBet, setHasBet] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25);

  useEffect(() => {
    colorPredictionController.initializeGame().catch(() => {});
    const unsub = colorPredictionController.subscribeToActiveRound((round) => {
      setActiveRound(round);
      setHasBet(false);
    });
    colorPredictionController.getRoundHistory(10).then(setHistory);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!activeRound) return;
    const calculateTime = () => {
      const lockTime = new Date(activeRound.lockTime as string).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((lockTime - now) / 1000));
      setTimeLeft(diff);
    };
    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [activeRound?.lockTime]);

  const handlePlaceBet = useCallback(async () => {
    if (!userProfile || !activeRound || !selectedColor) {
      toast.error('Select a color to bet!');
      return;
    }
    if (activeRound.phase !== 'betting') {
      toast.error('Betting is locked!');
      return;
    }
    if ((userProfile.walletBalance || 0) < betAmount) {
      toast.error('Insufficient balance!', 'Please add money to your wallet.');
      return;
    }
    if (hasBet) {
      toast.info('Already placed bet this round!');
      return;
    }
    setIsPlacingBet(true);
    try {
      await debitWallet(userProfile.uid, betAmount, 'bet', `Color Prediction - Round #${activeRound.roundNumber}`, activeRound.roundId);
      await colorPredictionController.placeBet(activeRound.roundId, userProfile.uid, userProfile.name, selectedColor, betAmount);
      setHasBet(true);
      toast.success(`Bet placed on ${selectedColor.toUpperCase()}! 🎨`, `₹${betAmount} bet for ${selectedColor === 'violet' ? '9x' : '2x'} win!`);
    } catch (err) {
      toast.error('Failed to place bet', err instanceof Error ? err.message : 'Try again');
    } finally {
      setIsPlacingBet(false);
    }
  }, [userProfile, activeRound, selectedColor, betAmount, hasBet]);

  const timerPercent = (timeLeft / 15) * 100;
  const timerColor = timeLeft > 10 ? 'timer-bar-green' : timeLeft > 5 ? 'timer-bar-yellow' : 'timer-bar-red';

  return (
    <MainLayout>
      <div className="px-4 py-4 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/games')} className="p-2 rounded-xl glass hover:bg-white/10 transition-all">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black text-white">Color Prediction</h1>
            <p className="text-xs text-gray-500">Predict • Win • Repeat</p>
          </div>
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
            <span className="w-2 h-2 rounded-full bg-green-400 live-indicator" />
            <span className="text-xs text-green-400">Live</span>
          </div>
        </div>

        {/* Round Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-gold rounded-2xl p-5 mb-5 relative overflow-hidden"
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-yellow-500/5 blur-2xl" />
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-gray-500">Round Number</p>
              <p className="text-2xl font-black gold-text">#{activeRound?.roundNumber || '...'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Phase</p>
              <Badge
                variant={activeRound?.phase === 'betting' ? 'green' : activeRound?.phase === 'result' ? 'gold' : 'red'}
              >
                {activeRound?.phase?.toUpperCase() || 'LOADING'}
              </Badge>
            </div>
          </div>

          {/* Timer */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-gray-400" />
                <span className="text-xs text-gray-400">
                  {activeRound?.phase === 'betting' ? 'Betting closes in' : 'Next round in'}
                </span>
              </div>
              <span className={`text-lg font-black ${timeLeft <= 5 ? 'text-red-400' : timeLeft <= 10 ? 'text-yellow-400' : 'text-green-400'}`}>
                {timeLeft}s
              </span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${timerColor} progress-bar rounded-full`}
                style={{ width: `${timerPercent}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Users size={11} /> {activeRound?.totalBets || 0} bets</span>
            <span className="flex items-center gap-1"><Zap size={11} /> ₹{activeRound?.totalAmount || 0} pool</span>
          </div>
        </motion.div>

        {/* Result display */}
        <AnimatePresence>
          {activeRound?.result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center py-6 mb-5"
            >
              <p className="text-sm text-gray-400 mb-2">Result</p>
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
                className={`w-20 h-20 rounded-full ${COLOR_BG[activeRound.result]} flex items-center justify-center text-4xl shadow-2xl`}
              >
                {activeRound.result === 'red' ? '🔴' : activeRound.result === 'green' ? '🟢' : '🟣'}
              </motion.div>
              <p className="text-xl font-black text-white mt-3 capitalize">{activeRound.result}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Color selection */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {COLORS.map((color) => (
            <motion.button
              key={color.value}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedColor(color.value)}
              disabled={activeRound?.phase !== 'betting' || hasBet}
              className={`
                relative overflow-hidden rounded-2xl p-4 text-center transition-all duration-200 border-2
                ${selectedColor === color.value
                  ? `border-white/50 ${color.class} scale-105 shadow-xl ${color.glow}`
                  : `${color.class} border-transparent opacity-70 hover:opacity-90 hover:scale-102`
                }
                ${(activeRound?.phase !== 'betting' || hasBet) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
              `}
            >
              <span className="text-2xl block mb-1">{color.emoji}</span>
              <p className="text-sm font-bold text-white">{color.label}</p>
              <p className="text-xs text-white/70">{color.multiplier}</p>
              {selectedColor === color.value && (
                <motion.div
                  layoutId="selectedColor"
                  className="absolute inset-0 border-2 border-white/40 rounded-2xl"
                />
              )}
            </motion.button>
          ))}
        </div>

        {/* Bet Amount */}
        <div className="glass rounded-2xl p-4 mb-5">
          <p className="text-sm text-gray-400 mb-3">Select Bet Amount</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {BET_AMOUNTS.map((amount) => (
              <button
                key={amount}
                onClick={() => setBetAmount(amount)}
                className={`bet-chip mx-auto w-full h-12 rounded-xl ${betAmount === amount ? 'selected' : ''}`}
              >
                ₹{amount}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Math.max(10, parseInt(e.target.value) || 10))}
              className="input-dark text-center font-bold text-yellow-400"
              min={10}
              max={10000}
            />
            <span className="text-gray-500 text-sm whitespace-nowrap">
              Win: <span className="text-green-400 font-bold">₹{selectedColor === 'violet' ? betAmount * 9 : betAmount * 2}</span>
            </span>
          </div>
        </div>

        {/* Place Bet Button */}
        {hasBet ? (
          <div className="text-center py-4 glass rounded-2xl">
            <Trophy size={24} className="text-yellow-400 mx-auto mb-2" />
            <p className="text-white font-bold">Bet Placed! Waiting for result...</p>
            <p className="text-gray-500 text-sm">You bet ₹{betAmount} on {selectedColor?.toUpperCase()}</p>
          </div>
        ) : (
          <Button
            variant="gold"
            fullWidth
            size="xl"
            isLoading={isPlacingBet}
            onClick={handlePlaceBet}
            disabled={!selectedColor || activeRound?.phase !== 'betting'}
          >
            {!selectedColor ? 'Select a Color First' :
              activeRound?.phase !== 'betting' ? 'Betting Locked' :
              `Place ₹${betAmount} Bet on ${selectedColor.toUpperCase()}`}
          </Button>
        )}

        {/* History */}
        {history.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <History size={16} className="text-gray-400" />
              <p className="text-sm font-semibold text-gray-300">Round History</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {history.map((round) => (
                <div
                  key={round.roundId}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white/10 ${
                    round.result === 'red' ? 'bg-red-600 text-white' :
                    round.result === 'green' ? 'bg-green-600 text-white' :
                    'bg-purple-600 text-white'
                  }`}
                  title={`Round #${round.roundNumber}: ${round.result}`}
                >
                  {round.result === 'red' ? 'R' : round.result === 'green' ? 'G' : 'V'}
                </div>
              ))}
            </div>
          </motion.div>
        )}
        <div className="h-6" />
      </div>
    </MainLayout>
  );
};
