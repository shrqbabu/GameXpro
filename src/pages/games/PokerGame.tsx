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
import { Loader2, LogOut, Info } from 'lucide-react';

// ── Seat positions around oval table (% based, for up to 6 players) ──
// Position 0 = bottom center (You), others go clockwise
const SEAT_POSITIONS = [
  { bottom: '-14%', left: '50%', transform: 'translateX(-50%)' },        // 0: bottom center (You)
  { bottom: '8%',  right: '-2%', transform: 'translateY(0)' },           // 1: bottom right
  { top: '8%',     right: '-2%', transform: 'translateY(0)' },           // 2: top right
  { top: '-14%',   left: '50%',  transform: 'translateX(-50%)' },        // 3: top center
  { top: '8%',     left: '-2%',  transform: 'translateY(0)' },           // 4: top left
  { bottom: '8%',  left: '-2%',  transform: 'translateY(0)' },           // 5: bottom left
];

// ── Single Player Seat ────────────────────────────────────────
const PlayerSeat: React.FC<{
  player: PokerPlayer;
  isMe: boolean;
  isActive: boolean;
  phase: string;
  seatIndex: number;
}> = ({ player, isMe, isActive, phase, seatIndex }) => {
  const isPlaying = phase !== 'waiting';
  const folded = player.status === 'folded';
  const isTop = seatIndex === 3;
  const isBottom = seatIndex === 0;

  return (
    <div className={`flex flex-col items-center ${folded ? 'opacity-50' : ''}`}
      style={{ minWidth: isMe ? 72 : 64 }}>

      {/* Cards ABOVE avatar for top players, BELOW for bottom */}
      {isPlaying && player.holeCards.length > 0 && !isBottom && (
        <div className="flex gap-0.5 mb-1">
          {(isMe || phase === 'showdown') && !folded
            ? player.holeCards.map((c, i) => <CardDisplay key={i} card={c} size="xs" animate />)
            : player.holeCards.map((_, i) => <CardDisplay key={i} faceDown size="xs" />)}
        </div>
      )}

      {/* Avatar circle */}
      <div className="relative">
        <div className={`
          rounded-full flex items-center justify-center font-black border-2 overflow-hidden
          transition-all duration-300
          ${isMe ? 'w-14 h-14' : 'w-11 h-11'}
          ${isActive && isPlaying
            ? 'border-yellow-400 shadow-[0_0_0_2px_#facc15,0_0_18px_rgba(250,204,21,0.7)]'
            : isMe
              ? 'border-purple-500'
              : 'border-gray-500'}
          bg-gradient-to-br from-gray-600 to-gray-800 text-white
        `}>
          <span className={`${isMe ? 'text-xl' : 'text-base'} font-black text-white`}>
            {player.name.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Dealer button */}
        {player.isDealer && (
          <span className="absolute -top-1 -right-1 bg-white text-gray-900
            text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center
            shadow border border-gray-300 z-10">D</span>
        )}

        {/* Active turn ring animation */}
        {isActive && isPlaying && (
          <div className="absolute inset-0 rounded-full border-2 border-yellow-400 animate-ping opacity-40" />
        )}
      </div>

      {/* Name plate */}
      <div className={`
        mt-0.5 px-2 py-0.5 rounded text-center
        ${isMe ? 'min-w-[72px]' : 'min-w-[60px]'}
        ${isActive && isPlaying
          ? 'bg-yellow-950/95 border border-yellow-500/60'
          : isMe
            ? 'bg-[#1a0a35]/95 border border-purple-500/40'
            : 'bg-gray-900/90 border border-white/10'}
      `}>
        <p className={`text-[10px] font-bold truncate leading-tight
          ${isMe ? 'text-purple-300' : 'text-white'}`}>
          {isMe ? 'You' : player.name}
        </p>
        <p className="text-yellow-400 text-[10px] font-semibold leading-tight">
          ₹{formatCurrency(player.chips)}
        </p>
      </div>

      {/* Bet chip below name */}
      {player.bet > 0 && (
        <div className="mt-0.5 flex items-center gap-0.5 bg-black/70 border border-yellow-500/40
          px-1.5 py-0.5 rounded-full">
          <span className="w-2 h-2 bg-red-500 rounded-full" />
          <span className="text-yellow-300 text-[9px] font-bold">₹{player.bet}</span>
        </div>
      )}

      {/* Status badges */}
      {folded && (
        <span className="text-red-400 text-[9px] font-black mt-0.5">FOLD</span>
      )}
      {player.status === 'allin' && (
        <span className="text-yellow-400 text-[9px] font-black animate-pulse mt-0.5">ALL IN</span>
      )}
      {phase === 'showdown' && player.handRank && !folded && (
        <span className="text-emerald-400 text-[8px] font-bold mt-0.5 max-w-[70px] truncate text-center">
          {player.handRank}
        </span>
      )}

      {/* Cards BELOW avatar for bottom (You) player */}
      {isPlaying && player.holeCards.length > 0 && isBottom && (
        <div className="flex gap-1 mt-1">
          {(isMe || phase === 'showdown') && !folded
            ? player.holeCards.map((c, i) => <CardDisplay key={i} card={c} size="sm" animate />)
            : player.holeCards.map((_, i) => <CardDisplay key={i} faceDown size="sm" />)}
        </div>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────
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
  const [showRaise, setShowRaise] = useState(false);

  const prevCount = useRef(0);
  const autoStarted = useRef(false);

  useEffect(() => {
    if (!tableId) return;
    return subscribePokerTable(tableId, (data) => {
      setTable(data);
      setLoading(false);
    });
  }, [tableId]);

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

  useEffect(() => {
    if (!table || !tableId) return;
    if (table.status === 'waiting' && table.phase === 'showdown' && table.players.length >= 2) {
      const t = setTimeout(async () => {
        try { await startPokerHand(tableId); } catch (e) {}
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [table?.phase, table?.status, table?.players.length]);

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
    if (action === 'raise') setShowRaise(false);
    setActionLoading(true);
    try {
      await pokerAction(tableId, user.uid, action, action === 'raise' ? raiseAmount : undefined);
    } catch (e: any) {
      showError(e.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!user || !tableId || leaving) return;
    setLeaving(true);
    try {
      await leavePokerTable(tableId, user.uid);
      navigate('/games/poker');
    } catch (e: any) {
      showError(e.message);
      setLeaving(false);
    }
  };

  const adjustRaise = (delta: number) => {
    setRaiseAmount(prev => Math.max(minRaise, Math.min(prev + delta, maxRaise)));
  };

  // Arrange players: Me at seat index 0 (bottom), others fill seats 1-5
  const getArrangedPlayers = () => {
    if (!table) return [];
    const me = table.players.find(p => p.uid === user?.uid);
    const others = table.players.filter(p => p.uid !== user?.uid);
    const arranged: (PokerPlayer & { displaySeat: number })[] = [];
    if (me) arranged.push({ ...me, displaySeat: 0 });
    others.forEach((p, i) => arranged.push({ ...p, displaySeat: i + 1 }));
    return arranged;
  };

  const arrangedPlayers = getArrangedPlayers();
  const showActions = isMyTurn && phase !== 'waiting' && phase !== 'showdown'
    && myPlayer?.status === 'active';

  if (loading) return (
    <div className="h-screen bg-[#1a0a2e] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
    </div>
  );

  if (!table) return (
    <div className="h-screen bg-[#1a0a2e] flex items-center justify-center text-white">
      <div className="text-center">
        <p className="mb-4 text-gray-300">Table not found</p>
        <button onClick={() => navigate('/games/poker')} className="text-yellow-400 text-sm underline">
          ← Back to Lobby
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{ background: 'linear-gradient(180deg, #1a0a2e 0%, #0d1a2e 50%, #0a1020 100%)' }}>

      {/* ══ TOP BAR ══════════════════════════════════════════ */}
      <div className="shrink-0 flex items-center justify-between px-3 pt-safe pt-2 pb-2 z-40">

        {/* Back / Leave */}
        <button onClick={() => setShowLeave(true)}
          className="flex items-center gap-1 bg-black/40 border border-white/10
            text-white text-xs font-semibold px-3 py-2 rounded-lg active:scale-95 transition-transform">
          <LogOut className="w-3.5 h-3.5 text-red-400" />
          <span className="text-red-400">Exit</span>
        </button>

        {/* POT AMOUNT — center top */}
        <div className="flex flex-col items-center">
          <span className="text-[9px] tracking-[2px] uppercase text-gray-400 font-semibold">
            POT AMOUNT
          </span>
          <span className="text-yellow-400 font-black text-xl leading-tight"
            style={{ fontFamily: 'Georgia, serif' }}>
            ₹{formatCurrency(pot)}
          </span>
        </div>

        {/* Boot amount + info */}
        <div className="flex flex-col items-end">
          <span className="text-[9px] tracking-[2px] uppercase text-gray-400 font-semibold">
            BLIND
          </span>
          <span className="text-white font-bold text-sm">
            ₹{table.bigBlind || 20}
          </span>
        </div>
      </div>

      {/* Phase pill */}
      <div className="flex justify-center mb-1 z-40">
        <span className={`text-[10px] font-bold tracking-[2px] uppercase px-3 py-0.5 rounded-full
          ${phase === 'waiting' ? 'bg-gray-700/60 text-gray-400'
          : phase === 'showdown' ? 'bg-yellow-600/30 text-yellow-400 border border-yellow-500/40'
          : 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30'}`}>
          {phase === 'waiting' ? `Waiting ${numPlayers}/2` : phase}
        </span>
      </div>

      {/* ══ TABLE AREA ════════════════════════════════════════ */}
      <div className="flex-1 relative flex items-center justify-center px-2 overflow-hidden">

        {/* Outer dark bg with subtle pattern */}
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, #1a2a3a 0%, #0a1020 100%)' }} />

        {/* Table wrapper — oval, takes most of screen */}
        <div className="relative w-full max-w-[360px]"
          style={{ height: 'clamp(240px, 55vw, 320px)' }}>

          {/* ── Wooden rim ── */}
          <div className="absolute inset-0"
            style={{
              borderRadius: '50%',
              background: 'linear-gradient(145deg, #a0622a 0%, #7a4820 40%, #4a2c0e 100%)',
              boxShadow: '0 0 0 4px #b8792a, 0 0 0 7px #6b3d0f, 0 20px 60px rgba(0,0,0,0.9)',
            }} />

          {/* ── Felt surface ── */}
          <div className="absolute inset-[10px] flex flex-col items-center justify-center"
            style={{
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at 50% 40%, #1a6b8a 0%, #0f4d6b 50%, #08303f 100%)',
              boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6), inset 0 0 80px rgba(0,0,0,0.3)',
            }}>

            {/* Brand watermark */}
            <div className="absolute inset-0 flex items-center justify-center
              text-white/[0.04] text-6xl pointer-events-none select-none font-black">
              ♠
            </div>

            {/* Center content: community cards + current bet */}
            <div className="flex flex-col items-center gap-1.5 z-10 px-4">

              {/* Community cards */}
              {phase !== 'waiting' && (
                <div className="flex gap-1 justify-center">
                  {[...Array(5)].map((_, i) => (
                    table.communityCards[i]
                      ? <CardDisplay key={i} card={table.communityCards[i]} size="xs" animate />
                      : <div key={i}
                          className="w-6 h-8 border border-white/15 bg-black/25 rounded" />
                  ))}
                </div>
              )}

              {/* Current bet indicator */}
              {currentBet > 0 && phase !== 'waiting' && (
                <div className="flex items-center gap-1 bg-black/50 border border-white/10
                  px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                  <span className="text-white/70 text-[9px]">
                    Bet: <span className="text-white font-bold">₹{formatCurrency(currentBet)}</span>
                  </span>
                </div>
              )}

              {/* Waiting message */}
              {phase === 'waiting' && numPlayers < 2 && (
                <div className="text-center">
                  <Loader2 className="w-5 h-5 text-white/40 animate-spin mx-auto mb-1" />
                  <p className="text-white/40 text-[10px]">Waiting for players...</p>
                </div>
              )}

              {/* Showdown badge */}
              {phase === 'showdown' && (
                <p className="text-yellow-400 font-black text-xs animate-bounce">🏆 Showdown!</p>
              )}
            </div>
          </div>

          {/* ── Player seats positioned around oval ── */}
          {arrangedPlayers.map(player => {
            const pos = SEAT_POSITIONS[player.displaySeat] || SEAT_POSITIONS[0];
            return (
              <div key={player.uid}
                className="absolute z-20 flex items-center justify-center"
                style={{
                  ...pos,
                  // Convert percentage strings to actual positioning
                  bottom: pos.bottom,
                  top: pos.top,
                  left: pos.left,
                  right: pos.right,
                  transform: pos.transform,
                }}>
                <PlayerSeat
                  player={player}
                  isMe={player.uid === user?.uid}
                  isActive={table.activePlayerUid === player.uid}
                  phase={phase}
                  seatIndex={player.displaySeat}
                />
              </div>
            );
          })}

          {/* Empty seat indicators */}
          {phase === 'waiting' && arrangedPlayers.length < 6 &&
            [...Array(Math.max(0, 2 - arrangedPlayers.length))].map((_, i) => {
              const seatIdx = arrangedPlayers.length + i;
              const pos = SEAT_POSITIONS[seatIdx];
              if (!pos) return null;
              return (
                <div key={`empty-${i}`}
                  className="absolute z-10 flex flex-col items-center gap-0.5"
                  style={{
                    bottom: pos.bottom, top: pos.top,
                    left: pos.left, right: pos.right,
                    transform: pos.transform,
                  }}>
                  <div className="w-11 h-11 rounded-full border-2 border-dashed border-white/20
                    bg-black/20 flex items-center justify-center">
                    <span className="text-white/20 text-lg">+</span>
                  </div>
                  <span className="text-white/20 text-[9px]">Empty</span>
                </div>
              );
            })
          }
        </div>
      </div>

      {/* ══ ERROR TOAST ══ */}
      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50
          bg-red-900/95 border border-red-500/50 text-red-300 text-xs font-medium
          px-4 py-2 rounded-lg whitespace-nowrap shadow-xl">
          ⚠️ {error}
        </div>
      )}

      {/* ══ BOTTOM ACTION PANEL ════════════════════════════ */}
      <div className="shrink-0 z-40 pb-safe">

        {/* WAITING state */}
        {phase === 'waiting' && (
          <div className="text-center py-3 px-4">
            {canStart ? (
              <button onClick={() => tableId && startPokerHand(tableId)}
                className="w-full max-w-xs mx-auto block bg-emerald-600 text-white
                  font-black py-3.5 text-sm rounded-xl active:scale-95 transition-transform
                  shadow-lg shadow-emerald-900/50">
                🎮 Start Game
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                <p className="text-gray-400 text-sm">Need {2 - numPlayers} more player{2 - numPlayers !== 1 ? 's' : ''}...</p>
              </div>
            )}
          </div>
        )}

        {/* MY TURN actions */}
        {showActions && (
          <div className="px-3 py-2 space-y-2">

            {/* YOUR TURN indicator */}
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
              <span className="text-emerald-400 font-bold text-[11px] tracking-[2px] uppercase">
                Your Turn
              </span>
            </div>

            {/* Raise slider (expandable) */}
            {showRaise && (myPlayer?.chips || 0) > callAmount && (
              <div className="bg-black/60 border border-white/10 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Raise Amount</span>
                  <span className="text-yellow-400 font-bold text-sm">
                    ₹{formatCurrency(Math.min(raiseAmount, maxRaise))}
                  </span>
                </div>
                <input
                  type="range"
                  min={minRaise}
                  max={maxRaise}
                  step={table?.bigBlind || 10}
                  value={Math.min(raiseAmount, maxRaise)}
                  onChange={e => setRaiseAmount(Number(e.target.value))}
                  className="w-full accent-yellow-400"
                />
                <div className="flex gap-2">
                  <button onClick={() => setRaiseAmount(minRaise)}
                    className="flex-1 bg-white/8 border border-white/10 text-yellow-400
                      text-[11px] font-bold py-1.5 rounded-lg">
                    MIN
                  </button>
                  <button onClick={() => setRaiseAmount(Math.round(maxRaise / 2))}
                    className="flex-1 bg-white/8 border border-white/10 text-yellow-400
                      text-[11px] font-bold py-1.5 rounded-lg">
                    ½
                  </button>
                  <button onClick={() => setRaiseAmount(maxRaise)}
                    className="flex-1 bg-white/8 border border-white/10 text-yellow-400
                      text-[11px] font-bold py-1.5 rounded-lg">
                    MAX
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons row */}
            <div className="grid grid-cols-4 gap-1.5">

              {/* FOLD */}
              <button
                onClick={() => handleAction('fold')}
                disabled={actionLoading}
                className="flex flex-col items-center justify-center py-3 rounded-xl
                  active:scale-95 transition-transform disabled:opacity-40 font-black"
                style={{ background: 'linear-gradient(160deg, #7f1d1d, #991b1b)',
                  border: '1.5px solid rgba(239,68,68,0.35)' }}>
                <span className="text-white text-xs">FOLD</span>
              </button>

              {/* CHECK or CALL */}
              {(myPlayer?.bet || 0) >= currentBet ? (
                <button
                  onClick={() => handleAction('check')}
                  disabled={actionLoading}
                  className="flex flex-col items-center justify-center py-3 rounded-xl
                    active:scale-95 transition-transform disabled:opacity-40"
                  style={{ background: 'linear-gradient(160deg, #78350f, #92400e)',
                    border: '1.5px solid rgba(234,179,8,0.35)' }}>
                  <span className="text-white font-black text-xs">CHECK</span>
                </button>
              ) : (
                <button
                  onClick={() => handleAction('call')}
                  disabled={actionLoading || callAmount === 0}
                  className="flex flex-col items-center justify-center py-2 rounded-xl
                    active:scale-95 transition-transform disabled:opacity-40"
                  style={{ background: 'linear-gradient(160deg, #14532d, #166534)',
                    border: '1.5px solid rgba(34,197,94,0.35)' }}>
                  <span className="text-white font-black text-xs">CALL</span>
                  <span className="text-green-300 text-[10px]">₹{formatCurrency(callAmount)}</span>
                </button>
              )}

              {/* RAISE */}
              <button
                onClick={() => {
                  if (showRaise) handleAction('raise');
                  else setShowRaise(true);
                }}
                disabled={actionLoading || (myPlayer?.chips || 0) <= callAmount || raiseAmount < minRaise}
                className="flex flex-col items-center justify-center py-2 rounded-xl
                  active:scale-95 transition-transform disabled:opacity-40"
                style={{ background: showRaise
                  ? 'linear-gradient(160deg, #4c1d95, #6d28d9)'
                  : 'linear-gradient(160deg, #3b0764, #4c1d95)',
                  border: `1.5px solid rgba(139,92,246,${showRaise ? 0.7 : 0.35})` }}>
                <span className="text-white font-black text-xs">
                  {showRaise ? 'CONFIRM' : 'RAISE'}
                </span>
                {showRaise && (
                  <span className="text-purple-300 text-[10px]">
                    ₹{formatCurrency(Math.min(raiseAmount, maxRaise))}
                  </span>
                )}
              </button>

              {/* ALL IN */}
              <button
                onClick={() => handleAction('allin')}
                disabled={actionLoading || (myPlayer?.chips || 0) === 0}
                className="flex flex-col items-center justify-center py-2 rounded-xl
                  active:scale-95 transition-transform disabled:opacity-40"
                style={{ background: 'linear-gradient(160deg, #7c2d12, #c2410c)',
                  border: '1.5px solid rgba(249,115,22,0.45)' }}>
                <span className="text-white font-black text-[11px]">ALL IN</span>
                <span className="text-orange-300 text-[10px]">₹{formatCurrency(myPlayer?.chips || 0)}</span>
              </button>
            </div>

            {/* Cancel raise */}
            {showRaise && (
              <button onClick={() => setShowRaise(false)}
                className="w-full text-gray-400 text-xs py-1 text-center">
                Cancel ✕
              </button>
            )}
          </div>
        )}

        {/* NOT MY TURN */}
        {!isMyTurn && phase !== 'waiting' && phase !== 'showdown'
          && myPlayer?.status === 'active' && (
          <div className="flex items-center justify-center gap-2 py-4 px-4">
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-ping" />
            <p className="text-gray-400 text-sm">
              <span className="text-yellow-400 font-semibold">
                {table.players.find(p => p.uid === table.activePlayerUid)?.name || 'Player'}
              </span>
              {' '}is deciding...
            </p>
          </div>
        )}

        {/* FOLDED */}
        {myPlayer?.status === 'folded' && phase !== 'showdown' && (
          <p className="text-center text-red-400/70 text-sm py-4">
            You folded — watching the hand...
          </p>
        )}

        {/* ALL IN waiting */}
        {myPlayer?.status === 'allin' && phase !== 'showdown' && (
          <p className="text-center text-yellow-400 font-black text-sm animate-pulse py-4">
            ALL IN 🎯 — Waiting for showdown...
          </p>
        )}

        {/* SHOWDOWN */}
        {phase === 'showdown' && (
          <div className="text-center py-3 px-4">
            {myPlayer && myPlayer.chips <= 0 ? (
              <div className="bg-red-900/40 border border-red-500/30 px-4 py-3 rounded-xl inline-block">
                <p className="text-red-400 font-bold text-sm">💸 Out of chips!</p>
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
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-end justify-center z-[100]">
          <div className="bg-[#0d1520] border border-white/10 p-6 w-full max-w-sm
            text-center rounded-t-2xl pb-safe pb-8">
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
            <LogOut className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <h3 className="text-white font-black text-lg mb-1">Leave Table?</h3>
            <p className="text-gray-400 text-sm mb-4">
              Your remaining chips will be returned to your wallet.
            </p>
            {(myPlayer?.chips || 0) > 0 && (
              <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-xl
                py-3 mb-5">
                <p className="text-gray-400 text-xs mb-0.5">You'll receive</p>
                <p className="text-emerald-400 font-black text-2xl">
                  +₹{formatCurrency(myPlayer!.chips)}
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowLeave(false)}
                className="flex-1 bg-white/8 border border-white/12 text-white font-bold
                  py-3.5 text-sm rounded-xl">
                Stay
              </button>
              <button onClick={handleLeave} disabled={leaving}
                className="flex-1 bg-red-600 text-white font-bold py-3.5 text-sm
                  rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
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
