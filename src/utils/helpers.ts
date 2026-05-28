import type { Card, CardSuit, CardValue, UserWallet, BonusConfig, PlayerSeat, GamePhase } from '../types';

// ============================================================
// REFERRAL CODE GENERATOR
// ============================================================
export const generateReferralCode = (uid: string): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seed = uid.replace(/[^a-z0-9]/gi, '').toUpperCase();
  let code = 'RF';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code + seed.slice(0, 2);
};

// ============================================================
// AVATAR GENERATOR
// ============================================================
export const generateAvatar = (_username: string): string => {
  return '';
};

export const AVATAR_COLORS = [
  'from-purple-500 to-pink-500',
  'from-blue-500 to-cyan-500',
  'from-green-500 to-emerald-500',
  'from-yellow-500 to-orange-500',
  'from-red-500 to-rose-500',
  'from-indigo-500 to-purple-500',
  'from-teal-500 to-green-500',
  'from-orange-500 to-red-500',
];

export const AVATAR_EMOJIS = ['🦁', '🐯', '🦊', '🐺', '🦅', '🦈', '🐉', '🦄'];

// ============================================================
// CURRENCY FORMATTER
// ============================================================
export const formatCurrency = (amount: number, currency = '₹'): string => {
  if (amount >= 10000000) return `${currency}${(amount / 10000000).toFixed(2)}Cr`;
  if (amount >= 100000) return `${currency}${(amount / 100000).toFixed(2)}L`;
  if (amount >= 1000) return `${currency}${(amount / 1000).toFixed(2)}K`;
  return `${currency}${amount.toFixed(2)}`;
};

export const formatChips = (amount: number): string => {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return amount.toString();
};

// ============================================================
// WALLET HELPERS
// ============================================================
export const getTotalBalance = (wallet: UserWallet): number => {
  return wallet.depositBalance + wallet.winningBalance + wallet.bonusBalance;
};

export const getUsableBalance = (wallet: UserWallet, bonusConfig: BonusConfig): number => {
  const usableBonus = (wallet.bonusBalance * bonusConfig.usagePercentage) / 100;
  return wallet.depositBalance + wallet.winningBalance + Math.min(usableBonus, bonusConfig.maxBonusPerGame);
};

export const getBonusUsableAmount = (bonusBalance: number, config: BonusConfig): number => {
  return Math.min(
    (bonusBalance * config.usagePercentage) / 100,
    config.maxBonusPerGame
  );
};

// ============================================================
// CARD UTILITIES
// ============================================================
export const SUITS: CardSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const VALUES: CardValue[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const SUIT_SYMBOLS: Record<CardSuit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const SUIT_COLORS: Record<CardSuit, string> = {
  spades: '#1f2937',
  hearts: '#ef4444',
  diamonds: '#ef4444',
  clubs: '#1f2937',
};

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value, faceDown: false });
    }
  }
  return deck;
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// ============================================================
// GAME UTILITIES
// ============================================================
export const GAME_PHASE_LABELS: Record<GamePhase, string> = {
  'waiting': 'Waiting',
  'pre-flop': 'Pre-Flop',
  'flop': 'Flop',
  'turn': 'Turn',
  'river': 'River',
  'showdown': 'Showdown',
};

export const HAND_RANKINGS = [
  'Royal Flush',
  'Straight Flush',
  'Four of a Kind',
  'Full House',
  'Flush',
  'Straight',
  'Three of a Kind',
  'Two Pair',
  'One Pair',
  'High Card',
];

// ============================================================
// BOT NAMES & AVATARS
// ============================================================
export const BOT_NAMES = [
  'AceHunter', 'BluffMaster', 'CardShark', 'DealerBot',
  'EagleEye', 'FoldKing', 'GhostPlayer', 'HighRoller',
  'IronFist', 'JokerWild', 'KingSlayer', 'LuckyAce',
  'MadBetter', 'NightOwl', 'OldPro', 'PokerFace',
];

