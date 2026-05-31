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

// ── Seat positions for square table (6 max, % based) ─────────
// Adjusted for square shape with 20% border-radius
const SEAT_POS: Record<number, string> = {
  0: 'bottom-[3%] left-1/2 -translate-x-1/2',         // You (bottom center)
  1: 'top-[42%] right-[2%] -translate-y-1/2',         // right middle
  2: 'top-[12%] right-[6%]',                           // top right
  3: 'top-[3%] left-1/2 -translate-x-1/2',            // top center
  4: 'top-[12%] left-[6%]',                            // top left
  5: 'top-[42%] left-[2%] -translate-y-1/2',           // left middle
};

// ── Player Seat Component ─────────────────────────────────────
const PlayerSeat: React.FC<{
  player: PokerPlayer;
  isMe: boolean;
  isActive: boolean;
  phase: string;
}> = ({ player, isMe, isActive, phase }) => {
  const isPlaying = phase !== 'waiting';
  const folded = player.status === 'folded';

  return (
    <div className={`flex flex-col items-center gap-0.5 ${folded ? 'opacity-40' : ''}`}>

      {/* Hole cards above avatar */}
      {isPlaying && player.holeCards.length > 0 && (
        <div className="flex gap-0.5 mb-[-6px] z-10 relative">
          {(isMe || (phase === 'showdown' && !folded))
            ? player.holeCards.map((c, i) => <CardDisplay key={i} card={c} size="xs" animate />)
            : player.holeCards.map((_, i) => <CardDisplay key={i} faceDown size="xs" />)}
        </div>
      )}

      {/* Avatar */}
      <div className="relative">
        <div className={`
          rounded-full flex items-center justify-center font-black border-[3px] transition-all
          ${isMe ? 'w-14 h-14 md:w-16 md:h-16' : 'w-11 h-11 md:w-13 md:h-13'}
          ${isActive && isPlaying
            ? 'border-yellow-400 shadow-[0_0_0_2px_#e8b84b,0_0_16px_rgba(232,184,75,0.6)]'
            : isMe ? 'border-purple-500' : 'border-gray-600'}
          ${isMe
            ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white text-xl'
            : 'bg-gradient-to-br from-gray-700 to-gray-800 text-white text-base'}`}>
          {player.name.charAt(0).toUpperCase()}
        </div>

        {/* Dealer button */}
        {player.isDealer && (
          <span className="absolute -bottom-1 -right-1 bg-white text-gray-900
            text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center
            shadow-md border border-gray-300 z-10">D</span>
        )}
      </div>

      {/* Name + Chips plate */}
      <div className={`
        px-2 py-0.5 border text-center
        ${isMe ? 'min-w-[80px] md:min-w-[88px]' : 'min-w-[64px] md:min-w-[72px]'}
        ${isActive && isPlaying
          ? 'bg-yellow-950/90 border-yellow-500/50'
          : isMe
            ? 'bg-[#140a28]/95 border-purple-500/40'
            : 'bg-gray-900/92 border-white/10'}
      `} style={{ borderRadius: '3px' }}>
        <p className={`text-[10px] md:text-[11px] font-semibold truncate leading-tight
          ${isMe ? 'text-purple-300' : 'text-white'}`}>
          {isMe ? 'You' : player.name}
        </p>
        <p className="text-yellow-400 text-[10px] md:text-[11px] font-semibold leading-tight flex items-center justify-center gap-0.5">
          <span className="w-2 h-2 bg-yellow-400 rounded-full inline-block" />
          {formatCurrency(player.chips)}
        </p>
      </div>

      {/* Bet / status badge */}
      <div className="h-4 flex items-center justify-center">
        {player.bet > 0 && (
          <span className="bg-black/70 text-yellow-400 text-[9px] font-bold
            px-1.5 py-0.5 border border-yellow-500/30" style={{ borderRadius: '3px' }}>
            ₹{player.bet}
          </span>
        )}
        {folded && <span className="text-red-500 text-[9px] font-black">FOLD</span>}
        {player.status === 'allin' && (
          <span className="text-yellow-400 text-[9px] font-black animate-pulse">ALL IN</span>
        )}
        {phase === 'showdown' && player.handRank && !folded && (
          <span className="text-emerald-400 text-[8px] font-bold truncate max-w-[72px]">
            {player.handRank}
          </span>
        )}
      </div>
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
    setRaiseAmount(prev => Math.max(minRaise, Math.min(prev + delta, maxRaise)));
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
        <button onClick={() => navigate('/games/poker')} className="text-yellow-400 text-sm">
          ← Back
        </button>
      </div>
    </div>
  );

  const showActions = isMyTurn && phase !== 'waiting' && phase !== 'showdown'
    && myPlayer?.status === 'active';

  return (
    <div className="fixed inset-0 flex flex-col bg-[#050f08] text-white overflow-hidden select-none">

      {/* ══ HEADER ══════════════════════════════════════════ */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2.5 z-40
        bg-[rgba(5,15,10,0.97)] border-b border-yellow-700/15 relative">

        {/* Jackpot pill */}
        <div className="flex flex-col items-start bg-yellow-400/8 border border-yellow-400/25 px-3 py-1.5"
          style={{ borderRadius: '4px' }}>
          <span className="text-[9px] font-semibold tracking-widest uppercase text-yellow-600">
            Jackpot
          </span>
          <span className="font-bold text-yellow-400 text-[15px] leading-tight"
            style={{ fontFamily: 'Georgia, serif' }}>
            <span className="inline-block w-2.5 h-2.5 bg-yellow-400 rounded-full mr-1 align-middle" />
            {formatCurrency(table.jackpot || 25000)}
          </span>
        </div>

        {/* Center: table name + phase */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
          <span className="text-[10px] tracking-[2px] uppercase text-gray-400 font-medium">
            Royal Table
          </span>
          <span className="text-[11px] font-semibold text-yellow-400 tracking-wide capitalize">
            {phase === 'waiting' ? 'Waiting' : phase}
          </span>
        </div>

        {/* EXIT button */}
        <button
          onClick={() => setShowLeave(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-red-400 text-xs font-semibold
            tracking-wider uppercase border border-red-500/35 bg-red-900/15 active:scale-95
            transition-transform"
          style={{ borderRadius: '4px' }}>
          EXIT <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ══ TABLE AREA ══════════════════════════════════════ */}
      <div className="flex-1 relative flex items-center justify-center px-3 overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at center, #0a1a10 0%, #050f08 100%)' }}>

        {/* Waiting overlay */}
        {phase === 'waiting' && numPlayers < 2 && (
          <div className="absolute inset-0 flex items-center justify-center z-30">
            <div className="text-center bg-gray-900/95 border border-gray-700 p-6 mx-4"
              style={{ borderRadius: '6px' }}>
              <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mx-auto mb-3" />
              <p className="text-white font-bold text-sm">Waiting for players...</p>
              <p className="text-gray-400 text-xs mt-1">{numPlayers}/2 joined</p>
              <p className="text-yellow-400 text-xs mt-2 font-semibold">
                Auto-starts when 2 players join!
              </p>
            </div>
          </div>
        )}

        {/* ── Square Table (20% border-radius) ── */}
        <div className="relative w-full max-w-[400px] mx-auto"
          style={{ height: 'min(72vh, 520px)', aspectRatio: '0.72' }}>

          {/* Wooden rim */}
          <div className="absolute inset-0 shadow-[0_14px_44px_rgba(0,0,0,0.8)]"
            style={{
              borderRadius: '20%',
              background: 'linear-gradient(145deg, #8a4f18 0%, #5c3410 40%, #3d2008 100%)',
              boxShadow: '0 0 0 3px #9B6A2B, inset 0 0 20px rgba(0,0,0,0.5), 0 14px 44px rgba(0,0,0,0.8)',
            }} />

          {/* Felt surface */}
          <div className="absolute inset-[13px] overflow-hidden"
            style={{
              borderRadius: '20%',
              background: 'radial-gradient(ellipse at 50% 38%, #1a7a4a 0%, #0f6035 55%, #092d1a 100%)',
              boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5)',
            }}>

            {/* Spade watermark */}
            <div className="absolute inset-0 flex items-center justify-center
              text-white/[0.04] text-[110px] pointer-events-none select-none">
              ♠
            </div>

            {/* Center: Pot + Community Cards */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
              flex flex-col items-center gap-2 w-full px-4">

              {pot > 0 && (
                <div className="flex items-center gap-1.5 bg-black/55 border border-yellow-400/30
                  px-4 py-1" style={{ borderRadius: '3px' }}>
                  <span className="text-[9px] font-semibold tracking-[2px] uppercase text-yellow-600">
                    POT
                  </span>
                  <span className="font-bold text-yellow-400 text-sm"
                    style={{ fontFamily: 'Georgia, serif' }}>
                    {formatCurrency(pot)}
                  </span>
                </div>
              )}

              {phase !== 'waiting' && (
                <div className="flex gap-1 md:gap-1.5 justify-center">
                  {[...Array(5)].map((_, i) => (
                    table.communityCards[i]
                      ? <CardDisplay key={i} card={table.communityCards[i]} size="sm" animate />
                      : <div key={i} className="w-7 h-10 md:w-9 md:h-12 border border-white/10
                          bg-black/20" style={{ borderRadius: '3px' }} />
                  ))}
                </div>
              )}

              {currentBet > 0 && phase !== 'waiting' && (
                <div className="bg-black/40 px-2 py-0.5" style={{ borderRadius: '3px' }}>
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
          px-4 py-2 whitespace-nowrap" style={{ borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {/* ══ BOTTOM ACTION AREA ════════════════════════════ */}
      <div className="shrink-0 bg-[rgba(5,12,8,0.98)] border-t border-yellow-700/12
        pt-3 pb-4 px-3 z-40">

        {/* WAITING */}
        {phase === 'waiting' && (
          <div className="text-center py-3">
            {canStart ? (
              <button onClick={() => tableId && startPokerHand(tableId)}
                className="bg-emerald-600 text-white font-black px-8 py-3 active:scale-95
                  transition-transform" style={{ borderRadius: '4px' }}>
                Start Game
              </button>
            ) : (
              <p className="text-gray-500 text-sm">Waiting for players... ({numPlayers}/2)</p>
            )}
          </div>
        )}

        {/* MY TURN */}
        {showActions && (
          <div className="space-y-2 max-w-md mx-auto">

            {/* YOUR TURN pulse */}
            <p className="text-center text-emerald-400 font-semibold text-[11px] tracking-[2px]
              uppercase animate-pulse">
              YOUR TURN
            </p>

            {/* Action Buttons */}
            <div className="grid grid-cols-4 gap-1.5">
              <button onClick={() => handleAction('fold')} disabled={actionLoading}
                className="flex flex-col items-center py-2.5 text-white font-black text-[13px]
                  border-[1.5px] border-red-500/35 active:scale-95 transition-transform
                  disabled:opacity-40"
                style={{ borderRadius: '4px', background: 'linear-gradient(160deg,#7f1d1d,#991b1b)' }}>
                FOLD
              </button>

              {(myPlayer?.bet || 0) >= currentBet ? (
                <button onClick={() => handleAction('check')} disabled={actionLoading}
                  className="flex flex-col items-center py-2.5 text-white font-black text-[13px]
                    border-[1.5px] border-yellow-500/35 active:scale-95 transition-transform
                    disabled:opacity-40"
                  style={{ borderRadius: '4px', background: 'linear-gradient(160deg,#78350f,#92400e)' }}>
                  CHECK
                </button>
              ) : (
                <button onClick={() => handleAction('call')} disabled={actionLoading || callAmount === 0}
                  className="flex flex-col items-center py-2 text-white font-black
                    border-[1.5px] border-green-500/35 active:scale-95 transition-transform
                    disabled:opacity-40"
                  style={{ borderRadius: '4px', background: 'linear-gradient(160deg,#14532d,#166534)' }}>
                  <span className="text-[13px]">CALL</span>
                  <span className="text-[10px] opacity-80">{formatCurrency(callAmount)}</span>
                </button>
              )}

              <button onClick={() => handleAction('raise')}
                disabled={actionLoading || (myPlayer?.chips || 0) <= callAmount || raiseAmount < minRaise}
                className="flex flex-col items-center py-2 text-white font-black
                  border-[1.5px] border-purple-500/35 active:scale-95 transition-transform
                  disabled:opacity-40"
                style={{ borderRadius: '4px', background: 'linear-gradient(160deg,#3b0764,#4c1d95)' }}>
                <span className="text-[13px]">RAISE</span>
                <span className="text-[10px] opacity-80">
                  {formatCurrency(Math.min(raiseAmount, maxRaise))}
                </span>
              </button>

              <button onClick={() => handleAction('allin')}
                disabled={actionLoading || (myPlayer?.chips || 0) === 0}
                className="flex flex-col items-center py-2 text-white font-black
                  border-[1.5px] border-orange-500/35 active:scale-95 transition-transform
                  disabled:opacity-40"
                style={{ borderRadius: '4px', background: 'linear-gradient(160deg,#7c2d12,#9a3412)' }}>
                <span className="text-[13px]">ALL IN</span>
                <span className="text-[10px] opacity-80">{formatCurrency(myPlayer?.chips || 0)}</span>
              </button>
            </div>

            {/* Raise Controls */}
            {(myPlayer?.chips || 0) > callAmount && (
              <div className="flex items-center gap-1.5">
                <button onClick={() => setRaiseAmount(minRaise)}
                  className="bg-white/7 border border-white/12 px-3 py-2 text-yellow-400
                    text-[11px] font-bold active:scale-95"
                  style={{ borderRadius: '4px' }}>
                  MIN
                </button>
                <button onClick={() => adjustRaise(-(table.bigBlind || 10))}
                  className="w-9 h-9 bg-white/8 border border-white/12 flex items-center
                    justify-center text-white text-lg active:scale-95"
                  style={{ borderRadius: '4px' }}>
                  −
                </button>
                <div className="flex-1 bg-white/6 border border-white/10 py-2.5 text-center
                  text-white font-bold text-base" style={{ borderRadius: '4px',
                  fontFamily: 'Georgia, serif' }}>
                  {formatCurrency(Math.min(raiseAmount, maxRaise))}
                </div>
                <button onClick={() => adjustRaise(table.bigBlind || 10)}
                  className="w-9 h-9 bg-white/8 border border-white/12 flex items-center
                    justify-center text-white text-lg active:scale-95"
                  style={{ borderRadius: '4px' }}>
                  +
                </button>
                <button onClick={() => setRaiseAmount(maxRaise)}
                  className="bg-white/7 border border-white/12 px-3 py-2 text-yellow-400
                    text-[11px] font-bold active:scale-95"
                  style={{ borderRadius: '4px' }}>
                  MAX
                </button>
              </div>
            )}
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
              <div className="bg-red-900/40 border border-red-500/30 px-4 py-3 inline-block"
                style={{ borderRadius: '4px' }}>
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
        <div className="fixed inset-0 bg-black/82 backdrop-blur-sm flex items-center
          justify-center z-[100] px-4">
          <div className="bg-[#0d1a12] border border-yellow-400/20 p-6 w-full max-w-[310px]
            text-center" style={{ borderRadius: '6px' }}>
            <LogOut className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-white font-black text-lg mb-1"
              style={{ fontFamily: 'Georgia, serif' }}>Leave Table?</h3>
            <p className="text-gray-400/80 text-sm mb-3">
              Remaining chips return to your wallet.
            </p>
            {(myPlayer?.chips || 0) > 0 && (
              <p className="text-emerald-400 font-black text-2xl mb-5"
                style={{ fontFamily: 'Georgia, serif' }}>
                +{formatCurrency(myPlayer!.chips)}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowLeave(false)}
                className="flex-1 bg-white/7 border border-white/12 text-white font-bold
                  py-3 text-sm" style={{ borderRadius: '4px' }}>
                Stay
              </button>
              <button onClick={handleLeave} disabled={leaving}
                className="flex-1 bg-red-600 text-white font-bold py-3 text-sm
                  flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ borderRadius: '4px' }}>
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
