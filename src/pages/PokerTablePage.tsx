import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronUp, ChevronDown, LogOut, Settings,
  Clock, Users, DollarSign
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import {
  SUIT_SYMBOLS, SUIT_COLORS, shuffleDeck, createDeck,
  generateDemoSeats, formatChips, BOT_NAMES, GAME_PHASE_LABELS,
} from '../utils/helpers';
import type { Card, PlayerSeat, GamePhase } from '../types';
import toast from 'react-hot-toast';

// ============================================================
// CARD COMPONENT
// ============================================================
const PlayingCard: React.FC<{ card: Card; size?: 'sm' | 'md' | 'lg'; animate?: boolean }> = ({
  card, size = 'md', animate = true
}) => {
  const sizeMap = {
    sm: 'w-8 h-12 text-xs rounded-md',
    md: 'w-12 h-18 text-sm rounded-lg',
    lg: 'w-16 h-24 text-base rounded-xl',
  };
  const suitColor = SUIT_COLORS[card.suit];
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  if (card.faceDown) {
    return (
      <motion.div
        initial={animate ? { rotateY: 0 } : {}}
        className={`${sizeMap[size]} bg-gradient-to-br from-blue-800 to-blue-900 border-2 border-blue-600 flex items-center justify-center shadow-lg`}
      >
        <div className="text-blue-400 text-xs opacity-50">♠</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={animate ? { rotateY: 90, scale: 0.5 } : {}}
      animate={animate ? { rotateY: 0, scale: 1 } : {}}
      transition={{ type: 'spring', damping: 15, stiffness: 200 }}
      whileHover={{ y: -5, scale: 1.05 }}
      className={`${sizeMap[size]} bg-white flex flex-col justify-between p-1 shadow-xl cursor-pointer relative overflow-hidden`}
    >
      <div className={`text-xs font-bold leading-none ${isRed ? 'text-red-500' : 'text-gray-900'}`}>
        <div>{card.value}</div>
        <div>{SUIT_SYMBOLS[card.suit]}</div>
      </div>
      <div
        className="absolute inset-0 flex items-center justify-center text-2xl font-bold opacity-20"
        style={{ color: suitColor }}
      >
        {SUIT_SYMBOLS[card.suit]}
      </div>
      <div className={`text-xs font-bold leading-none rotate-180 ${isRed ? 'text-red-500' : 'text-gray-900'}`}>
        <div>{card.value}</div>
        <div>{SUIT_SYMBOLS[card.suit]}</div>
      </div>
      {/* Shine */}
      <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-white/30 to-transparent pointer-events-none" />
    </motion.div>
  );
};

// ============================================================
// PLAYER SEAT COMPONENT
// ============================================================
const PlayerSeatComp: React.FC<{
  seat: PlayerSeat;
  isCurrentUser?: boolean;
}> = ({ seat, isCurrentUser }) => {
  if (seat.status === 'empty') {
    return (
      <motion.div
        whileHover={{ scale: 1.05 }}
        className="flex flex-col items-center gap-1 cursor-pointer group"
      >
        <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 group-hover:border-amber-400/50 transition-colors flex items-center justify-center text-gray-500 group-hover:text-amber-400">
          <span className="text-lg">+</span>
        </div>
        <span className="text-xs text-gray-600 group-hover:text-gray-400">Empty</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative flex flex-col items-center gap-1 ${seat.isFolded ? 'opacity-40' : ''}`}
    >
      {/* Current turn indicator */}
      {seat.isCurrentTurn && (
        <div className="absolute -inset-2 rounded-2xl border-2 border-amber-400 animate-pulse" />
      )}

      {/* Dealer/Blind buttons */}
      <div className="absolute -top-3 flex gap-1">
        {seat.isDealer && (
          <span className="w-5 h-5 rounded-full bg-white text-gray-900 text-xs font-bold flex items-center justify-center shadow-lg">D</span>
        )}
        {seat.isSmallBlind && !seat.isDealer && (
          <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">SB</span>
        )}
        {seat.isBigBlind && !seat.isDealer && (
          <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-xs font-bold flex items-center justify-center">BB</span>
        )}
      </div>

      {/* Avatar */}
      <div className={`relative ${isCurrentUser ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-green-900 rounded-full' : ''}`}>
        <Avatar
          username={seat.username || 'Bot'}
          avatarIndex={seat.avatarIndex || 0}
          size="md"
          showStatus
          isOnline
        />
        {seat.isBot && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 border border-green-900 flex items-center justify-center">
            <span className="text-white" style={{ fontSize: '7px' }}>B</span>
          </div>
        )}
      </div>

      {/* Name + chips */}
      <div className="text-center">
        <p className={`text-xs font-medium ${isCurrentUser ? 'text-amber-400' : 'text-white'} max-w-[80px] truncate`}>
          {isCurrentUser ? 'YOU' : seat.username}
        </p>
        <p className="text-emerald-400 text-xs font-mono">{formatChips(seat.chips)}</p>
      </div>

      {/* Player cards */}
      {seat.cards.length > 0 && (
        <div className="flex gap-0.5">
          {seat.cards.map((card, i) => (
            <PlayingCard key={i} card={card} size="sm" />
          ))}
        </div>
      )}

      {/* Action badge */}
      {seat.action && seat.action !== 'waiting' && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`px-2 py-0.5 rounded text-xs font-bold
            ${seat.action === 'fold' ? 'bg-red-500/80' :
              seat.action === 'call' ? 'bg-blue-500/80' :
              seat.action === 'raise' ? 'bg-amber-500/80' :
              seat.action === 'check' ? 'bg-emerald-500/80' :
              seat.action === 'all-in' ? 'bg-purple-500/80' : 'bg-gray-500/80'}
            text-white
          `}
        >
          {seat.action.toUpperCase()}
        </motion.div>
      )}

      {/* Timer */}
      {seat.isCurrentTurn && seat.timeLeft !== undefined && (
        <div className="w-10 h-1 bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: seat.timeLeft, ease: 'linear' }}
            className="h-full bg-amber-400 rounded-full"
          />
        </div>
      )}

      {/* Bet amount */}
      {seat.currentBet > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -bottom-6 px-2 py-0.5 bg-amber-500/80 rounded text-xs text-black font-bold"
        >
          {formatChips(seat.currentBet)}
        </motion.div>
      )}
    </motion.div>
  );
};

