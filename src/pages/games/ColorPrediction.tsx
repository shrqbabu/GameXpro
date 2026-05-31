// src/pages/games/ColorPrediction.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  subscribeColorGame,
  createColorPredictionRound,
  placeBet,
  settleColorRound,
  getColorGameHistory,
} from '../../firebase/games';
import { ColorPredictionRound, ColorChoice } from '../../types';
import { formatCurrency, calculateUsableBalance } from '../../utils/helpers';
import {
  Timer, Trophy, Loader2, TrendingUp,
  History, CheckCircle, AlertCircle,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────
const BETTING_MS      = 30_000;
const RESULT_SHOW_MS  = 6_000;
const BET_AMOUNTS     = [10, 25, 50, 100, 250, 500];

// ── Color config ─────────────────────────────────────────────
const COLOR_CFG = {
  RED: {
    label: 'Red', emoji: '🔴',
    bg: 'bg-red-600', ring: 'ring-red-400',
    text: 'text-red-400', border: 'border-red-500',
    multiplier: 2,
  },
  GREEN: {
    label: 'Green', emoji: '🟢',
    bg: 'bg-green-600', ring: 'ring-green-400',
    text: 'text-green-400', border: 'border-green-500',
    multiplier: 2,
  },
  VIOLET: {
    label: 'Violet', emoji: '🟣',
    bg: 'bg-violet-600', ring: 'ring-violet-400',
    text: 'text-violet-400', border: 'border-violet-500',
    multiplier: 3,
  },
} as const;

// ── Timer bar ────────────────────────────────────────────────
const TimerBar: React.FC<{ endsAt: any; durationMs: number }> = ({
  endsAt, durationMs,
}) => {
  const [pct,  setPct]  = useState(100);
  const [secs, setSecs] = useState(Math.ceil(durationMs / 1000));

  useEffect(() => {
    if (!endsAt) return;
    const endMs =
      typeof endsAt.toMillis === 'function'
        ? endsAt.toMillis()
        : (endsAt?.seconds ?? 0) * 1000;

    const tick = () => {
      const rem = endMs - Date.now();
      setPct(Math.max(0, (rem / durationMs) * 100));
      setSecs(Math.max(0, Math.ceil(rem / 1000)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt, durationMs]);

  const barColor =
    pct > 60 ? 'bg-green-500' :
    pct > 25 ? 'bg-yellow-500' : 'bg-red-500';

  const textColor =
    pct > 60 ? 'text-green-400' :
    pct > 25 ? 'text-yellow-400' : 'text-red-400 animate-pulse';

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span className="flex items-center gap-1">
          <Timer className="w-3 h-3" /> Betting closes in
        </span>
        <span className={`font-black text-base tabular-nums ${textColor}`}>
          {secs}s
        </span>
      </div>
      <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// ── Result ball ──────────────────────────────────────────────
const ResultBall: React.FC<{ color: ColorChoice }> = ({ color }) => {
  const cfg = COLOR_CFG[color];
  return (
    <div
      className={`w-24 h-24 rounded-full ${cfg.bg} shadow-2xl
                  flex items-center justify-center text-4xl animate-bounce`}
    >
      {cfg.emoji}
    </div>
  );
};

// ── History dot ──────────────────────────────────────────────
const HistDot: React.FC<{ color: ColorChoice }> = ({ color }) => {
  const cfg = COLOR_CFG[color];
  return (
    <div
      className={`w-9 h-9 rounded-full ${cfg.bg} flex items-center
                  justify-center text-white text-xs font-black`}
      title={cfg.label}
    >
      {cfg.label[0]}
    </div>
  );
};

// ── Toast helper ─────────────────────────────────────────────
type ToastState = { msg: string; type: 'success' | 'error' } | null;

// ── Main Page ────────────────────────────────────────────────
export const ColorPrediction: React.FC = () => {
  const { user, wallet } = useAuth();

  const [round,         setRound]         = useState<ColorPredictionRound | null>(null);
  const [history,       setHistory]       = useState<ColorPredictionRound[]>([]);
  const [selectedColor, setSelectedColor] = useState<ColorChoice>('RED');
  const [betAmount,     setBetAmount]     = useState(10);
  const [myBet,         setMyBet]         = useState<any>(null);
  const [loading,       setLoading]       = useState(false);
  const [toast,         setToast]         = useState<ToastState>(null);

  // Prevent double settle / double round creation
  const settlingRef   = useRef(false);
  const nextRoundRef  = useRef(false);
  const resultTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const usable = wallet ? calculateUsableBalance(wallet) : 0;

  // ── Bootstrap + subscribe ────────────────────────────────
  const ensureRound = useCallback(async () => {
    if (nextRoundRef.current) return;
    nextRoundRef.current = true;
    try { await createColorPredictionRound(); }
    catch (e) { console.error('ensureRound:', e); }
    finally { nextRoundRef.current = false; }
  }, []);

  useEffect(() => {
    ensureRound();
    const unsub = subscribeColorGame((r) => setRound(r));
    return () => unsub();
  }, [ensureRound]);

  // Load history when round changes
  useEffect(() => {
    getColorGameHistory(10)
      .then((h) => setHistory(h.filter((r) => r.status === 'RESULT' && r.result)))
      .catch(() => {});
  }, [round?.id]);

  // ── Sync my bet ──────────────────────────────────────────
  useEffect(() => {
    if (!round || !user) return;
    const found = (round.bets || []).find((b: any) => b.uid === user.uid) || null;
    setMyBet(found);
  }, [round, user]);

  // ── Auto-settle when betting timer expires ───────────────
  useEffect(() => {
    if (!round || round.status !== 'BETTING') return;
    if (settlingRef.current) return;

    const endMs =
      typeof round.bettingEndsAt?.toMillis === 'function'
        ? round.bettingEndsAt.toMillis()
        : (round.bettingEndsAt?.seconds ?? 0) * 1000;

    const remaining = endMs - Date.now();

    const doSettle = async () => {
      if (settlingRef.current) return;
      settlingRef.current = true;
      try { await settleColorRound(round.id); }
      catch (e) { console.error('Settle error:', e); }
      finally { settlingRef.current = false; }
    };

    if (remaining <= 0) { doSettle(); return; }
    const tid = setTimeout(doSettle, remaining + 300);
    return () => clearTimeout(tid);
  }, [round?.status, round?.id]);

  // ── Schedule next round after result ────────────────────
  useEffect(() => {
    if (!round || round.status !== 'RESULT') return;
    if (resultTimer.current) clearTimeout(resultTimer.current);
    resultTimer.current = setTimeout(async () => {
      try { await createColorPredictionRound(); }
      catch (e) { console.error('Next round error:', e); }
    }, RESULT_SHOW_MS);
    return () => { if (resultTimer.current) clearTimeout(resultTimer.current); };
  }, [round?.status, round?.id]);

  // ── Place bet ────────────────────────────────────────────
  const handleBet = async () => {
    if (!user || !round) return;
    if (round.status !== 'BETTING') { showToast('Betting is closed', 'error'); return; }
    if (myBet)                       { showToast('Already bet this round', 'error'); return; }
    if (betAmount < 10)              { showToast('Minimum bet ₹10', 'error'); return; }
    if (betAmount > usable)          { showToast('Insufficient balance', 'error'); return; }

    setLoading(true);
    try {
      await placeBet(
        user.uid,
        user.name || 'Player',
        round.id,
        selectedColor,
        betAmount,
      );
      showToast(`✅ ₹${betAmount} on ${selectedColor}`, 'success');
    } catch (e: any) {
      showToast(e.message || 'Bet failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────
  const didWin =
    round?.status === 'RESULT' && myBet && round.result === myBet.color;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50
          flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl border text-sm
          font-medium max-w-[90vw] whitespace-nowrap
          ${toast.type === 'success'
            ? 'bg-emerald-900/95 border-emerald-500/50 text-emerald-300'
            : 'bg-red-900/95 border-red-500/50 text-red-300'}`}
        >
          {toast.type === 'success'
            ? <CheckCircle  className="w-4 h-4 flex-shrink-0" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span className="truncate">{toast.msg}</span>
        </div>
      )}

      <div className="max-w-xl mx-auto px-3 py-4">
        {/* Header */}
        <div className="text-center mb-5">
          <h1 className="text-3xl font-black bg-gradient-to-r from-red-400 via-violet-400 to-green-400
                          bg-clip-text text-transparent">
            🎨 Color Prediction
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Round #{round?.roundNumber ?? '—'}
          </p>
        </div>

        {/* Balance */}
        <div className="flex justify-end mb-3">
          <div className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-1.5">
            <p className="text-gray-500 text-xs">Balance</p>
            <p className="text-yellow-400 font-bold text-sm">{formatCurrency(usable)}</p>
          </div>
        </div>

        {/* Status card */}
        <div className="bg-gray-900 border border-gray-700/50 rounded-2xl p-4 mb-4">
          {/* Status row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0
                ${round?.status === 'BETTING' ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400'}`}
              />
              <span className={`font-bold text-sm
                ${round?.status === 'BETTING' ? 'text-emerald-400' : 'text-blue-400'}`}
              >
                {round?.status === 'BETTING' ? '🟢 Betting Open' : '🏁 Result'}
              </span>
            </div>
          </div>

          {/* Timer */}
          {round?.status === 'BETTING' && round.bettingEndsAt && (
            <TimerBar endsAt={round.bettingEndsAt} durationMs={BETTING_MS} />
          )}

          {/* Result */}
          {round?.status === 'RESULT' && round.result && (
            <div className="flex flex-col items-center gap-3 py-2">
              <ResultBall color={round.result as ColorChoice} />
              <p className={`text-2xl font-black ${COLOR_CFG[round.result as ColorChoice].text}`}>
                {COLOR_CFG[round.result as ColorChoice].label} Wins!
              </p>
              {myBet && (
                <p className={`text-lg font-black ${didWin ? 'text-green-400' : 'text-red-400'}`}>
                  {didWin
                    ? `🎉 +₹${Math.floor(myBet.amount * myBet.multiplier)}`
                    : `😔 -₹${myBet.amount}`}
                </p>
              )}
              <p className="text-xs text-gray-500 animate-pulse">
                Next round starting soon…
              </p>
            </div>
          )}
        </div>

        {/* Bet panel — only during BETTING and no bet yet */}
        {round?.status === 'BETTING' && !myBet && (
          <div className="bg-gray-900 border border-gray-700/50 rounded-2xl p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">
              Choose Color
            </h2>

            {/* Color buttons */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {(Object.keys(COLOR_CFG) as ColorChoice[]).map((c) => {
                const cfg = COLOR_CFG[c];
                const sel = selectedColor === c;
                return (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={`py-5 rounded-xl font-bold flex flex-col items-center gap-1
                      transition-all duration-200 ${cfg.bg}
                      ${sel ? `ring-4 ${cfg.ring} scale-105` : 'opacity-70 hover:opacity-90'}`}
                  >
                    <span className="text-2xl">{cfg.emoji}</span>
                    <span className="text-white text-sm">{cfg.label}</span>
                    <span className="text-white/70 text-xs">{cfg.multiplier}×</span>
                  </button>
                );
              })}
            </div>

            {/* Amount presets */}
            <div className="flex flex-wrap gap-2 mb-3">
              {BET_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => setBetAmount(a)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${betAmount === a
                      ? 'bg-yellow-500 text-black'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                >
                  ₹{a}
                </button>
              ))}
            </div>

            {/* Custom input */}
            <input
              type="number"
              min={10}
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2
                         text-white text-sm mb-1 focus:outline-none focus:border-yellow-500"
              placeholder="Custom amount"
            />
            <div className="flex justify-between text-xs text-gray-500 mb-3">
              <span>Balance: {formatCurrency(usable)}</span>
              <span className="text-green-400">
                Win: {formatCurrency(betAmount * COLOR_CFG[selectedColor].multiplier)}
              </span>
            </div>

            <button
              onClick={handleBet}
              disabled={loading}
              className={`w-full py-3.5 rounded-xl font-black text-lg transition-all
                ${COLOR_CFG[selectedColor].bg} hover:opacity-90
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading
                ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                : `Bet ₹${betAmount} on ${COLOR_CFG[selectedColor].label} (${COLOR_CFG[selectedColor].multiplier}×)`}
            </button>
          </div>
        )}

        {/* My active bet */}
        {myBet && round?.status === 'BETTING' && (
          <div className={`rounded-2xl p-4 mb-4 text-center font-bold border-2
            ${COLOR_CFG[myBet.color as ColorChoice]?.bg ?? 'bg-gray-700'}
            ${COLOR_CFG[myBet.color as ColorChoice]?.border ?? ''}`}
          >
            <CheckCircle className="w-5 h-5 inline mr-2" />
            Bet placed: ₹{myBet.amount} on {myBet.color} ({myBet.multiplier}×)
            <p className="text-white/70 text-xs mt-1 font-normal">
              Potential win: {formatCurrency(myBet.amount * myBet.multiplier)}
            </p>
          </div>
        )}

        {/* Live bets */}
        {(round?.bets?.length ?? 0) > 0 && (
          <div className="bg-gray-900 border border-gray-700/50 rounded-2xl p-4 mb-4">
            <h3 className="flex items-center gap-2 text-xs text-gray-400
                           uppercase tracking-wider mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-yellow-400" />
              Bets this round ({round!.bets.length})
            </h3>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {round!.bets.map((b: any, i: number) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-gray-300 truncate max-w-[160px]">
                    {b.uid === user?.uid ? '⭐ You' : b.userName}
                  </span>
                  <span className={COLOR_CFG[b.color as ColorChoice]?.text ?? 'text-gray-400'}>
                    {b.color} · ₹{b.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="bg-gray-900 border border-gray-700/50 rounded-2xl p-4">
            <h3 className="flex items-center gap-2 text-xs text-gray-400
                           uppercase tracking-wider mb-3">
              <History className="w-3.5 h-3.5 text-yellow-400" />
              Recent Results
            </h3>
            <div className="flex flex-wrap gap-2">
              {history.map((h) => (
                <HistDot key={h.id} color={h.result as ColorChoice} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ColorPrediction;
