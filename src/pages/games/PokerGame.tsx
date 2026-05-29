
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  subscribePokerTable,
  startPokerHand,
  pokerAction,
  leavePokerTable,
  PokerTable,
  PokerPlayer,
} from '../../firebase/games';
import CardDisplay from '../../components/games/CardDisplay';
import { formatCurrency, calculateUsableBalance } from '../../utils/helpers';
import {
  ArrowLeft, Users, Loader2, Play, LogOut,
  ChevronDown, Zap, Trophy, AlertCircle,
} from 'lucide-react';

// ─── Player Seat Positions (CSS) ─────────────────────
const SEAT_POSITIONS = [
  'bottom-4 left-1/2 -translate-x-1/2',           // Seat 0 — Bottom center (You)
  'top-4 right-12',                                 // Seat 1 — Top right
  'top-4 left-1/2 -translate-x-1/2',               // Seat 2 — Top center
  'top-4 left-12',                                  // Seat 3 — Top left
];

// ─── Action Button Config ─────────────────────────────
const ACTION_BUTTONS = [
  { action: 'fold', label: 'Fold', color: 'from-red-700 to-red-900 border-red-600/40', textColor: 'text-white' },
  { action: 'check', label: 'Check', color: 'from-blue-700 to-blue-900 border-blue-600/40', textColor: 'text-white' },
  { action: 'call', label: 'Call', color: 'from-emerald-700 to-emerald-900 border-emerald-600/40', textColor: 'text-white' },
  { action: 'raise', label: 'Raise', color: 'from-purple-700 to-purple-900 border-purple-600/40', textColor: 'text-white' },
  { action: 'allin', label: 'All In!', color: 'from-yellow-600 to-yellow-800 border-yellow-500/40', textColor: 'text-gray-900' },
] as const;

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
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useEffect(() => {
    if (!tableId) return;
    const unsub = subscribePokerTable(tableId, (data) => {
      setTable(data);
      setLoading(false);
      if (data.currentBet) {
        setRaiseAmount(data.currentBet * 2);
      }
    });
    return unsub;
  }, [tableId]);

  const myPlayer = table?.players.find((p) => p.uid === user?.uid);
  const isMyTurn = table?.activePlayerUid === user?.uid;
  const phase = table?.phase || 'waiting';
  const communityCards = table?.communityCards || [];
  const pot = table?.pot || 0;
  const currentBet = table?.currentBet || 0;
  const canStart = (table?.players.length || 0) >= 2 &&
    table?.status === 'waiting' &&
    table?.createdBy === user?.uid;

  const callAmount = Math.min(
    currentBet - (myPlayer?.bet || 0),
    myPlayer?.chips || 0
  );

  const handleAction = async (
    action: 'fold' | 'check' | 'call' | 'raise' | 'allin'
  ) => {
    if (!user || !tableId || actionLoading) return;
    setActionLoading(true);
    setError('');
    try {
      await pokerAction(
        tableId,
        user.uid,
        action,
        action === 'raise' ? raiseAmount : undefined
      );
    } catch (e: any) {
      setError(e.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async () => {
    if (!tableId || starting) return;
    setStarting(true);
    setError('');
    try {
      await startPokerHand(tableId);
    } catch (e: any) {
      setError(e.message || 'Failed to start');
    } finally {
      setStarting(false);
    }
  };

  const handleLeave = async () => {
    if (!user || !tableId || leaving) return;
    setLeaving(true);
    try {
      await leavePokerTable(tableId, user.uid);
      navigate('/poker');
    } catch (e: any) {
      setError(e.message || 'Failed to leave');
      setLeaving(false);
    }
  };

  const getPhaseLabel = () => {
    const labels: Record<string, string> = {
      waiting: '⏳ Waiting for players',
      preflop: '🃏 Pre-Flop',
      flop: '🃏 The Flop',
      turn: '🃏 The Turn',
      river: '🃏 The River',
      showdown: '🏆 Showdown!',
    };
    return labels[phase] || phase;
  };

  const getPlayerSeatPosition = (player: PokerPlayer) => {
    return SEAT_POSITIONS[player.seatIndex % SEAT_POSITIONS.length];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent
            rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Loading table...</p>
        </div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">Table not found</p>
          <button onClick={() => navigate('/poker')}
            className="text-purple-400 hover:text-purple-300 flex items-center gap-2 mx-auto">
            <ArrowLeft className="w-4 h-4" /> Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top Bar */}
      <div className="bg-gray-900/95 backdrop-blur-md border-b border-gray-700/50
        px-4 py-3 flex items-center justify-between z-30">
        <button
          onClick={() => setShowLeaveConfirm(true)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm hidden sm:block">Lobby</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-white font-bold text-sm">{table.name}</p>
            <p className="text-gray-500 text-xs">
              Blinds: {formatCurrency(table.smallBlind)}/{formatCurrency(table.bigBlind)}
            </p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full border
            ${phase === 'waiting'
              ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
              : phase === 'showdown'
              ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
              : 'bg-purple-500/20 text-purple-400 border-purple-500/30'}`}>
            {getPhaseLabel()}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-gray-500 text-xs">Chips</p>
            <p className="text-yellow-400 font-bold text-sm">
              {formatCurrency(myPlayer?.chips || 0)}
            </p>
          </div>
          <div className="flex items-center gap-1 text-gray-400 text-sm">
            <Users className="w-4 h-4" />
            {table.players.length}/4
          </div>
        </div>
      </div>

      {/* ── MAIN TABLE AREA ──────────────────────────── */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center
        min-h-[400px] md:min-h-[500px] p-4">

        {/* TABLE FELT */}
        <div className="relative w-full max-w-2xl" style={{ aspectRatio: '2/1.2' }}>
          {/* Outer rim */}
          <div className="absolute inset-0 rounded-[45%] bg-gradient-to-br
            from-yellow-800 via-amber-900 to-yellow-800 shadow-2xl" />

          {/* Felt surface */}
          <div className="absolute inset-2 rounded-[45%] bg-gradient-to-br
            from-green-800 via-green-700 to-emerald-800 shadow-inner">

            {/* Inner border */}
            <div className="absolute inset-3 rounded-[45%] border border-yellow-600/20" />

            {/* ── CENTER CONTENT ── */}
            <div className="absolute inset-0 flex flex-col items-center
              justify-center gap-3">

              {/* Pot Display */}
              {pot > 0 && (
                <div className="bg-gray-900/70 backdrop-blur-sm rounded-xl
                  px-4 py-1.5 border border-yellow-500/20">
                  <p className="text-yellow-400 font-black text-sm">
                    POT: {formatCurrency(pot)}
                  </p>
                </div>
              )}

              {/* Community Cards */}
              {phase !== 'waiting' && phase !== 'preflop' && (
                <div className="flex gap-1.5 justify-center">
                  {[...Array(5)].map((_, i) => (
                    <CardDisplay
                      key={i}
                      card={communityCards[i] || undefined}
                      faceDown={!communityCards[i]}
                      size="sm"
                      animate={!!communityCards[i]}
                    />
                  ))}
                </div>
              )}

              {/* Phase Label */}
              {phase === 'preflop' && (
                <p className="text-white/40 text-xs font-medium uppercase tracking-widest">
                  Pre-Flop Betting
                </p>
              )}

              {phase === 'waiting' && (
                <div className="text-center">
                  {table.players.length < 2 ? (
                    <p className="text-white/40 text-xs">
                      Waiting for players...
                      <br />
                      ({table.players.length}/2 minimum)
                    </p>
                  ) : canStart ? (
                    <p className="text-emerald-400/70 text-xs animate-pulse">
                      Ready! Start the game
                    </p>
                  ) : (
                    <p className="text-white/40 text-xs">
                      Waiting for host to start...
                    </p>
                  )}
                </div>
              )}

              {/* Current Bet Indicator */}
              {currentBet > 0 && phase !== 'waiting' && (
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1">
                  <p className="text-white/70 text-xs">
                    Current bet: <span className="font-bold text-white">
                      {formatCurrency(currentBet)}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── PLAYER SEATS ── */}
          {table.players.map((player) => {
            const posClass = getPlayerSeatPosition(player);
            const isMe = player.uid === user?.uid;
            const isActive = table.activePlayerUid === player.uid;

            return (
              <div
                key={player.uid}
                className={`absolute ${posClass} z-10`}
              >
                <div className={`
                  bg-gray-900/95 backdrop-blur-sm border-2 rounded-2xl p-2.5
                  transition-all duration-300 min-w-[130px]
                  ${isActive && phase !== 'waiting' && phase !== 'showdown'
                    ? 'border-yellow-400 shadow-lg shadow-yellow-400/30 scale-105'
                    : isMe
                    ? 'border-purple-500/50'
                    : 'border-gray-700/70'}
                  ${player.status === 'folded' ? 'opacity-40' : ''}
                `}>
                  {/* Turn indicator */}
                  {isActive && phase !== 'waiting' && (
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2
                      w-3 h-3 bg-yellow-400 rounded-full animate-ping" />
                  )}

                  {/* Player info */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center
                      text-xs font-black shrink-0
                      ${isMe
                        ? 'bg-gradient-to-br from-purple-500 to-blue-600 text-white'
                        : 'bg-gradient-to-br from-gray-600 to-gray-700 text-white'}`}>
                      {player.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-white text-xs font-bold truncate">
                          {isMe ? 'You' : player.name}
                        </p>
                        {player.isDealer && (
                          <span className="w-4 h-4 bg-white text-gray-900 rounded-full
                            text-xs font-black flex items-center justify-center shrink-0">
                            D
                          </span>
                        )}
                      </div>
                      <p className="text-yellow-400 text-xs font-bold">
                        {formatCurrency(player.chips)}
                      </p>
                    </div>
                  </div>

                  {/* Hole Cards */}
                  <div className="flex gap-1 justify-center mb-1.5">
                    {player.holeCards.length > 0 ? (
                      isMe ? (
                        player.holeCards.map((card, i) => (
                          <CardDisplay key={i} card={card} size="xs" />
                        ))
                      ) : (
                        player.holeCards.map((_, i) => (
                          <CardDisplay key={i} faceDown size="xs" />
                        ))
                      )
                    ) : (
                      <div className="text-gray-700 text-xs">No cards</div>
                    )}
                  </div>

                  {/* Bet / Status */}
                  <div className="text-center">
                    {player.bet > 0 && (
                      <p className="text-gray-400 text-xs">
                        Bet: {formatCurrency(player.bet)}
                      </p>
                    )}
                    {player.status === 'folded' && (
                      <p className="text-red-500 text-xs font-medium">Folded</p>
                    )}
                    {player.status === 'allin' && (
                      <p className="text-yellow-400 text-xs font-black">ALL IN</p>
                    )}
                    {player.isSmallBlind && phase === 'preflop' && (
                      <p className="text-blue-400 text-xs">SB</p>
                    )}
                    {player.isBigBlind && phase === 'preflop' && (
                      <p className="text-purple-400 text-xs">BB</p>
                    )}
                    {/* Show hand rank at showdown */}
                    {phase === 'showdown' && player.handRank && (
                      <p className="text-yellow-400 text-xs font-bold">{player.handRank}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── BOTTOM ACTION PANEL ──────────────────────── */}
      <div className="bg-gray-900/95 backdrop-blur-md border-t border-gray-700/50
        px-4 py-4 z-30">
        <div className="max-w-2xl mx-auto">

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm mb-3
              bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* ── WAITING PHASE ── */}
          {phase === 'waiting' && (
            <div className="text-center">
              {canStart ? (
                <button
                  onClick={handleStart}
                  disabled={starting}
                  className="bg-gradient-to-r from-emerald-600 to-green-600
                    text-white font-black px-8 py-3 rounded-xl hover:from-emerald-500
                    hover:to-green-500 transition-all disabled:opacity-50
                    flex items-center gap-2 mx-auto shadow-lg shadow-emerald-500/20">
                  {starting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                  Start Game ({table.players.length} players)
                </button>
              ) : table.players.length < 2 ? (
                <div className="text-gray-500">
                  <p className="text-sm">Share this table link to invite players</p>
                  <p className="text-yellow-400 text-xs mt-1">
                    Need {2 - table.players.length} more player(s) to start
                  </p>
                </div>
              ) : (
                <div className="text-gray-400 text-sm">
                  Waiting for the host ({table.players.find(p => p.uid === table.createdBy)?.name}) to start...
                </div>
              )}
            </div>
          )}

          {/* ── MY TURN ACTIONS ── */}
          {isMyTurn && phase !== 'waiting' && phase !== 'showdown' && myPlayer?.status === 'active' && (
            <div className="space-y-3">
              {/* Raise Slider */}
              {myPlayer.chips > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs w-12 shrink-0">Raise</span>
                  <input
                    type="range"
                    min={currentBet * 2 || table.bigBlind * 2}
                    max={(myPlayer.chips || 0) + (myPlayer.bet || 0)}
                    value={raiseAmount}
                    onChange={(e) => setRaiseAmount(Number(e.target.value))}
                    className="flex-1 accent-purple-500 h-1"
                  />
                  <span className="text-yellow-400 text-sm font-bold w-20 text-right shrink-0">
                    {formatCurrency(raiseAmount)}
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-5 gap-1.5">
                {ACTION_BUTTONS.map(({ action, label, color, textColor }) => {
                  // Hide check if there's a bet to call
                  if (action === 'check' && myPlayer.bet < currentBet) return null;
                  // Hide call if we're already at current bet
                  if (action === 'call' && myPlayer.bet >= currentBet) return null;

                  return (
                    <button
                      key={action}
                      onClick={() => handleAction(action)}
                      disabled={actionLoading}
                      className={`bg-gradient-to-b ${color} border ${textColor}
                        font-bold py-3 rounded-xl text-xs transition-all
                        disabled:opacity-40 active:scale-95
                        hover:brightness-110 flex flex-col items-center gap-0.5`}>
                      <span>{label}</span>
                      {action === 'call' && callAmount > 0 && (
                        <span className="text-xs opacity-70 font-normal">
                          {formatCurrency(callAmount)}
                        </span>
                      )}
                      {action === 'raise' && (
                        <span className="text-xs opacity-70 font-normal">
                          {formatCurrency(raiseAmount)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── NOT MY TURN ── */}
          {!isMyTurn && phase !== 'waiting' && phase !== 'showdown' &&
            myPlayer?.status === 'active' && (
            <div className="text-center text-gray-500 text-sm py-2">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-ping" />
                Waiting for{' '}
                {table.players.find(p => p.uid === table.activePlayerUid)?.name || 'player'}...
              </div>
            </div>
          )}

          {/* ── FOLDED ── */}
          {myPlayer?.status === 'folded' && phase !== 'showdown' && (
            <div className="text-center text-red-400 text-sm py-2">
              You folded. Waiting for the hand to finish...
            </div>
          )}

          {/* ── SHOWDOWN ── */}
          {phase === 'showdown' && (
            <div className="text-center py-2">
              <p className="text-yellow-400 font-black text-lg mb-3">🏆 Showdown!</p>
              <div className="flex gap-3 justify-center flex-wrap">
                {table.players
                  .filter(p => p.status !== 'folded' && p.handRank)
                  .map(p => (
                    <div key={p.uid} className="bg-gray-800 rounded-xl px-4 py-2 text-sm">
                      <p className="text-white font-bold">{p.uid === user?.uid ? 'You' : p.name}</p>
                      <p className="text-yellow-400 text-xs">{p.handRank}</p>
                    </div>
                  ))}
              </div>
              {table.status === 'waiting' && canStart && (
                <button
                  onClick={handleStart}
                  className="mt-3 bg-purple-600 hover:bg-purple-500 text-white
                    font-bold px-6 py-2 rounded-xl transition-colors text-sm">
                  Deal Next Hand
                </button>
              )}
            </div>
          )}

          {/* All-in waiting */}
          {myPlayer?.status === 'allin' && phase !== 'showdown' && (
            <div className="text-center text-yellow-400 text-sm py-2 font-bold">
              You're ALL IN! Waiting for showdown...
            </div>
          )}
        </div>
      </div>

      {/* ── LEAVE CONFIRM MODAL ── */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex
          items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6
            w-full max-w-sm text-center">
            <LogOut className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-white font-bold text-lg mb-2">Leave Table?</h3>
            <p className="text-gray-400 text-sm mb-2">
              Your remaining chips will be credited to your winning balance.
            </p>
            {myPlayer && myPlayer.chips > 0 && (
              <p className="text-emerald-400 font-bold text-lg mb-4">
                +{formatCurrency(myPlayer.chips)}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 bg-gray-800 border border-gray-700 text-gray-300
                  font-bold py-3 rounded-xl hover:bg-gray-700 transition-colors">
                Stay
              </button>
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl
                  hover:bg-red-500 transition-colors disabled:opacity-50
                  flex items-center justify-center gap-2">
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
