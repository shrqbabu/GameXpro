// src/pages/games/DragonTiger.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  subscribeLatestDragonTiger,
  createDragonTigerRound,
  placeDragonTigerBet,
  dealDragonTiger,
  DragonTigerGame,
  DTBet,
} from '../../firebase/games';
import CardDisplay from '../../components/games/CardDisplay';
import GameTimer from '../../components/games/GameTimer';
import { formatCurrency, calculateUsableBalance } from '../../utils/helpers';
import {
  Users, History, Loader2, AlertCircle,
  CheckCircle, Coins, RefreshCw,
} from 'lucide-react';

const BET_CHIPS = [10, 50, 100, 500, 1000];
const NEXT_ROUND_DELAY = 8000;

interface HistEntry { winner: 'dragon' | 'tiger' | 'tie'; roundNumber: number; }

const DragonTigerPage: React.FC = () => {
  const { user, wallet } = useAuth();

  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState<DragonTigerGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [betAmount, setBetAmount] = useState(50);
  const [placing, setPlacing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [history, setHistory] = useState<HistEntry[]>([]);
  const [nextRoundIn, setNextRoundIn] = useState<number | null>(null);

  const isDealing = useRef(false);
  const nextRoundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentGameId = useRef<string | null>(null);
  const resultHandled = useRef<string | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const clearTimers = useCallback(() => {
    if (nextRoundTimer.current) { clearTimeout(nextRoundTimer.current); nextRoundTimer.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const startNextRound = useCallback(async () => {
    clearTimers();
    isDealing.current = false;
    resultHandled.current = null;
    setNextRoundIn(null);
    setGame(null);
    try { await createDragonTigerRound(); }
    catch (e: any) { showToast('Failed to start next round', 'error'); }
  }, [clearTimers, showToast]);

  const scheduleNextRound = useCallback((roundId: string) => {
    if (resultHandled.current === roundId) return;
    resultHandled.current = roundId;
    clearTimers();
    let secs = Math.ceil(NEXT_ROUND_DELAY / 1000);
    setNextRoundIn(secs);
    countdownRef.current = setInterval(() => {
      secs -= 1;
      setNextRoundIn(secs > 0 ? secs : null);
      if (secs <= 0) { clearInterval(countdownRef.current!); countdownRef.current = null; }
    }, 1000);
    nextRoundTimer.current = setTimeout(startNextRound, NEXT_ROUND_DELAY);
  }, [clearTimers, startNextRound]);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeLatestDragonTiger(async (id, data) => {
      if (id !== currentGameId.current) {
        currentGameId.current = id;
        setGameId(id);
        isDealing.current = false;
        clearTimers();
        setNextRoundIn(null);
      }
      setGame(data);
      setLoading(false);
      if (data.status === 'result' && data.winner) {
        setHistory(prev => {
          if (prev.find(h => h.roundNumber === data.roundNumber)) return prev;
          return [{ winner: data.winner!, roundNumber: data.roundNumber }, ...prev.slice(0, 19)];
        });
        scheduleNextRound(String(data.roundNumber));
      }
    });

    const initTimer = setTimeout(async () => {
      if (!currentGameId.current) {
        try { await createDragonTigerRound(); } catch (e) {}
      }
    }, 2000);

    return () => { unsub(); clearTimers(); clearTimeout(initTimer); };
  }, []);

  const handleTimerExpire = useCallback(async () => {
    if (!gameId || isDealing.current) return;
    isDealing.current = true;
    try {
      await dealDragonTiger(gameId);
    } catch (e: any) {
      if (e.message !== 'Already dealing') showToast(e.message || 'Deal failed', 'error');
      isDealing.current = false;
    }
  }, [gameId, showToast]);

  const handleBet = async (side: 'dragon' | 'tiger' | 'tie') => {
    if (!user || !gameId) return;
    if (!wallet) { showToast('Wallet not loaded', 'error'); return; }
    if (game?.status !== 'betting') { showToast('Betting is closed', 'error'); return; }
    const myBet = game?.bets?.find(b => b.uid === user.uid);
    if (myBet) { showToast('Already placed bet', 'error'); return; }
    const usable = calculateUsableBalance(wallet);
    if (usable < betAmount) { showToast('Insufficient balance', 'error'); return; }
    setPlacing(true);
    try {
      await placeDragonTigerBet(gameId, user.uid, user.name || 'Player', betAmount, side);
      const emoji = side === 'dragon' ? '🐉' : side === 'tiger' ? '🐯' : '🤝';
      showToast(`${emoji} ₹${betAmount} on ${side.toUpperCase()}`, 'success');
    } catch (e: any) {
      showToast(e.message || 'Bet failed', 'error');
    } finally {
      setPlacing(false);
    }
  };

  const myBet = game?.bets?.find(b => b.uid === user?.uid);
  const usable = wallet ? calculateUsableBalance(wallet) : 0;

  const getTimerDate = (val: any): Date => {
    if (!val) return new Date(Date.now() + 20000);
    if (val instanceof Date) return val;
    if (val?.toDate) return val.toDate();
    if (val?.seconds) return new Date(val.seconds * 1000);
    return new Date(val);
  };

  const dragonTotal = game?.bets?.filter(b => b.side === 'dragon').reduce((s, b) => s + b.amount, 0) || 0;
  const tigerTotal = game?.bets?.filter(b => b.side === 'tiger').reduce((s, b) => s + b.amount, 0) || 0;
  const tieTotal = game?.bets?.filter(b => b.side === 'tie').reduce((s, b) => s + b.amount, 0) || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading Dragon Tiger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50
          flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl border text-sm font-medium
          max-w-[90vw] whitespace-nowrap
          ${toast.type === 'success'
            ? 'bg-emerald-900/95 border-emerald-500/50 text-emerald-300'
            : 'bg-red-900/95 border-red-500/50 text-red-300'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span className="truncate">{toast.msg}</span>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-3 py-3 md:px-4 md:py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg md:text-xl font-black">🐉 Dragon Tiger</h1>
            <p className="text-gray-500 text-xs hidden sm:block">Higher card wins • Tie pays 8×</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-1.5">
              <p className="text-gray-500 text-xs">Balance</p>
              <p className="text-yellow-400 font-bold text-sm">{formatCurrency(usable)}</p>
            </div>
            {game && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-1.5">
                <p className="text-gray-500 text-xs">Round</p>
                <p className="text-white font-bold text-sm">#{game.roundNumber.toString().slice(-4)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          {/* GAME BOARD */}
          <div className="flex-1 space-y-3">

            {/* Status Bar */}
            <div className="bg-gray-900 border border-gray-700/50 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0
                  ${game?.status === 'betting' ? 'bg-emerald-400 animate-pulse' :
                    game?.status === 'dealing' ? 'bg-amber-400 animate-pulse' : 'bg-blue-400'}`} />
                <span className="font-semibold text-xs md:text-sm">
                  {game?.status === 'betting' && <span className="text-emerald-400">🎲 Betting Open</span>}
                  {game?.status === 'dealing' && <span className="text-amber-400">🃏 Revealing Cards...</span>}
                  {game?.status === 'result' && (
                    <span className={game.winner === 'dragon' ? 'text-amber-400' : game.winner === 'tiger' ? 'text-orange-400' : 'text-purple-400'}>
                      🏆 {game.winner === 'tie' ? 'TIE GAME!' : `${game.winner?.toUpperCase()} Wins!`}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {game?.status === 'betting' && game?.bettingEndsAt && (
                  <GameTimer endsAt={getTimerDate(game.bettingEndsAt)} onExpire={handleTimerExpire} />
                )}
                {game?.status === 'result' && nextRoundIn !== null && (
                  <div className="flex items-center gap-1.5 bg-gray-800 rounded-lg px-2.5 py-1.5">
                    <RefreshCw className="w-3 h-3 text-yellow-400 animate-spin" />
                    <span className="text-xs text-gray-400">
                      Next <span className="text-yellow-400 font-bold">{nextRoundIn}s</span>
                    </span>
                  </div>
                )}
                {game?.status === 'dealing' && (
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                )}
              </div>
            </div>

            {/* Main Table */}
            <div className="bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900
              border border-gray-700/40 rounded-2xl p-3 md:p-5 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.02]"
                style={{ backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`, backgroundSize: '20px 20px' }} />

              {/* VS Badge */}
              <div className="flex justify-center mb-4">
                <div className="bg-gray-800 border border-gray-700 rounded-full px-4 py-1">
                  <span className="text-gray-400 text-xs font-black tracking-widest">VS</span>
                </div>
              </div>

              {/* Dragon vs Tiger */}
              <div className="grid grid-cols-2 gap-3 md:gap-5">
                {/* Dragon */}
                <div className={`rounded-2xl p-3 md:p-4 border-2 text-center transition-all duration-500
                  ${game?.winner === 'dragon'
                    ? 'border-yellow-400 bg-yellow-400/10 shadow-xl shadow-yellow-400/20'
                    : myBet?.side === 'dragon'
                    ? 'border-amber-500/60 bg-amber-900/15'
                    : 'border-amber-900/25 bg-black/15'}`}>
                  <div className="text-3xl md:text-4xl mb-2">🐉</div>
                  <h3 className={`font-black text-base md:text-lg mb-3 ${game?.winner === 'dragon' ? 'text-yellow-400' : 'text-amber-400'}`}>
                    DRAGON
                  </h3>
                  <div className="flex justify-center mb-2">
                    {game?.dragonCard ? (
                      <div className="relative">
                        {game.winner === 'dragon' && (
                          <div className="absolute -inset-2 bg-yellow-400/25 rounded-xl blur-lg animate-pulse" />
                        )}
                        <CardDisplay card={game.dragonCard} size="md" animate />
                      </div>
                    ) : (
                      <div className={`w-14 h-20 md:w-16 md:h-24 rounded-xl border-2 border-dashed
                        flex items-center justify-center transition-all
                        ${game?.status === 'dealing' ? 'border-amber-500/40 bg-amber-500/5 animate-pulse' : 'border-gray-700'}`}>
                        <span className="text-3xl text-gray-700">?</span>
                      </div>
                    )}
                  </div>
                  {game?.winner === 'dragon' && <p className="text-yellow-400 text-xs font-bold">🏆 WINNER</p>}
                  {myBet?.side === 'dragon' && (
                    <p className="text-amber-400 text-xs mt-1">Your Bet: {formatCurrency(myBet.amount)}</p>
                  )}
                </div>

                {/* Tiger */}
                <div className={`rounded-2xl p-3 md:p-4 border-2 text-center transition-all duration-500
                  ${game?.winner === 'tiger'
                    ? 'border-yellow-400 bg-yellow-400/10 shadow-xl shadow-yellow-400/20'
                    : myBet?.side === 'tiger'
                    ? 'border-orange-500/60 bg-orange-900/15'
                    : 'border-orange-900/25 bg-black/15'}`}>
                  <div className="text-3xl md:text-4xl mb-2">🐯</div>
                  <h3 className={`font-black text-base md:text-lg mb-3 ${game?.winner === 'tiger' ? 'text-yellow-400' : 'text-orange-400'}`}>
                    TIGER
                  </h3>
                  <div className="flex justify-center mb-2">
                    {game?.tigerCard ? (
                      <div className="relative">
                        {game.winner === 'tiger' && (
                          <div className="absolute -inset-2 bg-yellow-400/25 rounded-xl blur-lg animate-pulse" />
                        )}
                        <CardDisplay card={game.tigerCard} size="md" animate />
                      </div>
                    ) : (
                      <div className={`w-14 h-20 md:w-16 md:h-24 rounded-xl border-2 border-dashed
                        flex items-center justify-center transition-all
                        ${game?.status === 'dealing' ? 'border-orange-500/40 bg-orange-500/5 animate-pulse' : 'border-gray-700'}`}>
                        <span className="text-3xl text-gray-700">?</span>
                      </div>
                    )}
                  </div>
                  {game?.winner === 'tiger' && <p className="text-yellow-400 text-xs font-bold">🏆 WINNER</p>}
                  {myBet?.side === 'tiger' && (
                    <p className="text-orange-400 text-xs mt-1">Your Bet: {formatCurrency(myBet.amount)}</p>
                  )}
                </div>
              </div>

              {/* Tie result */}
              {game?.status === 'result' && game.winner === 'tie' && (
                <div className="mt-3 text-center bg-purple-900/20 border border-purple-500/30 rounded-xl p-3">
                  <p className="text-2xl mb-1">🤝</p>
                  <p className="text-purple-400 font-black text-lg">TIE GAME!</p>
                  <p className="text-purple-300 text-xs">Tie bets pay 8× • Others get 50% back</p>
                </div>
              )}

              {/* Pot */}
              {(game?.pot || 0) > 0 && (
                <div className="mt-3 text-center">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Pot • </span>
                  <span className="text-yellow-400 font-black text-base">{formatCurrency(game?.pot || 0)}</span>
                </div>
              )}
            </div>

            {/* Result Banner */}
            {game?.status === 'result' && myBet && (
              <div className={`rounded-xl p-4 border-2 text-center
                ${myBet.side === game.winner
                  ? 'bg-emerald-900/40 border-emerald-500/50'
                  : game.winner === 'tie' && myBet.side !== 'tie'
                  ? 'bg-amber-900/40 border-amber-500/50'
                  : 'bg-red-900/40 border-red-500/50'}`}>
                {myBet.side === game.winner ? (
                  <>
                    <p className="text-2xl mb-1">🎉</p>
                    <p className="text-emerald-400 font-black text-lg">You Won!</p>
                    <p className="text-emerald-300 font-bold">
                      +{formatCurrency(myBet.side === 'tie' ? myBet.amount * 8 : Math.floor(myBet.amount * 1.95))}
                    </p>
                  </>
                ) : game.winner === 'tie' && myBet.side !== 'tie' ? (
                  <>
                    <p className="text-2xl mb-1">🤝</p>
                    <p className="text-amber-400 font-black">Tie — 50% Returned</p>
                    <p className="text-amber-300 font-bold">+{formatCurrency(Math.floor(myBet.amount * 0.5))}</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl mb-1">😔</p>
                    <p className="text-red-400 font-black text-lg">Better Luck Next Time</p>
                    <p className="text-red-300 font-bold">-{formatCurrency(myBet.amount)}</p>
                  </>
                )}
              </div>
            )}

            {/* Bet Panel */}
            {game?.status === 'betting' && (
              <div className="bg-gray-900 border border-gray-700/50 rounded-xl p-3 md:p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-white flex items-center gap-2 text-sm md:text-base">
                    <Coins className="w-4 h-4 text-yellow-400" />
                    Place Your Bet
                  </h3>
                  {myBet && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-3 py-1">
                      ✓ Bet Placed
                    </span>
                  )}
                </div>

                {myBet ? (
                  <div className="text-center py-3">
                    <p className="text-gray-400 text-xs mb-2">Betting on:</p>
                    <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-600 font-black text-base">
                      <span>{myBet.side === 'dragon' ? '🐉' : myBet.side === 'tiger' ? '🐯' : '🤝'}</span>
                      <span>{myBet.side.toUpperCase()}</span>
                      <span className="text-yellow-400">{formatCurrency(myBet.amount)}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-3">
                      <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider">Select Amount</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {BET_CHIPS.map(chip => (
                          <button key={chip} onClick={() => setBetAmount(chip)}
                            className={`flex-1 min-w-[50px] py-2 rounded-lg text-xs font-bold transition-all border
                              ${betAmount === chip
                                ? 'bg-yellow-500 border-yellow-400 text-gray-900 scale-105'
                                : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}>
                            ₹{chip >= 1000 ? `${chip / 1000}K` : chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {/* Dragon */}
                      <button onClick={() => handleBet('dragon')} disabled={placing || !user}
                        className="bg-gradient-to-b from-amber-700 to-amber-900 border border-amber-600/40
                          text-white font-black py-4 rounded-xl disabled:opacity-40 transition-all
                          active:scale-95 hover:from-amber-600 hover:to-amber-800
                          flex flex-col items-center gap-1">
                        <span className="text-2xl">🐉</span>
                        <span className="text-xs">Dragon</span>
                        <span className="text-amber-300 text-xs">1.95×</span>
                      </button>
                      {/* Tie */}
                      <button onClick={() => handleBet('tie')} disabled={placing || !user}
                        className="bg-gradient-to-b from-purple-700 to-purple-900 border border-purple-600/40
                          text-white font-black py-4 rounded-xl disabled:opacity-40 transition-all
                          active:scale-95 hover:from-purple-600 hover:to-purple-800
                          flex flex-col items-center gap-1">
                        <span className="text-2xl">🤝</span>
                        <span className="text-xs">Tie</span>
                        <span className="text-purple-300 text-xs">8×</span>
                      </button>
                      {/* Tiger */}
                      <button onClick={() => handleBet('tiger')} disabled={placing || !user}
                        className="bg-gradient-to-b from-orange-700 to-orange-900 border border-orange-600/40
                          text-white font-black py-4 rounded-xl disabled:opacity-40 transition-all
                          active:scale-95 hover:from-orange-600 hover:to-orange-800
                          flex flex-col items-center gap-1">
                        <span className="text-2xl">🐯</span>
                        <span className="text-xs">Tiger</span>
                        <span className="text-orange-300 text-xs">1.95×</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          <div className="lg:w-60 xl:w-64 flex flex-col gap-3">
            {/* Live Bets */}
            <div className="bg-gray-900 border border-gray-700/50 rounded-xl p-3">
              <h3 className="font-bold text-white flex items-center gap-2 mb-3 text-sm">
                <Users className="w-4 h-4 text-amber-400" />
                Live Bets
                <span className="ml-auto text-xs bg-gray-800 px-2 py-0.5 rounded-full text-gray-400">
                  {game?.bets?.length || 0}
                </span>
              </h3>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {[
                  { label: '🐉', key: 'dragon', total: dragonTotal, color: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-800/30' },
                  { label: '🤝', key: 'tie', total: tieTotal, color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-800/30' },
                  { label: '🐯', key: 'tiger', total: tigerTotal, color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-800/30' },
                ].map(({ label, key, total, color, bg }) => (
                  <div key={key} className={`${bg} border rounded-lg p-1.5 text-center`}>
                    <p className="text-sm">{label}</p>
                    <p className={`text-xs font-black ${color}`}>₹{total}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {!game?.bets?.length ? (
                  <div className="text-center py-3 text-gray-600 text-xs">No bets yet</div>
                ) : (
                  game.bets.map((bet: DTBet, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-2.5 py-1.5 text-xs">
                      <span className="text-gray-300 truncate max-w-[65px]">{bet.name}</span>
                      <div className="flex items-center gap-1">
                        <span>{bet.side === 'dragon' ? '🐉' : bet.side === 'tiger' ? '🐯' : '🤝'}</span>
                        <span className="text-yellow-400 font-bold">₹{bet.amount}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* History */}
            <div className="bg-gray-900 border border-gray-700/50 rounded-xl p-3">
              <h3 className="font-bold text-white flex items-center gap-2 mb-3 text-sm">
                <History className="w-4 h-4 text-yellow-400" />
                History
              </h3>
              {!history.length ? (
                <div className="text-center py-3 text-gray-600 text-xs">No rounds yet</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {history.map((h, i) => (
                    <span key={i} className={`text-base w-8 h-8 flex items-center justify-center rounded-full border
                      ${h.winner === 'dragon' ? 'bg-amber-500/10 border-amber-500/25' :
                        h.winner === 'tiger' ? 'bg-orange-500/10 border-orange-500/25' :
                        'bg-purple-500/10 border-purple-500/25'}`}>
                      {h.winner === 'dragon' ? '🐉' : h.winner === 'tiger' ? '🐯' : '🤝'}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Payout */}
            <div className="bg-gray-900 border border-gray-700/50 rounded-xl p-3">
              <h3 className="font-bold text-white text-sm mb-2">Payouts</h3>
              <div className="space-y-2 text-xs">
                {[
                  { label: '🐉 Dragon', payout: '1.95×', color: 'text-amber-400' },
                  { label: '🐯 Tiger', payout: '1.95×', color: 'text-orange-400' },
                  { label: '🤝 Tie', payout: '8×', color: 'text-purple-400' },
                ].map(({ label, payout, color }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className={color}>{label}</span>
                    <span className="text-emerald-400 font-black">{payout}</span>
                  </div>
                ))}
                <div className="border-t border-gray-800 pt-2 text-gray-600">
                  Tie: Non-tie bets get 50% back
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DragonTigerPage;
