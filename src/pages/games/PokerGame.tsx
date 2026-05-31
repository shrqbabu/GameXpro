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
import { Loader2, LogOut } from 'lucide-react';

// ── Seat positions OUTSIDE the square table (30% radius) ─────
// All positions are absolute, relative to the table wrapper div
// Table wrapper is larger than the felt to accommodate seats
const SEAT_CONFIGS: Record<number, {
  wrapperPos: string;   // position of the seat container
  align: string;        // flex alignment
}> = {
  0: { // Bottom center — YOU
    wrapperPos: 'bottom-0 left-1/2 -translate-x-1/2',
    align: 'items-center',
  },
  1: { // Right middle
    wrapperPos: 'top-1/2 right-0 -translate-y-1/2',
    align: 'items-center',
  },
  2: { // Top right
    wrapperPos: 'top-0 right-[12%]',
    align: 'items-center',
  },
  3: { // Top center
    wrapperPos: 'top-0 left-1/2 -translate-x-1/2',
    align: 'items-center',
  },
  4: { // Top left
    wrapperPos: 'top-0 left-[12%]',
    align: 'items-center',
  },
  5: { // Left middle
    wrapperPos: 'top-1/2 left-0 -translate-y-1/2',
    align: 'items-center',
  },
};

// ── Player Seat Component ─────────────────────────────────────
const PlayerSeat: React.FC<{
  player: PokerPlayer;
  isMe: boolean;
  isActive: boolean;
  phase: string;
  displaySeat: number;
}> = ({ player, isMe, isActive, phase, displaySeat }) => {
  const isPlaying = phase !== 'waiting';
  const folded = player.status === 'folded';
  const isBottomSeat = displaySeat === 0; // "You" seat

  return (
    <div className={`flex flex-col items-center gap-0.5 ${folded ? 'opacity-50' : ''}`}>

      {/* ── Cards ABOVE avatar (for non-bottom seats) ── */}
      {isPlaying && player.holeCards.length > 0 && !isBottomSeat && (
        <div className="flex gap-0.5 mb-0.5">
          {(isMe || (phase === 'showdown' && !folded))
            ? player.holeCards.map((c, i) => <CardDisplay key={i} card={c} size="xs" animate />)
            : player.holeCards.map((_, i) => <CardDisplay key={i} faceDown size="xs" />)}
        </div>
      )}

      {/* ── Avatar ── */}
      <div className="relative">
        <div className={`
          rounded-full flex items-center justify-center font-black border-[3px]
          transition-all duration-300
          ${isMe ? 'w-14 h-14' : 'w-11 h-11'}
          ${isActive && isPlaying
            ? 'border-yellow-400 shadow-[0_0_0_3px_#facc15,0_0_20px_rgba(250,204,21,0.6)]'
            : isMe
              ? 'border-purple-500'
              : 'border-gray-500'}
          ${isMe
            ? 'bg-gradient-to-br from-purple-700 to-blue-700 text-white'
            : 'bg-gradient-to-br from-gray-600 to-gray-800 text-white'}
        `}>
          <span className={`font-black ${isMe ? 'text-xl' : 'text-base'}`}>
            {player.name.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Active ping ring */}
        {isActive && isPlaying && (
          <div className="absolute inset-0 rounded-full border-2 border-yellow-400
            animate-ping opacity-50 pointer-events-none" />
        )}

        {/* Dealer chip */}
        {player.isDealer && (
          <span className="absolute -top-1 -right-1 bg-white text-gray-900
            text-[8px] font-black w-4 h-4 rounded-full flex items-center
            justify-center shadow border border-gray-300 z-20">
            D
          </span>
        )}
      </div>

      {/* ── Name + chips plate ── */}
      <div className={`
        px-2 py-0.5 rounded text-center
        ${isMe ? 'min-w-[76px]' : 'min-w-[62px]'}
        ${isActive && isPlaying
          ? 'bg-yellow-950/95 border border-yellow-500/60'
          : isMe
            ? 'bg-[#180830]/95 border border-purple-500/50'
            : 'bg-gray-900/95 border border-white/15'}
      `}>
        <p className={`text-[10px] font-bold truncate leading-tight
          ${isMe ? 'text-purple-300' : 'text-white'}`}>
          {isMe ? 'You' : player.name}
        </p>
        <p className="text-yellow-400 text-[10px] font-semibold leading-tight">
          ₹{formatCurrency(player.chips)}
        </p>
      </div>

      {/* ── Bet chip ── */}
      {player.bet > 0 && (
        <div className="flex items-center gap-0.5 bg-black/75 border border-red-500/40
          px-1.5 py-0.5 rounded-full">
          <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
          <span className="text-yellow-300 text-[9px] font-bold">₹{player.bet}</span>
        </div>
      )}

      {/* ── Status badges ── */}
      {folded && (
        <span className="text-red-400 text-[9px] font-black tracking-wider">FOLD</span>
      )}
      {player.status === 'allin' && (
        <span className="text-yellow-400 text-[9px] font-black animate-pulse">ALL IN</span>
      )}
      {phase === 'showdown' && player.handRank && !folded && (
        <span className="text-emerald-400 text-[8px] font-bold max-w-[72px] truncate text-center">
          {player.handRank}
        </span>
      )}

      {/* ── Cards BELOW avatar (only for bottom "You" seat) ── */}
      {isPlaying && player.holeCards.length > 0 && isBottomSeat && (
        <div className="flex gap-1 mt-0.5">
          {(isMe || (phase === 'showdown' && !folded))
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
    if (table.status === 'waiting' && table.phase === 'showdown'
      && table.players.length >= 2) {
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

  const callAmount = Math.max(
    0,
    Math.min(currentBet - (myPlayer?.bet || 0), myPlayer?.chips || 0)
  );
  const minRaise = Math.max(currentBet * 2, (table?.bigBlind || 20) * 2);
  const maxRaise = (myPlayer?.chips || 0) + (myPlayer?.bet || 0);

  useEffect(() => {
    if (minRaise > 0) setRaiseAmount(Math.min(minRaise, maxRaise));
  }, [currentBet, minRaise, maxRaise]);

  const showError = (m: string) => {
    setError(m);
    setTimeout(() => setError(''), 3000);
  };

  const handleAction = async (
    action: 'fold' | 'check' | 'call' | 'raise' | 'allin'
  ) => {
    if (!user || !tableId || actionLoading) return;
    if (action === 'raise') setShowRaise(false);
    setActionLoading(true);
    try {
      await pokerAction(
        tableId, user.uid, action,
        action === 'raise' ? raiseAmount : undefined
      );
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

  // Arrange: Me at displaySeat 0, others at 1-5
  const arrangedPlayers = (() => {
    if (!table) return [];
    const me = table.players.find(p => p.uid === user?.uid);
    const others = table.players.filter(p => p.uid !== user?.uid);
    const result: (PokerPlayer & { displaySeat: number })[] = [];
    if (me) result.push({ ...me, displaySeat: 0 });
    others.forEach((p, i) => result.push({ ...p, displaySeat: i + 1 }));
    return result;
  })();

  const showActions = isMyTurn
    && phase !== 'waiting'
    && phase !== 'showdown'
    && myPlayer?.status === 'active';

  if (loading) return (
    <div className="h-screen bg-[#0d1520] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
    </div>
  );

  if (!table) return (
    <div className="h-screen bg-[#0d1520] flex items-center justify-center text-white">
      <div className="text-center space-y-3">
        <p className="text-gray-300">Table not found</p>
        <button onClick={() => navigate('/games/poker')}
          className="text-yellow-400 text-sm underline">
          ← Back to Lobby
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{
        background:
          'linear-gradient(180deg,#1a0a2e 0%,#0d1a2e 50%,#080e1a 100%)',
      }}
    >
      {/* ══ TOP HEADER ══════════════════════════════════════ */}
      <div
        className="shrink-0 flex items-center justify-between px-3 py-2 z-40
          border-b border-white/5"
        style={{ background: 'rgba(10,8,25,0.97)' }}
      >
        {/* Exit button */}
        <button
          onClick={() => setShowLeave(true)}
          className="flex items-center gap-1.5 bg-red-900/30 border border-red-500/40
            text-red-400 text-xs font-bold px-3 py-2 rounded-lg
            active:scale-95 transition-transform"
        >
          <LogOut className="w-3.5 h-3.5" />
          Exit
        </button>

        {/* Pot amount center */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
          <span className="text-[9px] tracking-[2.5px] uppercase text-gray-400 font-semibold">
            Pot Amount
          </span>
          <span
            className="font-black text-yellow-400 text-xl leading-tight"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            ₹{formatCurrency(pot)}
          </span>
        </div>

        {/* Blind right */}
        <div className="flex flex-col items-end">
          <span className="text-[9px] tracking-[2px] uppercase text-gray-400 font-semibold">
            Blind
          </span>
          <span className="text-white font-bold text-sm">
            ₹{table.bigBlind || 20}
          </span>
        </div>
      </div>

      {/* Phase badge */}
      <div className="shrink-0 flex justify-center pt-1.5 pb-0.5 z-40">
        <span
          className={`
            text-[10px] font-black tracking-[2px] uppercase px-4 py-1 rounded-full
            ${phase === 'waiting'
              ? 'bg-gray-800/80 text-gray-400 border border-gray-600/30'
              : phase === 'showdown'
                ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-500/50'
                : 'bg-emerald-900/50 text-emerald-400 border border-emerald-600/40'}
          `}
        >
          {phase === 'waiting'
            ? `Waiting for players ${numPlayers}/2`
            : phase}
        </span>
      </div>

      {/* ══ TABLE AREA ══════════════════════════════════════ */}
      {/*
        Strategy:
        - A large wrapper div fills remaining space
        - Inside, we place a square "table zone" centered
        - The felt square sits inside with padding for seats
        - Player seats are absolutely positioned on the WRAPPER
          (outside the felt but inside the zone)
      */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden px-1">

        {/* Table zone: square container that holds felt + seats */}
        {/* We give it enough size so seats don't overflow screen */}
        <div
          className="relative"
          style={{
            width: 'min(88vw, 340px)',
            height: 'min(88vw, 340px)',
          }}
        >
          {/* ── Felt square (inset from wrapper to leave room for seats) ── */}
          <div
            className="absolute"
            style={{
              // inset 22% on all sides to leave room for seats
              top: '18%',
              left: '18%',
              right: '18%',
              bottom: '18%',
              borderRadius: '30%',
              // Wooden rim via box-shadow
              boxShadow:
                '0 0 0 5px #b8792a, 0 0 0 9px #7a4820, 0 20px 60px rgba(0,0,0,0.85)',
              background:
                'radial-gradient(ellipse at 50% 38%, #1a7a4a 0%, #0f6035 55%, #092d1a 100%)',
            }}
          >
            {/* Felt inner shadow */}
            <div
              className="absolute inset-0"
              style={{
                borderRadius: '30%',
                boxShadow: 'inset 0 0 40px rgba(0,0,0,0.55)',
              }}
            />

            {/* Spade watermark */}
            <div
              className="absolute inset-0 flex items-center justify-center
                text-white/[0.04] text-7xl pointer-events-none select-none"
            >
              ♠
            </div>

            {/* ── Center content: community cards + pot info ── */}
            <div
              className="absolute inset-0 flex flex-col items-center
                justify-center gap-1.5 px-2"
            >
              {/* Community cards */}
              {phase !== 'waiting' && (
                <div className="flex gap-0.5 justify-center">
                  {[...Array(5)].map((_, i) =>
                    table.communityCards[i] ? (
                      <CardDisplay
                        key={i}
                        card={table.communityCards[i]}
                        size="xs"
                        animate
                      />
                    ) : (
                      <div
                        key={i}
                        className="w-5 h-7 border border-white/15
                          bg-black/30 rounded"
                      />
                    )
                  )}
                </div>
              )}

              {/* Current bet */}
              {currentBet > 0 && phase !== 'waiting' && (
                <div
                  className="flex items-center gap-1 bg-black/60
                    border border-white/10 px-2 py-0.5 rounded-full"
                >
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                  <span className="text-white/60 text-[9px]">
                    Bet:{' '}
                    <span className="text-white font-bold">
                      ₹{formatCurrency(currentBet)}
                    </span>
                  </span>
                </div>
              )}

              {/* Waiting */}
              {phase === 'waiting' && numPlayers < 2 && (
                <div className="text-center">
                  <Loader2
                    className="w-5 h-5 text-white/30 animate-spin mx-auto mb-1"
                  />
                  <p className="text-white/30 text-[9px]">Waiting...</p>
                </div>
              )}

              {/* Showdown */}
              {phase === 'showdown' && (
                <p className="text-yellow-400 font-black text-[11px] animate-bounce">
                  🏆 Showdown!
                </p>
              )}
            </div>
          </div>

          {/* ── Player seats (absolutely on wrapper, outside felt) ── */}
          {arrangedPlayers.map(player => {
            const cfg = SEAT_CONFIGS[player.displaySeat] || SEAT_CONFIGS[0];
            return (
              <div
                key={player.uid}
                className={`absolute z-20 flex flex-col ${cfg.align} ${cfg.wrapperPos}`}
              >
                <PlayerSeat
                  player={player}
                  isMe={player.uid === user?.uid}
                  isActive={table.activePlayerUid === player.uid}
                  phase={phase}
                  displaySeat={player.displaySeat}
                />
              </div>
            );
          })}

          {/* Empty seat hints (waiting phase) */}
          {phase === 'waiting' &&
            [...Array(Math.max(0, 2 - numPlayers))].map((_, idx) => {
              const seatIdx = numPlayers + idx;
              const cfg = SEAT_CONFIGS[seatIdx];
              if (!cfg) return null;
              return (
                <div
                  key={`empty-${idx}`}
                  className={`absolute z-10 flex flex-col items-center gap-0.5 ${cfg.wrapperPos}`}
                >
                  <div
                    className="w-10 h-10 rounded-full border-2 border-dashed
                      border-white/20 bg-black/20 flex items-center justify-center"
                  >
                    <span className="text-white/20 text-xl font-light">+</span>
                  </div>
                  <span className="text-white/20 text-[9px]">Empty</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* ══ ERROR TOAST ══ */}
      {error && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 z-50
            bg-red-900/95 border border-red-500/50 text-red-300 text-xs
            font-medium px-4 py-2 rounded-lg whitespace-nowrap shadow-2xl"
        >
          ⚠️ {error}
        </div>
      )}

      {/* ══ BOTTOM ACTION PANEL ════════════════════════════ */}
      <div
        className="shrink-0 z-40 border-t border-white/5"
        style={{ background: 'rgba(8,10,20,0.98)' }}
      >

        {/* WAITING */}
        {phase === 'waiting' && (
          <div className="text-center py-4 px-4">
            {canStart ? (
              <button
                onClick={() => tableId && startPokerHand(tableId)}
                className="w-full max-w-xs mx-auto block bg-emerald-600
                  hover:bg-emerald-500 text-white font-black py-3.5 text-sm
                  rounded-xl active:scale-95 transition-all
                  shadow-lg shadow-emerald-900/40"
              >
                🎮 Start Game
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                <p className="text-gray-400 text-sm">
                  Need {2 - numPlayers} more player
                  {2 - numPlayers !== 1 ? 's' : ''} to start...
                </p>
              </div>
            )}
          </div>
        )}

        {/* MY TURN */}
        {showActions && (
          <div className="px-3 pt-2 pb-3 space-y-2 max-w-md mx-auto">

            {/* YOUR TURN label */}
            <div className="flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
              <span className="text-emerald-400 font-bold text-[11px]
                tracking-[2px] uppercase">
                Your Turn
              </span>
            </div>

            {/* Raise panel */}
            {showRaise && (myPlayer?.chips || 0) > callAmount && (
              <div
                className="bg-black/60 border border-white/10 rounded-xl
                  p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs font-semibold">
                    Raise Amount
                  </span>
                  <span className="text-yellow-400 font-black text-base">
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
                  className="w-full accent-yellow-400 h-1.5"
                />
                <div className="flex gap-2">
                  {[
                    { label: 'MIN', val: minRaise },
                    { label: '½ POT', val: Math.round(pot / 2 + (myPlayer?.bet || 0)) },
                    { label: 'POT', val: Math.min(pot + (myPlayer?.bet || 0), maxRaise) },
                    { label: 'MAX', val: maxRaise },
                  ].map(({ label, val }) => (
                    <button
                      key={label}
                      onClick={() => setRaiseAmount(Math.min(Math.max(val, minRaise), maxRaise))}
                      className="flex-1 bg-white/8 border border-white/10 text-yellow-400
                        text-[10px] font-bold py-1.5 rounded-lg active:scale-95"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-4 gap-1.5">

              {/* FOLD */}
              <button
                onClick={() => handleAction('fold')}
                disabled={actionLoading}
                className="flex flex-col items-center justify-center py-3
                  rounded-xl active:scale-95 transition-transform
                  disabled:opacity-40"
                style={{
                  background: 'linear-gradient(160deg,#7f1d1d,#991b1b)',
                  border: '1.5px solid rgba(239,68,68,0.4)',
                }}
              >
                <span className="text-white font-black text-xs">FOLD</span>
              </button>

              {/* CHECK or CALL */}
              {(myPlayer?.bet || 0) >= currentBet ? (
                <button
                  onClick={() => handleAction('check')}
                  disabled={actionLoading}
                  className="flex flex-col items-center justify-center py-3
                    rounded-xl active:scale-95 transition-transform
                    disabled:opacity-40"
                  style={{
                    background: 'linear-gradient(160deg,#78350f,#92400e)',
                    border: '1.5px solid rgba(234,179,8,0.4)',
                  }}
                >
                  <span className="text-white font-black text-xs">CHECK</span>
                </button>
              ) : (
                <button
                  onClick={() => handleAction('call')}
                  disabled={actionLoading || callAmount === 0}
                  className="flex flex-col items-center justify-center py-2
                    rounded-xl active:scale-95 transition-transform
                    disabled:opacity-40"
                  style={{
                    background: 'linear-gradient(160deg,#14532d,#166534)',
                    border: '1.5px solid rgba(34,197,94,0.4)',
                  }}
                >
                  <span className="text-white font-black text-xs">CALL</span>
                  <span className="text-green-300 text-[10px]">
                    ₹{formatCurrency(callAmount)}
                  </span>
                </button>
              )}

              {/* RAISE */}
              <button
                onClick={() => {
                  if (showRaise) handleAction('raise');
                  else setShowRaise(true);
                }}
                disabled={
                  actionLoading
                  || (myPlayer?.chips || 0) <= callAmount
                  || raiseAmount < minRaise
                }
                className="flex flex-col items-center justify-center py-2
                  rounded-xl active:scale-95 transition-transform
                  disabled:opacity-40"
                style={{
                  background: showRaise
                    ? 'linear-gradient(160deg,#5b21b6,#7c3aed)'
                    : 'linear-gradient(160deg,#3b0764,#4c1d95)',
                  border: `1.5px solid rgba(139,92,246,${showRaise ? 0.7 : 0.4})`,
                }}
              >
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
                className="flex flex-col items-center justify-center py-2
                  rounded-xl active:scale-95 transition-transform
                  disabled:opacity-40"
                style={{
                  background: 'linear-gradient(160deg,#7c2d12,#c2410c)',
                  border: '1.5px solid rgba(249,115,22,0.45)',
                }}
              >
                <span className="text-white font-black text-[11px]">
                  ALL IN
                </span>
                <span className="text-orange-300 text-[10px]">
                  ₹{formatCurrency(myPlayer?.chips || 0)}
                </span>
              </button>
            </div>

            {/* Cancel raise */}
            {showRaise && (
              <button
                onClick={() => setShowRaise(false)}
                className="w-full text-gray-500 text-xs py-1 text-center
                  active:text-gray-300 transition-colors"
              >
                Cancel ✕
              </button>
            )}
          </div>
        )}

        {/* NOT MY TURN */}
        {!isMyTurn
          && phase !== 'waiting'
          && phase !== 'showdown'
          && myPlayer?.status === 'active' && (
          <div className="flex items-center justify-center gap-2 py-4 px-4">
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-ping" />
            <p className="text-gray-400 text-sm">
              <span className="text-yellow-400 font-semibold">
                {table.players.find(p => p.uid === table.activePlayerUid)?.name
                  || 'Player'}
              </span>{' '}
              is deciding...
            </p>
          </div>
        )}

        {/* FOLDED */}
        {myPlayer?.status === 'folded' && phase !== 'showdown' && (
          <p className="text-center text-red-400/70 text-sm py-4">
            You folded — watching the hand...
          </p>
        )}

        {/* ALL IN */}
        {myPlayer?.status === 'allin' && phase !== 'showdown' && (
          <p className="text-center text-yellow-400 font-black text-sm
            animate-pulse py-4">
            ALL IN 🎯 — Waiting for showdown...
          </p>
        )}

        {/* SHOWDOWN */}
        {phase === 'showdown' && (
          <div className="text-center py-3 px-4">
            {myPlayer && myPlayer.chips <= 0 ? (
              <div
                className="bg-red-900/40 border border-red-500/30 px-4 py-3
                  rounded-xl inline-block"
              >
                <p className="text-red-400 font-bold text-sm">
                  💸 Out of chips!
                </p>
                <p className="text-gray-400 text-xs">Returning to lobby...</p>
              </div>
            ) : (
              <p className="text-gray-400 text-sm flex items-center
                justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
                Next hand in 4s...
              </p>
            )}
          </div>
        )}
      </div>

      {/* ══ LEAVE MODAL (bottom sheet) ══ */}
      {showLeave && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md flex
            items-end justify-center z-[100]"
          onClick={() => setShowLeave(false)}
        >
          <div
            className="bg-[#0d1520] border border-white/10 p-6 w-full
              max-w-sm text-center rounded-t-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
            <LogOut className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <h3
              className="text-white font-black text-lg mb-1"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Leave Table?
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Your chips will be returned to your wallet.
            </p>
            {(myPlayer?.chips || 0) > 0 && (
              <div
                className="bg-emerald-900/30 border border-emerald-500/30
                  rounded-xl py-3 mb-5"
              >
                <p className="text-gray-400 text-xs mb-0.5">
                  You'll receive
                </p>
                <p className="text-emerald-400 font-black text-2xl">
                  +₹{formatCurrency(myPlayer!.chips)}
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeave(false)}
                className="flex-1 bg-white/8 border border-white/12 text-white
                  font-bold py-3.5 text-sm rounded-xl"
              >
                Stay
              </button>
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="flex-1 bg-red-600 text-white font-bold py-3.5
                  text-sm rounded-xl flex items-center justify-center gap-2
                  disabled:opacity-50"
              >
                {leaving
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PokerGamePage;
