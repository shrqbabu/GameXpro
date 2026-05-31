// src/pages/games/PokerGame.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  subscribePokerTable, startPokerHand, pokerAction,
  leavePokerTable, checkAndAutoStart, buyInAtTable,
  PokerTable, PokerPlayer,
} from '../../firebase/games';
import CardDisplay from '../../components/games/CardDisplay';
import { formatCurrency } from '../../utils/helpers';
import { Loader2, LogOut, Wallet } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Seat layout — positions are on the TABLE CONTAINER (360×260px oval)
// Each seat renders OUTSIDE the felt via negative offsets so cards
// are always fully visible and never clipped by the oval overflow:hidden.
//
//   Seat 0 → bottom-center  (YOU — rendered separately below table)
//   Seat 1 → right-middle
//   Seat 2 → top-right
//   Seat 3 → top-center
//   Seat 4 → top-left
//   Seat 5 → left-middle
//
// Values are inline styles (top/left/right/bottom + transform) applied
// to absolutely-positioned wrappers on the outer table div.
// ─────────────────────────────────────────────────────────────
const SEAT_STYLE: Record<number, React.CSSProperties> = {
  // Seat 0 handled separately (always YOU, pinned below table)
  1: { right: '-8px',  top: '50%',  transform: 'translateY(-50%)' },
  2: { right: '8px',   top: '-64px' },
  3: { left: '50%',    top: '-68px', transform: 'translateX(-50%)' },
  4: { left: '8px',    top: '-64px' },
  5: { left: '-8px',   top: '50%',  transform: 'translateY(-50%)' },
};

