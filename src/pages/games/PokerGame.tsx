// src/pages/games/PokerGame.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  subscribePokerTable,
  startPokerHand,
  pokerAction,
  leavePokerTable,
  checkAndAutoStart,
} from '../../firebase/games';
import type { PokerTable, PokerPlayer } from '../../firebase/games';
import CardDisplay from '../../components/games/CardDisplay';
import { formatCurrency } from '../../utils/helpers';
import {
  Loader2, LogOut, AlertCircle, Trophy, Wifi, ArrowLeft,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   SEAT POSITIONS — Portrait mobile-first, like reference
   Top player, left/right players, bottom (me)
   ═══════════════════════════════════════════════════════════ */
const MOBILE_SEATS: Record<number, Record<number, string>> = {
  2: {
    0: 'bottom-[2%] left-1/2 -translate-x-1/2',
    1: 'top-[2%] left-1/2 -translate-x-1/2',
  },
  3: {
    0: 'bottom-[2%] left-1/2 -translate-x-1/2',
    1: 'top-[20%] left-[2%]',
    2: 'top-[2%] left-1/2 -translate-x-1/2',
  },
  4: {
    0: 'bottom-[2%] left-1/2 -translate-x-1/2',
    1: 'top-[45%] right-[1%] -translate-y-1/2',
    2: 'top-[2%] left-1/2 -translate-x-1/2',
    3: 'top-[45%] left-[1%] -translate-y-1/2',
  },
  5: {
    0: 'bottom-[2%] left-1/2 -translate-x-1/2',
    1: 'bottom-[25%] right-[1%]',
    2: 'top-[15%] right-[3%]',
    3: 'top-[2%] left-1/2 -translate-x-1/2',
    4: 'top-[15%] left-[3%]',
  },
  6: {
    0: 'bottom-[2%] left-1/2 -translate-x-1/2',
    1: 'bottom-[22%] right-[1%]',
    2: 'top-[18%] right-[1%]',
    3: 'top-[2%] left-1/2 -translate-x-1/2',
    4: 'top-[18%] left-[1%]',
    5: 'bottom-[22%] left-[1%]',
  },
};

function getSeatPos(seatIndex: number, total: number): string {
  const count = Math.min(Math.max(total, 2), 6);
  return MOBILE_SEATS[count]?.[seatIndex] || MOBILE_SEATS[6][seatIndex] || '';
}

/* ═══════════════════════════════════════════════════════════
   PLAYER SEAT COMPONENT — Round avatar + name card below
   ═══════════════════════════════════════════════════════════ */
const PlayerSeat: React.FC<{
  player: PokerPlayer;
  isMe: boolean;
  isActive: boolean;
  phase: string;
}> = ({ player, isMe, isActive, phase }) => {
  const playing = phase !== 'waiting';
  const folded = player.status === 'folded';
  const broke = player.chips === 0 && player.status !== 'allin';

  // Avatar colors
  const avatarColors = [
    'from-purple-500 to-blue-600',
    'from-pink-500 to-rose-600',
    'from-amber-500 to-orange-600',
    'from-emerald-500 to-teal-600',
    'from-cyan-500 to-blue-600',
    'from-violet-500 to-purple-600',
  ];
  const colorClass = isMe
    ? 'from-yellow-400 to-amber-500'
    : avatarColors[player.seatIndex % avatarColors.length];

  return (
    <div className={`flex flex-col items-center gap-1 transition-all duration-300
      ${folded || broke ? 'opacity-40 scale-95' : ''}
      ${isActive && playing ? 'scale-105' : ''}`}>

      {/* Avatar Circle */}
      <div className="relative">
        {/* Active ring */}
        {isActive && playing && (
          <div className="absolute -inset-1.5 rounded-full border-2 border-yellow-400
            animate-pulse shadow-lg shadow-yellow-400/30" />
        )}
        {/* Glow */}
        {isMe && (
          <div className="absolute -inset-1 bg-yellow-400/20 rounded-full blur-md" />
        )}
        <div className={`relative w-12 h-12 md:w-14 md:h-14 rounded-full
          bg-gradient-to-br ${colorClass}
          flex items-center justify-center text-white font-black
          text-lg md:text-xl shadow-lg border-2
          ${isActive && playing ? 'border-yellow-400' : 'border-gray-600/50'}`}>
          {player.name.charAt(0).toUpperCase()}
        </div>

        {/* Dealer badge */}
        {player.isDealer && (
          <div className="absolute -bottom-1 -left-1 w-5 h-5 bg-yellow-500
            rounded-full flex items-center justify-center text-[10px]
            font-black text-gray-900 border border-yellow-300 shadow-md">
            D
          </div>
        )}
      </div>

      {/* Hole Cards — shown between avatar and name for "me" */}
      {playing && isMe && player.holeCards.length > 0 && (
        <div className="flex gap-0.5 -mt-1">
          {player.holeCards.map((c, i) => (
            <CardDisplay key={i} card={c} size="sm" animate />
          ))}
        </div>
      )}

      {/* Opponent cards (face down or showdown) */}
      {playing && !isMe && player.holeCards.length > 0 && (
        <div className="flex gap-0.5 -mt-1">
          {phase === 'showdown' && !folded
            ? player.holeCards.map((c, i) => (
                <CardDisplay key={i} card={c} size="xs" animate />
              ))
            : player.holeCards.map((_, i) => (
                <CardDisplay key={i} faceDown size="xs" />
              ))}
        </div>
      )}

      {/* Name + Chips plate */}
      <div className={`bg-gray-900/95 backdrop-blur-sm border rounded-lg
        px-2.5 py-1 text-center min-w-[70px] shadow-lg
        ${isMe ? 'border-yellow-500/50' : 'border-gray-600/50'}`}>
        <p className="text-white text-[11px] font-bold truncate max-w-[80px]">
          {isMe ? 'You' : player.name}
        </p>
        <p className={`text-[11px] font-bold flex items-center justify-center gap-0.5
          ${broke ? 'text-red-400' : 'text-yellow-400'}`}>
          <span className="text-[9px]">🪙</span>
          {broke ? 'BUST' : formatCurrency(player.chips)}
        </p>
      </div>

      {/* Status badges */}
      {player.status === 'folded' && (
        <span className="text-red-400 text-[9px] font-black bg-red-950/60
          border border-red-500/30 px-2 py-0.5 rounded">FOLD</span>
      )}
      {player.status === 'allin' && (
        <span className="text-yellow-400 text-[9px] font-black bg-yellow-950/60
          border border-yellow-500/30 px-2 py-0.5 rounded animate-pulse">ALL IN</span>
      )}
      {player.bet > 0 && player.status === 'active' && (
        <span className="text-gray-300 text-[9px] bg-gray-800/80
          border border-gray-600/30 px-2 py-0.5 rounded">
          Bet: ₹{player.bet}
        </span>
      )}
      {phase === 'showdown' && player.handRank && !folded && (
        <span className="text-yellow-400 text-[9px] font-bold bg-yellow-950/60
          border border-yellow-500/30 px-2 py-0.5 rounded">
          {player.handRank}
        </span>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN POKER PAGE
   ═══════════════════════════════════════════════════════════ */
const PokerGamePage: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [table, setTable] = useState<PokerTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [error, setError] = useState('');
  const [showLeave, setShowLeave] = useState(false);
  const [brokeBanner, setBrokeBanner] = useState<string[]>([]);

  const prevPlayerCount = useRef(0);
  const autoStartTriggered = useRef(false);

  // Subscribe
  useEffect(() => {
    if (!tableId) return;
    return subscribePokerTable(tableId, (data) => {
      setTable(data);
      setLoading(false);
      const broke = (data as any).lastBrokePlayers as Array<{ uid: string; name: string }> | undefined;
      if (broke && broke.length > 0) {
        setBrokeBanner(broke.map(p => p.name));
        setTimeout(() => setBrokeBanner([]), 5000);
      }
    });
  }, [tableId]);

  // Auto-start
  useEffect(() => {
    if (!table || !tableId) return;
    const num = table.players.length;
    if (num >= 2 && prevPlayerCount.current < 2
      && table.status === 'waiting' && table.phase === 'waiting'
      && !autoStartTriggered.current) {
      autoStartTriggered.current = true;
      const t = setTimeout(async () => {
        try { await checkAndAutoStart(tableId); } catch (e) {}
        autoStartTriggered.current = false;
      }, 2000);
      return () => clearTimeout(t);
    }
    if (table.status === 'waiting' && num >= 2) autoStartTriggered.current = false;
    prevPlayerCount.current = num;
  }, [table?.players.length, table?.status, table?.phase, tableId]);

  // Auto-leave if broke
  useEffect(() => {
    if (!table || !user || !tableId) return;
    const me = table.players.find(p => p.uid === user.uid);
    if (!me && table.phase === 'showdown') {
      const t = setTimeout(() => navigate('/games/poker'), 3000);
      return () => clearTimeout(t);
    }
    if (me && me.chips <= 0 && table.phase === 'showdown') {
      const t = setTimeout(async () => {
        try { await leavePokerTable(tableId, user.uid); } catch (_) {}
        navigate('/games/poker');
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [table?.phase, table?.players, user, tableId, navigate]);

  // Auto next hand
  useEffect(() => {
    if (!table || !tableId) return;
    if (table.status === 'waiting' && table.phase === 'showdown' && table.players.length >= 2) {
      const t = setTimeout(async () => {
        try { await startPokerHand(tableId); } catch (e) {}
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [table?.phase, table?.status, table?.players.length, tableId]);

  const myPlayer = table?.players.find(p => p.uid === user?.uid);
  const isMyTurn = table?.activePlayerUid === user?.uid;
  const phase = table?.phase || 'waiting';
  const pot = table?.pot || 0;
  const currentBet = table?.currentBet || 0;
  const numPlayers = table?.players.length || 0;
  const canStart = numPlayers >= 2 && table?.status === 'waiting' && phase === 'waiting';

  const callAmount = Math.max(0, Math.min(currentBet - (myPlayer?.bet || 0), myPlayer?.chips || 0));
  const minRaise = Math.max(currentBet * 2, (table?.bigBlind || 20) * 2);
  const maxRaise = (myPlayer?.chips || 0) + (myPlayer?.bet || 0);

  useEffect(() => {
    if (minRaise > 0) setRaiseAmount(Math.min(minRaise, maxRaise));
  }, [currentBet, minRaise, maxRaise]);

  const showErr = (msg: string) => { setError(msg); setTimeout(() => setError(''), 3000); };

  const handleAction = async (act: 'fold' | 'check' | 'call' | 'raise' | 'allin') => {
    if (!user || !tableId || actionLoading) return;
    setActionLoading(true);
    try { await pokerAction(tableId, user.uid, act, act === 'raise' ? raiseAmount : undefined); }
    catch (e: any) { showErr(e.message || 'Action failed'); }
    finally { setActionLoading(false); }
  };

  const handleStart = async () => {
    if (!tableId || starting) return;
    setStarting(true);
    try { await startPokerHand(tableId); } catch (e: any) { showErr(e.message); }
    finally { setStarting(false); }
  };

  const handleLeave = async () => {
    if (!user || !tableId || leaving) return;
    setLeaving(true);
    try { await leavePokerTable(tableId, user.uid); navigate('/games/poker'); }
    catch (e: any) { showErr(e.message); setLeaving(false); }
  };

  if (loading) return (
    <div className="h-[100dvh] bg-[#0a0a0a] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
    </div>
  );

  if (!table) return (
    <div className="h-[100dvh] bg-[#0a0a0a] flex flex-col items-center justify-center text-white gap-4">
      <p>Table not found</p>
      <button onClick={() => navigate('/games/poker')} className="text-yellow-400">← Back</button>
    </div>
  );

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-[#0a0a0a] text-white overflow-hidden select-none">

      {/* ═══ TOP BAR ═══ */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 z-50
        bg-[#0a0a0a]/95 backdrop-blur-md">
        <button onClick={() => setShowLeave(true)}
          className="w-9 h-9 flex items-center justify-center rounded-full
            bg-gray-800/80 border border-gray-700/50 text-gray-300
            active:scale-90 transition-transform">
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Pot display */}
        {pot > 0 ? (
          <div className="bg-[#1a1510] border border-yellow-700/40 rounded-full
            px-4 py-1.5 flex items-center gap-1.5">
            <span className="text-yellow-500 text-xs font-bold uppercase">Pot</span>
            <span className="text-yellow-400 font-black text-sm">
              🪙 {formatCurrency(pot)}
            </span>
          </div>
        ) : (
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">
            {table.name}
          </div>
        )}

        <button onClick={() => setShowLeave(true)}
          className="bg-gray-800/80 border border-gray-700/50 rounded-lg
            px-3 py-1.5 text-[11px] text-red-400 font-bold
            active:scale-90 transition-transform">
          EXIT 🚪
        </button>
      </div>

      {/* ═══ BROKE BANNER ═══ */}
      {brokeBanner.length > 0 && (
        <div className="shrink-0 bg-red-900/60 border-b border-red-700/30 px-4 py-1.5 text-center">
          <p className="text-red-300 text-[11px] font-bold">💸 {brokeBanner.join(', ')} busted!</p>
        </div>
      )}

      {/* ═══ TABLE AREA — Full height, vertical oval ═══ */}
      <div className="flex-1 relative overflow-hidden">
        {/* Dark textured background */}
        <div className="absolute inset-0 bg-[#0a0a0a]"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, #111 0%, #050505 100%)`,
          }} />

        {/* Table container - centered */}
        <div className="absolute inset-0 flex items-center justify-center p-3">
          <div className="relative w-full max-w-[380px] md:max-w-[500px]"
            style={{ aspectRatio: '3/4' }}>

            {/* Outer rim — wood effect */}
            <div className="absolute inset-0 rounded-[45%] bg-gradient-to-b
              from-[#5a3a1a] via-[#3d2610] to-[#2a1a0a]
              shadow-[0_0_60px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.1)]" />

            {/* Inner felt — green gradient */}
            <div className="absolute inset-[8px] md:inset-[12px] rounded-[44%]
              bg-gradient-to-b from-[#1a5c2e] via-[#1b7a35] to-[#145a28]
              shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]">

              {/* Felt texture */}
              <div className="absolute inset-0 rounded-[44%] opacity-[0.08]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='6' height='6' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='1' height='1' fill='white' fill-opacity='0.3'/%3E%3C/svg%3E")`,
                }} />

              {/* Center spade watermark */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.06]">
                <span className="text-[120px] md:text-[160px]">♠</span>
              </div>

              {/* ── CENTER CONTENT ── */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-8">

                {/* POT */}
                {pot > 0 && (
                  <div className="bg-black/40 backdrop-blur-sm border border-yellow-600/30
                    rounded-full px-4 py-1.5 shadow-lg">
                    <span className="text-yellow-400 font-black text-sm">
                      POT
                    </span>
                    <br />
                    <span className="text-yellow-300 font-black text-base">
                      🪙 {formatCurrency(pot)}
                    </span>
                  </div>
                )}

                {/* Community Cards */}
                {phase !== 'waiting' && (
                  <div className="flex gap-1.5 justify-center">
                    {[...Array(5)].map((_, i) => (
                      table.communityCards[i]
                        ? <CardDisplay key={i} card={table.communityCards[i]} size="sm" animate />
                        : <div key={i} className="w-9 h-13 md:w-11 md:h-15 rounded-lg
                            border border-dashed border-white/10 bg-white/5"
                            style={{ height: '52px', width: '36px' }} />
                    ))}
                  </div>
                )}

                {/* Waiting state */}
                {phase === 'waiting' && numPlayers < 2 && (
                  <div className="text-center">
                    <Wifi className="w-6 h-6 text-yellow-400/60 animate-pulse mx-auto mb-2" />
                    <p className="text-white/40 text-xs font-bold">Waiting for players...</p>
                    <p className="text-white/20 text-[10px]">{numPlayers}/2</p>
                  </div>
                )}

                {phase === 'showdown' && (
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    <span className="text-yellow-400 font-black text-sm">SHOWDOWN</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── PLAYER SEATS ── */}
            {table.players.map(player => (
              <div key={player.uid}
                className={`absolute z-10 ${getSeatPos(player.seatIndex, numPlayers)}`}>
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

      {/* ═══ BOTTOM ACTION PANEL ═══ */}
      <div className="shrink-0 bg-[#0d0d0d] border-t border-gray-800/50 px-3 py-3 z-50
        pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto space-y-2">

          {error && (
            <div className="flex items-center gap-2 bg-red-950/60 border border-red-500/30
              text-red-400 text-[11px] rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* WAITING */}
          {phase === 'waiting' && canStart && (
            <div className="text-center space-y-2">
              <button onClick={handleStart} disabled={starting}
                className="w-full bg-gradient-to-r from-emerald-600 to-green-600
                  text-white font-black py-3 rounded-xl disabled:opacity-50
                  active:scale-95 transition-all text-sm shadow-lg shadow-emerald-500/20">
                {starting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `▶ START GAME (${numPlayers})`}
              </button>
              <p className="text-gray-600 text-[10px]">Auto-starts in 2s</p>
            </div>
          )}

          {phase === 'waiting' && !canStart && (
            <p className="text-center text-gray-600 text-xs py-2">
              Waiting for {2 - numPlayers} more player(s)...
            </p>
          )}

          {/* MY TURN — Action Buttons */}
          {isMyTurn && phase !== 'waiting' && phase !== 'showdown'
            && myPlayer?.status === 'active' && (
            <div className="space-y-2.5">

              {/* Raise controls */}
              {(myPlayer?.chips || 0) > 0 && maxRaise > minRaise && (
                <div className="flex items-center gap-2 bg-gray-900/60 rounded-xl px-3 py-2">
                  <button onClick={() => setRaiseAmount(minRaise)}
                    className="bg-gray-800 text-gray-300 text-[10px] font-bold px-2 py-1
                      rounded-lg border border-gray-700 active:scale-90">MIN</button>
                  <button onClick={() => setRaiseAmount(Math.max(minRaise, raiseAmount - (table.bigBlind || 10)))}
                    className="bg-gray-800 text-white text-sm font-bold w-8 h-8
                      rounded-lg border border-gray-700 active:scale-90">−</button>
                  <div className="flex-1 text-center">
                    <span className="text-yellow-400 font-black text-base">
                      {formatCurrency(Math.min(raiseAmount, maxRaise))}
                    </span>
                  </div>
                  <button onClick={() => setRaiseAmount(Math.min(maxRaise, raiseAmount + (table.bigBlind || 10)))}
                    className="bg-gray-800 text-white text-sm font-bold w-8 h-8
                      rounded-lg border border-gray-700 active:scale-90">+</button>
                  <button onClick={() => setRaiseAmount(maxRaise)}
                    className="bg-gray-800 text-gray-300 text-[10px] font-bold px-2 py-1
                      rounded-lg border border-gray-700 active:scale-90">MAX</button>
                </div>
              )}

              {/* Action buttons row */}
              <div className="flex gap-2">
                {/* FOLD */}
                <button onClick={() => handleAction('fold')} disabled={actionLoading}
                  className="flex-1 bg-gradient-to-b from-red-800 to-red-950
                    border border-red-600/40 text-white font-black py-3.5
                    rounded-xl text-xs disabled:opacity-40 active:scale-95
                    shadow-lg transition-all uppercase tracking-wider">
                  FOLD
                </button>

                {/* CHECK */}
                {(myPlayer?.bet || 0) >= currentBet && (
                  <button onClick={() => handleAction('check')} disabled={actionLoading}
                    className="flex-1 bg-gradient-to-b from-yellow-700 to-yellow-900
                      border border-yellow-600/40 text-white font-black py-3.5
                      rounded-xl text-xs disabled:opacity-40 active:scale-95
                      shadow-lg transition-all uppercase tracking-wider">
                    CHECK
                  </button>
                )}

                {/* CALL */}
                {(myPlayer?.bet || 0) < currentBet && callAmount > 0 && (
                  <button onClick={() => handleAction('call')} disabled={actionLoading}
                    className="flex-1 bg-gradient-to-b from-emerald-700 to-emerald-900
                      border border-emerald-600/40 text-white font-black py-3.5
                      rounded-xl disabled:opacity-40 active:scale-95
                      shadow-lg transition-all flex flex-col items-center">
                    <span className="text-xs uppercase tracking-wider">CALL</span>
                    <span className="text-[10px] text-emerald-300">{formatCurrency(callAmount)}</span>
                  </button>
                )}

                {/* RAISE */}
                {(myPlayer?.chips || 0) > callAmount && (
                  <button onClick={() => handleAction('raise')}
                    disabled={actionLoading || raiseAmount < minRaise}
                    className="flex-1 bg-gradient-to-b from-purple-700 to-purple-950
                      border border-purple-500/40 text-white font-black py-3.5
                      rounded-xl disabled:opacity-40 active:scale-95
                      shadow-lg transition-all flex flex-col items-center">
                    <span className="text-xs uppercase tracking-wider">RAISE</span>
                    <span className="text-[10px] text-purple-300">
                      {formatCurrency(Math.min(raiseAmount, maxRaise))}
                    </span>
                  </button>
                )}
              </div>

              {/* ALL IN separate button */}
              <button onClick={() => handleAction('allin')}
                disabled={actionLoading || (myPlayer?.chips || 0) === 0}
                className="w-full bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600
                  border border-yellow-400/50 text-gray-900 font-black py-3
                  rounded-xl disabled:opacity-40 active:scale-95 shadow-lg
                  transition-all text-sm uppercase tracking-widest">
                🔥 ALL IN — {formatCurrency(myPlayer?.chips || 0)}
              </button>

              {/* YOUR TURN indicator */}
              <p className="text-center text-yellow-400 text-xs font-black uppercase
                tracking-widest animate-pulse">
                YOUR TURN
              </p>

              {actionLoading && (
                <div className="flex justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
                </div>
              )}
            </div>
          )}

          {/* Not my turn */}
          {!isMyTurn && phase !== 'waiting' && phase !== 'showdown'
            && myPlayer?.status === 'active' && (
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-ping" />
              <span className="text-gray-400 text-sm">
                {table.players.find(p => p.uid === table.activePlayerUid)?.name}'s turn...
              </span>
            </div>
          )}

          {myPlayer?.status === 'folded' && phase !== 'showdown' && (
            <p className="text-center text-red-400/60 text-sm py-2">You folded — watching...</p>
          )}

          {myPlayer?.status === 'allin' && phase !== 'showdown' && (
            <p className="text-center text-yellow-400 font-black text-sm animate-pulse py-2">
              ALL IN 🔥 — Waiting for showdown...
            </p>
          )}

          {/* SHOWDOWN */}
          {phase === 'showdown' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 justify-center">
                {table.players.filter(p => p.status !== 'folded' && p.handRank).map(p => (
                  <div key={p.uid} className={`rounded-xl px-3 py-2 border text-center
                    ${p.uid === user?.uid
                      ? 'bg-yellow-500/10 border-yellow-500/40'
                      : 'bg-gray-800 border-gray-700'}`}>
                    <p className="text-white font-bold text-xs">{p.uid === user?.uid ? 'You' : p.name}</p>
                    <p className="text-yellow-400 text-xs">{p.handRank}</p>
                  </div>
                ))}
              </div>
              {myPlayer && myPlayer.chips <= 0 && (
                <div className="bg-red-950/40 border border-red-500/30 rounded-xl px-4 py-3 text-center">
                  <p className="text-red-400 font-bold text-sm">💸 Busted! Leaving in 3s...</p>
                </div>
              )}
              {table.players.length >= 2 && (!myPlayer || myPlayer.chips > 0) && (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
                  <span className="text-gray-400 text-xs">Next hand in 4s...</span>
                </div>
              )}
            </div>
          )}

          {!myPlayer && phase !== 'waiting' && (
            <p className="text-center text-gray-600 text-xs py-1">Spectating</p>
          )}
        </div>
      </div>

      {/* ═══ LEAVE MODAL ═══ */}
      {showLeave && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-end
          sm:items-center justify-center z-[100] px-4 pb-4 sm:pb-0">
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-3xl p-6
            w-full max-w-sm text-center shadow-2xl">
            <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5 sm:hidden" />
            <LogOut className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h3 className="text-white font-black text-lg mb-1">Leave Table?</h3>
            <p className="text-gray-400 text-sm mb-3">Chips returned to wallet.</p>
            {(myPlayer?.chips || 0) > 0 && (
              <p className="text-emerald-400 font-black text-2xl mb-5">
                +{formatCurrency(myPlayer!.chips)}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowLeave(false)}
                className="flex-1 bg-gray-800 border border-gray-700 text-white font-bold
                  py-3 rounded-2xl text-sm active:scale-95">Stay</button>
              <button onClick={handleLeave} disabled={leaving}
                className="flex-1 bg-red-600 text-white font-bold py-3 rounded-2xl
                  text-sm disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2">
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
