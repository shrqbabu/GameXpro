import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection, addDoc, onSnapshot, query, orderBy, limit,
  serverTimestamp, doc, updateDoc, getDoc, getDocs, where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { ColorPredictionRound, ColorChoice } from '../../types';
import { placeBet } from '../../firebase/games';
import { addFunds } from '../../firebase/wallet';
import { calculateUsableBalance, formatCurrency } from '../../utils/helpers';
import { Timer, Trophy, Loader2, TrendingUp, History } from 'lucide-react';
import toast from 'react-hot-toast';

const ROUND_DURATION = 60; // seconds
const BET_AMOUNTS = [10, 20, 50, 100, 200, 500];

const COLOR_CONFIG = {
  RED: { label: 'Red', bg: 'bg-red-500', border: 'border-red-400', hover: 'hover:bg-red-400', text: 'text-red-400', multiplier: 2, emoji: '🔴' },
  GREEN: { label: 'Green', bg: 'bg-green-500', border: 'border-green-400', hover: 'hover:bg-green-400', text: 'text-green-400', multiplier: 2, emoji: '🟢' },
  VIOLET: { label: 'Violet', bg: 'bg-violet-500', border: 'border-violet-400', hover: 'hover:bg-violet-400', text: 'text-violet-400', multiplier: 3, emoji: '🟣' },
};

