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

// ─── Seat positions as % of the WRAPPER (not the felt) ─────────────────────
// These match exactly where players sit — empty seats use identical positions
const SEAT_POSITIONS: Record<number, React.CSSProperties> = {
  0: { bottom: '2%', left: '50%', transform: 'translateX(-50%)' },   // bottom center (You)
  1: { bottom: '24%',     right: '2%',  transform: 'translateY(-50%)' },   // right middle
  2: { top: '10%',      right: '18%'  },                                   // top right
  3: { top: '2%',      left: '50%',  transform: 'translateX(-50%)' },   // top center
  4: { top: '10%',      left: '18%'  },                                    // top left
  5: { bottom: '24%',     left: '2%', },    // left middle
};

      const FELT_EMPTY_POSITIONS: Record< number, React.CSSProperties> = {
        0: { bottom: '8%', left: '50%', transform: 'translateX(-50%)',},
        1: { bottom: '24%', right: '4%', },
        2: { top: '12%', right: '18%', },
        3: { top: '4%', left: '50%',},
        4: { top: '14%', left: '14%', },
        5: { bottom: '24%', left: '4%', },
      };

// ─── Animated Card Component ────────────────────────────────────────────────
const AnimatedCard: React.FC<{
  card?: string;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md';
  delay?: number;
  animate?: boolean;
}> = ({ card, faceDown, size = 'sm', delay = 0, animate = false }) => {
  const [visible, setVisible] = useState(!animate);
  const [dealt, setDealt] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    const t1 = setTimeout(() => setVisible(true), delay);
    const t2 = setTimeout(() => setDealt(true), delay + 50);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [animate, delay]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: dealt ? 'scale(1) translateY(0)' : 'scale(0.3) translateY(-60px)',
        transition: 'opacity 0.35s ease, transform 0.45s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      {faceDown || !card
        ? <CardDisplay faceDown size={size} />
        : <CardDisplay card={card} size={size} animate />
      }
    </div>
  );
};