// ─────────────────────────────────────────────────────────────
// Small card — rendered above each player avatar
// ─────────────────────────────────────────────────────────────
const TinyCard: React.FC<{
  card?: string;
  faceDown?: boolean;
  delay?: number;
}> = ({ card, faceDown, delay = 0 }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const style: React.CSSProperties = {
    width: 18,
    height: 26,
    borderRadius: 2,
    border: '0.5px solid',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 7,
    fontWeight: 900,
    lineHeight: 1,
    flexShrink: 0,
    opacity: visible ? 1 : 0,
    transform: visible ? 'scale(1) rotate(0deg)' : 'scale(0.4) rotate(-20deg)',
    transition: `opacity 0.3s ease ${delay}ms, transform 0.3s ease ${delay}ms`,
  };

  if (faceDown) {
    return (
      <div style={{
        ...style,
        background: 'repeating-linear-gradient(45deg,#1a3a7a,#1a3a7a 2px,#0d2050 2px,#0d2050 5px)',
        borderColor: '#2a4a9a',
      }} />
    );
  }

  if (!card) return <div style={{ ...style, background: '#1a3060', borderColor: '#2a4080' }} />;

  // Parse card string like "Ah", "Kd", "10s", "2c"
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const suitMap: Record<string, string> = { h: '♥', d: '♦', s: '♠', c: '♣' };
  const isRed = suit === 'h' || suit === 'd';

  return (
    <div style={{ ...style, background: '#fff', borderColor: '#ccc', color: isRed ? '#dc2626' : '#111' }}>
      <span>{rank}</span>
      <span>{suitMap[suit] || suit}</span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Community card — slightly larger
// ─────────────────────────────────────────────────────────────
const CommunityCard: React.FC<{ card?: string; delay?: number }> = ({ card, delay = 0 }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const style: React.CSSProperties = {
    width: 26,
    height: 36,
    borderRadius: 3,
    border: '0.5px solid',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 9,
    fontWeight: 900,
    lineHeight: 1,
    flexShrink: 0,
    opacity: visible ? 1 : 0,
    transform: visible ? 'scale(1) rotate(0deg)' : 'scale(0.3) rotate(-25deg)',
    transition: `opacity 0.35s ease ${delay}ms, transform 0.35s ease ${delay}ms`,
  };

  if (!card) {
    return (
      <div style={{
        ...style,
        background: 'rgba(0,0,0,0.25)',
        borderColor: 'rgba(255,255,255,0.12)',
      }} />
    );
  }

  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const suitMap: Record<string, string> = { h: '♥', d: '♦', s: '♠', c: '♣' };
  const isRed = suit === 'h' || suit === 'd';

  return (
    <div style={{ ...style, background: '#fff', borderColor: '#ddd', color: isRed ? '#dc2626' : '#111' }}>
      <span>{rank}</span>
      <span>{suitMap[suit] || suit}</span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Player Seat — used for opponents (seat 1–5)
// ─────────────────────────────────────────────────────────────
const PlayerSeat: React.FC<{
  player: PokerPlayer;
  isActive: boolean;
  phase: string;
  dealDelay?: number;
}> = ({ player, isActive, phase, dealDelay = 0 }) => {
  const isPlaying = phase !== 'waiting';
  const folded    = player.status === 'folded';
  const isWinner  = (player as any).isWinner === true;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      opacity: folded ? 0.45 : 1,
      minWidth: 60,
    }}>
      {/* Hole cards */}
      {isPlaying && player.holeCards.length > 0 && (
        <div style={{ display: 'flex', gap: 2, marginBottom: -4, position: 'relative', zIndex: 10 }}>
          {phase === 'showdown' && !folded
            ? player.holeCards.map((c, i) => (
                <TinyCard key={i} card={c} delay={dealDelay + i * 100} />
              ))
            : player.holeCards.map((_, i) => (
                <TinyCard key={i} faceDown delay={dealDelay + i * 100} />
              ))
          }
        </div>
      )}

      {/* Avatar */}
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 900,
          fontSize: 14,
          color: '#fff',
          background: 'linear-gradient(135deg,#374151,#1f2937)',
          border: `2.5px solid ${isWinner ? '#22c55e' : isActive && isPlaying ? '#f5a623' : '#4b5563'}`,
          boxShadow: isWinner
            ? '0 0 0 2px #22c55e, 0 0 14px rgba(34,197,94,0.5)'
            : isActive && isPlaying
              ? '0 0 0 2px #f5a623, 0 0 10px rgba(245,166,35,0.4)'
              : 'none',
          position: 'relative',
          flexShrink: 0,
        }}>
          {player.name.charAt(0).toUpperCase()}

          {/* Winner badge */}
          {isWinner && (
            <span style={{
              position: 'absolute',
              top: -14,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#16a34a',
              color: '#fff',
              fontSize: 7,
              fontWeight: 900,
              padding: '1px 5px',
              borderRadius: 2,
              whiteSpace: 'nowrap',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              Winner!
            </span>
          )}

          {/* Dealer button */}
          {player.isDealer && (
            <span style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              background: '#fff',
              color: '#111',
              fontSize: 6,
              fontWeight: 900,
              width: 13,
              height: 13,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #ccc',
              zIndex: 10,
            }}>
              D
            </span>
          )}
        </div>
      </div>

      {/* Name + chips plate */}
      <div style={{
        background: isActive && isPlaying
          ? 'rgba(80,55,0,0.92)'
          : 'rgba(10,14,12,0.92)',
        border: `0.5px solid ${isActive && isPlaying ? 'rgba(245,166,35,0.5)' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 3,
        padding: '2px 7px',
        textAlign: 'center',
        minWidth: 58,
      }}>
        <p style={{ fontSize: 9, fontWeight: 700, color: '#e5e7eb', lineHeight: 1.3, margin: 0 }}>
          {player.name}
        </p>
        <p style={{
          fontSize: 9,
          fontWeight: 700,
          color: '#f5a623',
          lineHeight: 1.3,
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}>
          <span style={{ width: 5, height: 5, background: '#f5a623', borderRadius: '50%', display: 'inline-block' }} />
          {formatCurrency(player.chips)}
        </p>
      </div>

      {/* Bet / status chip */}
      <div style={{ height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {player.bet > 0 && !folded && (
          <span style={{
            background: 'rgba(0,0,0,0.75)',
            color: '#f5a623',
            fontSize: 8,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 3,
            border: '0.5px solid rgba(245,166,35,0.35)',
          }}>
            ₹{player.bet}
          </span>
        )}
        {folded && (
          <span style={{ color: '#ef4444', fontSize: 8, fontWeight: 900 }}>FOLD</span>
        )}
        {player.status === 'allin' && !folded && (
          <span style={{ color: '#f5a623', fontSize: 8, fontWeight: 900 }}>ALL IN</span>
        )}
        {phase === 'showdown' && (player as any).handRank && !folded && (
          <span style={{ color: '#34d399', fontSize: 7, fontWeight: 700, maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(player as any).handRank}
          </span>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MY seat — always bottom-center, larger avatar, face-up cards
// ─────────────────────────────────────────────────────────────
const MySeat: React.FC<{
  player: PokerPlayer;
  isActive: boolean;
  phase: string;
}> = ({ player, isActive, phase }) => {
  const isPlaying = phase !== 'waiting';
  const folded    = player.status === 'folded';
  const isWinner  = (player as any).isWinner === true;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      opacity: folded ? 0.5 : 1,
    }}>
      {/* My hole cards — face up, slightly bigger */}
      {isPlaying && player.holeCards.length > 0 && (
        <div style={{ display: 'flex', gap: 3, marginBottom: -4, position: 'relative', zIndex: 10 }}>
          {player.holeCards.map((c, i) => {
            const rank = c.slice(0, -1);
            const suit = c.slice(-1);
            const suitMap: Record<string, string> = { h: '♥', d: '♦', s: '♠', c: '♣' };
            const isRed = suit === 'h' || suit === 'd';
            return (
              <div key={i} style={{
                width: 22,
                height: 32,
                borderRadius: 3,
                border: '0.5px solid #ccc',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8,
                fontWeight: 900,
                color: isRed ? '#dc2626' : '#111',
                lineHeight: 1,
                boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
              }}>
                <span>{rank}</span>
                <span>{suitMap[suit] || suit}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Avatar */}
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 900,
          fontSize: 18,
          color: '#fff',
          background: 'linear-gradient(135deg,#7c3aed,#2563eb)',
          border: `3px solid ${isWinner ? '#22c55e' : isActive && isPlaying ? '#f5a623' : '#7c3aed'}`,
          boxShadow: isWinner
            ? '0 0 0 2px #22c55e, 0 0 18px rgba(34,197,94,0.6)'
            : isActive && isPlaying
              ? '0 0 0 2px #f5a623, 0 0 14px rgba(245,166,35,0.5)'
              : 'none',
          position: 'relative',
        }}>
          {player.name.charAt(0).toUpperCase()}

          {isWinner && (
            <span style={{
              position: 'absolute',
              top: -16,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#16a34a',
              color: '#fff',
              fontSize: 8,
              fontWeight: 900,
              padding: '2px 6px',
              borderRadius: 3,
              whiteSpace: 'nowrap',
              textTransform: 'uppercase',
            }}>
              Winner!
            </span>
          )}

          {player.isDealer && (
            <span style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              background: '#fff',
              color: '#111',
              fontSize: 7,
              fontWeight: 900,
              width: 14,
              height: 14,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #ccc',
            }}>
              D
            </span>
          )}
        </div>
      </div>

      {/* Name + chips */}
      <div style={{
        background: isActive && isPlaying
          ? 'rgba(80,55,0,0.95)'
          : 'rgba(20,10,40,0.95)',
        border: `0.5px solid ${isActive && isPlaying ? 'rgba(245,166,35,0.5)' : 'rgba(124,58,237,0.4)'}`,
        borderRadius: 3,
        padding: '2px 10px',
        textAlign: 'center',
        minWidth: 72,
      }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#c4b5fd', lineHeight: 1.3, margin: 0 }}>
          You
        </p>
        <p style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#f5a623',
          lineHeight: 1.3,
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
        }}>
          <span style={{ width: 6, height: 6, background: '#f5a623', borderRadius: '50%', display: 'inline-block' }} />
          {formatCurrency(player.chips)}
        </p>
      </div>

      {/* Status */}
      <div style={{ height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {player.bet > 0 && !folded && (
          <span style={{
            background: 'rgba(0,0,0,0.75)',
            color: '#f5a623',
            fontSize: 9,
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 3,
            border: '0.5px solid rgba(245,166,35,0.35)',
          }}>
            ₹{player.bet}
          </span>
        )}
        {folded && <span style={{ color: '#ef4444', fontSize: 9, fontWeight: 900 }}>FOLD</span>}
        {player.status === 'allin' && !folded && (
          <span style={{ color: '#f5a623', fontSize: 9, fontWeight: 900 }}>ALL IN</span>
        )}
        {phase === 'showdown' && (player as any).handRank && !folded && (
          <span style={{ color: '#34d399', fontSize: 8, fontWeight: 700 }}>
            {(player as any).handRank}
          </span>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Buy-In Panel — shown when player is out of chips
// ─────────────────────────────────────────────────────────────
const BUY_IN_AMOUNTS = [500, 1000, 2000, 5000];

const BuyInPanel: React.FC<{
  walletBalance: number;
  onBuyIn: (amount: number) => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ walletBalance, onBuyIn, onCancel, loading }) => {
  const [selected, setSelected] = useState(1000);

  return (
    <div className="space-y-2">
      <div className="text-center">
        <p className="text-red-400 font-bold text-sm">Table chips khatam!</p>
        <p className="text-gray-400 text-xs">Wallet se chips khareed kar khelna jari rakho</p>
      </div>

      {/* Wallet balance */}
      <div className="flex items-center justify-center gap-2 bg-yellow-400/8 border border-yellow-400/25 rounded py-2 px-4">
        <Wallet className="w-4 h-4 text-yellow-400" />
        <span className="text-yellow-400 font-bold text-sm">Wallet: {formatCurrency(walletBalance)}</span>
      </div>

      {/* Amount grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {BUY_IN_AMOUNTS.map(amt => (
          <button
            key={amt}
            onClick={() => setSelected(amt)}
            disabled={amt > walletBalance}
            style={{ borderRadius: 4 }}
            className={`py-2 text-center border transition-all disabled:opacity-30
              ${selected === amt
                ? 'border-yellow-400 bg-yellow-400/15 text-yellow-400'
                : 'border-white/15 bg-white/5 text-white'
              }`}
          >
            <span className="block text-[11px] font-black">₹{(amt / 1000).toFixed(amt < 1000 ? 1 : 0)}k</span>
            <span className="block text-[9px] opacity-70">chips</span>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          style={{ borderRadius: 4 }}
          className="flex-1 py-2.5 text-sm font-bold text-white bg-white/7 border border-white/12">
          Cancel
        </button>
        <button
          onClick={() => onBuyIn(selected)}
          disabled={loading || selected > walletBalance}
          style={{ borderRadius: 4 }}
          className="flex-1 py-2.5 text-sm font-bold text-white bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <>
                <Wallet className="w-3.5 h-3.5" />
                Buy {formatCurrency(selected)}
              </>
          }
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
const PokerGamePage: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const { user }    = useAuth();
  const navigate    = useNavigate();

  const [table,         setTable]         = useState<PokerTable | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [buyInLoading,  setBuyInLoading]  = useState(false);
  const [leaving,       setLeaving]       = useState(false);
  const [raiseAmount,   setRaiseAmount]   = useState(0);
  const [error,         setError]         = useState('');
  const [showLeave,     setShowLeave]     = useState(false);
  const [showBuyIn,     setShowBuyIn]     = useState(false);

  const prevCount    = useRef(0);
  const autoStarted  = useRef(false);

  // ── Firebase subscriptions ──
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
        try { await checkAndAutoStart(tableId); } catch {}
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

  // ── Derived state ──
  const myPlayer    = table?.players.find(p => p.uid === user?.uid);
  const opponents   = table?.players.filter(p => p.uid !== user?.uid) ?? [];
  const isMyTurn    = table?.activePlayerUid === user?.uid;
  const phase       = table?.phase ?? 'waiting';
  const pot         = table?.pot ?? 0;
  const currentBet  = table?.currentBet ?? 0;
  const numPlayers  = table?.players.length ?? 0;
  const canStart    = numPlayers >= 2 && table?.status === 'waiting';

  const callAmount  = Math.max(0, Math.min(currentBet - (myPlayer?.bet ?? 0), myPlayer?.chips ?? 0));
  const minRaise    = Math.max(currentBet * 2, (table?.bigBlind ?? 20) * 2);
  const maxRaise    = (myPlayer?.chips ?? 0) + (myPlayer?.bet ?? 0);

  useEffect(() => {
    if (minRaise > 0) setRaiseAmount(Math.min(minRaise, maxRaise));
  }, [currentBet, minRaise, maxRaise]);

  const showError = (m: string) => { setError(m); setTimeout(() => setError(''), 3000); };

  // ── Actions ──
  const handleAction = async (action: 'fold' | 'check' | 'call' | 'raise' | 'allin') => {
    if (!user || !tableId || actionLoading) return;
    setActionLoading(true);
    try { await pokerAction(tableId, user.uid, action, action === 'raise' ? raiseAmount : undefined); }
    catch (e: any) { showError(e.message ?? 'Action failed'); }
    finally { setActionLoading(false); }
  };

  const handleLeave = async () => {
    if (!user || !tableId || leaving) return;
    setLeaving(true);
    try { await leavePokerTable(tableId, user.uid); navigate('/games/poker'); }
    catch (e: any) { showError(e.message); setLeaving(false); }
  };

  const handleBuyIn = async (amount: number) => {
    if (!user || !tableId || buyInLoading) return;
    setBuyInLoading(true);
    try {
      await buyInAtTable(tableId, user.uid, amount);
      setShowBuyIn(false);
    }
    catch (e: any) { showError(e.message ?? 'Buy-in failed'); }
    finally { setBuyInLoading(false); }
  };

  const adjustRaise = (delta: number) =>
    setRaiseAmount(prev => Math.max(minRaise, Math.min(prev + delta, maxRaise)));

  // ── Loading / not found ──
  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
    </div>
  );

  if (!table) return (
    <div className="h-screen bg-black flex items-center justify-center text-white">
      <div className="text-center">
        <p className="mb-4">Table not found</p>
        <button onClick={() => navigate('/games/poker')} className="text-yellow-400 text-sm">← Back</button>
      </div>
    </div>
  );

  const showActions = isMyTurn && phase !== 'waiting' && phase !== 'showdown'
    && myPlayer?.status === 'active';

  const walletBalance = (user as any)?.walletBalance ?? 0;
  const isOutOfChips  = (myPlayer?.chips ?? 0) <= 0;

  // ─────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col text-white select-none overflow-hidden"
      style={{ background: '#1a0a02' }}>

      {/* ══ HEADER ══ */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 z-40"
        style={{ background: '#111', borderBottom: '1px solid #2a2a2a' }}>

        {/* Pot amount — center */}
        <div className="flex-1" />
        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <p className="text-[9px] tracking-[2px] uppercase" style={{ color: '#888' }}>Pot Amount</p>
          <p className="text-[18px] font-black text-white leading-tight">
            {pot > 0 ? formatCurrency(pot) : '—'}
          </p>
        </div>

        {/* Phase badge */}
        <div className="flex-1 flex justify-end items-center gap-2">
          <span className="text-[10px] font-semibold capitalize" style={{ color: '#f5a623' }}>
            {phase === 'waiting' ? 'Waiting' : phase}
          </span>
          <button
            onClick={() => setShowLeave(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-red-400 text-[11px]
              font-bold uppercase active:scale-95 transition-transform"
            style={{ borderRadius: 4, border: '0.5px solid rgba(239,68,68,0.4)', background: 'rgba(127,29,29,0.2)' }}>
            <LogOut className="w-3 h-3" /> Exit
          </button>
        </div>
      </div>

      {/* Boot amount top-right */}
      {(table.bigBlind ?? 0) > 0 && (
        <div className="absolute top-10 right-3 text-right z-50" style={{ top: 44 }}>
          <p className="text-[8px] uppercase tracking-widest" style={{ color: '#888' }}>Boot</p>
          <p className="text-[11px] font-bold text-white">{formatCurrency((table.bigBlind ?? 0) / 2)}</p>
        </div>
      )}

      {/* ══ TABLE AREA ══ */}
      <div className="flex-1 flex items-center justify-center overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at center, #2a1200 0%, #1a0a02 100%)', paddingBottom: 8 }}>

        {/* Waiting overlay */}
        {phase === 'waiting' && numPlayers < 2 && (
          <div className="absolute inset-0 flex items-center justify-center z-30">
            <div className="text-center p-6 mx-4"
              style={{ background: 'rgba(20,20,20,0.96)', border: '1px solid #333', borderRadius: 8 }}>
              <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mx-auto mb-3" />
              <p className="text-white font-bold text-sm">Waiting for players...</p>
              <p className="text-xs mt-1" style={{ color: '#888' }}>{numPlayers}/2 joined</p>
              <p className="text-yellow-400 text-xs mt-2 font-semibold">Auto-starts when 2 players join!</p>
            </div>
          </div>
        )}

        {/*
          TABLE LAYOUT
          ┌──────────────────────────────────────┐
          │  outer wrapper (relative, 360×300)   │
          │  ┌─ oval wooden rim (300×180) ──────┐│
          │  │  ┌─ felt ─────────────────────┐  ││
          │  │  │  community cards + pot     │  ││
          │  │  └────────────────────────────┘  ││
          │  └──────────────────────────────────┘│
          │  opponent seats: absolute on wrapper  │
          │  your seat: pinned at bottom          │
          └──────────────────────────────────────┘
        */}
        <div style={{ position: 'relative', width: 360, height: 300 }}>

          {/* Oval table — centered in wrapper */}
          <div style={{
            position: 'absolute',
            top: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 310,
            height: 170,
            borderRadius: '50%',
            background: 'linear-gradient(160deg,#8a4f18,#5c3410,#3d2008)',
            boxShadow: '0 0 0 5px #9B6A2B, 0 10px 30px rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* Felt */}
            <div style={{
              width: 290,
              height: 150,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at 50% 40%, #1e7a48 0%, #0f6035 55%, #092d1a 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              position: 'relative',
            }}>
              {/* Watermark */}
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 36,
                fontWeight: 900,
                color: 'rgba(255,255,255,0.04)',
                letterSpacing: 3,
                pointerEvents: 'none',
              }}>
                ♠
              </div>

              {/* Community cards */}
              {phase !== 'waiting' && (
                <div style={{ display: 'flex', gap: 4, zIndex: 5, position: 'relative' }}>
                  {[...Array(5)].map((_, i) => (
                    <CommunityCard
                      key={i}
                      card={table.communityCards?.[i]}
                      delay={i * 120}
                    />
                  ))}
                </div>
              )}

              {/* Pot amount — below cards */}
              {pot > 0 && phase !== 'waiting' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'rgba(0,0,0,0.6)',
                  border: '0.5px solid rgba(245,166,35,0.35)',
                  borderRadius: 3,
                  padding: '2px 10px',
                  zIndex: 5,
                }}>
                  <span style={{ fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: '#b87a20' }}>
                    POT
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#f5a623', fontFamily: 'Georgia,serif' }}>
                    {formatCurrency(pot)}
                  </span>
                </div>
              )}

              {/* Showdown label */}
              {phase === 'showdown' && (
                <span style={{ fontSize: 11, fontWeight: 900, color: '#f5a623', zIndex: 5 }}>
                  Showdown!
                </span>
              )}
            </div>
          </div>

          {/* ── Opponent seats — absolute on wrapper ── */}
          {opponents.map((player, idx) => {
            // Map opponent index → seatIndex slot (1–5)
            const seatStyle = SEAT_STYLE[player.seatIndex] ?? SEAT_STYLE[1];
            return (
              <div key={player.uid} style={{ position: 'absolute', zIndex: 20, ...seatStyle }}>
                <PlayerSeat
                  player={player}
                  isActive={table.activePlayerUid === player.uid}
                  phase={phase}
                  dealDelay={idx * 150}
                />
              </div>
            );
          })}

          {/* ── MY seat — always bottom center ── */}
          {myPlayer && (
            <div style={{
              position: 'absolute',
              bottom: -10,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 25,
            }}>
              <MySeat
                player={myPlayer}
                isActive={isMyTurn}
                phase={phase}
              />
            </div>
          )}
        </div>
      </div>

      {/* ══ ERROR TOAST ══ */}
      {error && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 whitespace-nowrap"
          style={{
            bottom: 160,
            background: 'rgba(127,29,29,0.97)',
            border: '0.5px solid rgba(239,68,68,0.5)',
            color: '#fca5a5',
            fontSize: 12,
            padding: '6px 14px',
            borderRadius: 4,
          }}>
          {error}
        </div>
      )}

      {/* ══ BOTTOM ACTION AREA ══ */}
      <div className="shrink-0 z-40 px-3 pt-2 pb-3"
        style={{ background: 'rgba(10,10,10,0.98)', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>

        {/* WAITING */}
        {phase === 'waiting' && (
          <div className="text-center py-2">
            {canStart ? (
              <button
                onClick={() => tableId && startPokerHand(tableId)}
                className="font-black px-8 py-3 text-white active:scale-95 transition-transform"
                style={{ borderRadius: 5, background: '#16a34a' }}>
                Start Game
              </button>
            ) : (
              <p className="text-sm py-1" style={{ color: '#666' }}>
                Waiting for players... ({numPlayers}/2)
              </p>
            )}
          </div>
        )}

        {/* BUY-IN (chips khatam) */}
        {showBuyIn && phase !== 'waiting' && (
          <BuyInPanel
            walletBalance={walletBalance}
            onBuyIn={handleBuyIn}
            onCancel={() => setShowBuyIn(false)}
            loading={buyInLoading}
          />
        )}

        {/* MY TURN actions */}
        {!showBuyIn && showActions && (
          <div className="space-y-2 max-w-md mx-auto">
            <p className="text-center text-[11px] font-bold tracking-[2px] uppercase animate-pulse"
              style={{ color: '#22c55e' }}>
              Your Turn
            </p>

            {/* 4 action buttons */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={() => handleAction('fold')}
                disabled={actionLoading}
                className="flex flex-col items-center py-2.5 font-black text-[12px] text-white
                  active:scale-95 transition-transform disabled:opacity-40"
                style={{ borderRadius: 5, background: '#7f1d1d', border: '1.5px solid rgba(239,68,68,0.4)' }}>
                FOLD
              </button>

              {(myPlayer?.bet ?? 0) >= currentBet ? (
                <button
                  onClick={() => handleAction('check')}
                  disabled={actionLoading}
                  className="flex flex-col items-center py-2.5 font-black text-[12px] text-white
                    active:scale-95 transition-transform disabled:opacity-40"
                  style={{ borderRadius: 5, background: '#78350f', border: '1.5px solid rgba(234,179,8,0.4)' }}>
                  CHECK
                </button>
              ) : (
                <button
                  onClick={() => handleAction('call')}
                  disabled={actionLoading || callAmount === 0}
                  className="flex flex-col items-center py-2 font-black text-white
                    active:scale-95 transition-transform disabled:opacity-40"
                  style={{ borderRadius: 5, background: '#14532d', border: '1.5px solid rgba(34,197,94,0.4)' }}>
                  <span className="text-[12px]">CALL</span>
                  <span className="text-[9px] opacity-80">{formatCurrency(callAmount)}</span>
                </button>
              )}

              <button
                onClick={() => handleAction('raise')}
                disabled={actionLoading || (myPlayer?.chips ?? 0) <= callAmount || raiseAmount < minRaise}
                className="flex flex-col items-center py-2 font-black text-white
                  active:scale-95 transition-transform disabled:opacity-40"
                style={{ borderRadius: 5, background: '#3b0764', border: '1.5px solid rgba(168,85,247,0.4)' }}>
                <span className="text-[12px]">RAISE</span>
                <span className="text-[9px] opacity-80">{formatCurrency(Math.min(raiseAmount, maxRaise))}</span>
              </button>

              <button
                onClick={() => handleAction('allin')}
                disabled={actionLoading || (myPlayer?.chips ?? 0) === 0}
                className="flex flex-col items-center py-2 font-black text-white
                  active:scale-95 transition-transform disabled:opacity-40"
                style={{ borderRadius: 5, background: '#7c2d12', border: '1.5px solid rgba(249,115,22,0.4)' }}>
                <span className="text-[12px]">ALL IN</span>
                <span className="text-[9px] opacity-80">{formatCurrency(myPlayer?.chips ?? 0)}</span>
              </button>
            </div>

            {/* Raise slider row */}
            {(myPlayer?.chips ?? 0) > callAmount && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setRaiseAmount(minRaise)}
                  className="text-[10px] font-bold active:scale-95 px-2.5 py-2"
                  style={{ borderRadius: 4, color: '#f5a623', background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.15)' }}>
                  MIN
                </button>
                <button
                  onClick={() => adjustRaise(-(table.bigBlind ?? 10))}
                  className="w-9 h-9 flex items-center justify-center text-white text-lg active:scale-95"
                  style={{ borderRadius: 4, background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)' }}>
                  −
                </button>
                <div className="flex-1 text-center font-bold text-[15px] text-white py-2"
                  style={{ borderRadius: 4, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', fontFamily: 'Georgia,serif' }}>
                  {formatCurrency(Math.min(raiseAmount, maxRaise))}
                </div>
                <button
                  onClick={() => adjustRaise(table.bigBlind ?? 10)}
                  className="w-9 h-9 flex items-center justify-center text-white text-lg active:scale-95"
                  style={{ borderRadius: 4, background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)' }}>
                  +
                </button>
                <button
                  onClick={() => setRaiseAmount(maxRaise)}
                  className="text-[10px] font-bold active:scale-95 px-2.5 py-2"
                  style={{ borderRadius: 4, color: '#f5a623', background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.15)' }}>
                  MAX
                </button>
              </div>
            )}
          </div>
        )}

        {/* NOT MY TURN */}
        {!showBuyIn && !isMyTurn && phase !== 'waiting' && phase !== 'showdown'
          && myPlayer?.status === 'active' && (
          <p className="text-center text-sm py-3" style={{ color: '#9ca3af' }}>
            <span className="inline-block w-2 h-2 rounded-full mr-2 animate-ping"
              style={{ background: '#f5a623', verticalAlign: 'middle' }} />
            {table.players.find(p => p.uid === table.activePlayerUid)?.name ?? 'Player'}'s turn...
          </p>
        )}

        {/* FOLDED */}
        {!showBuyIn && myPlayer?.status === 'folded' && phase !== 'showdown' && (
          <p className="text-center text-sm py-3" style={{ color: 'rgba(239,68,68,0.7)' }}>
            You folded — watching...
          </p>
        )}

        {/* ALL IN */}
        {!showBuyIn && myPlayer?.status === 'allin' && phase !== 'showdown' && (
          <p className="text-center font-black text-sm py-3 animate-pulse" style={{ color: '#f5a623' }}>
            ALL IN — Waiting for showdown...
          </p>
        )}

        {/* SHOWDOWN */}
        {!showBuyIn && phase === 'showdown' && (
          <div className="text-center py-2 space-y-2">
            {isOutOfChips ? (
              <div>
                <p className="text-red-400 font-bold text-sm mb-1">Chips khatam ho gaye!</p>
                <button
                  onClick={() => setShowBuyIn(true)}
                  className="font-bold text-sm px-6 py-2 text-white active:scale-95 transition-transform"
                  style={{ borderRadius: 5, background: '#16a34a' }}>
                  <Wallet className="w-4 h-4 inline mr-1" /> Wallet se Buy-In karo
                </button>
              </div>
            ) : (
              <p className="text-sm flex items-center justify-center gap-2" style={{ color: '#9ca3af' }}>
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#f5a623' } as any} />
                Next hand in 4s...
              </p>
            )}
          </div>
        )}
      </div>

      {/* ══ LEAVE MODAL ══ */}
      {showLeave && (
        <div className="absolute inset-0 flex items-center justify-center z-[100] px-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-[300px] text-center p-6"
            style={{ background: '#0d1a12', border: '0.5px solid rgba(245,166,35,0.25)', borderRadius: 8 }}>
            <LogOut className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-white font-black text-lg mb-1" style={{ fontFamily: 'Georgia,serif' }}>
              Leave Table?
            </h3>
            <p className="text-sm mb-4" style={{ color: 'rgba(156,163,175,0.85)' }}>
              Remaining chips return to your wallet.
            </p>
            {(myPlayer?.chips ?? 0) > 0 && (
              <p className="font-black text-2xl mb-5" style={{ color: '#34d399', fontFamily: 'Georgia,serif' }}>
                +{formatCurrency(myPlayer!.chips)}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeave(false)}
                className="flex-1 font-bold py-3 text-sm text-white"
                style={{ borderRadius: 4, background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.12)' }}>
                Stay
              </button>
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="flex-1 font-bold py-3 text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ borderRadius: 4, background: '#dc2626' }}>
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
