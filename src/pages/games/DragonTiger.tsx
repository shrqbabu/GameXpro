
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  createDragonTigerRound,
  getActiveDragonTigerGame,
  subscribeDragonTiger,
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
  CheckCircle, Coins, Flame,
} from 'lucide-react';

const BET_CHIPS = [10, 50, 100, 500, 1000];
const NEXT_ROUND_DELAY = 6000;

interface HistEntry {
  winner: 'dragon' | 'tiger' | 'tie';
}

const DragonTigerPage: React.FC = () => {
  const { user, wallet } = useAuth();

  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState<DragonTigerGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [betAmount, setBetAmount] = useState(50);
  const [placing, setPlacing] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [history, setHistory] = useState<HistEntry[]>([]);
  const [nextRoundSecs, setNextRoundSecs] = useState<number | null>(null);

  const isDealing = useRef(false);
  const nextRoundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const initGame = useCallback(async () => {
    setLoading(true);
    try {
      let id = await getActiveDragonTigerGame();
      if (!id) id = await createDragonTigerRound();
      setGameId(id);
    } catch (e: any) {
      showToast(e.message || 'Failed to load', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initGame();
    return () => {
      if (nextRoundTimer.current) clearTimeout(nextRoundTimer.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [initGame]);

  useEffect(() => {
    if (!gameId) return;
    const unsub = subscribeDragonTiger(gameId, (data) => {
      setGame(data);

      if (data.status === 'result' && !isDealing.current) {
        if (data.winner) {
          setHistory((prev) => [{ winner: data.winner! }, ...prev.slice(0, 19)]);
        }

        let secs = Math.ceil(NEXT_ROUND_DELAY / 1000);
        setNextRoundSecs(secs);
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          secs--;
          setNextRoundSecs(secs > 0 ? secs : null);
          if (secs <= 0) clearInterval(countdownRef.current!);
        }, 1000);

        if (nextRoundTimer.current) clearTimeout(nextRoundTimer.current);
        nextRoundTimer.current = setTimeout(async () => {
          isDealing.current = false;
          const newId = await createDragonTigerRound();
          setGameId(newId);
          setGame(null);
        }, NEXT_ROUND_DELAY);
      }
    });
    return () => unsub();
  }, [gameId]);

  const handleTimerExpire = useCallback(async () => {
    if (!gameId || isDealing.current) return;
    isDealing.current = true;
    setDealing(true);
    try {
      await dealDragonTiger(gameId);
    } catch (e: any) {
      showToast(e.message || 'Deal failed', 'error');
      isDealing.current = false;
    } finally {
      setDealing(false);
    }
  }, [gameId]);

  const handleBet = async (side: 'dragon' | 'tiger' | 'tie') => {
    if (!user || !gameId) return;
    if (!wallet) { showToast('Wallet not loaded', 'error'); return; }
    if (game?.status !== 'betting') { showToast('Betting is closed', 'error'); return; }

    const myBet = game?.bets?.find((b) => b.uid === user.uid);
    if (myBet) { showToast('Already placed bet', 'error'); return; }

    const usable = calculateUsableBalance(wallet);
    if (usable < betAmount) { showToast('Insufficient balance', 'error'); return; }

    setPlacing(true);
    try {
      await placeDragonTigerBet(
        gameId, user.uid, user.name || 'Player', betAmount, side
      );
      const emoji = side === 'dragon' ? '🐉' : side === 'tiger' ? '🐯' : '🤝';
      showToast(`${emoji} ₹${betAmount} on ${side.toUpperCase()}`, 'success');
    } catch (e: any) {
      showToast(e.message || 'Bet failed', 'error');
    } finally {
      setPlacing(false);
    }
  };

  const myBet = game?.bets?.find((b) => b.uid === user?.uid);
  const usable = wallet ? calculateUsableBalance(wallet) : 0;

  const getWinAmount = (side: 'dragon' | 'tiger' | 'tie', amount: number) => {
    if (side === 'tie') return amount * 8;
    return Math.floor(amount * 1.95);
  };

  const getResultInfo = () => {
    if (!game?.winner || !myBet) return null;
    if (myBet.side === game.winner) {
      return {
        won: true,
        amount: getWinAmount(myBet.side, myBet.amount),
      };
    }
    if (game.winner === 'tie' && myBet.side !== 'tie') {
      return { won: false, amount: -Math.floor(myBet.amount * 0.5), partial: true };
    }
    return { won: false, amount: -myBet.amount };
  };

  const result = getResultInfo();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent
            rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading Dragon Tiger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50
          flex items-center gap-2 px-5 py-3 rounded-2xl shadow-2xl border text-sm font-medium
          ${toast.type === 'success'
            ? 'bg-emerald-900/95 border-emerald-500/50 text-emerald-300'
            : 'bg-red-900/95 border-red-500/50 text-red-300'}`}>
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4" />
            : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2">
              🐉 Dragon Tiger
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Higher card wins • Tie pays 8x
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2">
            <p className="text-gray-500 text-xs">Balance</p>
            <p className="text-yellow-400 font-bold">{formatCurrency(usable)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* LEFT: Game Board */}
          <div className="lg:col-span-2 space-y-4">

            {/* Status Bar */}
            <div className="bg-gray-900 border border-gray-700/50 rounded-2xl p-4
              flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Flame className={`w-5 h-5
                  ${game?.status === 'betting' ? 'text-orange-400 animate-pulse' :
                    game?.status === 'result' ? 'text-yellow-400' : 'text-gray-400'}`} />
                <span className="font-semibold text-sm">
                  {game?.status === 'betting' && '🎲 Place your bets!'}
                  {game?.status === 'dealing' && '🃏 Revealing cards...'}
                  {game?.status === 'result' && (
                    <span className={
                      game.winner === 'dragon' ? 'text-red-400' :
                      game.winner === 'tiger' ? 'text-orange-400' : 'text-yellow-400'
                    }>
                      🏆 {game.winner === 'tie' ? 'TIE GAME!' : `${game.winner?.toUpperCase()} Wins!`}
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-gray-600 text-xs">Pot</p>
                  <p className="text-yellow-400 font-bold text-sm">
                    {formatCurrency(game?.pot || 0)}
                  </p>
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

                {game?.status === 'result' && nextRoundSecs !== null && (
                  <div className="text-sm text-gray-400">
                    Next in <span className="text-yellow-400 font-bold">{nextRoundSecs}s</span>
                  </div>
                )}

                {game?.status === 'dealing' && (
                  <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                )}
              </div>
            </div>

            {/* MAIN TABLE */}
            <div className="bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900
              border border-gray-700/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden">

              {/* Table pattern */}
              <div className="absolute inset-0 opacity-3"
                style={{
                  backgroundImage: `repeating-linear-gradient(45deg,
                    transparent, transparent 35px, rgba(255,255,255,.03) 35px,
                    rgba(255,255,255,.03) 70px)`,
                }} />

              <div className="grid grid-cols-3 gap-4 items-center relative">
                {/* Dragon */}
                <div className={`rounded-2xl p-5 border-2 text-center transition-all duration-500
                  ${game?.winner === 'dragon'
                    ? 'border-yellow-400 bg-yellow-400/10 shadow-xl shadow-yellow-400/20'
                    : myBet?.side === 'dragon'
                    ? 'border-red-500 bg-red-500/10'
                    : 'border-gray-700 bg-gray-800/30'}`}>
                  <div className="text-5xl mb-3 leading-none">🐉</div>
                  <h3 className={`font-black text-xl mb-3
                    ${game?.winner === 'dragon' ? 'text-yellow-400' : 'text-red-400'}`}>
                    DRAGON
                  </h3>

                  <div className="flex justify-center mb-3">
                    {game?.dragonCard ? (
                      <div className="relative">
                        {game.winner === 'dragon' && (
                          <div className="absolute -inset-2 bg-yellow-400/30
                            rounded-xl blur-lg animate-pulse" />
                        )}
                        <CardDisplay card={game.dragonCard} size="lg" animate />
                      </div>
                    ) : (
                      <div className={`w-20 h-28 rounded-xl border-2 border-dashed
                        flex items-center justify-center transition-all
                        ${game?.status === 'dealing'
                          ? 'border-red-500/40 bg-red-500/5 animate-pulse'
                          : 'border-gray-700'}`}>
                        <span className="text-4xl text-gray-700">?</span>
                      </div>
                    )}
                  </div>

                  {game?.winner === 'dragon' && (
                    <div className="text-yellow-400 text-xs font-bold">🏆 WINNER</div>
                  )}
                  {myBet?.side === 'dragon' && (
                    <div className="text-red-400 text-xs mt-1">
                      Your bet: {formatCurrency(myBet.amount)}
                    </div>
                  )}
                </div>

                {/* Center */}
                <div className="text-center">
                  {game?.status === 'result' && game?.winner === 'tie' ? (
                    <div>
                      <div className="text-5xl mb-2">🤝</div>
                      <div className="text-yellow-400 font-black text-2xl">TIE</div>
                      <div className="text-yellow-300 text-sm">8× Payout</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-gray-700 font-black text-3xl mb-2">VS</div>
                      {game?.dragonCard && game?.tigerCard && (
                        <div className="space-y-1 text-xs text-gray-600">
                          <div>🐉 {game.dragonCard.value}</div>
                          <div>🐯 {game.tigerCard.value}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tiger */}
                <div className={`rounded-2xl p-5 border-2 text-center transition-all duration-500
                  ${game?.winner === 'tiger'
                    ? 'border-yellow-400 bg-yellow-400/10 shadow-xl shadow-yellow-400/20'
                    : myBet?.side === 'tiger'
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-gray-700 bg-gray-800/30'}`}>
                  <div className="text-5xl mb-3 leading-none">🐯</div>
                  <h3 className={`font-black text-xl mb-3
                    ${game?.winner === 'tiger' ? 'text-yellow-400' : 'text-orange-400'}`}>
                    TIGER
                  </h3>

                  <div className="flex justify-center mb-3">
                    {game?.tigerCard ? (
                      <div className="relative">
                        {game.winner === 'tiger' && (
                          <div className="absolute -inset-2 bg-yellow-400/30
                            rounded-xl blur-lg animate-pulse" />
                        )}
                        <CardDisplay card={game.tigerCard} size="lg" animate />
                      </div>
                    ) : (
                      <div className={`w-20 h-28 rounded-xl border-2 border-dashed
                        flex items-center justify-center transition-all
                        ${game?.status === 'dealing'
                          ? 'border-orange-500/40 bg-orange-500/5 animate-pulse'
                          : 'border-gray-700'}`}>
                        <span className="text-4xl text-gray-700">?</span>
                      </div>
                    )}
                  </div>

                  {game?.winner === 'tiger' && (
                    <div className="text-yellow-400 text-xs font-bold">🏆 WINNER</div>
                  )}
                  {myBet?.side === 'tiger' && (
                    <div className="text-orange-400 text-xs mt-1">
                      Your bet: {formatCurrency(myBet.amount)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Result Banner */}
            {game?.status === 'result' && myBet && result && (
              <div className={`rounded-2xl p-5 border-2 text-center
                ${result.won
                  ? 'bg-emerald-900/40 border-emerald-500/50 shadow-lg shadow-emerald-500/20'
                  : result.partial
                  ? 'bg-amber-900/40 border-amber-500/50'
                  : 'bg-red-900/40 border-red-500/50'}`}>
                {result.won ? (
                  <>
                    <p className="text-4xl mb-2">🎉</p>
                    <p className="text-emerald-400 font-black text-2xl">You Won!</p>
                    <p className="text-emerald-300 text-lg mt-1">
                      +{formatCurrency(result.amount)}
                    </p>
                  </>
                ) : result.partial ? (
                  <>
                    <p className="text-4xl mb-2">🤝</p>
                    <p className="text-amber-400 font-black text-xl">It's a Tie!</p>
                    <p className="text-amber-300 mt-1">
                      Returned: {formatCurrency(Math.floor(myBet.amount * 0.5))}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-4xl mb-2">😔</p>
                    <p className="text-red-400 font-black text-2xl">Better Luck Next Time</p>
                    <p className="text-red-300 mt-1">-{formatCurrency(myBet.amount)}</p>
                  </>
                )}
              </div>
            )}

            {/* Bet Panel */}
            {game?.status === 'betting' && (
              <div className="bg-gray-900 border border-gray-700/50 rounded-2xl p-5">
                <h3 className="font-bold flex items-center gap-2 mb-4">
                  <Coins className="w-4 h-4 text-yellow-400" />
                  Place Your Bet
                </h3>

                {myBet ? (
                  <div className="text-center py-5">
                    <p className="text-gray-400 text-sm mb-3">You bet on:</p>
                    <div className="inline-flex items-center gap-3 px-6 py-3
                      rounded-2xl bg-gray-800 border border-gray-600 font-black text-xl">
                      <span>
                        {myBet.side === 'dragon' ? '🐉' : myBet.side === 'tiger' ? '🐯' : '🤝'}
                      </span>
                      <span>{myBet.side.toUpperCase()}</span>
                      <span className="text-yellow-400">{formatCurrency(myBet.amount)}</span>
                    </div>
                    <p className="text-gray-600 text-xs mt-2">
                      Potential win: {formatCurrency(getWinAmount(myBet.side, myBet.amount))}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Chip Selector */}
                    <div className="mb-5">
                      <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider">
                        Select chip
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {BET_CHIPS.map((chip) => (
                          <button
                            key={chip}
                            onClick={() => setBetAmount(chip)}
                            className={`flex-1 min-w-[55px] py-2.5 rounded-xl
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
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => handleBet('dragon')}
                        disabled={placing || !user}
                        className="bg-gradient-to-b from-red-700 to-red-900
                          border border-red-600/40 text-white font-black py-5
                          rounded-2xl hover:from-red-600 hover:to-red-800
                          disabled:opacity-40 transition-all active:scale-95
                          flex flex-col items-center gap-1
                          hover:shadow-lg hover:shadow-red-500/30">
                        <span className="text-3xl">🐉</span>
                        <span className="text-sm">Dragon</span>
                        <span className="text-red-300 text-xs">1.95×</span>
                        <span className="text-yellow-300 text-xs font-normal">
                          +{formatCurrency(Math.floor(betAmount * 1.95))}
                        </span>
                      </button>

                      <button
                        onClick={() => handleBet('tie')}
                        disabled={placing || !user}
                        className="bg-gradient-to-b from-yellow-600 to-yellow-800
                          border border-yellow-500/40 text-gray-900 font-black py-5
                          rounded-2xl hover:from-yellow-500 hover:to-yellow-700
                          disabled:opacity-40 transition-all active:scale-95
                          flex flex-col items-center gap-1
                          hover:shadow-lg hover:shadow-yellow-500/30">
                        <span className="text-3xl">🤝</span>
                        <span className="text-sm">Tie</span>
                        <span className="text-yellow-900 text-xs">8×</span>
                        <span className="text-yellow-900 text-xs font-normal">
                          +{formatCurrency(betAmount * 8)}
                        </span>
                      </button>

                      <button
                        onClick={() => handleBet('tiger')}
                        disabled={placing || !user}
                        className="bg-gradient-to-b from-orange-700 to-orange-900
                          border border-orange-600/40 text-white font-black py-5
                          rounded-2xl hover:from-orange-600 hover:to-orange-800
                          disabled:opacity-40 transition-all active:scale-95
                          flex flex-col items-center gap-1
                          hover:shadow-lg hover:shadow-orange-500/30">
                        <span className="text-3xl">🐯</span>
                        <span className="text-sm">Tiger</span>
                        <span className="text-orange-300 text-xs">1.95×</span>
                        <span className="text-yellow-300 text-xs font-normal">
                          +{formatCurrency(Math.floor(betAmount * 1.95))}
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* RIGHT Sidebar */}
          <div className="space-y-4">
            {/* Live Bets */}
            <div className="bg-gray-900 border border-gray-700/50 rounded-2xl p-4">
              <h3 className="font-bold flex items-center gap-2 mb-3 text-sm">
                <Users className="w-4 h-4 text-red-400" />
                Live Bets
                <span className="ml-auto text-xs text-gray-600">
                  {game?.bets?.length || 0}
                </span>
              </h3>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {!game?.bets?.length ? (
                  <div className="text-center py-6 text-gray-700 text-sm">
                    No bets yet
                  </div>
                ) : (
                  game.bets.map((bet: DTBet, i) => (
                    <div key={i} className="flex items-center justify-between
                      bg-gray-800/60 rounded-xl px-3 py-2 text-xs">
                      <span className="text-gray-300 truncate max-w-[70px]">{bet.name}</span>
                      <span className={
                        bet.side === 'dragon' ? 'text-red-400' :
                        bet.side === 'tiger' ? 'text-orange-400' : 'text-yellow-400'}>
                        {bet.side === 'dragon' ? '🐉' : bet.side === 'tiger' ? '🐯' : '🤝'}
                      </span>
                      <span className="text-yellow-400 font-bold">₹{bet.amount}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* History */}
            <div className="bg-gray-900 border border-gray-700/50 rounded-2xl p-4">
              <h3 className="font-bold flex items-center gap-2 mb-3 text-sm">
                <History className="w-4 h-4 text-yellow-400" />
                History
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {!history.length ? (
                  <div className="text-gray-700 text-sm w-full text-center py-4">
                    No history
                  </div>
                ) : (
                  history.map((h, i) => (
                    <span key={i} className={`text-xs font-bold px-2 py-1
                      rounded-full border
                      ${h.winner === 'dragon'
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : h.winner === 'tiger'
                        ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                        : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                      {h.winner === 'dragon' ? '🐉' : h.winner === 'tiger' ? '🐯' : '🤝'}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Payouts */}
            <div className="bg-gray-900 border border-gray-700/50 rounded-2xl p-4">
              <h3 className="font-bold text-sm mb-3">Payouts</h3>
              <div className="space-y-2 text-xs">
                {[
                  { emoji: '🐉', label: 'Dragon', payout: '1.95×' },
                  { emoji: '🐯', label: 'Tiger', payout: '1.95×' },
                  { emoji: '🤝', label: 'Tie', payout: '8×' },
                ].map(({ emoji, label, payout }) => (
                  <div key={label} className="flex items-center justify-between
                    bg-gray-800/50 rounded-xl px-3 py-2">
                    <span>{emoji} {label}</span>
                    <span className="text-white font-bold">{payout}</span>
                  </div>
                ))}
                <div className="text-gray-600 text-xs pt-1 border-t border-gray-800">
                  On Tie: Non-tie bets get 50% back
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DragonTiger;
