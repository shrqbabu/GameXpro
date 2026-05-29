import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { deductFunds, addFunds } from '../../firebase/wallet';
import toast from 'react-hot-toast';

type ABSide = 'ANDAR' | 'BAHAR';
type GamePhase = 'BETTING' | 'DEALING' | 'RESULT';

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const BET_AMOUNTS = [10, 50, 100, 500, 1000];

function randomCard() {
  const v = VALUES[Math.floor(Math.random() * VALUES.length)];
  const s = SUITS[Math.floor(Math.random() * SUITS.length)];
  return { value: v, suit: s };
}

function CardMini({ card, isRed }: { card: { value: string; suit: string }; isRed: boolean }) {
  return (
    <div className="ab-card" style={{ borderColor: isRed ? 'rgba(248,113,113,0.6)' : 'rgba(226,232,240,0.3)' }}>
      <span style={{ color: isRed ? '#f87171' : '#e2e8f0', fontFamily: "'Cinzel',serif", fontSize: 11, fontWeight: 700 }}>{card.value}</span>
      <span style={{ color: isRed ? '#f87171' : '#e2e8f0', fontSize: 16 }}>{card.suit}</span>
    </div>
  );
}

export function AndarBahar() {
  const navigate = useNavigate();
  const { user, wallet } = useAuth();
  const [phase, setPhase] = useState<GamePhase>('BETTING');
  const [betAmount, setBetAmount] = useState(50);
  const [customBet, setCustomBet] = useState('');
  const [choice, setChoice] = useState<ABSide | null>(null);
  const [jokerCard, setJokerCard] = useState<any>(null);
  const [andarCards, setAndarCards] = useState<any[]>([]);
  const [baharCards, setBaharCards] = useState<any[]>([]);
  const [winner, setWinner] = useState<ABSide | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState('');
  const [history, setHistory] = useState<ABSide[]>([]);
  const [dealing, setDealing] = useState(false);

  const effectiveBet = customBet ? parseInt(customBet) || 0 : betAmount;
  const balance = wallet?.totalBalance ?? 0;

  const simulateDeal = (joker: { value: string }, onDone: (side: ABSide) => void) => {
    let andar: any[] = [];
    let bahar: any[] = [];
    let turn: ABSide = 'ANDAR';
    let maxRounds = 26;
    let round = 0;

    const dealNext = () => {
      if (round >= maxRounds) { onDone('BAHAR'); return; }
      const c = randomCard();
      const isMatch = c.value === joker.value;

      if (turn === 'ANDAR') {
        andar = [...andar, c];
        setAndarCards([...andar]);
      } else {
        bahar = [...bahar, c];
        setBaharCards([...bahar]);
      }

      if (isMatch) {
        onDone(turn);
        return;
      }
      turn = turn === 'ANDAR' ? 'BAHAR' : 'ANDAR';
      round++;
      setTimeout(dealNext, 320);
    };
    setTimeout(dealNext, 400);
  };

  const handlePlaceBet = async () => {
    if (!choice) return toast.error('Andar ya Bahar chuniye');
    if (effectiveBet < 10) return toast.error('Minimum bet ₹10 hai');
    if (!wallet || wallet.totalBalance < effectiveBet) return toast.error('Insufficient balance');
    if (!user) return;

    setLoading(true);
    try {
      await deductFunds(user.uid, effectiveBet, 'GAME_LOSS', `Andar Bahar bet - ${choice}`);
      setPhase('DEALING');
      setDealing(true);
      setAndarCards([]);
      setBaharCards([]);
      setWinner(null);

      const jk = randomCard();
      setJokerCard(jk);

      simulateDeal(jk, async (w) => {
        setWinner(w);
        setHistory(h => [w, ...h.slice(0, 19)]);
        const won = choice === w;
        if (won) {
          const payout = Math.floor(effectiveBet * 1.9);
          await addFunds(user.uid, payout, 'winningBalance', `Andar Bahar win - ${choice}`);
          setResultMsg(`🎉 ${w} mein aaya! +₹${payout - effectiveBet} profit`);
          toast.success(`Aap jeete! ₹${payout} mila`);
        } else {
          setResultMsg(`💔 ${w} mein aaya. Haare ₹${effectiveBet}`);
          toast.error(`${w} mein aaya`);
        }
        setDealing(false);
        setLoading(false);
        setPhase('RESULT');
      });
    } catch (e: any) {
      toast.error(e.message || 'Error');
      setLoading(false);
      setPhase('BETTING');
    }
  };

  const handleReset = () => {
    setPhase('BETTING');
    setChoice(null);
    setJokerCard(null);
    setAndarCards([]);
    setBaharCards([]);
    setWinner(null);
    setResultMsg('');
    setDealing(false);
  };

  return (
    <div className="ab-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;800&family=Raleway:wght@300;400;500&display=swap');
        .ab-root{min-height:100vh;background:radial-gradient(ellipse at top,#1a0533 0%,#0d0020 60%,#000 100%);font-family:'Raleway',sans-serif;color:#e2e8f0;padding-bottom:40px;}
        .ab-header{display:flex;align-items:center;gap:12px;padding:20px 24px;border-bottom:1px solid rgba(220,180,255,0.2);background:rgba(0,0,0,0.4);backdrop-filter:blur(10px);position:sticky;top:0;z-index:10;}
        .ab-back{background:none;border:1px solid rgba(220,180,255,0.3);color:#c084fc;padding:8px 16px;border-radius:8px;cursor:pointer;font-family:'Raleway',sans-serif;font-size:13px;transition:all 0.2s;}
        .ab-back:hover{background:rgba(220,180,255,0.1);}
        .ab-title{font-family:'Cinzel',serif;font-size:20px;font-weight:800;background:linear-gradient(135deg,#c084fc,#e879f9,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:2px;}
        .ab-balance{margin-left:auto;background:rgba(192,132,252,0.1);border:1px solid rgba(192,132,252,0.3);padding:6px 14px;border-radius:20px;font-size:13px;color:#c084fc;font-weight:500;}
        .ab-table{max-width:700px;margin:28px auto 0;padding:0 16px;}
        .ab-felt{background:radial-gradient(ellipse,#1a0040 0%,#0d001f 60%,#06000f 100%);border:3px solid rgba(192,132,252,0.6);border-radius:24px;padding:28px 20px;position:relative;box-shadow:0 0 60px rgba(192,132,252,0.12),inset 0 0 40px rgba(0,0,0,0.6);}
        .ab-felt::before{content:'';position:absolute;inset:6px;border:1px solid rgba(192,132,252,0.15);border-radius:18px;pointer-events:none;}

        /* Joker card */
        .joker-section{text-align:center;margin-bottom:24px;}
        .joker-label{font-family:'Cinzel',serif;font-size:10px;letter-spacing:3px;color:rgba(192,132,252,0.7);text-transform:uppercase;margin-bottom:10px;}
        .joker-card-big{width:72px;height:100px;margin:0 auto;background:linear-gradient(135deg,#fffef5,#f8f4e8);border:3px solid #c084fc;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 0 30px rgba(192,132,252,0.5);position:relative;}
        .joker-glow{animation:jokerGlow 1.5s ease-in-out infinite alternate;}
        @keyframes jokerGlow{from{box-shadow:0 0 20px rgba(192,132,252,0.4)}to{box-shadow:0 0 40px rgba(192,132,252,0.9)}}
        .joker-val{font-family:'Cinzel',serif;font-size:22px;font-weight:800;}
        .joker-suit{font-size:20px;}
        .joker-placeholder{width:72px;height:100px;margin:0 auto;border:2px dashed rgba(192,132,252,0.3);border-radius:10px;display:flex;align-items:center;justify-content:center;color:rgba(192,132,252,0.3);font-size:24px;}

        /* Two sides */
        .ab-sides{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;}
        .ab-side{border-radius:16px;padding:16px 12px;min-height:180px;}
        .ab-side.andar-side{background:rgba(34,197,94,0.05);border:2px solid ${phase === 'RESULT' && winner === 'ANDAR' ? '#22c55e' : 'rgba(34,197,94,0.25)'};}
        .ab-side.bahar-side{background:rgba(239,68,68,0.05);border:2px solid ${phase === 'RESULT' && winner === 'BAHAR' ? '#ef4444' : 'rgba(239,68,68,0.25)'};}
        .ab-side.winner-andar{border-color:#22c55e;box-shadow:0 0 30px rgba(34,197,94,0.3);}
        .ab-side.winner-bahar{border-color:#ef4444;box-shadow:0 0 30px rgba(239,68,68,0.3);}
        .side-title{font-family:'Cinzel',serif;font-size:16px;font-weight:800;text-align:center;margin-bottom:12px;letter-spacing:2px;}
        .andar-title{color:#22c55e;}
        .bahar-title{color:#ef4444;}
        .cards-grid{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;}
        .ab-card{width:32px;height:44px;background:linear-gradient(135deg,#f8f4e8,#fffef5);border:1.5px solid;border-radius:5px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;animation:cardAppear 0.3s ease-out;}
        @keyframes cardAppear{from{opacity:0;transform:scale(0.7) rotate(-10deg)}to{opacity:1;transform:scale(1) rotate(0)}}
        .empty-side{display:flex;align-items:center;justify-content:center;height:80px;color:rgba(255,255,255,0.15);font-size:12px;font-family:'Cinzel',serif;letter-spacing:1px;}

        /* Bet section */
        .ab-bet-choices{display:flex;gap:12px;justify-content:center;margin-bottom:20px;}
        .ab-choice-btn{flex:1;max-width:200px;padding:16px;border-radius:14px;border:2px solid transparent;cursor:pointer;font-family:'Cinzel',serif;font-size:18px;font-weight:800;letter-spacing:2px;transition:all 0.2s;background:rgba(0,0,0,0.4);}
        .ab-choice-btn.andar-btn{border-color:rgba(34,197,94,0.4);color:#22c55e;}
        .ab-choice-btn.andar-btn:hover,.ab-choice-btn.andar-btn.sel{background:rgba(34,197,94,0.15);border-color:#22c55e;box-shadow:0 0 25px rgba(34,197,94,0.3);transform:scale(1.03);}
        .ab-choice-btn.bahar-btn{border-color:rgba(239,68,68,0.4);color:#ef4444;}
        .ab-choice-btn.bahar-btn:hover,.ab-choice-btn.bahar-btn.sel{background:rgba(239,68,68,0.15);border-color:#ef4444;box-shadow:0 0 25px rgba(239,68,68,0.3);transform:scale(1.03);}
        .ab-choice-btn:disabled{opacity:0.4;cursor:not-allowed;transform:none;}
        .ab-payout-sub{font-size:10px;opacity:0.65;margin-top:3px;letter-spacing:1px;}

        .chip-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:14px;}
        .chip{width:46px;height:46px;border-radius:50%;border:3px solid;cursor:pointer;font-family:'Cinzel',serif;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;transition:all 0.2s;}
        .chip:hover,.chip.active{transform:scale(1.12) translateY(-3px);}
        .chip:disabled{opacity:0.4;cursor:not-allowed;transform:none;}
        .chip-10{background:radial-gradient(circle,#dc2626,#991b1b);border-color:#ef4444;color:#fff;}
        .chip-50{background:radial-gradient(circle,#1d4ed8,#1e3a8a);border-color:#3b82f6;color:#fff;}
        .chip-100{background:radial-gradient(circle,#15803d,#14532d);border-color:#22c55e;color:#fff;}
        .chip-500{background:radial-gradient(circle,#7c3aed,#4c1d95);border-color:#8b5cf6;color:#fff;}
        .chip-1000{background:radial-gradient(circle,#d4af37,#92710a);border-color:#f5e070;color:#000;}

        .bet-display{text-align:center;margin-bottom:12px;}
        .bet-display-label{font-size:11px;color:rgba(192,132,252,0.6);letter-spacing:2px;text-transform:uppercase;}
        .bet-display-amount{font-family:'Cinzel',serif;font-size:24px;font-weight:800;color:#c084fc;}
        .custom-bet{display:flex;align-items:center;gap:8px;justify-content:center;margin-bottom:18px;}
        .custom-bet input{background:rgba(255,255,255,0.05);border:1px solid rgba(192,132,252,0.3);color:#e2e8f0;padding:7px 12px;border-radius:8px;font-family:'Raleway',sans-serif;font-size:14px;width:100px;text-align:center;outline:none;}
        .custom-bet input:focus{border-color:#c084fc;}
        .custom-bet-label{font-size:12px;color:rgba(192,132,252,0.6);}
        .ab-place-btn{width:100%;padding:16px;border-radius:12px;border:none;background:linear-gradient(135deg,#a855f7,#c084fc,#a855f7);color:#fff;font-family:'Cinzel',serif;font-size:16px;font-weight:800;letter-spacing:2px;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 20px rgba(168,85,247,0.4);}
        .ab-place-btn:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(168,85,247,0.5);}
        .ab-place-btn:disabled{opacity:0.4;cursor:not-allowed;transform:none;}

        .result-area{text-align:center;padding:16px 0;}
        .result-text{font-family:'Cinzel',serif;font-size:20px;font-weight:800;margin-bottom:4px;}
        .result-win{color:#22c55e;}
        .result-lose{color:#ef4444;}
        .result-sub{font-size:14px;color:rgba(226,232,240,0.6);margin-bottom:18px;}
        .ab-play-again{background:rgba(192,132,252,0.1);border:2px solid #c084fc;color:#c084fc;padding:12px 32px;border-radius:10px;cursor:pointer;font-family:'Cinzel',serif;font-size:14px;transition:all 0.2s;}
        .ab-play-again:hover{background:rgba(192,132,252,0.2);}

        .dealing-ticker{text-align:center;color:#c084fc;font-family:'Cinzel',serif;font-size:13px;letter-spacing:2px;animation:pulse 0.8s infinite;margin-bottom:10px;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}

        .history-strip{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:16px;padding-top:14px;border-top:1px solid rgba(192,132,252,0.1);}
        .hist-dot{width:26px;height:26px;border-radius:50%;font-family:'Cinzel',serif;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid;}
        .hist-a{background:rgba(34,197,94,0.15);border-color:rgba(34,197,94,0.5);color:#22c55e;}
        .hist-b{background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.5);color:#ef4444;}
        .history-label{width:100%;text-align:center;font-size:10px;color:rgba(192,132,252,0.4);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;}
      `}</style>

      <div className="ab-header">
        <button className="ab-back" onClick={() => navigate('/dashboard')}>← Back</button>
        <span className="ab-title">🃏 Andar Bahar</span>
        <span className="ab-balance">₹{balance.toLocaleString('en-IN')}</span>
      </div>

      <div className="ab-table">
        <div className="ab-felt">
          {/* Joker Card */}
          <div className="joker-section">
            <div className="joker-label">Joker Card</div>
            {jokerCard ? (
              <div className={`joker-card-big joker-glow`}>
                <span className="joker-val" style={{ color: (jokerCard.suit === '♥' || jokerCard.suit === '♦') ? '#f87171' : '#1a1a2e' }}>
                  {jokerCard.value}
                </span>
                <span className="joker-suit" style={{ color: (jokerCard.suit === '♥' || jokerCard.suit === '♦') ? '#f87171' : '#1a1a2e' }}>
                  {jokerCard.suit}
                </span>
              </div>
            ) : (
              <div className="joker-placeholder">🃏</div>
            )}
          </div>

          {/* Dealing animation ticker */}
          {dealing && <div className="dealing-ticker">Cards deal ho rahi hain...</div>}

          {/* Two sides */}
          <div className="ab-sides">
            <div className={`ab-side andar-side ${winner === 'ANDAR' ? 'winner-andar' : ''}`}>
              <div className="side-title andar-title">ANDAR</div>
              {andarCards.length === 0
                ? <div className="empty-side">Andar ki cards</div>
                : <div className="cards-grid">
                    {andarCards.map((c, i) => {
                      const isRed = c.suit === '♥' || c.suit === '♦';
                      return <CardMini key={i} card={c} isRed={isRed} />;
                    })}
                  </div>}
            </div>
            <div className={`ab-side bahar-side ${winner === 'BAHAR' ? 'winner-bahar' : ''}`}>
              <div className="side-title bahar-title">BAHAR</div>
              {baharCards.length === 0
                ? <div className="empty-side">Bahar ki cards</div>
                : <div className="cards-grid">
                    {baharCards.map((c, i) => {
                      const isRed = c.suit === '♥' || c.suit === '♦';
                      return <CardMini key={i} card={c} isRed={isRed} />;
                    })}
                  </div>}
            </div>
          </div>

          {/* Result */}
          {phase === 'RESULT' && (
            <div className="result-area">
              <div className={`result-text ${resultMsg.includes('🎉') ? 'result-win' : 'result-lose'}`}>
                {resultMsg.includes('🎉') ? '🎉 Mubarak ho!' : '💔 Haaste rehna!'}
              </div>
              <div className="result-sub">{resultMsg}</div>
              <button className="ab-play-again" onClick={handleReset}>Phir Khelo</button>
            </div>
          )}

          {/* Betting phase */}
          {phase === 'BETTING' && (
            <>
              <div className="ab-bet-choices">
                <button className={`ab-choice-btn andar-btn ${choice === 'ANDAR' ? 'sel' : ''}`} onClick={() => setChoice('ANDAR')}>
                  ANDAR<div className="ab-payout-sub">1.9x Payout</div>
                </button>
                <button className={`ab-choice-btn bahar-btn ${choice === 'BAHAR' ? 'sel' : ''}`} onClick={() => setChoice('BAHAR')}>
                  BAHAR<div className="ab-payout-sub">1.9x Payout</div>
                </button>
              </div>

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

              <button className="ab-place-btn" onClick={handlePlaceBet} disabled={loading || !choice}>
                {loading ? 'Processing...' : `BET LAGAO — ₹${effectiveBet}`}
              </button>
            </>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="history-strip">
              <div className="history-label">Last Results</div>
              {history.map((h, i) => (
                <div key={i} className={`hist-dot ${h === 'ANDAR' ? 'hist-a' : 'hist-b'}`}>
                  {h === 'ANDAR' ? 'A' : 'B'}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