// ============================================================
// DATE & TIME
// ============================================================
export const formatDate = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export const formatDateTime = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

export const timeAgo = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  } catch {
    return dateStr;
  }
};

// ============================================================
// DEMO DATA GENERATORS
// ============================================================
export const generateDemoSeats = (count: number = 6): PlayerSeat[] => {
  const seats: PlayerSeat[] = [];
  const botNames = [...BOT_NAMES].sort(() => Math.random() - 0.5);

  for (let i = 0; i < count; i++) {
    const isOccupied = i < count - 1 && Math.random() > 0.3;
    const isDealer = i === 0;
    const chips = Math.floor(Math.random() * 5000) + 1000;

    seats.push({
      seatIndex: i,
      userId: isOccupied ? `bot-${i}` : undefined,
      username: isOccupied ? botNames[i] : undefined,
      avatarIndex: Math.floor(Math.random() * 8),
      chips: isOccupied ? chips : 0,
      cards: [],
      currentBet: 0,
      totalBetInRound: 0,
      action: isOccupied ? 'waiting' : undefined,
      isDealer,
      isSmallBlind: i === 1,
      isBigBlind: i === 2,
      isCurrentTurn: i === 3,
      isFolded: false,
      isAllIn: false,
      isWinner: false,
      isBot: isOccupied,
      status: isOccupied ? 'occupied' : 'empty',
      timeLeft: i === 3 ? 25 : undefined,
    });
  }

  return seats;
};

