import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { deductFunds, addFunds } from '../../firebase/wallet';
import toast from 'react-hot-toast';

type DTChoice = 'DRAGON' | 'TIGER' | 'TIE';
type GamePhase = 'BETTING' | 'DEALING' | 'RESULT';

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS: Record<string, string> = { '♠': '#e2e8f0', '♥': '#f87171', '♦': '#f87171', '♣': '#e2e8f0' };
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const BET_AMOUNTS = [10, 50, 100, 500, 1000];

function randomCard() {
  const v = VALUES[Math.floor(Math.random() * VALUES.length)];
  const s = SUITS[Math.floor(Math.random() * SUITS.length)];
  const rank = VALUES.indexOf(v) + 1;
  return { value: v, suit: s, rank };
}

function getWinner(d: { rank: number }, t: { rank: number }): DTChoice {
  if (d.rank > t.rank) return 'DRAGON';
  if (t.rank > d.rank) return 'TIGER';
  return 'TIE';
}

const PAYOUT: Record<DTChoice, number> = { DRAGON: 2, TIGER: 2, TIE: 8 };

interface PlayingCardProps {
  card?: { value: string; suit: string } | null;
  faceDown?: boolean;
  flip?: boolean;
}

function PlayingCard({ card, faceDown, flip }: PlayingCardProps) {
  const isRed = card && (card.suit === '♥' || card.suit === '♦');
  return (
    <div className={`card-wrapper ${flip ? 'flip' : ''}`}>
      <div className="card-inner">
        <div className="card-back">
          <div className="card-back-pattern" />
        </div>
        <div className="card-front">
          {card && (
            <>
              <span className="card-corner top-left" style={{ color: isRed ? '#f87171' : '#e2e8f0' }}>
                <span className="card-val">{card.value}</span>
                <span className="card-suit-sm">{card.suit}</span>
              </span>
              <span className="card-center-suit" style={{ color: isRed ? '#f87171' : '#e2e8f0' }}>
                {card.suit}
              </span>
              <span className="card-corner bottom-right" style={{ color: isRed ? '#f87171' : '#e2e8f0' }}>
                <span className="card-val">{card.value}</span>
                <span className="card-suit-sm">{card.suit}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function DragonTiger() {
  const navigate = useNavigate();
  const { user, wallet } = useAuth();
  const [phase, setPhase] = useState<GamePhase>('BETTING');
  const [betAmount, setBetAmount] = useState(50);
  const [customBet, setCustomBet] = useState('');
  const [choice, setChoice] = useState<DTChoice | null>(null);
  const [dragonCard, setDragonCard] = useState<any>(null);
  const [tigerCard, setTigerCard] = useState<any>(null);
  const [winner, setWinner] = useState<DTChoice | null>(null);
  const [flipDragon, setFlipDragon] = useState(false);
  const [flipTiger, setFlipTiger] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState('');
  const [history, setHistory] = useState<DTChoice[]>([]);

  const effectiveBet = customBet ? parseInt(customBet) || 0 : betAmount;

  const handlePlaceBet = async () => {
    if (!choice) return toast.error('Pehle apna choice chuniye');
    if (effectiveBet < 10) return toast.error('Minimum bet ₹10 hai');
    if (!wallet || wallet.totalBalance < effectiveBet) return toast.error('Insufficient balance');
    if (!user) return;

    setLoading(true);
    try {
      await deductFunds(user.uid, effectiveBet, 'GAME_LOSS', `Dragon Tiger bet - ${choice}`);
      setPhase('DEALING');
      setFlipDragon(false);
      setFlipTiger(false);
      setDragonCard(null);
      setTigerCard(null);
      setWinner(null);

      const dc = randomCard();
      const tc = randomCard();

      setTimeout(() => { setDragonCard(dc); setFlipDragon(true); }, 600);
      setTimeout(() => { setTigerCard(tc); setFlipTiger(true); }, 1400);

      setTimeout(async () => {
        const w = getWinner(dc, tc);
        setWinner(w);
        setHistory(h => [w, ...h.slice(0, 19)]);

        const won = choice === w;
        if (won) {
          const payout = effectiveBet * PAYOUT[choice];
          await addFunds(user.uid, payout, 'winningBalance', `Dragon Tiger win - ${choice}`);
          setResultMsg(`🎉 ${w} Jeeta! +₹${payout - effectiveBet} profit`);
          toast.success(`Aap jeete! ₹${payout} mila`);
        } else {
          setResultMsg(`💔 ${w} Jeeta. ₹${effectiveBet} haara`);
          toast.error(`${w} jeeta`);
        }
        setPhase('RESULT');
        setLoading(false);
      }, 2800);
    } catch (e: any) {
      toast.error(e.message || 'Error');
      setLoading(false);
      setPhase('BETTING');
    }
  };

  const handleReset = () => {
    setPhase('BETTING');
    setChoice(null);
    setDragonCard(null);
    setTigerCard(null);
    setWinner(null);
    setFlipDragon(false);
    setFlipTiger(false);
    setResultMsg('');
  };

  const balance = wallet?.totalBalance ?? 0;

  return (
    <div className="dt-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;800&family=Raleway:wght@300;400;500&display=swap');
        .dt-root{min-height:100vh;background:radial-gradient(ellipse at top,#0d1b2a 0%,#050d14 60%,#000 100%);font-family:'Raleway',sans-serif;color:#e2e8f0;padding-bottom:40px;}
        .dt-header{display:flex;align-items:center;gap:12px;padding:20px 24px;border-bottom:1px solid rgba(212,175,55,0.2);background:rgba(0,0,0,0.4);backdrop-filter:blur(10px);position:sticky;top:0;z-index:10;}
        .dt-back{background:none;border:1px solid rgba(212,175,55,0.3);color:#d4af37;padding:8px 16px;border-radius:8px;cursor:pointer;font-family:'Raleway',sans-serif;font-size:13px;transition:all 0.2s;}
        .dt-back:hover{background:rgba(212,175,55,0.1);border-color:#d4af37;}
        .dt-title{font-family:'Cinzel',serif;font-size:22px;font-weight:800;background:linear-gradient(135deg,#d4af37,#f5e070,#d4af37);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:2px;}
        .dt-balance{margin-left:auto;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);padding:6px 14px;border-radius:20px;font-size:13px;color:#d4af37;font-weight:500;}
        .dt-table{max-width:680px;margin:32px auto 0;padding:0 16px;}
        .felt{background:radial-gradient(ellipse,#0a3d1f 0%,#062710 70%,#041a0c 100%);border:3px solid #d4af37;border-radius:24px;padding:32px 24px;position:relative;box-shadow:0 0 60px rgba(212,175,55,0.15),inset 0 0 40px rgba(0,0,0,0.5);}
        .felt::before{content:'';position:absolute;inset:6px;border:1px solid rgba(212,175,55,0.2);border-radius:18px;pointer-events:none;}
        .dt-zones{display:flex;gap:20px;justify-content:center;margin-bottom:28px;}
        .dt-zone{flex:1;max-width:180px;text-align:center;}
        .zone-label{font-family:'Cinzel',serif;font-size:11px;letter-spacing:3px;color:#d4af37;opacity:0.7;margin-bottom:12px;text-transform:uppercase;}
        .zone-name{font-family:'Cinzel',serif;font-size:28px;font-weight:800;letter-spacing:2px;margin-bottom:16px;}
        .dragon-name{background:linear-gradient(135deg,#ff6b35,#ff4500);-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-shadow:none;}
        .tiger-name{background:linear-gradient(135deg,#38bdf8,#0ea5e9);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .tie-zone{flex:0 0 90px;display:flex;flex-direction:column;align-items:center;justify-content:center;}
        .tie-name{font-family:'Cinzel',serif;font-size:14px;color:#d4af37;letter-spacing:2px;margin-bottom:8px;}
        .tie-payout{font-size:11px;color:rgba(212,175,55,0.6);}

        /* Card */
        .card-wrapper{width:80px;height:112px;margin:0 auto;perspective:600px;cursor:default;}
        .card-inner{width:100%;height:100%;position:relative;transform-style:preserve-3d;transition:transform 0.7s cubic-bezier(.4,0,.2,1);}
        .card-wrapper.flip .card-inner{transform:rotateY(180deg);}
        .card-back,.card-front{position:absolute;inset:0;backface-visibility:hidden;border-radius:10px;border:2px solid rgba(212,175,55,0.6);}
        .card-back{background:linear-gradient(135deg,#1a0a3e,#0d1b2a);display:flex;align-items:center;justify-content:center;}
        .card-back-pattern{width:60px;height:88px;border:2px solid rgba(212,175,55,0.3);border-radius:6px;background:repeating-linear-gradient(45deg,rgba(212,175,55,0.05) 0px,rgba(212,175,55,0.05) 2px,transparent 2px,transparent 8px);}
        .card-front{background:linear-gradient(135deg,#f8f4e8,#fffef5);transform:rotateY(180deg);position:relative;overflow:hidden;}
        .card-corner{position:absolute;display:flex;flex-direction:column;align-items:center;line-height:1;}
        .card-corner.top-left{top:4px;left:6px;}
        .card-corner.bottom-right{bottom:4px;right:6px;transform:rotate(180deg);}
        .card-val{font-family:'Cinzel',serif;font-size:13px;font-weight:800;}
        .card-suit-sm{font-size:10px;}
        .card-center-suit{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:32px;}
        .empty-card{width:80px;height:112px;margin:0 auto;border:2px dashed rgba(212,175,55,0.2);border-radius:10px;display:flex;align-items:center;justify-content:center;}
        .empty-card-inner{width:50px;height:70px;border:1px solid rgba(212,175,55,0.1);border-radius:6px;}

        /* Bet buttons */
        .bet-choice{display:flex;gap:12px;justify-content:center;margin:24px 0 20px;}
        .bet-btn{flex:1;max-width:140px;padding:14px 8px;border-radius:12px;border:2px solid transparent;cursor:pointer;font-family:'Cinzel',serif;font-size:14px;font-weight:600;letter-spacing:1px;transition:all 0.2s;background:rgba(0,0,0,0.4);}
        .bet-btn.dragon{border-color:rgba(255,107,53,0.4);color:#ff6b35;}
        .bet-btn.dragon:hover,.bet-btn.dragon.selected{background:linear-gradient(135deg,rgba(255,107,53,0.25),rgba(255,69,0,0.15));border-color:#ff6b35;box-shadow:0 0 20px rgba(255,107,53,0.3);}
        .bet-btn.tiger{border-color:rgba(56,189,248,0.4);color:#38bdf8;}
        .bet-btn.tiger:hover,.bet-btn.tiger.selected{background:linear-gradient(135deg,rgba(56,189,248,0.25),rgba(14,165,233,0.15));border-color:#38bdf8;box-shadow:0 0 20px rgba(56,189,248,0.3);}
        .bet-btn.tie{border-color:rgba(212,175,55,0.4);color:#d4af37;}
        .bet-btn.tie:hover,.bet-btn.tie.selected{background:linear-gradient(135deg,rgba(212,175,55,0.25),rgba(212,175,55,0.1));border-color:#d4af37;box-shadow:0 0 20px rgba(212,175,55,0.3);}
        .bet-btn.selected{transform:scale(1.04);}
        .bet-btn:disabled{opacity:0.4;cursor:not-allowed;transform:none;}
        .payout-tag{font-size:10px;color:inherit;opacity:0.7;margin-top:2px;}

        .chip-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px;}
        .chip{width:48px;height:48px;border-radius:50%;border:3px solid;cursor:pointer;font-family:'Cinzel',serif;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;transition:all 0.2s;position:relative;}
        .chip:hover,.chip.active{transform:scale(1.12) translateY(-3px);box-shadow:0 6px 20px rgba(0,0,0,0.5);}
        .chip:disabled{opacity:0.4;cursor:not-allowed;transform:none;}
        .chip-10{background:radial-gradient(circle,#dc2626,#991b1b);border-color:#ef4444;color:#fff;}
        .chip-50{background:radial-gradient(circle,#1d4ed8,#1e3a8a);border-color:#3b82f6;color:#fff;}
        .chip-100{background:radial-gradient(circle,#15803d,#14532d);border-color:#22c55e;color:#fff;}
        .chip-500{background:radial-gradient(circle,#7c3aed,#4c1d95);border-color:#8b5cf6;color:#fff;}
        .chip-1000{background:radial-gradient(circle,#d4af37,#92710a);border-color:#f5e070;color:#000;}

        .bet-display{text-align:center;margin-bottom:16px;}
        .bet-display-label{font-size:11px;color:rgba(212,175,55,0.6);letter-spacing:2px;text-transform:uppercase;}
        .bet-display-amount{font-family:'Cinzel',serif;font-size:26px;font-weight:800;color:#d4af37;}

        .custom-bet{display:flex;align-items:center;gap:8px;justify-content:center;margin-bottom:20px;}
        .custom-bet input{background:rgba(255,255,255,0.05);border:1px solid rgba(212,175,55,0.3);color:#e2e8f0;padding:8px 12px;border-radius:8px;font-family:'Raleway',sans-serif;font-size:14px;width:100px;text-align:center;outline:none;}
        .custom-bet input:focus{border-color:#d4af37;}
        .custom-bet-label{font-size:12px;color:rgba(212,175,55,0.6);}

        .place-btn{width:100%;padding:16px;border-radius:12px;border:none;background:linear-gradient(135deg,#d4af37,#f5e070,#d4af37);color:#000;font-family:'Cinzel',serif;font-size:16px;font-weight:800;letter-spacing:2px;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 20px rgba(212,175,55,0.3);}
        .place-btn:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(212,175,55,0.4);}
        .place-btn:disabled{opacity:0.4;cursor:not-allowed;transform:none;}

        .result-overlay{text-align:center;padding:20px 0;}
        .result-text{font-family:'Cinzel',serif;font-size:20px;font-weight:800;margin-bottom:4px;}
        .result-win{color:#22c55e;}
        .result-lose{color:#ef4444;}
        .result-sub{font-size:14px;color:rgba(226,232,240,0.7);margin-bottom:20px;}
        .play-again{background:rgba(212,175,55,0.1);border:2px solid #d4af37;color:#d4af37;padding:12px 32px;border-radius:10px;cursor:pointer;font-family:'Cinzel',serif;font-size:14px;font-weight:600;letter-spacing:1px;transition:all 0.2s;}
        .play-again:hover{background:rgba(212,175,55,0.2);}

        .winner-glow-dragon{box-shadow:0 0 40px rgba(255,107,53,0.5)!important;border-color:#ff6b35!important;}
        .winner-glow-tiger{box-shadow:0 0 40px rgba(56,189,248,0.5)!important;border-color:#38bdf8!important;}
        .winner-glow-tie{box-shadow:0 0 40px rgba(212,175,55,0.5)!important;border-color:#d4af37!important;}

        .history-strip{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:20px;padding-top:16px;border-top:1px solid rgba(212,175,55,0.1);}
        .hist-dot{width:28px;height:28px;border-radius:50%;font-family:'Cinzel',serif;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid;}
        .hist-d{background:rgba(255,107,53,0.15);border-color:rgba(255,107,53,0.5);color:#ff6b35;}
        .hist-t{background:rgba(56,189,248,0.15);border-color:rgba(56,189,248,0.5);color:#38bdf8;}
        .hist-tie{background:rgba(212,175,55,0.15);border-color:rgba(212,175,55,0.5);color:#d4af37;}
        .history-label{width:100%;text-align:center;font-size:10px;color:rgba(212,175,55,0.4);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;}

        .dealing-msg{text-align:center;padding:12px;color:#d4af37;font-family:'Cinzel',serif;font-size:14px;letter-spacing:2px;animation:pulse 1s infinite;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes dealIn{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}}
        .card-appear{animation:dealIn 0.4s ease-out;}
      `}</style>

      <div className="dt-header">
        <button className="dt-back" onClick={() => navigate('/dashboard')}>← Back</button>
        <span className="dt-title">🐉 Dragon Tiger 🐯</span>
        <span className="dt-balance">₹{balance.toLocaleString('en-IN')}</span>
      </div>

      <div className="dt-table">
        <div className="felt">
          {/* Card zones */}
          <div className="dt-zones">
            <div className="dt-zone">
              <div className="zone-label">1x Payout</div>
              <div className="zone-name dragon-name">Dragon</div>
              <div className={`card-appear ${winner === 'DRAGON' ? 'winner-glow-dragon' : ''}`} style={{ borderRadius: 10 }}>
                {dragonCard && flipDragon
                  ? <PlayingCard card={dragonCard} flip={flipDragon} />
                  : phase !== 'BETTING'
                    ? <PlayingCard faceDown flip={false} />
                    : <div className="empty-card"><div className="empty-card-inner" /></div>}
              </div>
            </div>

            <div className="dt-zone tie-zone" style={{ justifyContent: 'flex-end', paddingBottom: 16 }}>
              <div className="tie-name" style={{ fontFamily: "'Cinzel',serif", fontSize: 14, color: '#d4af37', letterSpacing: 2, marginBottom: 4 }}>TIE</div>
              <div className="tie-payout" style={{ fontSize: 11, color: 'rgba(212,175,55,0.6)' }}>8x</div>
            </div>

            <div className="dt-zone">
              <div className="zone-label">1x Payout</div>
              <div className="zone-name tiger-name">Tiger</div>
              <div className={`card-appear ${winner === 'TIGER' ? 'winner-glow-tiger' : ''}`} style={{ borderRadius: 10 }}>
                {tigerCard && flipTiger
                  ? <PlayingCard card={tigerCard} flip={flipTiger} />
                  : phase !== 'BETTING'
                    ? <PlayingCard faceDown flip={false} />
                    : <div className="empty-card"><div className="empty-card-inner" /></div>}
              </div>
            </div>
          </div>

          {phase === 'DEALING' && <div className="dealing-msg">🃏 Cards deal ho rahi hain...</div>}

          {phase === 'RESULT' && (
            <div className="result-overlay">
              <div className={`result-text ${resultMsg.includes('🎉') ? 'result-win' : 'result-lose'}`}>
                {resultMsg.includes('🎉') ? '🎉 Aap Jeete!' : '💔 Better Luck Next Time'}
              </div>
              <div className="result-sub">{resultMsg}</div>
              <button className="play-again" onClick={handleReset}>Phir Khelo</button>
            </div>
          )}

          {phase === 'BETTING' && (
            <>
              {/* Choice buttons */}
              <div className="bet-choice">
                <button className={`bet-btn dragon ${choice === 'DRAGON' ? 'selected' : ''}`} onClick={() => setChoice('DRAGON')}>
                  🐉 Dragon<div className="payout-tag">2x Payout</div>
                </button>
                <button className={`bet-btn tie ${choice === 'TIE' ? 'selected' : ''}`} onClick={() => setChoice('TIE')} style={{ flex: '0 0 80px', maxWidth: 80 }}>
                  TIE<div className="payout-tag">8x</div>
                </button>
                <button className={`bet-btn tiger ${choice === 'TIGER' ? 'selected' : ''}`} onClick={() => setChoice('TIGER')}>
                  🐯 Tiger<div className="payout-tag">2x Payout</div>
                </button>
              </div>

              {/* Chips */}
              <div className="chip-row">
                {BET_AMOUNTS.map(a => (
                  <button key={a} className={`chip chip-${a} ${!customBet && betAmount === a ? 'active' : ''}`}
                    onClick={() => { setBetAmount(a); setCustomBet(''); }}>
                    {a >= 1000 ? '1K' : a}
                  </button>
                ))}
              </div>

              <div className="bet-display">
                <div className="bet-display-label">Aapka Bet</div>
                <div className="bet-display-amount">₹{effectiveBet.toLocaleString('en-IN')}</div>
              </div>

              <div className="custom-bet">
                <span className="custom-bet-label">Custom:</span>
                <input type="number" placeholder="Amount" value={customBet}
                  onChange={e => setCustomBet(e.target.value)} min={10} />
              </div>

              <button className="place-btn" onClick={handlePlaceBet} disabled={loading || !choice}>
                {loading ? 'Processing...' : `BET LAGAO — ₹${effectiveBet}`}
              </button>
            </>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="history-strip">
              <div className="history-label">Last Results</div>
              {history.map((h, i) => (
                <div key={i} className={`hist-dot ${h === 'DRAGON' ? 'hist-d' : h === 'TIGER' ? 'hist-t' : 'hist-tie'}`}>
                  {h === 'DRAGON' ? 'D' : h === 'TIGER' ? 'T' : 'Ti'}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