// ============================================================
// MAIN POKER TABLE PAGE
// ============================================================
const BOT_ACTIONS = ['fold', 'check', 'call', 'raise', 'all-in'] as const;

export const PokerTablePage: React.FC = () => {
  const { userProfile } = useAuth();
  const [seats, setSeats] = useState<PlayerSeat[]>([]);
  const [communityCards, setCommunityCards] = useState<Card[]>([]);
  const [pot, setPot] = useState(0);
  const [phase, setPhase] = useState<GamePhase>('waiting');
  const [playerChips, setPlayerChips] = useState(5000);
  const [playerCards, setPlayerCards] = useState<Card[]>([]);
  const [raiseAmount, setRaiseAmount] = useState(200);
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [currentBigBlind] = useState(50);
  const [isPlayerTurn, setIsPlayerTurn] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [winner, setWinner] = useState('');
  const [deck, setDeck] = useState<Card[]>([]);

  const TABLES = [
    { id: 't1', name: 'Beginner Table', blinds: '₹5/₹10', min: 500, max: 3000, players: 4, difficulty: 'Easy' },
    { id: 't2', name: 'Classic Texas', blinds: '₹25/₹50', min: 1000, max: 10000, players: 6, difficulty: 'Medium' },
    { id: 't3', name: 'High Rollers', blinds: '₹100/₹200', min: 5000, max: 50000, players: 5, difficulty: 'Hard' },
  ];

  const initGame = useCallback((tableId: string) => {
    const newDeck = shuffleDeck(createDeck());
    setDeck(newDeck);
    const demoSeats = generateDemoSeats(6);

    // Assign player to last seat
    const playerSeat = {
      ...demoSeats[5],
      userId: userProfile?.uid || 'player',
      username: userProfile?.username || 'You',
      avatarIndex: userProfile?.avatarIndex || 0,
      chips: playerChips,
      cards: [newDeck[0], newDeck[1]],
      isBot: false,
      status: 'occupied' as const,
      isCurrentTurn: false,
    };

    // Deal 2 cards to each bot
    const updatedSeats = demoSeats.map((seat, i) => {
      if (i === 5) return playerSeat;
      if (seat.status === 'occupied') {
        return {
          ...seat,
          cards: [
            { ...newDeck[i * 2 + 2], faceDown: true },
            { ...newDeck[i * 2 + 3], faceDown: true },
          ],
          currentBet: i === 1 ? 25 : i === 2 ? 50 : 0,
        };
      }
      return seat;
    });

    setSeats(updatedSeats);
    setCommunityCards([]);
    setPot(75);
    setPhase('pre-flop');
    setPlayerCards([newDeck[0], newDeck[1]]);
    setGameStarted(true);
    setSelectedTable(tableId);
    setShowResults(false);
    setIsPlayerTurn(true);
    setTimeLeft(30);

    toast.success('🎰 Game started! Good luck!', { icon: '♠' });
  }, [userProfile, playerChips]);

  // Timer countdown
  useEffect(() => {
    if (!gameStarted || !isPlayerTurn) return;
    if (timeLeft <= 0) {
      handleAction('fold');
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, gameStarted, isPlayerTurn]);

  // Bot turn simulation
  const simulateBotTurn = useCallback(() => {
    const botAction = BOT_ACTIONS[Math.floor(Math.random() * BOT_ACTIONS.length)];
    const delay = Math.random() * 2000 + 1000;

    setTimeout(() => {
      setSeats((prev) => {
        const currentBotIdx = prev.findIndex((s) => s.isCurrentTurn && s.isBot);
        if (currentBotIdx === -1) return prev;

        const updated = [...prev];
        updated[currentBotIdx] = {
          ...updated[currentBotIdx],
          action: botAction,
          isCurrentTurn: false,
          isFolded: botAction === 'fold',
        };

        // Find next active seat
        const nextIdx = (currentBotIdx + 1) % 6;
        if (updated[nextIdx].status === 'occupied' && !updated[nextIdx].isFolded) {
          updated[nextIdx] = { ...updated[nextIdx], isCurrentTurn: true };
          if (!updated[nextIdx].isBot) {
            setIsPlayerTurn(true);
            setTimeLeft(30);
          }
        }

        return updated;
      });
    }, delay);
  }, []);

  useEffect(() => {
    const botTurnSeat = seats.find((s) => s.isCurrentTurn && s.isBot);
    if (botTurnSeat) {
      simulateBotTurn();
    }
  }, [seats, simulateBotTurn]);

  const handleAction = (action: 'fold' | 'check' | 'call' | 'raise' | 'all-in') => {
    if (!isPlayerTurn) return;
    setIsPlayerTurn(false);

    setSeats((prev) => {
      const updated = [...prev];
      const playerIdx = updated.findIndex((s) => !s.isBot && s.status === 'occupied');
      if (playerIdx === -1) return prev;

      updated[playerIdx] = {
        ...updated[playerIdx],
        action,
        isCurrentTurn: false,
        isFolded: action === 'fold',
        currentBet: action === 'call' ? currentBigBlind :
          action === 'raise' ? raiseAmount :
          action === 'all-in' ? playerChips : 0,
      };

      if (action === 'call') {
        setPot((p) => p + currentBigBlind);
        setPlayerChips((c) => c - currentBigBlind);
      } else if (action === 'raise') {
        setPot((p) => p + raiseAmount);
        setPlayerChips((c) => c - raiseAmount);
      } else if (action === 'all-in') {
        setPot((p) => p + playerChips);
        setPlayerChips(0);
      }

      // Move to next bot
      const nextIdx = (playerIdx + 1) % 6;
      if (updated[nextIdx].status === 'occupied' && !updated[nextIdx].isFolded) {
        updated[nextIdx] = { ...updated[nextIdx], isCurrentTurn: true };
      }

      return updated;
    });

    if (action === 'fold') {
      setTimeout(() => progressToNextPhase(true), 1500);
    } else {
      setTimeout(() => progressToNextPhase(false), 3000);
    }

    const messages: Record<string, string> = {
      fold: '🃏 You folded',
      check: '✓ You checked',
      call: `📞 You called ₹${currentBigBlind}`,
      raise: `📈 You raised to ₹${raiseAmount}`,
      'all-in': '🚀 ALL IN!',
    };
    toast(messages[action], { icon: action === 'all-in' ? '🔥' : '♠' });
  };

  const progressToNextPhase = (playerFolded: boolean) => {
    if (playerFolded) {
      const botWinner = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
      setWinner(botWinner);
      setShowResults(true);
      setPhase('showdown');
      return;
    }

    setPhase((prev) => {
      const nextPhase: Record<GamePhase, GamePhase> = {
        'waiting': 'pre-flop',
        'pre-flop': 'flop',
        'flop': 'turn',
        'turn': 'river',
        'river': 'showdown',
        'showdown': 'waiting',
      };

      const next = nextPhase[prev];

      if (next === 'flop') {
        const newCommunity = [deck[10], deck[11], deck[12]];
        setCommunityCards(newCommunity);
        toast('🃏 Flop dealt!', { icon: '♦' });
      } else if (next === 'turn') {
        setCommunityCards((c) => [...c, deck[13]]);
        toast('🃏 Turn dealt!', { icon: '♣' });
      } else if (next === 'river') {
        setCommunityCards((c) => [...c, deck[14]]);
        toast('🃏 River dealt!', { icon: '♥' });
      } else if (next === 'showdown') {
        const isWin = Math.random() > 0.4;
        const winAmount = Math.floor(pot * (isWin ? 1 : 0));
        if (isWin) {
          setWinner('You');
          setPlayerChips((c) => c + pot);
          toast.success(`🏆 You win ₹${pot}!`, { duration: 5000 });
        } else {
          const botWinner = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
          setWinner(botWinner);
          toast.error(`${botWinner} wins the pot of ₹${pot}`, { duration: 5000 });
        }
        setShowResults(true);
        void winAmount;
      }

      return next;
    });

    if (phase !== 'river') {
      setIsPlayerTurn(true);
      setTimeLeft(30);
      setSeats((prev) =>
        prev.map((s, i) => ({
          ...s,
          isCurrentTurn: i === 5 && !s.isFolded,
          currentBet: 0,
          action: s.isFolded ? s.action : undefined,
        }))
      );
    }
  };

  // Table selection view
  if (!gameStarted) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-8"
        >
          <div className="text-6xl mb-4">🎰</div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">Choose Your Table</h1>
          <p className="text-gray-400">Select a table and join the action</p>
        </motion.div>

        <div className="grid gap-4">
          {TABLES.map((table, i) => (
            <motion.div
              key={table.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl p-6 hover:bg-white/8 transition-all duration-200 cursor-pointer group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl poker-felt flex items-center justify-center text-2xl border border-emerald-700/50 shadow-lg">
                    ♠
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">{table.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-gray-400 text-sm flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> {table.blinds}
                      </span>
                      <span className="text-gray-400 text-sm flex items-center gap-1">
                        <Users className="w-3 h-3" /> {table.players}/6
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={
                        table.difficulty === 'Easy' ? 'green' :
                        table.difficulty === 'Medium' ? 'blue' : 'red'
                      } size="xs">
                        {table.difficulty}
                      </Badge>
                      <span className="text-gray-500 text-xs">
                        Buy-in: ₹{table.min.toLocaleString()} – ₹{table.max.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {Array.from({ length: Math.min(table.players, 4) }).map((_, j) => (
                      <div
                        key={j}
                        className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-gray-900"
                      />
                    ))}
                    {table.players > 4 && (
                      <div className="w-7 h-7 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-xs text-gray-300">
                        +{table.players - 4}
                      </div>
                    )}
                  </div>
                  <Button
                    size="md"
                    onClick={() => initGame(table.id)}
                    icon={<ChevronDown className="w-4 h-4 rotate-270" />}
                  >
                    Join Table
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Demo chips notice */}
        <div className="glass rounded-xl p-4 flex items-center gap-3">
          <div className="text-2xl">🪙</div>
          <div>
            <p className="text-white text-sm font-medium">Playing with Demo Chips</p>
            <p className="text-gray-400 text-xs">You have {formatChips(userProfile?.demoChips || 5000)} demo chips. No real money involved.</p>
          </div>
          <div className="ml-auto">
            <Badge variant="gold">Demo Mode</Badge>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Table Info Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Badge variant="green" dot pulse>Live</Badge>
          <span className="text-white font-medium text-sm">
            {TABLES.find((t) => t.id === selectedTable)?.name}
          </span>
          <Badge variant="gold" size="xs">{GAME_PHASE_LABELS[phase]}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {isPlayerTurn ? (
              <span className={timeLeft <= 10 ? 'text-red-400 font-bold' : 'text-white'}>
                {timeLeft}s
              </span>
            ) : '–'}
          </span>
          <Button
            variant="ghost"
            size="xs"
            icon={<Settings className="w-4 h-4" />}
          >
          </Button>
          <Button
            variant="danger"
            size="xs"
            icon={<LogOut className="w-4 h-4" />}
            onClick={() => {
              setGameStarted(false);
              setPhase('waiting');
              toast('Left the table', { icon: '👋' });
            }}
          >
            Leave
          </Button>
        </div>
      </div>

      {/* POKER TABLE */}
      <div className="relative">
        {/* Outer felt */}
        <div className="poker-felt rounded-[40px] border-8 border-amber-900/60 p-4 md:p-6 shadow-[0_0_60px_rgba(0,0,0,0.9),inset_0_0_60px_rgba(0,0,0,0.5)] min-h-[500px]">
          {/* Inner rail */}
          <div className="poker-felt rounded-[32px] border-4 border-amber-800/30 p-4 md:p-6 relative">

            {/* TOP PLAYERS (seats 0-2) */}
            <div className="flex justify-around mb-6">
              {seats.slice(0, 3).map((seat) => (
                <PlayerSeatComp key={seat.seatIndex} seat={seat} />
              ))}
            </div>

            {/* CENTER - Community Cards + Pot */}
            <div className="flex flex-col items-center gap-4 py-4">
              {/* Community cards */}
              <div className="flex items-center gap-2">
                {communityCards.length === 0 ? (
                  <div className="flex gap-2 opacity-20">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="w-10 h-14 md:w-14 md:h-20 rounded-lg border-2 border-dashed border-white/20" />
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {communityCards.map((card, i) => (
                      <PlayingCard key={i} card={card} size="md" />
                    ))}
                    {/* Remaining slots */}
                    {Array.from({ length: 5 - communityCards.length }).map((_, i) => (
                      <div key={i} className="w-12 h-18 rounded-lg border-2 border-dashed border-white/10" style={{ height: '72px' }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Pot display */}
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center">
                  <div className="px-6 py-2 rounded-full bg-black/40 border border-amber-500/40 text-amber-400 font-mono font-bold text-lg shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                    🏆 POT: ₹{pot.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Phase indicator */}
              <div className="flex items-center gap-2">
                {(['pre-flop', 'flop', 'turn', 'river', 'showdown'] as GamePhase[]).map((p) => (
                  <div
                    key={p}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                      phase === p
                        ? 'bg-amber-500 text-black'
                        : ['pre-flop', 'flop', 'turn', 'river'].indexOf(p) <
                          ['pre-flop', 'flop', 'turn', 'river'].indexOf(phase as string)
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-gray-600'
                    }`}
                  >
                    {GAME_PHASE_LABELS[p]}
                  </div>
                ))}
              </div>
            </div>

            {/* BOTTOM PLAYERS (seats 3-5) */}
            <div className="flex justify-around mt-6">
              {seats.slice(3, 6).map((seat, i) => (
                <PlayerSeatComp
                  key={seat.seatIndex}
                  seat={seat}
                  isCurrentUser={i === 2}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PLAYER HAND + CONTROLS */}
      <div className="mt-4 glass rounded-2xl p-4 md:p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* My Cards */}
          <div className="flex items-center gap-4">
            <div>
              <p className="text-gray-400 text-xs mb-2">Your Hand</p>
              <div className="flex gap-2">
                {playerCards.map((card, i) => (
                  <PlayingCard key={i} card={card} size="lg" />
                ))}
              </div>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-xs">Your Chips</p>
              <p className="text-amber-400 font-mono font-bold text-lg">
                ₹{playerChips.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full md:w-auto">
            {isPlayerTurn ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 justify-center md:justify-end">
                  <Button
                    variant="danger"
                    size="md"
                    onClick={() => handleAction('fold')}
                  >
                    Fold
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => handleAction('check')}
                  >
                    Check
                  </Button>
                  <Button
                    variant="green"
                    size="md"
                    onClick={() => handleAction('call')}
                  >
                    Call ₹{currentBigBlind}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRaiseAmount((r) => Math.max(currentBigBlind * 2, r - 50))}
                    className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/20 flex-shrink-0"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <Button
                    variant="gold"
                    size="md"
                    className="flex-1"
                    onClick={() => handleAction('raise')}
                  >
                    Raise ₹{raiseAmount}
                  </Button>
                  <button
                    onClick={() => setRaiseAmount((r) => Math.min(playerChips, r + 50))}
                    className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/20 flex-shrink-0"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <Button
                    variant="purple"
                    size="md"
                    onClick={() => handleAction('all-in')}
                    className="flex-shrink-0"
                  >
                    All-In
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-4">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  <span className="text-sm">Waiting for other players...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Winner Overlay */}
      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 15 }}
              className="glass rounded-3xl p-8 max-w-sm w-full text-center"
            >
              {winner === 'You' ? (
                <>
                  <div className="text-6xl mb-4">🏆</div>
                  <h2 className="text-2xl font-display font-bold text-amber-400 mb-2">You Win!</h2>
                  <p className="text-white text-lg mb-1">Pot: ₹{pot.toLocaleString()}</p>
                  <p className="text-gray-400 text-sm">Congratulations! The chips are yours!</p>
                </>
              ) : (
                <>
                  <div className="text-6xl mb-4">😔</div>
                  <h2 className="text-2xl font-display font-bold text-red-400 mb-2">Better Luck!</h2>
                  <p className="text-white text-lg mb-1">{winner} wins</p>
                  <p className="text-gray-400 text-sm">Pot of ₹{pot.toLocaleString()} goes to {winner}</p>
                </>
              )}
              <div className="flex gap-3 mt-6">
                <Button variant="ghost" fullWidth onClick={() => {
                  setShowResults(false);
                  setGameStarted(false);
                }}>
                  Leave Table
                </Button>
                <Button fullWidth onClick={() => initGame(selectedTable || 't1')}>
                  Play Again
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PokerTablePage;