export const ColorPrediction: React.FC = () => {
  const { firebaseUser, user, wallet } = useAuth();
  const [round, setRound] = useState<ColorPredictionRound | null>(null);
  const [history, setHistory] = useState<ColorPredictionRound[]>([]);
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION);
  const [selectedColor, setSelectedColor] = useState<ColorChoice | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [betting, setBetting] = useState(false);
  const [hasBet, setHasBet] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCreatingRound = useRef(false);

  const usableBalance = wallet ? calculateUsableBalance(wallet) : 0;

  // Create a new round
  const createNewRound = useCallback(async () => {
    if (isCreatingRound.current) return;
    isCreatingRound.current = true;

    try {
      // Get last round number
      const q = query(collection(db, 'colorPredictionGames'), orderBy('roundNumber', 'desc'), limit(1));
      const snap = await getDocs(q);
      const lastRound = snap.empty ? 0 : (snap.docs[0].data().roundNumber || 0);

      const timerEnd = new Date(Date.now() + ROUND_DURATION * 1000);

      await addDoc(collection(db, 'colorPredictionGames'), {
        roundNumber: lastRound + 1,
        status: 'BETTING',
        bets: [],
        result: null,
        timerEnd: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        endsAt: timerEnd.toISOString(),
      });
    } catch (_e) {
      // ignore
    } finally {
      isCreatingRound.current = false;
    }
  }, []);

  // Settle round
  const settleRound = useCallback(async (roundId: string) => {
    const colors: ColorChoice[] = ['RED', 'GREEN', 'VIOLET'];
    const weights = [45, 45, 10]; // weighted random
    const rand = Math.random() * 100;
    let result: ColorChoice;
    if (rand < weights[0]) result = colors[0];
    else if (rand < weights[0] + weights[1]) result = colors[1];
    else result = colors[2];

    const roundRef = doc(db, 'colorPredictionGames', roundId);
    const roundSnap = await getDoc(roundRef);
    if (!roundSnap.exists()) return;

    const roundData = roundSnap.data() as ColorPredictionRound;

    await updateDoc(roundRef, {
      status: 'RESULT',
      result,
      updatedAt: serverTimestamp(),
    });

    // Settle bets
    for (const bet of (roundData.bets || [])) {
      if (bet.settled) continue;
      const won = bet.color === result;
      if (won) {
        const payout = bet.amount * COLOR_CONFIG[bet.color].multiplier;
        await addFunds(bet.uid, payout, 'winningBalance', `Color prediction win - ${bet.color} (Round ${roundData.roundNumber})`);
      }
    }

    // Create next round after 5s
    setTimeout(() => createNewRound(), 5000);
  }, [createNewRound]);

  // Subscribe to current round
  useEffect(() => {
    const q = query(
      collection(db, 'colorPredictionGames'),
      where('status', 'in', ['BETTING', 'CLOSED', 'RESULT']),
      orderBy('roundNumber', 'desc'),
      limit(1)
    );

    const unsub = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        await createNewRound();
        return;
      }

      const roundDoc = snap.docs[0];
      const roundData = { id: roundDoc.id, ...roundDoc.data() } as ColorPredictionRound;
      setRound(roundData);

      // Check if current user has bet
      if (firebaseUser) {
        setHasBet(roundData.bets?.some(b => b.uid === firebaseUser.uid) || false);
      }
    });

    return () => unsub();
  }, [firebaseUser, createNewRound]);

  // History
  useEffect(() => {
    const q = query(
      collection(db, 'colorPredictionGames'),
      where('status', '==', 'RESULT'),
      orderBy('roundNumber', 'desc'),
      limit(15)
    );

    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as ColorPredictionRound)));
    });

    return () => unsub();
  }, []);

  // Timer
  useEffect(() => {
    if (!round || round.status !== 'BETTING') {
      setTimeLeft(0);
      return;
    }

    const endTime = round.endsAt
      ? new Date(round.endsAt as unknown as string).getTime()
      : Date.now() + ROUND_DURATION * 1000;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0 && round.status === 'BETTING') {
        // Close betting and settle
        updateDoc(doc(db, 'colorPredictionGames', round.id!), {
          status: 'CLOSED',
          updatedAt: serverTimestamp(),
        }).then(() => {
          setTimeout(() => settleRound(round.id!), 3000);
        });
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [round, settleRound]);

  const handleBet = async () => {
    if (!firebaseUser || !round || !selectedColor) {
      toast.error('Select a color first');
      return;
    }
    if (hasBet) { toast.error('Already bet in this round'); return; }
    if (betAmount > usableBalance) { toast.error('Insufficient balance'); return; }
    if (round.status !== 'BETTING') { toast.error('Betting is closed'); return; }
    if (timeLeft < 5) { toast.error('Too late to bet!'); return; }

    setBetting(true);
    try {
      await placeBet(firebaseUser.uid, user?.name || 'Player', round.id!, selectedColor, betAmount);
      setHasBet(true);
      toast.success(`Bet placed on ${selectedColor}!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to place bet');
    } finally {
      setBetting(false);
    }
  };

  const timerProgress = (timeLeft / ROUND_DURATION) * 100;
  const timerColor = timeLeft > 30 ? 'text-green-400' : timeLeft > 10 ? 'text-yellow-400' : 'text-red-400';
  const timerBarColor = timeLeft > 30 ? 'bg-green-500' : timeLeft > 10 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h2 className="text-2xl font-bold text-white">🎨 Color Prediction</h2>
        <p className="text-gray-400 text-sm">Predict the color to win big!</p>
      </motion.div>

      {/* Round Info + Timer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white/5 border border-white/10 rounded-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400">Round #{round?.roundNumber || '...'}</p>
            <div className={`flex items-center gap-2 mt-1 px-3 py-1 rounded-full text-sm font-semibold border ${
              round?.status === 'BETTING'
                ? 'bg-green-500/20 border-green-500/30 text-green-400'
                : round?.status === 'RESULT'
                ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
            }`}>
              {round?.status === 'BETTING' ? '🟢 Betting Open' : round?.status === 'RESULT' ? '🏁 Results' : '⏳ Closing...'}
            </div>
          </div>

          <div className="text-center">
            <div className={`text-4xl font-bold ${timerColor} tabular-nums`}>
              {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Timer className="w-3 h-3" />
              <span>Timer</span>
            </div>
          </div>
        </div>

        {/* Timer bar */}
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${timerProgress}%` }}
            transition={{ duration: 0.5 }}
            className={`h-full rounded-full ${timerBarColor}`}
          />
        </div>
      </motion.div>

      {/* Result Display */}
      <AnimatePresence>
        {round?.status === 'RESULT' && round.result && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="bg-gradient-to-r from-yellow-500/20 to-orange-500/10 border border-yellow-500/30 rounded-2xl p-6 text-center"
          >
            <p className="text-gray-400 text-sm mb-2">Result</p>
            <div className={`w-20 h-20 mx-auto rounded-full ${COLOR_CONFIG[round.result].bg} flex items-center justify-center text-4xl mb-3 shadow-lg`}>
              {COLOR_CONFIG[round.result].emoji}
            </div>
            <p className={`text-2xl font-bold ${COLOR_CONFIG[round.result].text}`}>
              {COLOR_CONFIG[round.result].label} Wins!
            </p>
            {hasBet && (
              <p className="text-sm text-gray-400 mt-2">
                {round.bets?.find(b => b.uid === firebaseUser?.uid)?.color === round.result
                  ? '🎉 You Won!'
                  : '😔 Better luck next round!'}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-2">Next round starting soon...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Color Selection */}
      {round?.status === 'BETTING' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
        >
          <p className="text-sm font-medium text-gray-300 mb-3">Choose Color</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {(Object.entries(COLOR_CONFIG) as [ColorChoice, typeof COLOR_CONFIG.RED][]).map(([color, config]) => (
              <motion.button
                key={color}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => !hasBet && setSelectedColor(color)}
                disabled={hasBet}
                className={`relative py-4 rounded-xl border-2 transition-all font-bold text-white ${
                  selectedColor === color
                    ? `${config.bg} ${config.border} shadow-lg scale-105`
                    : `bg-white/5 border-white/10 ${config.hover}`
                } disabled:opacity-60`}
              >
                <div className="text-3xl mb-1">{config.emoji}</div>
                <div className="text-xs">{config.label}</div>
                <div className={`text-xs ${config.text}`}>{config.multiplier}×</div>
              </motion.button>
            ))}
          </div>

          {/* Bet Amount */}
          <p className="text-sm font-medium text-gray-300 mb-2">Bet Amount</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {BET_AMOUNTS.map(amt => (
              <motion.button
                key={amt}
                whileTap={{ scale: 0.95 }}
                onClick={() => !hasBet && setBetAmount(amt)}
                disabled={hasBet || amt > usableBalance}
                className={`py-2 rounded-xl text-sm font-semibold border transition-all ${
                  betAmount === amt
                    ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                } disabled:opacity-40`}
              >
                ₹{amt}
              </motion.button>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
            <span>Usable Balance: {formatCurrency(usableBalance)}</span>
            {selectedColor && <span>Potential Win: {formatCurrency(betAmount * COLOR_CONFIG[selectedColor].multiplier)}</span>}
          </div>

          {hasBet ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
              <p className="text-green-400 font-semibold">✓ Bet Placed! Waiting for result...</p>
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleBet}
              disabled={!selectedColor || betting || timeLeft < 5}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {betting && <Loader2 className="w-4 h-4 animate-spin" />}
              Place Bet {selectedColor ? `on ${COLOR_CONFIG[selectedColor].label}` : ''}
            </motion.button>
          )}
        </motion.div>
      )}

      {/* Active Bets */}
      {round && round.bets?.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-yellow-400" />
            <p className="text-sm font-medium text-white">Active Bets ({round.bets.length})</p>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {round.bets.map((bet, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${COLOR_CONFIG[bet.color]?.bg}`} />
                  <span className="text-gray-300">{bet.userName}</span>
                  <span className={`${bet.uid === firebaseUser?.uid ? 'text-yellow-400' : 'text-gray-500'}`}>
                    {bet.uid === firebaseUser?.uid ? '(You)' : ''}
                  </span>
                </div>
                <span className="text-gray-400">₹{bet.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-medium text-white">Recent Results</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {history.slice(0, 10).map((h) => h.result && (
              <div
                key={h.id}
                className={`w-8 h-8 rounded-full ${COLOR_CONFIG[h.result]?.bg} flex items-center justify-center text-xs text-white font-bold shadow`}
                title={`Round ${h.roundNumber}: ${h.result}`}
              >
                {COLOR_CONFIG[h.result]?.label.charAt(0)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
