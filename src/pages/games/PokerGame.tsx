// src/pages/games/PokerGame.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  subscribePokerTable, startPokerHand, pokerAction,
  leavePokerTable, checkAndAutoStart,
  PokerTable, PokerPlayer,
} from '../../firebase/games';
import CardDisplay from '../../components/games/CardDisplay';
import { formatCurrency } from '../../utils/helpers';
import {
  ArrowLeft, Loader2, LogOut, Minus, Plus,
} from 'lucide-react';

// ── Vertical Poker Table Seat Positions (6 max) ──────────────
// 0 = bottom (You), going clockwise
const SEAT_POS: Record<number, string> = {
  0: 'bottom-[2%] left-1/2 -translate-x-1/2',        // You (bottom center)
  1: 'top-[42%] right-[1%] -translate-y-1/2',        // right middle
  2: 'top-[14%] right-[8%]',                          // top right
  3: 'top-[2%] left-1/2 -translate-x-1/2',           // top center
  4: 'top-[14%] left-[8%]',                           // top left
  5: 'top-[42%] left-[1%] -translate-y-1/2',          // left middle
};

// ── Player Seat Component ────────────────────────────────────
const PlayerSeat: React.FC<{
  player: PokerPlayer;
  isMe: boolean;
  isActive: boolean;
  phase: string;
}> = ({ player, isMe, isActive, phase }) => {
  const isPlaying = phase !== 'waiting';
  const folded = player.status === 'folded';

  return (
    <div className={`flex flex-col items-center ${folded ? 'opacity-40' : ''}`}>
      {/* Avatar with golden ring */}
      <div className="relative">
        <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center
          text-base md:text-xl font-black border-[3px] transition-all
          ${isActive && isPlaying
            ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.7)]'
            : isMe ? 'border-purple-500' : 'border-gray-600'}
          ${isMe ? 'bg-gradient-to-br from-purple-500 to-blue-600 text-white'
            : 'bg-gradient-to-br from-gray-700 to-gray-800 text-white'}`}>
          {player.name.charAt(0).toUpperCase()}
        </div>

        {/* Dealer button */}
        {player.isDealer && (
          <span className="absolute -bottom-1 -right-1 bg-white text-gray-900
            text-[9px] md:text-xs font-black w-4 h-4 md:w-5 md:h-5 rounded-full
            flex items-center justify-center shadow-md border border-gray-300">D</span>
        )}

        {/* Hole Cards (overlapping avatar top) */}
        {isPlaying && player.holeCards.length > 0 && (
          <div className="absolute -top-5 md:-top-7 left-1/2 -translate-x-1/2 flex gap-0.5">
            {(isMe || (phase === 'showdown' && !folded))
              ? player.holeCards.map((c, i) => <CardDisplay key={i} card={c} size="xs" animate />)
              : player.holeCards.map((_, i) => <CardDisplay key={i} faceDown size="xs" />)}
          </div>
        )}
      </div>

      {/* Name + Chips plate */}
      <div className={`mt-1 px-2 py-0.5 rounded-lg border text-center min-w-[64px] md:min-w-[80px]
        ${isActive && isPlaying
          ? 'bg-yellow-950/80 border-yellow-500/50'
          : 'bg-gray-900/90 border-gray-700/60'}`}>
        <p className="text-white text-[10px] md:text-xs font-bold truncate leading-tight">
          {isMe ? 'You' : player.name}
        </p>
        <p className="text-yellow-400 text-[10px] md:text-xs font-bold leading-tight">
          {formatCurrency(player.chips)}
        </p>
      </div>

      {/* Status / Bet chip */}
      <div className="h-4 mt-0.5 flex items-center justify-center">
        {player.bet > 0 && (
          <span className="bg-black/60 text-yellow-400 text-[9px] md:text-[10px]
            font-bold px-1.5 py-0.5 rounded-full border border-yellow-500/30">
            ₹{player.bet}
          </span>
        )}
        {folded && <span className="text-red-500 text-[9px] font-black">FOLD</span>}
        {player.status === 'allin' && (
          <span className="text-yellow-400 text-[9px] font-black animate-pulse">ALL IN</span>
        )}
        {phase === 'showdown' && player.handRank && !folded && (
          <span className="text-emerald-400 text-[8px] md:text-[9px] font-bold truncate max-w-[70px]">
            {player.handRank}
          </span>
        )}
      </div>
    </div>
  );
};

// ── Main Page ────────────────────────────────────────────────
const PokerGamePage: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [table, setTable] = useState<PokerTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [error, setError] = useState('');
  const [showLeave, setShowLeave] = useState(false);

  const prevCount = useRef(0);
  const autoStarted = useRef(false);

  useEffect(() => {
    if (!tableId) return;
    return subscribePokerTable(tableId, (data) => {
      setTable(data);
      setLoading(false);
    });
  }, [tableId]);

  // Auto-start when 2nd player joins
  useEffect(() => {
    if (!table || !tableId) return;
    const n = table.players.length;
    if (n >= 2 && prevCount.current < 2 && table.status === 'waiting'
      && table.phase === 'waiting' && !autoStarted.current) {
      autoStarted.current = true;
      setTimeout(async () => {
        try { await checkAndAutoStart(tableId); } catch (e) {}
        autoStarted.current = false;
      }, 2000);
    }
    if (table.status === 'waiting' && n >= 2) autoStarted.current = false;
    prevCount.current = n;
  }, [table?.players.length, table?.status]);

  // Auto next hand after showdown
  useEffect(() => {
    if (!table || !tableId) return;
    if (table.status === 'waiting' && table.phase === 'showdown' && table.players.length >= 2) {
      const t = setTimeout(async () => {
        try { await startPokerHand(tableId); } catch (e) {}
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [table?.phase, table?.status, table?.players.length]);

  // Auto leave if broke
  useEffect(() => {
    if (!table || !user) return;
    const me = table.players.find(p => p.uid === user.uid);
    if (!me && table.phase === 'showdown') {
      setTimeout(() => navigate('/games/poker'), 3000);
    }
  }, [table?.phase, table?.players]);

  const myPlayer = table?.players.find(p => p.uid === user?.uid);
  const isMyTurn = table?.activePlayerUid === user?.uid;
  const phase = table?.phase || 'waiting';
  const pot = table?.pot || 0;
  const currentBet = table?.currentBet || 0;
  const numPlayers = table?.players.length || 0;
  const canStart = numPlayers >= 2 && table?.status === 'waiting';

  const callAmount = Math.max(0, Math.min(currentBet - (myPlayer?.bet || 0), myPlayer?.chips || 0));
  const minRaise = Math.max(currentBet * 2, (table?.bigBlind || 20) * 2);
  const maxRaise = (myPlayer?.chips || 0) + (myPlayer?.bet || 0);

  useEffect(() => {
    if (minRaise > 0) setRaiseAmount(Math.min(minRaise, maxRaise));
  }, [currentBet, minRaise, maxRaise]);

  const showError = (m: string) => { setError(m); setTimeout(() => setError(''), 3000); };

  const handleAction = async (action: 'fold' | 'check' | 'call' | 'raise' | 'allin') => {
    if (!user || !tableId || actionLoading) return;
    setActionLoading(true);
    try { await pokerAction(tableId, user.uid, action, action === 'raise' ? raiseAmount : undefined); }
    catch (e: any) { showError(e.message || 'Action failed'); }
    finally { setActionLoading(false); }
  };

  const handleLeave = async () => {
    if (!user || !tableId || leaving) return;
    setLeaving(true);
    try { await leavePokerTable(tableId, user.uid); navigate('/games/poker'); }
    catch (e: any) { showError(e.message); setLeaving(false); }
  };

  const adjustRaise = (delta: number) => {
    setRaiseAmount(prev => {
      const next = prev + delta;
      return Math.max(minRaise, Math.min(next, maxRaise));
    });
  };

  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
    </div>
  );

  if (!table) return (
    <div className="h-screen bg-black flex items-center justify-center text-white">
      <div className="text-center">
        <p className="mb-4">Table not found</p>
        <button onClick={() => navigate('/games/poker')}
          className="text-yellow-400 flex items-center gap-2 mx-auto">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>
    </div>
  );

  const showActions = isMyTurn && phase !== 'waiting' && phase !== 'showdown'
    && myPlayer?.status === 'active';

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0a0e0a] text-white overflow-hidden select-none">

      {/* ══ TOP BAR ══════════════════════════════════════════ */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2.5 z-40">
        <button onClick={() => setShowLeave(true)}
          className="w-10 h-10 rounded-full border-2 border-gray-700 bg-gray-900/80
            flex items-center justify-center text-gray-300 active:scale-90 transition-transform">
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Center info pill */}
        <div className="flex items-center gap-2 bg-gray-900/80 border-2 border-yellow-700/40
          rounded-full px-4 py-1.5">
          <span className="text-yellow-500 text-[10px] font-bold uppercase tracking-wider">
            POT
          </span>
          <span className="text-yellow-400 text-sm font-black">
            {formatCurrency(pot)}
          </span>
        </div>

        <button onClick={() => setShowLeave(true)}
          className="flex items-center gap-1.5 border-2 border-red-700/50 bg-red-950/40
            rounded-xl px-3 py-2 text-red-400 text-xs font-bold active:scale-90 transition-transform">
          EXIT <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ══ TABLE AREA (Vertical Oval) ══════════════════════ */}
      <div className="flex-1 relative flex items-center justify-center px-2 overflow-hidden">

        {/* Waiting overlay */}
        {phase === 'waiting' && numPlayers < 2 && (
          <div className="absolute inset-0 flex items-center justify-center z-30">
            <div className="text-center bg-gray-900/95 border border-gray-700 rounded-2xl p-6 mx-4">
              <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mx-auto mb-3" />
              <p className="text-white font-bold text-sm">Waiting for players...</p>
              <p className="text-gray-400 text-xs mt-1">{numPlayers}/2 joined</p>
              <p className="text-yellow-400 text-xs mt-2 font-semibold">
                Auto-starts when 2 players join!
              </p>
            </div>
          </div>
        )}

        {/* Vertical Oval Table */}
        <div className="relative w-full max-w-[440px] mx-auto"
          style={{ height: 'min(75vh, 620px)', aspectRatio: '0.62' }}>

          {/* Outer wooden rim */}
          <div className="absolute inset-0 rounded-[50%]
            bg-gradient-to-b from-[#8B5A2B] via-[#6B4423] to-[#3D2817]
            shadow-[0_10px_40px_rgba(0,0,0,0.8)]" />

          {/* Inner felt */}
          <div className="absolute inset-[12px] md:inset-[16px] rounded-[50%]
            bg-gradient-to-b from-[#1a7a4a] via-[#0f6638] to-[#0a4528]
            shadow-[inset_0_0_60px_rgba(0,0,0,0.6)]">

            {/* Spade watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.07]">
              <span className="text-white text-[140px] md:text-[200px] leading-none">♠</span>
            </div>

            {/* Center: Community cards + Pot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
              flex flex-col items-center gap-2 w-full px-4">

              {/* POT */}
              {pot > 0 && (
                <div className="bg-black/50 border border-yellow-500/30 rounded-full
                  px-4 py-1 mb-1">
                  <span className="text-yellow-500 text-[9px] font-bold uppercase tracking-wider">Pot </span>
                  <span className="text-yellow-400 text-xs md:text-sm font-black">
                    {formatCurrency(pot)}
                  </span>
                </div>
              )}

              {/* Community Cards */}
              {phase !== 'waiting' && (
                <div className="flex gap-1 md:gap-1.5 justify-center">
                  {[...Array(5)].map((_, i) => (
                    table.communityCards[i]
                      ? <CardDisplay key={i} card={table.communityCards[i]} size="sm" animate />
                      : <div key={i} className="w-8 h-11 md:w-10 md:h-14 rounded-lg
                          border border-white/10 bg-black/20" />
                  ))}
                </div>
              )}

              {/* Current bet */}
              {currentBet > 0 && phase !== 'waiting' && (
                <div className="bg-black/40 rounded-lg px-2 py-0.5 mt-1">
                  <span className="text-white/50 text-[9px]">
                    Bet: <span className="text-white font-bold">{formatCurrency(currentBet)}</span>
                  </span>
                </div>
              )}

              {phase === 'showdown' && (
                <p className="text-yellow-400 font-black text-sm mt-1">🏆 Showdown!</p>
              )}
            </div>

            {/* Player Seats */}
            {table.players.map(player => (
              <div key={player.uid}
                className={`absolute z-20 ${SEAT_POS[player.seatIndex] || SEAT_POS[0]}`}>
                <PlayerSeat
                  player={player}
                  isMe={player.uid === user?.uid}
                  isActive={table.activePlayerUid === player.uid}
                  phase={phase}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ ERROR TOAST ══ */}
      {error && (
        <div className="absolute bottom-44 left-1/2 -translate-x-1/2 z-50
          bg-red-900/95 border border-red-500/50 text-red-300 text-xs font-medium
          px-4 py-2 rounded-xl whitespace-nowrap">
          {error}
        </div>
      )}

      {/* ══ BOTTOM ACTION AREA ═══════════════════════════════ */}
      <div className="shrink-0 bg-gradient-to-t from-black to-transparent pt-2 pb-3 px-2 z-40">

        {/* WAITING */}
        {phase === 'waiting' && (
          <div className="text-center py-4">
            {canStart ? (
              <button onClick={() => tableId && startPokerHand(tableId)}
                className="bg-emerald-600 text-white font-black px-8 py-3 rounded-2xl
                  active:scale-95 transition-transform">
                Start Game
              </button>
            ) : (
              <p className="text-gray-500 text-sm">Waiting for players... ({numPlayers}/2)</p>
            )}
          </div>
        )}

        {/* MY TURN — Action buttons */}
        {showActions && (
          <div className="space-y-2 max-w-md mx-auto">
            {/* Action Buttons Row */}
            <div className="grid grid-cols-4 gap-1.5">
              {/* FOLD */}
              <button onClick={() => handleAction('fold')} disabled={actionLoading}
                className="bg-gradient-to-b from-red-700 to-red-900 border-2 border-red-600/50
                  rounded-2xl py-3 text-white font-black text-sm active:scale-95
                  transition-transform disabled:opacity-40 shadow-lg">
                FOLD
              </button>

              {/* CHECK / CALL */}
              {(myPlayer?.bet || 0) >= currentBet ? (
                <button onClick={() => handleAction('check')} disabled={actionLoading}
                  className="bg-gradient-to-b from-yellow-600 to-yellow-800 border-2 border-yellow-500/50
                    rounded-2xl py-3 text-white font-black text-sm active:scale-95
                    transition-transform disabled:opacity-40 shadow-lg">
                  CHECK
                </button>
              ) : (
                <button onClick={() => handleAction('call')} disabled={actionLoading || callAmount === 0}
                  className="bg-gradient-to-b from-green-600 to-green-800 border-2 border-green-500/50
                    rounded-2xl py-2 text-white font-black active:scale-95
                    transition-transform disabled:opacity-40 shadow-lg flex flex-col leading-tight">
                  <span className="text-sm">CALL</span>
                  <span className="text-[10px] opacity-90">{formatCurrency(callAmount)}</span>
                </button>
              )}

              {/* RAISE */}
              <button onClick={() => handleAction('raise')}
                disabled={actionLoading || (myPlayer?.chips || 0) <= callAmount || raiseAmount < minRaise}
                className="bg-gradient-to-b from-purple-600 to-purple-900 border-2 border-purple-500/50
                  rounded-2xl py-2 text-white font-black active:scale-95
                  transition-transform disabled:opacity-40 shadow-lg flex flex-col leading-tight">
                <span className="text-sm">RAISE</span>
                <span className="text-[10px] opacity-90">{formatCurrency(Math.min(raiseAmount, maxRaise))}</span>
              </button>

              {/* ALL IN */}
              <button onClick={() => handleAction('allin')}
                disabled={actionLoading || (myPlayer?.chips || 0) === 0}
                className="bg-gradient-to-b from-orange-600 to-red-700 border-2 border-orange-500/50
                  rounded-2xl py-2 text-white font-black active:scale-95
                  transition-transform disabled:opacity-40 shadow-lg flex flex-col leading-tight">
                <span className="text-sm">ALL IN</span>
                <span className="text-[10px] opacity-90">{formatCurrency(myPlayer?.chips || 0)}</span>
              </button>
            </div>

            {/* Raise Controls (MIN / - / amount / + / MAX) */}
            {(myPlayer?.chips || 0) > callAmount && (
              <div className="flex items-center gap-1.5">
                <button onClick={() => setRaiseAmount(minRaise)}
                  className="bg-gray-800 border border-yellow-700/40 rounded-xl px-3 py-2.5
                    text-yellow-500 text-xs font-bold active:scale-95">
                  MIN
                </button>
                <button onClick={() => adjustRaise(-(table.bigBlind || 10))}
                  className="bg-gray-800 border border-gray-700 rounded-xl w-10 h-10
                    flex items-center justify-center text-white active:scale-95">
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex-1 bg-gray-900 border border-gray-700 rounded-xl py-2.5 text-center">
                  <span className="text-white font-black text-base">
                    {formatCurrency(Math.min(raiseAmount, maxRaise))}
                  </span>
                </div>
                <button onClick={() => adjustRaise(table.bigBlind || 10)}
                  className="bg-gray-800 border border-gray-700 rounded-xl w-10 h-10
                    flex items-center justify-center text-white active:scale-95">
                  <Plus className="w-4 h-4" />
                </button>
                <button onClick={() => setRaiseAmount(maxRaise)}
                  className="bg-gray-800 border border-yellow-700/40 rounded-xl px-3 py-2.5
                    text-yellow-500 text-xs font-bold active:scale-95">
                  MAX
                </button>
              </div>
            )}

            <p className="text-center text-emerald-400 font-bold text-sm animate-pulse">
              YOUR TURN
            </p>
          </div>
        )}

        {/* NOT MY TURN */}
        {!isMyTurn && phase !== 'waiting' && phase !== 'showdown'
          && myPlayer?.status === 'active' && (
          <p className="text-center text-gray-400 text-sm py-4">
            <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full animate-ping mr-2" />
            {table.players.find(p => p.uid === table.activePlayerUid)?.name || 'Player'}'s turn...
          </p>
        )}

        {/* FOLDED */}
        {myPlayer?.status === 'folded' && phase !== 'showdown' && (
          <p className="text-center text-red-400/70 text-sm py-4">You folded — watching...</p>
        )}

        {/* ALL IN */}
        {myPlayer?.status === 'allin' && phase !== 'showdown' && (
          <p className="text-center text-yellow-400 font-black text-sm animate-pulse py-4">
            ALL IN 🎯 — Waiting for showdown...
          </p>
        )}

        {/* SHOWDOWN */}
        {phase === 'showdown' && (
          <div className="text-center py-3 space-y-2">
            {myPlayer && myPlayer.chips <= 0 ? (
              <div className="bg-red-900/40 border border-red-500/30 rounded-xl px-4 py-3 inline-block">
                <p className="text-red-400 font-bold text-sm">💸 You're out of chips!</p>
                <p className="text-gray-400 text-xs">Returning to lobby...</p>
              </div>
            ) : (
              <p className="text-gray-400 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
                Next hand in 4s...
              </p>
            )}
          </div>
        )}
      </div>

      {/* ══ LEAVE MODAL ══ */}
      {showLeave && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-sm text-center">
            <LogOut className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h3 className="text-white font-black text-lg mb-1">Leave Table?</h3>
            <p className="text-gray-400 text-sm mb-3">Remaining chips return to your wallet.</p>
            {(myPlayer?.chips || 0) > 0 && (
              <p className="text-emerald-400 font-black text-2xl mb-5">+{formatCurrency(myPlayer!.chips)}</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowLeave(false)}
                className="flex-1 bg-gray-800 border border-gray-700 text-white font-bold py-3 rounded-2xl text-sm">
                Stay
              </button>
              <button onClick={handleLeave} disabled={leaving}
                className="flex-1 bg-red-600 text-white font-bold py-3 rounded-2xl text-sm
                  flex items-center justify-center gap-2 disabled:opacity-50">
                {leaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PokerGamePage;
