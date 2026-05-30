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
  Loader2,
  Play,
  LogOut,
  AlertCircle,
  Trophy,
  Users,
  Wifi,
} from 'lucide-react';

// ── Seat positions ────────────────────────────────────────
const SEAT_POS: Record<number, string> = {
  0: 'bottom-2 left-1/2 -translate-x-1/2',
  1: 'bottom-[28%] right-1 md:right-4',
  2: 'top-[18%] right-1 md:right-4',
  3: 'top-2 left-1/2 -translate-x-1/2',
  4: 'top-[18%] left-1 md:left-4',
  5: 'bottom-[28%] left-1 md:left-4',
};

// ── Player Seat ────────────────────────────────────────────
const PlayerSeat: React.FC<{
  player: PokerPlayer;
  isMe: boolean;
  isActive: boolean;
  phase: string;
}> = ({ player, isMe, isActive, phase }) => {
  const playing = phase !== 'waiting';
  const folded = player.status === 'folded';
  const broke = player.chips === 0 && player.status !== 'allin';

  return (
    <div
      className={`
      relative flex flex-col items-center gap-0.5
      bg-gray-900/95 backdrop-blur-sm border-2 rounded-xl
      px-1.5 py-2 w-[70px] sm:w-[85px] md:w-[110px]
      transition-all duration-300 select-none
      ${
        isActive && playing
          ? 'border-yellow-400 shadow-lg shadow-yellow-400/30 scale-105 z-20'
          : isMe
          ? 'border-purple-500/70'
          : 'border-gray-700/60'
      }
      ${folded || broke ? 'opacity-40' : ''}
    `}
    >
      {isActive && playing && (
        <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
          <span className="animate-ping absolute h-full w-full rounded-full bg-yellow-400 opacity-75" />
          <span className="relative rounded-full h-3 w-3 bg-yellow-400" />
        </span>
      )}

      <div
        className={`w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center
        text-xs font-black flex-shrink-0
        ${
          isMe
            ? 'bg-gradient-to-br from-purple-500 to-blue-600 text-white'
            : 'bg-gray-700 text-white'
        }`}
      >
        {player.name.charAt(0).toUpperCase()}
      </div>

      <p className="text-white text-[9px] md:text-[11px] font-bold truncate w-full text-center">
        {isMe ? 'You' : player.name}
      </p>

      <p
        className={`text-[9px] md:text-[11px] font-bold ${
          broke ? 'text-red-400' : 'text-yellow-400'
        }`}
      >
        {broke ? 'BUST' : formatCurrency(player.chips)}
      </p>

      {player.isDealer && (
        <span className="absolute -bottom-2 -left-2 bg-white text-gray-900 text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-md">
          D
        </span>
      )}

      {playing && (
        <div
          className="flex gap-0.5 justify-center mt-0.5"
          style={{ minHeight: '32px' }}
        >
          {player.holeCards.length > 0
            ? isMe || (phase === 'showdown' && !folded)
              ? player.holeCards.map((c, i) => (
                  <CardDisplay key={i} card={c} size="xs" animate />
                ))
              : player.holeCards.map((_, i) => (
                  <CardDisplay key={i} faceDown size="xs" />
                ))
            : null}
        </div>
      )}

      <div className="h-4 flex items-center justify-center">
        {player.status === 'folded' && (
          <span className="text-red-500 text-[8px] font-black">FOLD</span>
        )}
        {player.status === 'allin' && (
          <span className="text-yellow-400 text-[8px] font-black animate-pulse">
            ALL IN
          </span>
        )}
        {player.bet > 0 && player.status === 'active' && (
          <span className="text-gray-400 text-[8px]">₹{player.bet}</span>
        )}
        {phase === 'showdown' && player.handRank && !folded && (
          <span className="text-yellow-400 text-[7px] font-bold truncate max-w-[65px]">
            {player.handRank}
          </span>
        )}
      </div>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────
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

  // ── Subscribe ─────────────────────────────────────────
  useEffect(() => {
    if (!tableId) return;
    return subscribePokerTable(tableId, (data) => {
      setTable(data);
      setLoading(false);

      // Broke player banner
      const broke = (data as any).lastBrokePlayers as
        | Array<{ uid: string; name: string }>
        | undefined;
      if (broke && broke.length > 0) {
        setBrokeBanner(broke.map((p) => p.name));
        setTimeout(() => setBrokeBanner([]), 5000);
      }
    });
  }, [tableId]);

  // ── Auto-start on 2nd player join ──────────────────────
  useEffect(() => {
    if (!table || !tableId) return;
    const num = table.players.length;

    if (
      num >= 2 &&
      prevPlayerCount.current < 2 &&
      table.status === 'waiting' &&
      table.phase === 'waiting' &&
      !autoStartTriggered.current
    ) {
      autoStartTriggered.current = true;
      const timer = setTimeout(async () => {
        try {
          await checkAndAutoStart(tableId);
        } catch (e) {
          console.error('Auto-start failed:', e);
        }
        autoStartTriggered.current = false;
      }, 2000);
      return () => clearTimeout(timer);
    }

    if (table.status === 'waiting' && num >= 2) {
      autoStartTriggered.current = false;
    }

    prevPlayerCount.current = num;
  }, [table?.players.length, table?.status, table?.phase, tableId]);

  // ── Auto-leave if broke ────────────────────────────────
  useEffect(() => {
    if (!table || !user || !tableId) return;
    const me = table.players.find((p) => p.uid === user.uid);

    if (!me && table.phase === 'showdown') {
      const t = setTimeout(() => navigate('/games/poker'), 3000);
      return () => clearTimeout(t);
    }

    if (me && me.chips <= 0 && table.phase === 'showdown') {
      const t = setTimeout(async () => {
        try {
          await leavePokerTable(tableId, user.uid);
        } catch (_) {}
        navigate('/games/poker');
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [table?.phase, table?.players, user, tableId, navigate]);

  // ── Auto-start next hand ───────────────────────────────
  useEffect(() => {
    if (!table || !tableId) return;
    if (
      table.status === 'waiting' &&
      table.phase === 'showdown' &&
      table.players.length >= 2
    ) {
      const t = setTimeout(async () => {
        try {
          await startPokerHand(tableId);
        } catch (e) {
          console.error('Auto next hand failed:', e);
        }
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [table?.phase, table?.status, table?.players.length, tableId]);

  // ── Derived state ──────────────────────────────────────
  const myPlayer = table?.players.find((p) => p.uid === user?.uid);
  const isMyTurn = table?.activePlayerUid === user?.uid;
  const phase = table?.phase || 'waiting';
  const pot = table?.pot || 0;
  const currentBet = table?.currentBet || 0;
  const numPlayers = table?.players.length || 0;
  const canStart =
    numPlayers >= 2 && table?.status === 'waiting' && phase === 'waiting';

  const callAmount = Math.max(
    0,
    Math.min(currentBet - (myPlayer?.bet || 0), myPlayer?.chips || 0)
  );
  const minRaise = Math.max(currentBet * 2, (table?.bigBlind || 20) * 2);
  const maxRaise = (myPlayer?.chips || 0) + (myPlayer?.bet || 0);

  useEffect(() => {
    if (minRaise > 0) setRaiseAmount(Math.min(minRaise, maxRaise));
  }, [currentBet, minRaise, maxRaise]);

  const showErr = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 3000);
  };

  const handleAction = async (
    act: 'fold' | 'check' | 'call' | 'raise' | 'allin'
  ) => {
    if (!user || !tableId || actionLoading) return;
    setActionLoading(true);
    try {
      await pokerAction(
        tableId,
        user.uid,
        act,
        act === 'raise' ? raiseAmount : undefined
      );
    } catch (e: any) {
      showErr(e.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async () => {
    if (!tableId || starting) return;
    setStarting(true);
    try {
      await startPokerHand(tableId);
    } catch (e: any) {
      showErr(e.message || 'Start failed');
    } finally {
      setStarting(false);
    }
  };

  const handleLeave = async () => {
    if (!user || !tableId || leaving) return;
    setLeaving(true);
    try {
      await leavePokerTable(tableId, user.uid);
      navigate('/games/poker');
    } catch (e: any) {
      showErr(e.message || 'Leave failed');
      setLeaving(false);
    }
  };

  const phaseLabel: Record<string, string> = {
    waiting: '⏳ Waiting',
    preflop: '🃏 Pre-Flop',
    flop: '🃏 Flop',
    turn: '🃏 Turn',
    river: '🃏 River',
    showdown: '🏆 Showdown',
  };

  // ── Loading / Not found ────────────────────────────────
  if (loading)
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
      </div>
    );

  if (!table)
    return (
      <div className="h-screen bg-gray-950 flex flex-col items-center justify-center text-white gap-4">
        <p className="text-lg">Table not found</p>
        <button
          onClick={() => navigate('/games/poker')}
          className="text-purple-400 hover:text-purple-300"
        >
          ← Back to Lobby
        </button>
      </div>
    );

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* ══ HEADER ════════════════════════════════════════ */}
      <div className="shrink-0 bg-gray-900 border-b border-gray-800 px-3 py-2 flex items-center gap-2 z-40">
        <button
          onClick={() => setShowLeave(true)}
          className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30
            text-red-400 hover:bg-red-500/20 px-2.5 py-1.5 rounded-xl text-xs font-bold
            transition-all flex-shrink-0 active:scale-95"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Leave</span>
        </button>

        <div className="flex-1 min-w-0 text-center">
          <p className="text-white font-bold text-sm truncate">{table.name}</p>
          <p className="text-[10px] text-gray-500">
            SB/BB: {table.smallBlind}/{table.bigBlind} ·{' '}
            <span
              className={`font-semibold ${
                phase === 'showdown'
                  ? 'text-yellow-400'
                  : phase === 'waiting'
                  ? 'text-blue-400'
                  : 'text-purple-400'
              }`}
            >
              {phaseLabel[phase]}
            </span>
          </p>
        </div>

        <div className="flex-shrink-0 text-right">
          <p className="text-[10px] text-gray-500">Chips</p>
          <p className="text-yellow-400 font-bold text-sm">
            {formatCurrency(myPlayer?.chips || 0)}
          </p>
        </div>

        <div className="flex items-center gap-1 bg-gray-800 rounded-xl px-2 py-1.5 flex-shrink-0">
          <Users className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-gray-300 font-bold">{numPlayers}/6</span>
        </div>
      </div>

      {/* ══ BROKE BANNER ══════════════════════════════════ */}
      {brokeBanner.length > 0 && (
        <div className="shrink-0 bg-red-900/80 border-b border-red-700/50 px-4 py-2 text-center z-40">
          <p className="text-red-300 text-xs font-bold">
            💸 {brokeBanner.join(', ')} ran out of chips!
          </p>
        </div>
      )}

      {/* ══ TABLE ═════════════════════════════════════════ */}
      <div className="flex-1 relative flex items-center justify-center bg-[#080e08] overflow-hidden p-2 md:p-6">
        {/* Waiting overlay */}
        {phase === 'waiting' && numPlayers < 2 && (
          <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/40 backdrop-blur-[2px]">
            <div className="text-center bg-gray-900/95 border border-gray-700 rounded-2xl p-6 mx-4">
              <Wifi className="w-8 h-8 text-blue-400 animate-pulse mx-auto mb-3" />
              <p className="text-white font-bold text-sm mb-1">
                Waiting for players...
              </p>
              <p className="text-gray-400 text-xs">{numPlayers}/2 joined</p>
              <p className="text-blue-400 text-xs mt-2 font-semibold">
                Auto-starts when 2 players join!
              </p>
            </div>
          </div>
        )}

        {/* Starting notice */}
        {phase === 'waiting' && numPlayers >= 2 && table.status === 'waiting' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-emerald-900/90 border border-emerald-500/50 rounded-full px-4 py-1.5 flex items-center gap-2">
            <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />
            <span className="text-emerald-400 text-xs font-bold">
              Starting soon...
            </span>
          </div>
        )}

        {/* Oval Table */}
        <div
          className="relative w-full h-full max-w-3xl"
          style={{ maxHeight: 'min(60vw, 400px)' }}
        >
          {/* Rim */}
          <div className="absolute inset-0 rounded-[50%] bg-gradient-to-br from-yellow-800 via-amber-900 to-yellow-950 shadow-[0_0_40px_rgba(0,0,0,0.8)]" />

          {/* Felt */}
          <div className="absolute inset-[6px] md:inset-[10px] rounded-[50%] bg-gradient-to-br from-emerald-800 via-green-700 to-emerald-900">
            <div className="absolute inset-[8px] rounded-[50%] border border-yellow-600/10" />

            {/* Center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 md:gap-2 p-8 md:p-12">
              {pot > 0 && (
                <div className="bg-black/60 border border-yellow-500/30 rounded-full px-3 py-1">
                  <span className="text-yellow-400 font-black text-xs md:text-sm">
                    💰 {formatCurrency(pot)}
                  </span>
                </div>
              )}

              {phase !== 'waiting' && (
                <div className="flex gap-1 md:gap-1.5 justify-center">
                  {[...Array(5)].map((_, i) =>
                    table.communityCards[i] ? (
                      <CardDisplay
                        key={i}
                        card={table.communityCards[i]}
                        size="sm"
                        animate
                      />
                    ) : (
                      <div
                        key={i}
                        className="w-7 h-10 md:w-9 md:h-12 rounded-lg border-2 border-dashed border-emerald-700/30 bg-emerald-950/20"
                      />
                    )
                  )}
                </div>
              )}

              {currentBet > 0 && phase !== 'waiting' && (
                <div className="bg-black/40 rounded-lg px-2 py-0.5">
                  <span className="text-white/50 text-[10px]">
                    Bet:{' '}
                    <span className="text-white font-bold">
                      {formatCurrency(currentBet)}
                    </span>
                  </span>
                </div>
              )}

              {phase === 'showdown' && (
                <div className="flex items-center gap-1 text-yellow-400">
                  <Trophy className="w-3.5 h-3.5" />
                  <span className="font-black text-xs md:text-sm">
                    Showdown!
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Player Seats */}
          {table.players.map((player) => (
            <div
              key={player.uid}
              className={`absolute z-10 ${
                SEAT_POS[player.seatIndex] || SEAT_POS[0]
              }`}
            >
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

      {/* ══ BOTTOM CONTROLS ═══════════════════════════════ */}
      <div className="shrink-0 bg-gray-900 border-t border-gray-800 px-3 py-3 z-40">
        <div className="max-w-xl mx-auto space-y-2">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* WAITING */}
          {phase === 'waiting' && canStart && (
            <div className="text-center">
              <button
                onClick={handleStart}
                disabled={starting}
                className="flex items-center gap-2 mx-auto bg-gradient-to-r from-emerald-600 to-green-600 text-white font-black px-6 py-2.5 rounded-xl disabled:opacity-50 transition-all active:scale-95 text-sm"
              >
                {starting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Force Start ({numPlayers})
              </button>
              <p className="text-gray-600 text-[10px] mt-1">
                Auto-starts shortly
              </p>
            </div>
          )}

          {phase === 'waiting' && !canStart && numPlayers < 2 && (
            <p className="text-center text-gray-500 text-sm py-1">
              Waiting for players... ({numPlayers}/2)
            </p>
          )}

          {/* MY TURN */}
          {isMyTurn &&
            phase !== 'waiting' &&
            phase !== 'showdown' &&
            myPlayer?.status === 'active' && (
              <div className="space-y-2">
                {(myPlayer?.chips || 0) > 0 && maxRaise > minRaise && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-[10px] w-10">
                      Raise
                    </span>
                    <input
                      type="range"
                      min={minRaise}
                      max={maxRaise}
                      step={table.bigBlind || 10}
                      value={Math.min(raiseAmount, maxRaise)}
                      onChange={(e) => setRaiseAmount(Number(e.target.value))}
                      className="flex-1 accent-purple-500 h-1.5"
                    />
                    <span className="text-yellow-400 text-xs font-bold w-14 text-right">
                      {formatCurrency(Math.min(raiseAmount, maxRaise))}
                    </span>
                  </div>
                )}

                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleAction('fold')}
                    disabled={actionLoading}
                    className="flex-1 bg-red-900/60 border border-red-700/50 text-white font-bold py-3 rounded-xl text-xs disabled:opacity-40 active:scale-95"
                  >
                    Fold
                  </button>

                  {(myPlayer?.bet || 0) >= currentBet && (
                    <button
                      onClick={() => handleAction('check')}
                      disabled={actionLoading}
                      className="flex-1 bg-blue-900/60 border border-blue-700/50 text-white font-bold py-3 rounded-xl text-xs disabled:opacity-40 active:scale-95"
                    >
                      Check
                    </button>
                  )}

                  {(myPlayer?.bet || 0) < currentBet && callAmount > 0 && (
                    <button
                      onClick={() => handleAction('call')}
                      disabled={actionLoading}
                      className="flex-1 bg-emerald-900/60 border border-emerald-700/50 text-white font-bold py-3 rounded-xl text-xs disabled:opacity-40 active:scale-95 flex flex-col items-center"
                    >
                      <span>Call</span>
                      <span className="text-[9px] opacity-60">
                        {formatCurrency(callAmount)}
                      </span>
                    </button>
                  )}

                  {(myPlayer?.chips || 0) > callAmount && (
                    <button
                      onClick={() => handleAction('raise')}
                      disabled={
                        actionLoading ||
                        raiseAmount < minRaise ||
                        raiseAmount > maxRaise
                      }
                      className="flex-1 bg-purple-900/60 border border-purple-700/50 text-white font-bold py-3 rounded-xl text-xs disabled:opacity-40 active:scale-95 flex flex-col items-center"
                    >
                      <span>Raise</span>
                      <span className="text-[9px] opacity-60">
                        {formatCurrency(Math.min(raiseAmount, maxRaise))}
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => handleAction('allin')}
                    disabled={actionLoading || (myPlayer?.chips || 0) === 0}
                    className="flex-1 bg-yellow-700/60 border border-yellow-600/50 text-white font-black py-3 rounded-xl text-xs disabled:opacity-40 active:scale-95"
                  >
                    All In
                    <br />
                    <span className="text-[9px] opacity-70 font-bold">
                      {formatCurrency(myPlayer?.chips || 0)}
                    </span>
                  </button>
                </div>

                {actionLoading && (
                  <div className="flex justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  </div>
                )}
              </div>
            )}

          {/* NOT MY TURN */}
          {!isMyTurn &&
            phase !== 'waiting' &&
            phase !== 'showdown' &&
            myPlayer?.status === 'active' && (
              <div className="flex items-center justify-center gap-2 py-1">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-ping" />
                <span className="text-gray-400 text-sm">
                  {table.players.find(
                    (p) => p.uid === table.activePlayerUid
                  )?.name || 'Player'}
                  's turn...
                </span>
              </div>
            )}

          {/* FOLDED */}
          {myPlayer?.status === 'folded' && phase !== 'showdown' && (
            <p className="text-center text-red-400/60 text-sm py-1">
              You folded — watching...
            </p>
          )}

          {/* ALL IN */}
          {myPlayer?.status === 'allin' && phase !== 'showdown' && (
            <p className="text-center text-yellow-400 font-black text-sm animate-pulse py-1">
              ALL IN 🎯 — Waiting for showdown...
            </p>
          )}

          {/* SHOWDOWN */}
          {phase === 'showdown' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 justify-center">
                {table.players
                  .filter((p) => p.status !== 'folded' && p.handRank)
                  .map((p) => (
                    <div
                      key={p.uid}
                      className={`rounded-xl px-3 py-2 border text-center ${
                        p.uid === user?.uid
                          ? 'bg-purple-500/10 border-purple-500/40'
                          : 'bg-gray-800 border-gray-700'
                      }`}
                    >
                      <p className="text-white font-bold text-xs">
                        {p.uid === user?.uid ? 'You' : p.name}
                      </p>
                      <p className="text-yellow-400 text-xs">{p.handRank}</p>
                    </div>
                  ))}
              </div>

              {myPlayer && myPlayer.chips <= 0 && (
                <div className="bg-red-900/40 border border-red-500/30 rounded-xl px-4 py-3 text-center">
                  <p className="text-red-400 font-bold text-sm">
                    💸 You ran out of chips!
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Leaving table in 3s...
                  </p>
                </div>
              )}

              {table.players.length >= 2 &&
                (!myPlayer || myPlayer.chips > 0) && (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                    <span className="text-gray-400 text-xs">
                      Next hand starting in 4s...
                    </span>
                  </div>
                )}
            </div>
          )}

          {!myPlayer && phase !== 'waiting' && (
            <p className="text-center text-gray-600 text-xs py-1">
              Spectating — waiting for next hand
            </p>
          )}
        </div>
      </div>

      {/* ══ LEAVE MODAL ═══════════════════════════════════ */}
      {showLeave && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] px-4 pb-4 sm:pb-0">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl">
            <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5 sm:hidden" />
            <LogOut className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h3 className="text-white font-black text-lg mb-1">
              Leave Table?
            </h3>
            <p className="text-gray-400 text-sm mb-3">
              Remaining chips returned to wallet.
            </p>
            {(myPlayer?.chips || 0) > 0 && (
              <p className="text-emerald-400 font-black text-2xl mb-5">
                +{formatCurrency(myPlayer!.chips)}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeave(false)}
                className="flex-1 bg-gray-800 border border-gray-700 text-white font-bold py-3 rounded-2xl hover:bg-gray-700 text-sm"
              >
                Stay
              </button>
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="flex-1 bg-red-600 text-white font-bold py-3 rounded-2xl hover:bg-red-500 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
              >
                {leaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Leave'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PokerGamePage;
