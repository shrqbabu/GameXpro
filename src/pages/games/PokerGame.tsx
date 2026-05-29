import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { deductFunds, addFunds } from '../../firebase/wallet';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────
type Suit = '♠' | '♥' | '♦' | '♣';
type Phase = 'LOBBY' | 'PRE_FLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
type PlayerAction = 'FOLD' | 'CHECK' | 'CALL' | 'RAISE' | null;

interface Card { value: string; suit: Suit; rank: number }

const VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS: Suit[] = ['♠','♥','♦','♣'];
const BET_AMOUNTS = [10, 25, 50, 100, 200];

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (let i = 0; i < VALUES.length; i++) deck.push({ value: VALUES[i], suit: s, rank: i + 2 });
  return deck.sort(() => Math.random() - 0.5);
}

function isRed(suit: Suit) { return suit === '♥' || suit === '♦'; }

// ─── Simple hand evaluator ────────────────────────────────────────────────────
function evaluateHand(cards: Card[]): { score: number; name: string } {
  const best = getBestFiveFrom(cards);
  return best;
}

function getBestFiveFrom(cards: Card[]): { score: number; name: string } {
  // Return highest score among all C(7,5) combos
  const combos = choose5(cards);
  let best = { score: 0, name: 'High Card' };
  for (const c of combos) {
    const r = scoreFive(c);
    if (r.score > best.score) best = r;
  }
  return best;
}

function choose5(cards: Card[]): Card[][] {
  const result: Card[][] = [];
  for (let i = 0; i < cards.length; i++)
    for (let j = i+1; j < cards.length; j++)
      for (let k = j+1; k < cards.length; k++)
        for (let l = k+1; l < cards.length; l++)
          for (let m = l+1; m < cards.length; m++)
            result.push([cards[i],cards[j],cards[k],cards[l],cards[m]]);
  return result;
}

function scoreFive(cards: Card[]): { score: number; name: string } {
  const ranks = cards.map(c => c.rank).sort((a,b)=>b-a);
  const suits = cards.map(c => c.suit);
  const flush = suits.every(s => s === suits[0]);
  const straight = ranks[0]-ranks[4]===4 && new Set(ranks).size===5;
  const straightAceLow = JSON.stringify(ranks) === JSON.stringify([14,5,4,3,2]);
  const groups = Object.values(ranks.reduce((a: Record<number,number>,r)=>{a[r]=(a[r]||0)+1;return a;},{})).sort((a,b)=>b-a);
  const topRank = ranks[0];

  if ((straight||straightAceLow) && flush) return { score: 800+topRank, name: straight && topRank===14 ? '🏆 Royal Flush' : '🎯 Straight Flush' };
  if (groups[0]===4) return { score: 700+topRank, name: '4️⃣ Four of a Kind' };
  if (groups[0]===3 && groups[1]===2) return { score: 600+topRank, name: '🏠 Full House' };
  if (flush) return { score: 500+topRank, name: '♠ Flush' };
  if (straight||straightAceLow) return { score: 400+topRank, name: '⬆️ Straight' };
  if (groups[0]===3) return { score: 300+topRank, name: '3️⃣ Three of a Kind' };
  if (groups[0]===2 && groups[1]===2) return { score: 200+topRank, name: '✌️ Two Pair' };
  if (groups[0]===2) return { score: 100+topRank, name: '👥 One Pair' };
  return { score: topRank, name: '🃏 High Card' };
}