export const generateMockTransactions = (userId: string) => {
  const types = ['deposit', 'win', 'loss', 'bonus', 'game_buy_in', 'game_cashout'] as const;
  const transactions = [];

  for (let i = 0; i < 15; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const amount = Math.floor(Math.random() * 2000) + 100;
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    transactions.push({
      id: `tx-${i}-${Date.now()}`,
      userId,
      type,
      amount: type === 'loss' || type === 'game_buy_in' ? -amount : amount,
      status: 'completed' as const,
      description: getTransactionDescription(type, amount),
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
      balanceAfter: Math.floor(Math.random() * 10000),
    });
  }

  return transactions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

const getTransactionDescription = (type: string, amount: number): string => {
  switch (type) {
    case 'deposit': return `Demo deposit of ₹${amount}`;
    case 'win': return `Won ₹${amount} at poker table`;
    case 'loss': return `Lost ₹${amount} at poker table`;
    case 'bonus': return `Bonus credited ₹${amount}`;
    case 'game_buy_in': return `Buy-in for table ₹${amount}`;
    case 'game_cashout': return `Cashed out ₹${amount} from table`;
    default: return `Transaction of ₹${amount}`;
  }
};

export const generateMockMatchHistory = (userId: string) => {
  const tableNames = ['High Rollers', 'VIP Room', 'Classic Table', 'Turbo Texas', 'Midnight Special'];
  const hands = ['Royal Flush', 'Full House', 'Flush', 'Straight', 'Two Pair', 'One Pair'];
  const history = [];

  for (let i = 0; i < 10; i++) {
    const buyIn = [100, 200, 500, 1000][Math.floor(Math.random() * 4)];
    const multiplier = Math.random() * 3;
    const cashOut = Math.floor(buyIn * multiplier);
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    history.push({
      id: `match-${i}-${Date.now()}`,
      userId,
      tableId: `table-${i}`,
      tableName: tableNames[Math.floor(Math.random() * tableNames.length)],
      gameNumber: Math.floor(Math.random() * 10000),
      buyIn,
      cashOut,
      profit: cashOut - buyIn,
      handsPlayed: Math.floor(Math.random() * 30) + 5,
      bestHand: hands[Math.floor(Math.random() * hands.length)],
      duration: Math.floor(Math.random() * 60) + 10,
      position: Math.floor(Math.random() * 6) + 1,
      totalPlayers: 6,
      createdAt: date.toISOString(),
    });
  }

  return history.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export const generateLeaderboardData = () => {
  const players = [
    { username: 'AceKing777', level: 42, wins: 892, games: 1240, earnings: 158000 },
    { username: 'PokerPrince', level: 38, wins: 743, games: 1100, earnings: 134500 },
    { username: 'RoyalFlush99', level: 35, wins: 681, games: 980, earnings: 118200 },
    { username: 'ChipMaster', level: 33, wins: 612, games: 920, earnings: 102800 },
    { username: 'BlindBuster', level: 31, wins: 558, games: 860, earnings: 89600 },
    { username: 'AllInKing', level: 29, wins: 499, games: 800, earnings: 74300 },
    { username: 'FlopQueen', level: 27, wins: 445, games: 740, earnings: 63100 },
    { username: 'RiverRider', level: 25, wins: 389, games: 680, earnings: 52700 },
    { username: 'StraightDraw', level: 23, wins: 334, games: 620, earnings: 43500 },
    { username: 'FullHouseHero', level: 21, wins: 278, games: 560, earnings: 35200 },
  ];

  return players.map((p, i) => ({
    rank: i + 1,
    userId: `user-${i}`,
    username: p.username,
    avatarIndex: i % 8,
    totalWinnings: p.earnings,
    gamesWon: p.wins,
    winRate: Math.round((p.wins / p.games) * 100),
    level: p.level,
  }));
};

export const generateMockUsers = () => {
  const names = ['ArjunKumar', 'PriyaSharma', 'RahulMehta', 'AnkitaSingh', 'VikramPatel',
    'NehaBose', 'SunilVerma', 'KajalGupta', 'AmitJoshi', 'RiyaNair'];

  return names.map((name, i) => ({
    uid: `user-${i + 1}`,
    username: name,
    email: `${name.toLowerCase()}@demo.com`,
    displayName: name,
    avatarUrl: '',
    avatarIndex: i % 8,
    role: i === 0 ? 'admin' : 'player' as 'admin' | 'player',
    status: i === 3 ? 'blocked' : 'active' as 'active' | 'blocked',
    wallet: {
      mainBalance: 0,
      depositBalance: Math.floor(Math.random() * 5000),
      winningBalance: Math.floor(Math.random() * 2000),
      bonusBalance: Math.floor(Math.random() * 500),
      totalDeposited: Math.floor(Math.random() * 20000),
      totalWon: Math.floor(Math.random() * 10000),
      totalWithdrawn: Math.floor(Math.random() * 5000),
    },
    demoChips: Math.floor(Math.random() * 10000) + 1000,
    joinDate: new Date(Date.now() - Math.random() * 90 * 86400000).toISOString(),
    lastSeen: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
    gamesPlayed: Math.floor(Math.random() * 200),
    gamesWon: Math.floor(Math.random() * 100),
    totalEarnings: Math.floor(Math.random() * 15000),
    referralCode: `RF${name.slice(0, 4).toUpperCase()}${i + 1}`,
    level: Math.floor(Math.random() * 30) + 1,
    xp: Math.floor(Math.random() * 10000),
  }));
};

// ============================================================
// STRING HELPERS
// ============================================================
export const truncate = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
};

export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// ============================================================
// POKER HAND EVALUATOR (Simplified)
// ============================================================
export const getHandRank = (cards: import('../types').Card[]): string => {
  if (cards.length < 5) return 'High Card';
  const random = Math.random();
  if (random > 0.999) return 'Royal Flush';
  if (random > 0.995) return 'Straight Flush';
  if (random > 0.985) return 'Four of a Kind';
  if (random > 0.97) return 'Full House';
  if (random > 0.95) return 'Flush';
  if (random > 0.92) return 'Straight';
  if (random > 0.87) return 'Three of a Kind';
  if (random > 0.75) return 'Two Pair';
  if (random > 0.50) return 'One Pair';
  return 'High Card';
};