// ─── Player Seat ─────────────────────────────────────────────────────────────
const PlayerSeat: React.FC<{
  player: PokerPlayer;
  isMe: boolean;
  isActive: boolean;
  isWinner: boolean;
  phase: string;
  displaySeat: number;
  dealAnimating: boolean;
  cardDealIndex: number;
}> = ({ player, isMe, isActive, isWinner, phase, displaySeat, dealAnimating, cardDealIndex }) => {
  const isPlaying = phase !== 'waiting';
  const folded = player.status === 'folded';
  const isBottom = displaySeat === 0;
  const showCards = isPlaying && player.holeCards.length > 0;
  const showFaceUp = isMe || (phase === 'showdown' && !folded);

  return (
    <div
      className={`flex flex-col items-center gap-0.5 transition-opacity duration-300
        ${folded ? 'opacity-50' : 'opacity-100'}`}
      style={{ position: 'relative' }}
    >
      {/* ── Winner Banner ── */}
      {isWinner && (
        <div
          className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap
            z-50 animate-bounce"
        >
          <span
            className="bg-gradient-to-r from-yellow-400 to-amber-500
              text-gray-900 font-black text-[11px] px-3 py-1 rounded-full
              shadow-lg shadow-yellow-500/50 border border-yellow-300"
          >
            🏆 WINNER!
          </span>
        </div>
      )}

      {/* ── Cards ABOVE avatar (non-bottom seats) ── */}
      {showCards && !isBottom && (
        <div className="flex gap-1 mb-2" style={{ zIndex: 30, transform: 'translateY(-4px)',}}>
          {player.holeCards.map((c, i) => (
            <AnimatedCard
              key={i}
              card={showFaceUp ? c : undefined}
              faceDown={!showFaceUp}
              size="xs"
              animate={dealAnimating}
              delay={cardDealIndex * 200 + i * 120}
            />
          ))}
        </div>
      )}

      {/* ── Avatar ── */}
      <div className="relative" style={{ zIndex: 20 }}>
        {/* Active ping */}
        {isActive && isPlaying && (
          <div
            className="absolute inset-0 rounded-full border-2 border-yellow-400
              animate-ping opacity-60 pointer-events-none"
            style={{ zIndex: 10 }}
          />
        )}

        <div
          className={`
            rounded-full flex items-center justify-center font-black
            transition-all duration-300 relative
            ${isMe
              ? 'w-14 h-14 md:w-16 md:h-16 text-xl'
              : 'w-11 h-11 md:w-12 md:h-12 text-base'}
            ${isWinner
              ? 'border-[3px] border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.7)]'
              : isActive && isPlaying
                ? 'border-[3px] border-yellow-400 shadow-[0_0_0_3px_rgba(250,204,21,0.4)]'
                : isMe
                  ? 'border-[3px] border-purple-500'
                  : 'border-2 border-gray-500'}
            ${isMe
              ? 'bg-gradient-to-br from-purple-600 to-blue-700 text-white'
              : 'bg-gradient-to-br from-gray-600 to-gray-800 text-white'}
          `}
        >
          {player.name.charAt(0).toUpperCase()}
        </div>

        {/* Dealer chip */}
        {player.isDealer && (
          <span
            className="absolute -top-1 -right-1 bg-white text-gray-900
              text-[8px] font-black w-4 h-4 rounded-full flex items-center
              justify-center shadow border border-gray-300"
            style={{ zIndex: 30 }}
          >
            D
          </span>
        )}
      </div>

      {/* ── Name plate ── */}
      <div
        className={`
          px-2 py-0.5 rounded-md text-center
          ${isMe ? 'min-w-[80px]' : 'min-w-[64px]'}
          ${isWinner
            ? 'bg-yellow-950/95 border border-yellow-400/60'
            : isActive && isPlaying
              ? 'bg-yellow-950/95 border border-yellow-500/60'
              : isMe
                ? 'bg-[#1a0a35]/95 border border-purple-500/50'
                : 'bg-gray-900/95 border border-white/15'}
        `}
        style={{ zIndex: 20 }}
      >
        <p
          className={`text-[11px] font-bold truncate leading-tight
            ${isMe ? 'text-purple-300' : 'text-white'}`}
        >
          {isMe ? 'You' : player.name}
        </p>
        <p className="text-yellow-400 text-[11px] font-semibold leading-tight">
          ₹{formatCurrency(player.chips)}
        </p>
      </div>

      {/* ── Bet chip ── */}
      {player.bet > 0 && (
        <div
          className="flex items-center gap-0.5 bg-black/80 border
            border-red-500/40 px-1.5 py-0.5 rounded-full"
          style={{ zIndex: 20 }}
        >
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
          <span className="text-yellow-300 text-[9px] font-bold">
            ₹{player.bet}
          </span>
        </div>
      )}

      {/* ── Status badges ── */}
      {folded && (
        <span className="text-red-400 text-[9px] font-black">FOLD</span>
      )}
      {player.status === 'allin' && (
        <span className="text-yellow-400 text-[9px] font-black animate-pulse">
          ALL IN
        </span>
      )}
      {phase === 'showdown' && player.handRank && !folded && (
        <span
          className="text-emerald-400 text-[9px] font-bold text-center
            max-w-[80px] truncate"
        >
          {player.handRank}
        </span>
      )}

      {/* ── Cards BELOW avatar (bottom / You seat) ── */}
      {showCards && isBottom && (
        <div className="flex gap-1 mt-1" style={{ zIndex: 30 }}>
          {player.holeCards.map((c, i) => (
            <AnimatedCard
              key={i}
              card={showFaceUp ? c : undefined}
              faceDown={!showFaceUp}
              size="sm"
              animate={dealAnimating}
              delay={cardDealIndex * 200 + i * 120}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Game Page ───────────────────────────────────────────────────────────
const PokerGamePage: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [table, setTable]               = useState<PokerTable | null>(null);
  const [loading, setLoading]           = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [leaving, setLeaving]           = useState(false);
  const [raiseAmount, setRaiseAmount]   = useState(0);
  const [error, setError]               = useState('');
  const [showLeave, setShowLeave]       = useState(false);
  const [showRaise, setShowRaise]       = useState(false);

  // Card deal animation state
  const [dealAnimating, setDealAnimating] = useState(false);
  const prevPhase = useRef<string>('waiting');
  const prevCardCount = useRef<number>(0);

  const prevCount    = useRef(0);
  const autoStarted  = useRef(false);

  // ── Subscribe ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tableId) return;
    return subscribePokerTable(tableId, (data) => {
      setTable(data);
      setLoading(false);
    });
  }, [tableId]);

  // ── Trigger deal animation when hole cards appear ─────────────────────────
  useEffect(() => {
    if (!table) return;
    const totalCards = table.players.reduce(
      (sum, p) => sum + p.holeCards.length, 0
    );
    const phaseChanged =
      prevPhase.current === 'waiting' && table.phase !== 'waiting';
    const newCardsDealt =
      totalCards > 0 && prevCardCount.current === 0;

    if ((phaseChanged || newCardsDealt) && !dealAnimating) {
      setDealAnimating(true);
      setTimeout(() => setDealAnimating(false), 2000);
    }
    prevPhase.current    = table.phase;
    prevCardCount.current = totalCards;
  }, [table?.phase, table?.players]);

  // ── Auto-start logic ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!table || !tableId) return;
    const n = table.players.length;
    if (
      n >= 2 && prevCount.current < 2 &&
      table.status === 'waiting' &&
      table.phase === 'waiting' &&
      !autoStarted.current
    ) {
      autoStarted.current = true;
      setTimeout(async () => {
        try { await checkAndAutoStart(tableId); } catch {}
        autoStarted.current = false;
      }, 2000);
    }
    if (table.status === 'waiting' && n >= 2) autoStarted.current = false;
    prevCount.current = n;
  }, [table?.players.length, table?.status]);

  useEffect(() => {
    if (!table || !tableId) return;
    if (
      table.status === 'waiting' &&
      table.phase === 'showdown' &&
      table.players.length >= 2
    ) {
      const t = setTimeout(async () => {
        try { await startPokerHand(tableId); } catch {}
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

  // ── Derived ────────────────────────────────────────────────────────────────
  const myPlayer    = table?.players.find(p => p.uid === user?.uid);
  const isMyTurn    = table?.activePlayerUid === user?.uid;
  const phase       = table?.phase || 'waiting';
  const pot         = table?.pot || 0;
  const currentBet  = table?.currentBet || 0;
  const numPlayers  = table?.players.length || 0;
  const canStart    = numPlayers >= 2 && table?.status === 'waiting';

  // Determine winner uid(s) at showdown
  const winnerUids = React.useMemo(() => {
    if (phase !== 'showdown' || !table) return new Set<string>();
    const activePlayers = table.players.filter(p => p.status !== 'folded');
    if (activePlayers.length === 0) return new Set<string>();
    // Winner is player with highest chips gain OR marked by handRank
    // Fallback: player whose uid matches table.lastWinner if it exists
    const lastWinner = (table as any).lastWinner as string | undefined;
    if (lastWinner) return new Set([lastWinner]);
    // Otherwise highlight all non-folded if only one remains
    if (activePlayers.length === 1)
      return new Set([activePlayers[0].uid]);
    return new Set<string>();
  }, [phase, table]);

  const callAmount = Math.max(
    0,
    Math.min(currentBet - (myPlayer?.bet || 0), myPlayer?.chips || 0),
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

  // ── Arrange players: me = seat 0, others = 1..5 ───────────────────────────
  const arrangedPlayers = React.useMemo(() => {
    if (!table) return [];
    const me     = table.players.find(p => p.uid === user?.uid);
    const others = table.players.filter(p => p.uid !== user?.uid);
    const out: (PokerPlayer & { displaySeat: number })[] = [];
    if (me) out.push({ ...me, displaySeat: 0 });
    others.forEach((p, i) => out.push({ ...p, displaySeat: i + 1 }));
    return out;
  }, [table, user?.uid]);

  // Which seat indices are EMPTY (no player)
  const occupiedSeats = new Set(arrangedPlayers.map(p => p.displaySeat));
  const emptySeats    = [0, 1, 2, 3, 4, 5].filter(s => !occupiedSeats.has(s));

  const showActions =
    isMyTurn &&
    phase !== 'waiting' &&
    phase !== 'showdown' &&
    myPlayer?.status === 'active';

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div
      className="h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(180deg,#1a0a2e,#080e1a)' }}
    >
      <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
    </div>
  );

  if (!table) return (
    <div
      className="h-screen flex items-center justify-center text-white"
      style={{ background: 'linear-gradient(180deg,#1a0a2e,#080e1a)' }}
    >
      <div className="text-center space-y-3">
        <p className="text-gray-300">Table not found</p>
        <button
          onClick={() => navigate('/games/poker')}
          className="text-yellow-400 text-sm underline"
        >
          ← Back to Lobby
        </button>
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{
        background:
          'linear-gradient(180deg,#12082a 0%,#0a1020 60%,#060810 100%)',
      }}
    >
      {/* ════════════════════════════════════════════════════
          HEADER
      ════════════════════════════════════════════════════ */}
      <div
        className="shrink-0 flex items-center justify-between px-3 md:px-6
          py-2.5 border-b border-white/5 z-50"
        style={{ background: 'rgba(8,6,20,0.97)' }}
      >
        {/* Exit */}
        <button
          onClick={() => setShowLeave(true)}
          className="flex items-center gap-1.5 bg-red-900/40 border
            border-red-500/50 text-red-400 text-xs font-bold px-3 md:px-4
            py-2 md:py-2.5 rounded-lg active:scale-95 transition-transform
            hover:bg-red-900/60"
        >
          <LogOut className="w-3.5 h-3.5" />
          Exit
        </button>

        {/* POT CENTER */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col
          items-center">
          <span
            className="text-[9px] md:text-[10px] tracking-[3px] uppercase
              text-gray-400 font-semibold"
          >
            POT AMOUNT
          </span>
          <span
            className="font-black text-yellow-400 text-xl md:text-2xl
              leading-tight"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            ₹{formatCurrency(pot)}
          </span>
        </div>

        {/* BLIND RIGHT */}
        <div className="flex flex-col items-end">
          <span
            className="text-[9px] md:text-[10px] tracking-[2px] uppercase
              text-gray-400 font-semibold"
          >
            BLIND
          </span>
          <span className="text-white font-bold text-sm md:text-base">
            ₹{table.bigBlind || 20}
          </span>
        </div>
      </div>

      {/* Phase badge */}
      <div className="shrink-0 flex justify-center pt-2 pb-1 z-50">
        <span
          className={`
            text-[10px] md:text-xs font-black tracking-[2px] uppercase
            px-5 py-1.5 rounded-full border
            ${phase === 'waiting'
              ? 'bg-gray-800/70 text-gray-300 border-gray-600/40'
              : phase === 'showdown'
                ? 'bg-yellow-900/50 text-yellow-400 border-yellow-500/50'
                : 'bg-emerald-900/50 text-emerald-400 border-emerald-600/40'}
          `}
        >
          {phase === 'waiting'
            ? `WAITING FOR PLAYERS ${numPlayers}/2`
            : phase.toUpperCase()}
        </span>
      </div>

      {/* ════════════════════════════════════════════════════
          TABLE AREA — flex-1, vertically centered
      ════════════════════════════════════════════════════ */}
      <div
        className="flex-1 flex items-center justify-center overflow-visible
          px-4 md:px-8"
        style={{ paddingTop: '12px', paddingBottom: '4px' }}
      >
        {/*
          ┌──────────────────────────────────────────────────────┐
          │  WRAPPER — large enough that edge seats don't clip   │
          │  The felt is INSET ~18% top/bottom, ~10% left/right  │
          │  giving edge seats space to straddle the rim.        │
          └──────────────────────────────────────────────────────┘
        */}
        <div
          className="relative"
          style={{
            width:  'min(90vw, 440px)',
            height: 'min(58vh, 480px)',
            // overflow must be visible so avatar heads above top edge show
            overflow: 'visible',
          }}
        >

          {/* ── GREEN FELT (inset inside wrapper) ────────────────────── */}
          <div
            className="absolute"
            style={{
              top:    '15%',
              bottom: '15%',
              left:   '8%',
              right:  '8%',
              borderRadius: '40%',
              background:
                'radial-gradient(ellipse at 50% 38%,' +
                '#2a9a5a 0%,#1a7a40 45%,#0f5a28 80%,#082010 100%)',
              boxShadow: `
                0 0 0 5px #c8922a,
                0 0 0 10px #8a5a18,
                0 0 0 13px #5a3a0a,
                0 25px 80px rgba(0,0,0,0.9)
              `,
              // let seats outside the felt be visible
              overflow: 'visible',
              zIndex: 1,
            }}
          >
            {/* Inner shadow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                borderRadius: '40%',
                boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5)',
              }}
            />

            {/* Spade watermark */}
            <div
              className="absolute inset-0 flex items-center justify-center
                pointer-events-none select-none"
              style={{
                color: 'rgba(255,255,255,0.03)',
                fontSize: 'clamp(60px,15vw,110px)',
                zIndex: 2,
              }}
            >
              ♠
            </div>

            {/* ── CENTER CONTENT (community cards, pot info) ── */}
            <div
              className="absolute inset-0 flex flex-col items-center
                justify-center gap-2 px-6"
              style={{ zIndex: 3 }}
            >
              {/* Community cards */}
              {phase !== 'waiting' && (
                <div className="flex gap-1 md:gap-1.5 justify-center">
                  {[...Array(5)].map((_, i) =>
                    table.communityCards[i] ? (
                      <AnimatedCard
                        key={i}
                        card={table.communityCards[i]}
                        size="sm"
                        animate
                        delay={i * 120}
                      />
                    ) : (
                      <div
                        key={i}
                        className="w-7 h-10 md:w-10 md:h-14 border
                          border-white/10 bg-black/20 rounded"
                      />
                    )
                  )}
                </div>
              )}

              {/* Current bet */}
              {currentBet > 0 && phase !== 'waiting' && (
                <div
                  className="flex items-center gap-1 bg-black/60
                    border border-white/10 px-3 py-1 rounded-full"
                >
                  <span className="w-2 h-2 bg-red-500 rounded-full
                    flex-shrink-0" />
                  <span className="text-white/60 text-[10px]">
                    Bet:{' '}
                    <span className="text-white font-bold">
                      ₹{formatCurrency(currentBet)}
                    </span>
                  </span>
                </div>
              )}

              {/* Waiting */}
              {phase === 'waiting' && numPlayers < 2 && (
                <div className="flex flex-col items-center gap-1.5">
                  <Loader2
                    className="w-6 h-6 md:w-8 md:h-8 text-white/25
                      animate-spin"
                  />
                  <span className="text-white/25 text-[11px] md:text-xs">
                    Waiting...
                  </span>
                </div>
              )}

              {/* Showdown */}
              {phase === 'showdown' && (
                <p
                  className="text-yellow-400 font-black text-sm md:text-base
                    animate-bounce"
                >
                  🏆 Showdown!
                </p>
              )}
            </div>

            {/* ── EMPTY SEATS inside felt ──────────────────────────── */}

            {/* We pre-calculate these for the 6 standard positions.*/}
            
             {emptySeats.map(seatIdx => {
              return (
                <div
                  key={`empty-${seatIdx}`}
                  className="absolute flex flex-col items-center gap-1"
                  style={FELT_EMPTY_POSITIONS[seatIdx]}
                >
                  <div
                    className="w-9 h-9 md:w-11 md:h-11 rounded-full border-2
                      border-dashed border-white/20 bg-black/10 flex items-center
                      justify-center"
                  >
                    <span className="text-white/20 text-lg font-light">+</span>
                  </div>
                  <span className="text-white/20 text-[9px] md:text-[10px]">
                    Empty
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── PLAYER SEATS (positioned on wrapper) ─────────────────── */}
          {arrangedPlayers.map((player, idx) => (
            <div
              key={player.uid}
              className="absolute"
              style={{
                ...SEAT_POSITIONS[player.displaySeat],
                zIndex: 20,
                // Ensure cards are never clipped
                overflow: 'visible',
              }}
            >
              <PlayerSeat
                player={player}
                isMe={player.uid === user?.uid}
                isActive={table.activePlayerUid === player.uid}
                isWinner={winnerUids.has(player.uid)}
                phase={phase}
                displaySeat={player.displaySeat}
                dealAnimating={dealAnimating}
                cardDealIndex={idx}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          ERROR TOAST
      ════════════════════════════════════════════════════ */}
      {error && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 z-[60]
            bg-red-900/95 border border-red-500/50 text-red-300 text-xs
            font-semibold px-4 py-2 rounded-lg whitespace-nowrap shadow-2xl"
        >
          ⚠️ {error}
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          BOTTOM ACTION PANEL
      ════════════════════════════════════════════════════ */}
      <div
        className="shrink-0 z-40 border-t border-white/5"
        style={{ background: 'rgba(6,8,18,0.98)' }}
      >
        {/* ↑ Top margin so buttons breathe above the panel edge */}
        <div className="max-w-lg mx-auto px-3 md:px-6 pt-3 pb-3 md:pt-4
          md:pb-4">

          {/* ── WAITING ── */}
          {phase === 'waiting' && (
            <div className="flex flex-col items-center gap-2">
              {canStart ? (
                <button
                  onClick={() => tableId && startPokerHand(tableId)}
                  className="w-full max-w-xs bg-emerald-600 hover:bg-emerald-500
                    text-white font-black py-3 md:py-4 text-sm rounded-xl
                    active:scale-95 transition-all shadow-lg
                    shadow-emerald-900/40"
                >
                  🎮 Start Game
                </button>
              ) : (
                <div className="flex items-center gap-2 py-2">
                  <Loader2
                    className="w-4 h-4 text-yellow-400 animate-spin"
                  />
                  <p className="text-gray-400 text-sm">
                    Need {2 - numPlayers} more player
                    {2 - numPlayers !== 1 ? 's' : ''} to start...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── MY TURN ACTIONS ── */}
          {showActions && (
            <div className="space-y-2">

              {/* YOUR TURN label */}
              <div className="flex items-center justify-center gap-1.5">
                <span
                  className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"
                />
                <span
                  className="text-emerald-400 font-bold text-[11px]
                    tracking-[2px] uppercase"
                >
                  Your Turn
                </span>
              </div>

              {/* Raise panel */}
              {showRaise && (myPlayer?.chips || 0) > callAmount && (
                <div
                  className="bg-white/5 border border-white/10 rounded-xl
                    p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs font-semibold">
                      Raise Amount
                    </span>
                    <span className="text-yellow-400 font-black text-base">
                      {formatCurrency(Math.min(raiseAmount, maxRaise))}
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
                  <div className="flex gap-1.5">
                    {[
                      { label: 'MIN', val: minRaise },
                      { label: '½',   val: Math.round(maxRaise / 2) },
                      {
                        label: 'POT',
                        val: Math.min(
                          pot + (myPlayer?.bet || 0), maxRaise
                        ),
                      },
                      { label: 'MAX', val: maxRaise },
                    ].map(({ label, val }) => (
                      <button
                        key={label}
                        onClick={() =>
                          setRaiseAmount(
                            Math.min(Math.max(val, minRaise), maxRaise)
                          )
                        }
                        className="flex-1 bg-white/8 border border-white/10
                          text-yellow-400 text-[10px] md:text-[11px] font-bold
                          py-1.5 rounded-lg active:scale-95 transition-transform"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Main action buttons */}
              <div className="grid grid-cols-3 gap-2 md:gap-3">

                {/* FOLD */}
                <button
                  onClick={() => handleAction('fold')}
                  disabled={actionLoading}
                  className="flex items-center justify-center gap-2 py-3 md:py-4
                    rounded-xl border active:scale-95 transition-transform
                    disabled:opacity-40 font-bold text-sm"
                  style={{
                    background: 'rgba(80,10,10,0.7)',
                    borderColor: 'rgba(239,68,68,0.5)',
                    color: '#f87171',
                  }}
                >
                  <span
                    className="w-4 h-4 rounded-full border-2 border-red-400
                      flex-shrink-0"
                  />
                  Fold
                </button>

                {/* CHECK / CALL */}
                {(myPlayer?.bet || 0) >= currentBet ? (
                  <button
                    onClick={() => handleAction('check')}
                    disabled={actionLoading}
                    className="flex flex-col items-center justify-center
                      py-3 md:py-4 rounded-xl border active:scale-95
                      transition-transform disabled:opacity-40"
                    style={{
                      background: 'rgba(30,30,40,0.8)',
                      borderColor: 'rgba(234,179,8,0.4)',
                    }}
                  >
                    <span className="text-white font-bold text-sm">
                      Check
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleAction('call')}
                    disabled={actionLoading || callAmount === 0}
                    className="flex flex-col items-center justify-center
                      py-2.5 md:py-3 rounded-xl border active:scale-95
                      transition-transform disabled:opacity-40"
                    style={{
                      background: 'rgba(20,50,30,0.8)',
                      borderColor: 'rgba(34,197,94,0.4)',
                    }}
                  >
                    <span className="text-white font-bold text-sm">Call</span>
                    <span className="text-green-400 text-[11px]">
                      ₹{formatCurrency(callAmount)}
                    </span>
                  </button>
                )}

                {/* ALL IN */}
                <button
                  onClick={() => handleAction('allin')}
                  disabled={
                    actionLoading || (myPlayer?.chips || 0) === 0
                  }
                  className="flex flex-col items-center justify-center
                    py-3 md:py-4 rounded-xl border active:scale-95
                    transition-transform disabled:opacity-40"
                  style={{
                    background: 'rgba(20,50,30,0.8)',
                    borderColor: 'rgba(34,197,94,0.4)',
                  }}
                >
                  <span className="text-white font-bold text-sm">All In</span>
                </button>
              </div>

              {/* Raise button */}
              {(myPlayer?.chips || 0) > callAmount && (
                <button
                  onClick={() => {
                    if (showRaise) handleAction('raise');
                    else setShowRaise(true);
                  }}
                  disabled={
                    actionLoading ||
                    raiseAmount < minRaise ||
                    (myPlayer?.chips || 0) <= callAmount
                  }
                  className="w-full py-2.5 rounded-xl border font-bold text-sm
                    active:scale-95 transition-all disabled:opacity-40"
                  style={{
                    background: showRaise
                      ? 'linear-gradient(135deg,#5b21b6,#7c3aed)'
                      : 'rgba(60,10,100,0.6)',
                    borderColor: `rgba(139,92,246,${showRaise ? 0.8 : 0.4})`,
                    color: '#c4b5fd',
                  }}
                >
                  {showRaise
                    ? `✓ Confirm Raise — ₹${formatCurrency(
                        Math.min(raiseAmount, maxRaise)
                      )}`
                    : '↑ Raise'}
                </button>
              )}

              {showRaise && (
                <button
                  onClick={() => setShowRaise(false)}
                  className="w-full text-gray-500 text-xs py-0.5 text-center
                    active:text-gray-300 transition-colors"
                >
                  Cancel ✕
                </button>
              )}
            </div>
          )}

          {/* ── NOT MY TURN ── */}
          {!isMyTurn &&
            phase !== 'waiting' &&
            phase !== 'showdown' &&
            myPlayer?.status === 'active' && (
            <div className="flex items-center justify-center gap-2 py-3">
              <span
                className="w-2 h-2 bg-yellow-500 rounded-full animate-ping"
              />
              <p className="text-gray-400 text-sm">
                <span className="text-yellow-400 font-semibold">
                  {table.players.find(
                    p => p.uid === table.activePlayerUid
                  )?.name || 'Player'}
                </span>{' '}
                is deciding...
              </p>
            </div>
          )}

          {/* ── FOLDED ── */}
          {myPlayer?.status === 'folded' && phase !== 'showdown' && (
            <p className="text-center text-red-400/70 text-sm py-3">
              You folded — watching the hand...
            </p>
          )}

          {/* ── ALL IN ── */}
          {myPlayer?.status === 'allin' && phase !== 'showdown' && (
            <p
              className="text-center text-yellow-400 font-black text-sm
                animate-pulse py-3"
            >
              ALL IN 🎯 — Waiting for showdown...
            </p>
          )}

          {/* ── SHOWDOWN ── */}
          {phase === 'showdown' && (
            <div className="text-center py-2">
              {myPlayer && myPlayer.chips <= 0 ? (
                <div
                  className="bg-red-900/40 border border-red-500/30 px-4
                    py-3 rounded-xl inline-block"
                >
                  <p className="text-red-400 font-bold text-sm">
                    💸 Out of chips!
                  </p>
                  <p className="text-gray-400 text-xs">
                    Returning to lobby...
                  </p>
                </div>
              ) : (
                <p
                  className="text-gray-400 text-sm flex items-center
                    justify-center gap-2"
                >
                  <Loader2
                    className="w-4 h-4 animate-spin text-yellow-400"
                  />
                  Next hand in 4s...
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          LEAVE MODAL
      ════════════════════════════════════════════════════ */}
      {showLeave && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md flex
            items-end md:items-center justify-center z-[100] px-4"
          onClick={() => setShowLeave(false)}
        >
          <div
            className="bg-[#0d1520] border border-white/10 p-6 w-full
              max-w-sm text-center rounded-t-2xl md:rounded-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div
              className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5
                md:hidden"
            />
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
                  font-bold py-3.5 text-sm rounded-xl hover:bg-white/12
                  transition-colors"
              >
                Stay
              </button>
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white
                  font-bold py-3.5 text-sm rounded-xl flex items-center
                  justify-center gap-2 disabled:opacity-50 transition-colors"
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