// ─── Card component ───────────────────────────────────────────────────────────
function PokerCard({ card, faceDown, small }: { card?: Card; faceDown?: boolean; small?: boolean }) {
  const sz = small ? { w: 40, h: 56, fs: 10, sf: 14 } : { w: 60, h: 84, fs: 13, sf: 22 };
  if (faceDown || !card) {
    return (
      <div style={{ width:sz.w, height:sz.h, background:'linear-gradient(135deg,#1a0a3e,#0d1b2a)', border:'2px solid rgba(212,175,55,0.5)', borderRadius:7, display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
        <div style={{ width:sz.w-14, height:sz.h-14, border:'1px solid rgba(212,175,55,0.2)', borderRadius:4, background:'repeating-linear-gradient(45deg,rgba(212,175,55,0.04) 0,rgba(212,175,55,0.04) 2px,transparent 2px,transparent 8px)' }} />
      </div>
    );
  }
  const red = isRed(card.suit);
  return (
    <div style={{ width:sz.w, height:sz.h, background:'linear-gradient(135deg,#fffef5,#f8f4e8)', border:`2px solid ${red?'rgba(248,113,113,0.7)':'rgba(30,30,50,0.4)'}`, borderRadius:7, display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center', flexShrink:0, position:'relative', animation:'cardIn 0.35s ease-out' }}>
      <span style={{ position:'absolute',top:3,left:5,fontFamily:"'Cinzel',serif",fontSize:sz.fs,fontWeight:800,color:red?'#dc2626':'#1a1a2e',lineHeight:1 }}>{card.value}</span>
      <span style={{ fontSize:sz.sf, color:red?'#dc2626':'#1a1a2e' }}>{card.suit}</span>
      <span style={{ position:'absolute',bottom:3,right:5,fontFamily:"'Cinzel',serif",fontSize:sz.fs,fontWeight:800,color:red?'#dc2626':'#1a1a2e',lineHeight:1,transform:'rotate(180deg)' }}>{card.value}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function PokerGame() {
  const navigate = useNavigate();
  const { user, wallet } = useAuth();
  const [phase, setPhase] = useState<Phase>('LOBBY');
  const [buyIn, setBuyIn] = useState(100);
  const [customBuyIn, setCustomBuyIn] = useState('');
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [botHand, setBotHand] = useState<Card[]>([]);
  const [community, setCommunity] = useState<Card[]>([]);
  const [pot, setPot] = useState(0);
  const [playerStack, setPlayerStack] = useState(0);
  const [botStack, setBotStack] = useState(1000);
  const [playerBet, setPlayerBet] = useState(0);
  const [botBet, setBotBet] = useState(0);
  const [raiseAmount, setRaiseAmount] = useState(50);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [winner, setWinner] = useState<'PLAYER' | 'BOT' | 'TIE' | null>(null);
  const [showBotCards, setShowBotCards] = useState(false);
  const [playerHandName, setPlayerHandName] = useState('');
  const [botHandName, setBotHandName] = useState('');
  const [history, setHistory] = useState<('WIN'|'LOSE'|'TIE')[]>([]);

  const effectiveBuyIn = customBuyIn ? parseInt(customBuyIn) || 0 : buyIn;
  const balance = wallet?.totalBalance ?? 0;
  const SMALL_BLIND = Math.max(5, Math.floor(effectiveBuyIn * 0.05));
  const BIG_BLIND = SMALL_BLIND * 2;

  const startGame = async () => {
    if (effectiveBuyIn < 20) return toast.error('Minimum buy-in ₹20 hai');
    if (!wallet || balance < effectiveBuyIn) return toast.error('Insufficient balance');
    if (!user) return;
    setLoading(true);
    try {
      await deductFunds(user.uid, effectiveBuyIn, 'GAME_LOSS', 'Poker buy-in');
      const d = buildDeck();
      const ph = [d[0], d[2]];
      const bh = [d[1], d[3]];
      const remaining = d.slice(4);
      setDeck(remaining);
      setPlayerHand(ph);
      setBotHand(bh);
      setCommunity([]);
      setPlayerStack(effectiveBuyIn - BIG_BLIND);
      setBotStack(1000 - SMALL_BLIND);
      setPlayerBet(BIG_BLIND);
      setBotBet(SMALL_BLIND);
      setPot(BIG_BLIND + SMALL_BLIND);
      setWinner(null);
      setShowBotCards(false);
      setMessage(`You: Big Blind ₹${BIG_BLIND} | Bot: Small Blind ₹${SMALL_BLIND}`);
      setPhase('PRE_FLOP');
    } catch (e: any) {
      toast.error(e.message || 'Error');
    }
    setLoading(false);
  };

  const botAction = (currentPot: number, currentComm: Card[], nextPhase: Phase, currentDeck: Card[]) => {
    const botHandEval = evaluateHand([...botHand, ...currentComm]);
    const shouldBluff = Math.random() < 0.25;
    if (botHandEval.score > 300 || shouldBluff) {
      const raisePct = Math.floor(currentPot * (0.3 + Math.random() * 0.4));
      setBotBet(b => b + raisePct);
      setBotStack(s => s - raisePct);
      setPot(p => p + raisePct);
      setMessage(`Bot raises ₹${raisePct}! Call, Raise, or Fold?`);
    } else {
      setMessage('Bot checks. Your turn!');
    }
    setPhase(nextPhase);
  };

  const dealFlop = () => {
    const flop = [deck[0], deck[1], deck[2]];
    const rest = deck.slice(3);
    setDeck(rest);
    setCommunity(flop);
    botAction(pot, flop, 'FLOP', rest);
  };

  const dealTurn = () => {
    const card = deck[0];
    const rest = deck.slice(1);
    setDeck(rest);
    const newComm = [...community, card];
    setCommunity(newComm);
    botAction(pot, newComm, 'TURN', rest);
  };

  const dealRiver = () => {
    const card = deck[0];
    setDeck(deck.slice(1));
    const newComm = [...community, card];
    setCommunity(newComm);
    botAction(pot, newComm, 'RIVER', deck.slice(1));
  };

  const showdown = async () => {
    setShowBotCards(true);
    const allComm = community;
    const pH = evaluateHand([...playerHand, ...allComm]);
    const bH = evaluateHand([...botHand, ...allComm]);
    setPlayerHandName(pH.name);
    setBotHandName(bH.name);

    let w: 'PLAYER' | 'BOT' | 'TIE';
    if (pH.score > bH.score) w = 'PLAYER';
    else if (bH.score > pH.score) w = 'BOT';
    else w = 'TIE';
    setWinner(w);
    setHistory(h => [w === 'PLAYER' ? 'WIN' : w === 'BOT' ? 'LOSE' : 'TIE', ...h.slice(0,19)]);

    if (w === 'PLAYER' && user) {
      await addFunds(user.uid, pot, 'winningBalance', 'Poker win');
      setMessage(`🎉 Aap jeete! ₹${pot} pot mila | ${pH.name}`);
      toast.success(`Poker mein jeete! ₹${pot}`);
    } else if (w === 'BOT') {
      setMessage(`💔 Bot jeeta (${bH.name} vs ${pH.name})`);
      toast.error('Bot jeeta');
    } else {
      const split = Math.floor(pot / 2);
      if (user) await addFunds(user.uid, split, 'winningBalance', 'Poker tie split');
      setMessage(`🤝 Tie! ₹${split} wapas mila | ${pH.name}`);
      toast('Tie! Pot split hua');
    }
    setPhase('SHOWDOWN');
  };

  const playerFold = async () => {
    setWinner('BOT');
    setShowBotCards(true);
    setHistory(h => ['LOSE', ...h.slice(0,19)]);
    setMessage('Aapne fold kiya. Bot jeeta!');
    setPhase('SHOWDOWN');
    toast.error('Fold kar diya');
  };

  const playerCall = () => {
    const diff = botBet - playerBet;
    const actualCall = Math.min(diff, playerStack);
    setPlayerStack(s => s - actualCall);
    setPlayerBet(b => b + actualCall);
    setPot(p => p + actualCall);
    if (phase === 'PRE_FLOP') dealFlop();
    else if (phase === 'FLOP') dealTurn();
    else if (phase === 'TURN') dealRiver();
    else if (phase === 'RIVER') showdown();
  };

  const playerCheck = () => {
    if (phase === 'PRE_FLOP') dealFlop();
    else if (phase === 'FLOP') dealTurn();
    else if (phase === 'TURN') dealRiver();
    else if (phase === 'RIVER') showdown();
  };

  const playerRaise = () => {
    if (raiseAmount <= 0 || raiseAmount > playerStack) return toast.error('Invalid raise amount');
    setPlayerStack(s => s - raiseAmount);
    setPlayerBet(b => b + raiseAmount);
    setPot(p => p + raiseAmount);
    // Bot responds
    const botFolds = Math.random() < 0.3;
    if (botFolds) {
      setWinner('PLAYER');
      setMessage(`🎉 Bot ne fold kiya! Pot ₹${pot + raiseAmount} aapka`);
      setHistory(h => ['WIN', ...h.slice(0,19)]);
      if (user) addFunds(user.uid, pot + raiseAmount, 'winningBalance', 'Poker win - bot folded');
      setPhase('SHOWDOWN');
    } else {
      setBotBet(b => b + Math.floor(raiseAmount * 0.8));
      setBotStack(s => s - Math.floor(raiseAmount * 0.8));
      setPot(p => p + Math.floor(raiseAmount * 0.8));
      if (phase === 'PRE_FLOP') dealFlop();
      else if (phase === 'FLOP') dealTurn();
      else if (phase === 'TURN') dealRiver();
      else if (phase === 'RIVER') showdown();
    }
  };

  const resetGame = () => {
    setPhase('LOBBY');
    setWinner(null);
    setShowBotCards(false);
    setPlayerHand([]);
    setBotHand([]);
    setCommunity([]);
    setMessage('');
    setPlayerHandName('');
    setBotHandName('');
    setPot(0);
  };

  return (
    <div className="poker-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;800&family=Raleway:wght@300;400;500&display=swap');
        @keyframes cardIn{from{opacity:0;transform:translateY(-16px) scale(0.85)}to{opacity:1;transform:translateY(0) scale(1)}}
        .poker-root{min-height:100vh;background:radial-gradient(ellipse at top,#0f1f0a 0%,#071305 60%,#000 100%);font-family:'Raleway',sans-serif;color:#e2e8f0;padding-bottom:40px;}
        .pk-header{display:flex;align-items:center;gap:12px;padding:20px 24px;border-bottom:1px solid rgba(34,197,94,0.2);background:rgba(0,0,0,0.5);backdrop-filter:blur(10px);position:sticky;top:0;z-index:10;}
        .pk-back{background:none;border:1px solid rgba(34,197,94,0.3);color:#22c55e;padding:8px 16px;border-radius:8px;cursor:pointer;font-family:'Raleway',sans-serif;font-size:13px;transition:all 0.2s;}
        .pk-back:hover{background:rgba(34,197,94,0.1);}
        .pk-title{font-family:'Cinzel',serif;font-size:20px;font-weight:800;background:linear-gradient(135deg,#22c55e,#86efac,#22c55e);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:2px;}
        .pk-balance{margin-left:auto;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);padding:6px 14px;border-radius:20px;font-size:13px;color:#22c55e;font-weight:500;}
        .pk-table{max-width:720px;margin:24px auto 0;padding:0 16px;}
        .felt{background:radial-gradient(ellipse,#0d2b0d 0%,#061806 70%,#020b02 100%);border:3px solid rgba(34,197,94,0.5);border-radius:24px;padding:28px 20px;position:relative;box-shadow:0 0 60px rgba(34,197,94,0.1),inset 0 0 40px rgba(0,0,0,0.6);}
        .felt::before{content:'';position:absolute;inset:6px;border:1px solid rgba(34,197,94,0.12);border-radius:18px;pointer-events:none;}

        /* Table sections */
        .bot-area,.player-area{padding:12px;border-radius:12px;margin-bottom:12px;}
        .bot-area{background:rgba(239,68,68,0.04);border:1px solid rgba(239,68,68,0.15);}
        .player-area{background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.15);}
        .area-label{font-family:'Cinzel',serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;}
        .bot-label{color:rgba(239,68,68,0.7);}
        .player-label{color:rgba(34,197,94,0.7);}
        .hand-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
        .hand-name{font-family:'Cinzel',serif;font-size:11px;color:#d4af37;margin-left:8px;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);padding:2px 8px;border-radius:10px;}

        /* Community cards */
        .community-area{background:rgba(212,175,55,0.03);border:1px solid rgba(212,175,55,0.15);border-radius:12px;padding:14px 12px;margin-bottom:14px;text-align:center;}
        .community-label{font-family:'Cinzel',serif;font-size:10px;letter-spacing:3px;color:rgba(212,175,55,0.6);text-transform:uppercase;margin-bottom:10px;}
        .community-cards{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}
        .empty-slot{width:60px;height:84px;border:2px dashed rgba(212,175,55,0.15);border-radius:7px;}

        /* Pot */
        .pot-display{text-align:center;margin-bottom:16px;}
        .pot-label{font-size:11px;color:rgba(212,175,55,0.5);letter-spacing:2px;text-transform:uppercase;}
        .pot-amount{font-family:'Cinzel',serif;font-size:28px;font-weight:800;color:#d4af37;}

        /* Message */
        .game-message{text-align:center;padding:10px 16px;background:rgba(0,0,0,0.3);border-radius:8px;font-size:13px;color:rgba(226,232,240,0.8);margin-bottom:16px;min-height:36px;border:1px solid rgba(255,255,255,0.05);}

        /* Actions */
        .action-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px;}
        .act-btn{padding:12px 20px;border-radius:10px;border:2px solid transparent;cursor:pointer;font-family:'Cinzel',serif;font-size:13px;font-weight:700;letter-spacing:1px;transition:all 0.2s;min-width:80px;}
        .fold-btn{background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.4);color:#ef4444;}
        .fold-btn:hover{background:rgba(239,68,68,0.22);border-color:#ef4444;}
        .check-btn{background:rgba(226,232,240,0.08);border-color:rgba(226,232,240,0.25);color:#e2e8f0;}
        .check-btn:hover{background:rgba(226,232,240,0.15);border-color:#e2e8f0;}
        .call-btn{background:rgba(34,197,94,0.12);border-color:rgba(34,197,94,0.4);color:#22c55e;}
        .call-btn:hover{background:rgba(34,197,94,0.22);border-color:#22c55e;}
        .raise-btn{background:rgba(212,175,55,0.12);border-color:rgba(212,175,55,0.4);color:#d4af37;}
        .raise-btn:hover{background:rgba(212,175,55,0.22);border-color:#d4af37;}
        .act-btn:disabled{opacity:0.35;cursor:not-allowed;}
        .raise-input-row{display:flex;align-items:center;gap:8px;justify-content:center;margin-bottom:12px;}
        .raise-input-row input{background:rgba(255,255,255,0.05);border:1px solid rgba(212,175,55,0.3);color:#e2e8f0;padding:7px 12px;border-radius:8px;font-family:'Raleway',sans-serif;font-size:14px;width:90px;text-align:center;outline:none;}
        .raise-input-row input:focus{border-color:#d4af37;}
        .raise-label{font-size:12px;color:rgba(212,175,55,0.6);}

        /* Lobby */
        .lobby{text-align:center;padding:20px 0;}
        .lobby-title{font-family:'Cinzel',serif;font-size:24px;font-weight:800;color:#22c55e;margin-bottom:8px;letter-spacing:2px;}
        .lobby-sub{color:rgba(226,232,240,0.5);font-size:14px;margin-bottom:24px;}
        .buyin-chips{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:14px;}
        .buyin-chip{padding:8px 16px;border-radius:20px;border:2px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.05);color:#22c55e;cursor:pointer;font-family:'Cinzel',serif;font-size:13px;font-weight:700;transition:all 0.2s;}
        .buyin-chip:hover,.buyin-chip.active{background:rgba(34,197,94,0.2);border-color:#22c55e;transform:scale(1.05);}
        .custom-buyin{display:flex;align-items:center;gap:8px;justify-content:center;margin-bottom:20px;}
        .custom-buyin input{background:rgba(255,255,255,0.05);border:1px solid rgba(34,197,94,0.3);color:#e2e8f0;padding:8px 12px;border-radius:8px;font-family:'Raleway',sans-serif;font-size:14px;width:110px;text-align:center;outline:none;}
        .custom-buyin input:focus{border-color:#22c55e;}
        .custom-buyin-label{font-size:12px;color:rgba(34,197,94,0.6);}
        .start-btn{padding:16px 48px;border-radius:12px;border:none;background:linear-gradient(135deg,#16a34a,#22c55e,#16a34a);color:#fff;font-family:'Cinzel',serif;font-size:16px;font-weight:800;letter-spacing:2px;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 20px rgba(34,197,94,0.3);}
        .start-btn:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(34,197,94,0.5);}
        .start-btn:disabled{opacity:0.4;cursor:not-allowed;transform:none;}
        .blinds-info{color:rgba(212,175,55,0.6);font-size:12px;margin-bottom:16px;}

        /* Showdown */
        .showdown-result{text-align:center;padding:12px 0 18px;}
        .sd-win{font-family:'Cinzel',serif;font-size:22px;font-weight:800;color:#22c55e;}
        .sd-lose{font-family:'Cinzel',serif;font-size:22px;font-weight:800;color:#ef4444;}
        .sd-tie{font-family:'Cinzel',serif;font-size:22px;font-weight:800;color:#d4af37;}
        .sd-sub{font-size:13px;color:rgba(226,232,240,0.6);margin-top:4px;margin-bottom:18px;}
        .new-game-btn{background:rgba(34,197,94,0.1);border:2px solid #22c55e;color:#22c55e;padding:12px 32px;border-radius:10px;cursor:pointer;font-family:'Cinzel',serif;font-size:14px;transition:all 0.2s;}
        .new-game-btn:hover{background:rgba(34,197,94,0.2);}

        .stacks-row{display:flex;justify-content:space-between;margin-bottom:10px;font-size:12px;color:rgba(226,232,240,0.5);}
        .stack-info span{color:#22c55e;font-weight:600;}

        .history-strip{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:16px;padding-top:14px;border-top:1px solid rgba(34,197,94,0.1);}
        .history-label{width:100%;text-align:center;font-size:10px;color:rgba(34,197,94,0.4);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;}
        .hist-dot{width:26px;height:26px;border-radius:50%;font-size:9px;font-family:'Cinzel',serif;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid;}
        .hist-w{background:rgba(34,197,94,0.15);border-color:rgba(34,197,94,0.5);color:#22c55e;}
        .hist-l{background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.5);color:#ef4444;}
        .hist-t{background:rgba(212,175,55,0.15);border-color:rgba(212,175,55,0.5);color:#d4af37;}
      `}</style>

      <div className="pk-header">
        <button className="pk-back" onClick={() => navigate('/dashboard')}>← Back</button>
        <span className="pk-title">♠ Poker</span>
        <span className="pk-balance">₹{balance.toLocaleString('en-IN')}</span>
      </div>

      <div className="pk-table">
        <div className="felt">

          {/* LOBBY */}
          {phase === 'LOBBY' && (
            <div className="lobby">
              <div className="lobby-title">Texas Hold'em Poker</div>
              <div className="lobby-sub">Bot ke against 1v1 khelo</div>
              <div className="buyin-chips">
                {[50,100,200,500,1000].map(a => (
                  <button key={a} className={`buyin-chip ${!customBuyIn && buyIn === a ? 'active' : ''}`}
                    onClick={() => { setBuyIn(a); setCustomBuyIn(''); }}>
                    ₹{a}
                  </button>
                ))}
              </div>
              <div className="custom-buyin">
                <span className="custom-buyin-label">Custom:</span>
                <input type="number" placeholder="Buy-in" value={customBuyIn}
                  onChange={e => setCustomBuyIn(e.target.value)} min={20} />
              </div>
              <div className="blinds-info">
                Blinds: Small ₹{Math.max(5, Math.floor(effectiveBuyIn * 0.05))} / Big ₹{Math.max(10, Math.floor(effectiveBuyIn * 0.1))}
              </div>
              <button className="start-btn" onClick={startGame} disabled={loading}>
                {loading ? 'Starting...' : `Game Shuru Karo — ₹${effectiveBuyIn}`}
              </button>
            </div>
          )}

          {/* GAME IN PROGRESS */}
          {phase !== 'LOBBY' && (
            <>
              <div className="stacks-row">
                <div className="stack-info">Bot Stack: <span>₹{botStack}</span></div>
                <div className="stack-info">Aapka Stack: <span>₹{playerStack}</span></div>
              </div>

              {/* Bot hand */}
              <div className="bot-area">
                <div className="area-label bot-label">Bot ki Hand</div>
                <div className="hand-row">
                  {botHand.map((c, i) => <PokerCard key={i} card={c} faceDown={!showBotCards} />)}
                  {showBotCards && botHandName && <span className="hand-name">{botHandName}</span>}
                </div>
              </div>

              {/* Community */}
              <div className="community-area">
                <div className="community-label">Community Cards</div>
                <div className="community-cards">
                  {[0,1,2,3,4].map(i => community[i]
                    ? <PokerCard key={i} card={community[i]} />
                    : <div key={i} className="empty-slot" />)}
                </div>
              </div>

              {/* Pot */}
              <div className="pot-display">
                <div className="pot-label">Pot</div>
                <div className="pot-amount">₹{pot.toLocaleString('en-IN')}</div>
              </div>

              {/* Player hand */}
              <div className="player-area">
                <div className="area-label player-label">Aapki Hand</div>
                <div className="hand-row">
                  {playerHand.map((c, i) => <PokerCard key={i} card={c} />)}
                  {playerHandName && <span className="hand-name">{playerHandName}</span>}
                </div>
              </div>

              {/* Message */}
              <div className="game-message">{message}</div>

              {/* SHOWDOWN result */}
              {phase === 'SHOWDOWN' && (
                <div className="showdown-result">
                  <div className={winner === 'PLAYER' ? 'sd-win' : winner === 'BOT' ? 'sd-lose' : 'sd-tie'}>
                    {winner === 'PLAYER' ? '🎉 Aap Jeete!' : winner === 'BOT' ? '💔 Bot Jeeta' : '🤝 Tie!'}
                  </div>
                  <div className="sd-sub">{message}</div>
                  <button className="new-game-btn" onClick={resetGame}>Naya Game</button>
                </div>
              )}

              {/* Actions */}
              {phase !== 'SHOWDOWN' && (
                <>
                  <div className="raise-input-row">
                    <span className="raise-label">Raise:</span>
                    <input type="number" value={raiseAmount} min={BIG_BLIND}
                      onChange={e => setRaiseAmount(parseInt(e.target.value)||BIG_BLIND)} />
                  </div>
                  <div className="action-bar">
                    <button className="act-btn fold-btn" onClick={playerFold}>Fold</button>
                    <button className="act-btn check-btn" onClick={playerCheck}
                      disabled={botBet > playerBet}>Check</button>
                    <button className="act-btn call-btn" onClick={playerCall}
                      disabled={botBet <= playerBet}>
                      Call {botBet > playerBet ? `₹${Math.min(botBet-playerBet, playerStack)}` : ''}
                    </button>
                    <button className="act-btn raise-btn" onClick={playerRaise}
                      disabled={raiseAmount > playerStack}>Raise</button>
                  </div>
                </>
              )}
            </>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="history-strip">
              <div className="history-label">Last Games</div>
              {history.map((h, i) => (
                <div key={i} className={`hist-dot ${h==='WIN'?'hist-w':h==='LOSE'?'hist-l':'hist-t'}`}>
                  {h==='WIN'?'W':h==='LOSE'?'L':'T'}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
