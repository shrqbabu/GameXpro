// src/pages/AndarBaharPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  createAndarBaharRound,
  getActiveAndarBaharGame,
  subscribeAndarBahar,
  placeAndarBaharBet,
  dealAndarBahar,
  AndarBaharGame,
  ABBet,
} from '../firebase/games';
import CardDisplay from '../components/games/CardDisplay';
import GameTimer from '../components/games/GameTimer';
import { formatCurrency, calculateUsableBalance } from '../utils/helpers';
import {
  Users, ChevronRight, History, TrendingUp,
  Loader2, AlertCircle, CheckCircle, Coins,
  Zap, RotateCcw,
} from 'lucide-react';

const BET_CHIPS = [10, 50, 100, 500, 1000];
const NEXT_ROUND_DELAY = 6000; // 6 seconds before next round

// ─────────────────────────────────────────────────────
// History Entry
// ─────────────────────────────────────────────────────
interface HistoryEntry {
  winner: 'andar' | 'bahar';
  roundNumber: number;
}

// ─────────────────────────────────────────────────────
// AndarBaharPage
// ─────────────────────────────────────────────────────

const AndarBaharPage: React.FC = () => {
  const { user, wallet } = useAuth();

  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState<AndarBaharGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [betAmount, setBetAmount] = useState(50);
  const [placing, setPlacing] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [nextRoundCountdown, setNextRoundCountdown] = useState<number | null>(null);

  const isDealing = useRef(false);
  const nextRoundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Init Game ──────────────────────────────────────
  const initGame = useCallback(async () => {
    setLoading(true);
    try {
      let id = await getActiveAndarBaharGame();
      if (!id) {
        id = await createAndarBaharRound();
      }
      setGameId(id);
    } catch (e: any) {
      showToast(e.message || 'Failed to load game', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initGame();
    return () => {
      if (nextRoundTimer.current) clearTimeout(nextRoundTimer.current);
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, [initGame]);

  // ── Subscribe to game ──────────────────────────────
  useEffect(() => {
    if (!gameId) return;
    const unsub = subscribeAndarBahar(gameId, (data) => {
      setGame(data);

      if (data.status === 'result' && !isDealing.current) {
        // Add to history
        if (data.winner) {
          setHistory((prev) => [
            { winner: data.winner!, roundNumber: data.roundNumber },
            ...prev.slice(0, 19),
          ]);
        }

        // Start next round countdown
        let secs = Math.ceil(NEXT_ROUND_DELAY / 1000);
        setNextRoundCountdown(secs);
        if (countdownInterval.current) clearInterval(countdownInterval.current);
        countdownInterval.current = setInterval(() => {
          secs--;
          setNextRoundCountdown(secs);
          if (secs <= 0) {
            clearInterval(countdownInterval.current!);
            setNextRoundCountdown(null);
          }
        }, 1000);

        // Schedule next round
        if (nextRoundTimer.current) clearTimeout(nextRoundTimer.current);
        nextRoundTimer.current = setTimeout(async () => {
          isDealing.current = false;
          const newId = await createAndarBaharRound();
          setGameId(newId);
          setGame(null);
        }, NEXT_ROUND_DELAY);
      }
    });
    return () => unsub();
  }, [gameId]);

  // ── Timer expired → deal ──────────────────────────
  const handleTimerExpire = useCallback(async () => {
    if (!gameId || isDealing.current) return;
    isDealing.current = true;
    setDealing(true);
    try {
      await dealAndarBahar(gameId);
    } catch (e: any) {
      showToast(e.message || 'Deal failed', 'error');
      isDealing.current = false;
    } finally {
      setDealing(false);
    }
  }, [gameId]);

  // ── Place Bet ──────────────────────────────────────
  const handleBet = async (side: 'andar' | 'bahar') => {
    if (!user || !gameId) return;
    if (!wallet) { showToast('Wallet not loaded', 'error'); return; }
    if (game?.status !== 'betting') { showToast('Betting is closed', 'error'); return; }

    const myBet = game?.bets?.find((b) => b.uid === user.uid);
    if (myBet) { showToast('Already placed a bet this round', 'error'); return; }

    const usable = calculateUsableBalance(wallet);
    if (usable < betAmount) { showToast('Insufficient balance', 'error'); return; }

    setPlacing(true);
    try {
      await placeAndarBaharBet(gameId, user.uid, user.name || 'Player', betAmount, side);
      showToast(
        `✅ ₹${betAmount} on ${side === 'andar' ? '🔵 ANDAR' : '🔴 BAHAR'}`,
        'success'
      );
    } catch (e: any) {
      showToast(e.message || 'Bet failed', 'error');
    } finally {
      setPlacing(false);
    }
  };

  const myBet = game?.bets?.find((b) => b.uid === user?.uid);
  const usableBalance = wallet ? calculateUsableBalance(wallet) : 0;

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent
            rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading Andar Bahar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Toast ───────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50
          flex items-center gap-2 px-5 py-3 rounded-2xl shadow-2xl
          border text-sm font-medium animate-[slideDown_0.3s_ease-out]
          ${toast.type === 'success'
            ? 'bg-emerald-900/95 border-emerald-500/50 text-emerald-300'
            : 'bg-red-900/95 border-red-500/50 text-red-300'
          }`}>
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4" />
            : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* ── Header ──────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              🃏 Andar Bahar
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Real-time multiplayer • Place bet before timer ends
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2">
              <p className="text-gray-500 text-xs">Balance</p>
              <p className="text-yellow-400 font-bold">{formatCurrency(usableBalance)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ── LEFT: Game Board ─────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Status Bar */}
            <div className="bg-gray-900 border border-gray-700/50 rounded-2xl p-4
              flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full
                  ${game?.status === 'betting' ? 'bg-emerald-400 animate-pulse' :
                    game?.status === 'dealing' ? 'bg-amber-400 animate-pulse' :
                    'bg-blue-400'}`} />
                <span className="font-semibold text-sm">
                  {game?.status === 'betting' && '🎲 Betting Open — Place your bets!'}
                  {game?.status === 'dealing' && '🃏 Dealing cards...'}
                  {game?.status === 'result' && (
                    <span className={game.winner === 'andar' ? 'text-blue-400' : 'text-rose-400'}>
                      🏆 {game.winner?.toUpperCase()} Wins!
                    </span>
                  )}
                </span>
              </div>

              {game?.status === 'betting' && game?.bettingEndsAt && (
                <GameTimer
                  endsAt={game.bettingEndsAt instanceof Date
                    ? game.bettingEndsAt
                    : game.bettingEndsAt?.toDate
                    ? game.bettingEndsAt.toDate()
                    : new Date(game.bettingEndsAt)}
                  onExpire={handleTimerExpire}
                />
              )}

              {game?.status === 'result' && nextRoundCountdown !== null && (
                <div className="text-gray-400 text-sm">
                  Next round in <span className="text-yellow-400 font-bold">
                    {nextRoundCountdown}s
                  </span>
                </div>
              )}

              {game?.status === 'dealing' && (
                <div className="flex items-center gap-2 text-amber-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Dealing...</span>
                </div>
              )}
            </div>

            {/* Main Table */}
            <div className="bg-gradient-to-br from-emerald-950 via-green-900
              to-emerald-950 border border-emerald-800/40 rounded-3xl p-6
              shadow-2xl shadow-emerald-950/50 relative overflow-hidden">

              {/* Felt texture overlay */}
              <div className="absolute inset-0 opacity-5"
                style={{
                  backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                  backgroundSize: '24px 24px'
                }} />

              {/* Joker Card Section */}
              <div className="relative text-center mb-6">
                <div className="inline-block">
                  <p className="text-emerald-300/60 text-xs uppercase tracking-widest mb-3
                    font-semibold">
                    ✦ Joker Card ✦
                  </p>
                  <div className="flex justify-center">
                    {game?.jokerCard ? (
                      <div className="relative">
                        <div className="absolute -inset-2 bg-yellow-400/20 rounded-2xl
                          blur-xl animate-pulse" />
                        <CardDisplay card={game.jokerCard} size="lg" animate />
                      </div>
                    ) : (
                      <div className="w-20 h-28 rounded-xl border-2 border-dashed
                        border-emerald-600/40 flex items-center justify-center
                        bg-emerald-900/20">
                        <span className="text-emerald-600/40 text-4xl">?</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Andar & Bahar Areas */}
              <div className="grid grid-cols-2 gap-4">
                {/* Andar */}
                <div className={`rounded-2xl p-4 border-2 transition-all duration-500
                  min-h-[120px] relative overflow-hidden
                  ${game?.winner === 'andar'
                    ? 'border-yellow-400 bg-yellow-400/10 shadow-lg shadow-yellow-400/20'
                    : myBet?.side === 'andar'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-emerald-700/30 bg-black/20'}`}>

                  {game?.winner === 'andar' && (
                    <div className="absolute inset-0 bg-yellow-400/5 animate-pulse" />
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="font-black text-lg text-blue-400">ANDAR</span>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {myBet?.side === 'andar' && (
                        <span className="text-xs bg-blue-500/20 text-blue-300
                          border border-blue-500/30 rounded-full px-2 py-0.5">
                          Your Bet ₹{myBet.amount}
                        </span>
                      )}
                      {game?.winner === 'andar' && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-300
                          border border-yellow-500/30 rounded-full px-2 py-0.5">
                          🏆 Winner
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {game?.andarCards?.map((card, i) => (
                      <CardDisplay key={i} card={card} size="xs" animate />
                    ))}
                    {game?.status === 'dealing' && (
                      <div className="w-8 h-11 rounded-lg bg-blue-500/10
                        border border-blue-500/20 animate-pulse" />
                    )}
                  </div>

                  <div className="mt-2 text-xs text-emerald-600">
                    {game?.andarCards?.length || 0} cards
                  </div>
                </div>

                {/* Bahar */}
                <div className={`rounded-2xl p-4 border-2 transition-all duration-500
                  min-h-[120px] relative overflow-hidden
                  ${game?.winner === 'bahar'
                    ? 'border-yellow-400 bg-yellow-400/10 shadow-lg shadow-yellow-400/20'
                    : myBet?.side === 'bahar'
                    ? 'border-rose-500 bg-rose-500/10'
                    : 'border-emerald-700/30 bg-black/20'}`}>

                  {game?.winner === 'bahar' && (
                    <div className="absolute inset-0 bg-yellow-400/5 animate-pulse" />
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-rose-500" />
                      <span className="font-black text-lg text-rose-400">BAHAR</span>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {myBet?.side === 'bahar' && (
                        <span className="text-xs bg-rose-500/20 text-rose-300
                          border border-rose-500/30 rounded-full px-2 py-0.5">
                          Your Bet ₹{myBet.amount}
                        </span>
                      )}
                      {game?.winner === 'bahar' && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-300
                          border border-yellow-500/30 rounded-full px-2 py-0.5">
                          🏆 Winner
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {game?.baharCards?.map((card, i) => (
                      <CardDisplay key={i} card={card} size="xs" animate />
                    ))}
                    {game?.status === 'dealing' && (
                      <div className="w-8 h-11 rounded-lg bg-rose-500/10
                        border border-rose-500/20 animate-pulse" />
                    )}
                  </div>

                  <div className="mt-2 text-xs text-emerald-600">
                    {game?.baharCards?.length || 0} cards
                  </div>
                </div>
              </div>

              {/* Pot */}
              {(game?.pot || 0) > 0 && (
                <div className="mt-4 text-center">
                  <span className="text-xs text-emerald-500/60 uppercase tracking-wider">
                    Total Pot
                  </span>
                  <p className="text-yellow-400 font-black text-xl">
                    {formatCurrency(game?.pot || 0)}
                  </p>
                </div>
              )}
            </div>

            {/* Result Banner */}
            {game?.status === 'result' && myBet && (
              <div className={`rounded-2xl p-5 border-2 text-center
                ${myBet.side === game.winner
                  ? 'bg-emerald-900/40 border-emerald-500/50 shadow-lg shadow-emerald-500/20'
                  : 'bg-red-900/40 border-red-500/50 shadow-lg shadow-red-500/20'}`}>
                {myBet.side === game.winner ? (
                  <>
                    <p className="text-4xl mb-2">🎉</p>
                    <p className="text-emerald-400 font-black text-2xl">You Won!</p>
                    <p className="text-emerald-300 text-lg mt-1">
                      +{formatCurrency(Math.floor(myBet.amount * 1.9))}
                    </p>
                    <p className="text-gray-500 text-sm mt-1">Credited to winning balance</p>
                  </>
                ) : (
                  <>
                    <p className="text-4xl mb-2">😔</p>
                    <p className="text-red-400 font-black text-2xl">Better luck next time</p>
                    <p className="text-red-300 text-lg mt-1">
                      -{formatCurrency(myBet.amount)}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Bet Panel */}
            {game?.status === 'betting' && (
              <div className="bg-gray-900 border border-gray-700/50 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Coins className="w-4 h-4 text-yellow-400" />
                    Place Your Bet
                  </h3>
                  {myBet && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-400
                      border border-emerald-500/30 rounded-full px-3 py-1">
                      ✓ Bet Placed
                    </span>
                  )}
                </div>

                {myBet ? (
                  <div className="text-center py-6">
                    <p className="text-gray-400 mb-3 text-sm">You're betting on:</p>
                    <div className={`inline-flex items-center gap-3 px-6 py-3
                      rounded-2xl border-2 font-black text-xl
                      ${myBet.side === 'andar'
                        ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                        : 'bg-rose-500/10 border-rose-500/40 text-rose-400'}`}>
                      <div className={`w-4 h-4 rounded-full
                        ${myBet.side === 'andar' ? 'bg-blue-500' : 'bg-rose-500'}`} />
                      {myBet.side.toUpperCase()} — {formatCurrency(myBet.amount)}
                    </div>
                    <p className="text-gray-600 text-xs mt-3">
                      Win: {formatCurrency(Math.floor(myBet.amount * 1.9))}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Chip Selector */}
                    <div className="mb-5">
                      <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider">
                        Select chip value
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {BET_CHIPS.map((chip) => (
                          <button
                            key={chip}
                            onClick={() => setBetAmount(chip)}
                            className={`relative flex-1 min-w-[60px] py-3 rounded-xl
                              text-sm font-bold transition-all border-2
                              ${betAmount === chip
                                ? 'bg-yellow-500 border-yellow-400 text-gray-900 scale-105 shadow-lg shadow-yellow-500/30'
                                : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}>
                            ₹{chip >= 1000 ? `${chip / 1000}K` : chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Bet Buttons */}
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => handleBet('andar')}
                        disabled={placing || !user}
                        className="group relative overflow-hidden bg-gradient-to-b
                          from-blue-600 to-blue-800 border border-blue-500/50
                          text-white font-black py-5 rounded-2xl
                          hover:from-blue-500 hover:to-blue-700
                          disabled:opacity-40 transition-all
                          hover:shadow-lg hover:shadow-blue-500/30
                          active:scale-95">
                        <div className="absolute inset-0 bg-blue-400/10
                          translate-y-full group-hover:translate-y-0 transition-transform" />
                        <div className="relative">
                          <div className="w-5 h-5 rounded-full bg-blue-300 mx-auto mb-2" />
                          <div className="text-xl mb-1">ANDAR</div>
                          <div className="text-blue-200 text-xs">
                            Bet: {formatCurrency(betAmount)}
                          </div>
                          <div className="text-blue-300/70 text-xs">
                            Win: {formatCurrency(Math.floor(betAmount * 1.9))}
                          </div>
                        </div>
                      </button>

                      <button
                        onClick={() => handleBet('bahar')}
                        disabled={placing || !user}
                        className="group relative overflow-hidden bg-gradient-to-b
                          from-rose-600 to-rose-800 border border-rose-500/50
                          text-white font-black py-5 rounded-2xl
                          hover:from-rose-500 hover:to-rose-700
                          disabled:opacity-40 transition-all
                          hover:shadow-lg hover:shadow-rose-500/30
                          active:scale-95">
                        <div className="absolute inset-0 bg-rose-400/10
                          translate-y-full group-hover:translate-y-0 transition-transform" />
                        <div className="relative">
                          <div className="w-5 h-5 rounded-full bg-rose-300 mx-auto mb-2" />
                          <div className="text-xl mb-1">BAHAR</div>
                          <div className="text-rose-200 text-xs">
                            Bet: {formatCurrency(betAmount)}
                          </div>
                          <div className="text-rose-300/70 text-xs">
                            Win: {formatCurrency(Math.floor(betAmount * 1.9))}
                          </div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT: Sidebar ───────────────────────── */}
          <div className="space-y-4">
            {/* Live Bets */}
            <div className="bg-gray-900 border border-gray-700/50 rounded-2xl p-4">
              <h3 className="font-bold text-white flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-emerald-400" />
                Live Bets
                <span className="ml-auto text-xs text-gray-500">
                  {game?.bets?.length || 0} players
                </span>
              </h3>

              <div className="mb-2 flex items-center justify-between text-xs text-gray-600">
                <span>Pot: <span className="text-yellow-400 font-bold">
                  {formatCurrency(game?.pot || 0)}</span>
                </span>
              </div>

              <div className="space-y-1.5 max-h-52 overflow-y-auto
                scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-700">
                {!game?.bets?.length ? (
                  <div className="text-center py-6 text-gray-700 text-sm">
                    No bets placed yet
                  </div>
                ) : (
                  game.bets.map((bet: ABBet, i) => (
                    <div key={i} className="flex items-center justify-between
                      bg-gray-800/60 rounded-xl px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full
                          ${bet.side === 'andar' ? 'bg-blue-500' : 'bg-rose-500'}`} />
                        <span className="text-gray-300 truncate max-w-[80px]">
                          {bet.name}
                        </span>
                      </div>
                      <span className={`font-bold text-xs
                        ${bet.side === 'andar' ? 'text-blue-400' : 'text-rose-400'}`}>
                        {bet.side.toUpperCase()}
                      </span>
                      <span className="text-yellow-400 font-bold">
                        ₹{bet.amount}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* History */}
            <div className="bg-gray-900 border border-gray-700/50 rounded-2xl p-4">
              <h3 className="font-bold text-white flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-yellow-400" />
                Round History
              </h3>
              {!history.length ? (
                <div className="text-center py-6 text-gray-700 text-sm">
                  No history yet
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {history.map((h, i) => (
                    <span key={i} className={`text-xs font-bold px-2.5 py-1
                      rounded-full border
                      ${h.winner === 'andar'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                      {h.winner === 'andar' ? 'A' : 'B'}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Payout Info */}
            <div className="bg-gray-900 border border-gray-700/50 rounded-2xl p-4">
              <h3 className="font-bold text-white text-sm mb-3">Payout</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-blue-400 font-bold">🔵 Andar</span>
                  <span className="text-white font-bold">1.9x</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-rose-400 font-bold">🔴 Bahar</span>
                  <span className="text-white font-bold">1.9x</span>
                </div>
                <div className="border-t border-gray-800 pt-2 text-gray-600">
                  First card always goes to Bahar
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AndarBaharPage;
