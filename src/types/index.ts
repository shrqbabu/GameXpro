// ============================================================
// CORE TYPES
// ============================================================

export type UserRole = 'player' | 'admin' | 'moderator';
export type UserStatus = 'active' | 'blocked' | 'suspended';

export interface UserWallet {
  mainBalance: number;
  depositBalance: number;
  winningBalance: number;
  bonusBalance: number;
  totalDeposited: number;
  totalWon: number;
  totalWithdrawn: number;
}

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  avatarIndex: number;
  role: UserRole;
  status: UserStatus;
  wallet: UserWallet;
  demoChips: number;
  joinDate: string;
  lastSeen: string;
  gamesPlayed: number;
  gamesWon: number;
  totalEarnings: number;
  referralCode: string;
  referredBy?: string;
  dailyBonusLastClaimed?: string;
  level: number;
  xp: number;
}

// ============================================================
// TRANSACTION TYPES
// ============================================================

export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'win'
  | 'loss'
  | 'bonus'
  | 'referral'
  | 'daily_bonus'
  | 'game_buy_in'
  | 'game_cashout';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  description: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
  balanceAfter?: number;
  gateway?: string; // For future real payment integration
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
}

// ============================================================
// BONUS SYSTEM TYPES
// ============================================================

export interface BonusConfig {
  usagePercentage: number; // % of bonus usable per game (e.g., 10)
  maxBonusPerGame: number; // Max bonus chips per game in rupees
  wageringRequirement: number; // Wagering multiplier before withdrawal
  expiryDays: number; // Days until bonus expires
}

// ============================================================
// GAME / POKER TYPES
// ============================================================

export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type CardValue = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: CardSuit;
  value: CardValue;
  faceDown?: boolean;
}

export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'all-in' | 'waiting' | 'sitting-out';
export type GamePhase = 'waiting' | 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown';
export type SeatStatus = 'empty' | 'occupied' | 'reserved';

export interface PlayerSeat {
  seatIndex: number;
  userId?: string;
  username?: string;
  avatarIndex?: number;
  chips: number;
  cards: Card[];
  currentBet: number;
  totalBetInRound: number;
  action?: PlayerAction;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isCurrentTurn: boolean;
  isFolded: boolean;
  isAllIn: boolean;
  isWinner: boolean;
  isBot: boolean;
  status: SeatStatus;
  timeLeft?: number;
}

export interface GameTable {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayers: number;
  currentPlayers: number;
  phase: GamePhase;
  pot: number;
  sidePots: number[];
  communityCards: Card[];
  seats: PlayerSeat[];
  deckRemaining: number;
  dealerSeatIndex: number;
  currentSeatIndex: number;
  timePerTurn: number;
  isPrivate: boolean;
  password?: string;
  createdAt: string;
  status: 'waiting' | 'active' | 'finished';
  gameNumber: number;
}

export interface MatchHistory {
  id: string;
  userId: string;
  tableId: string;
  tableName: string;
  gameNumber: number;
  buyIn: number;
  cashOut: number;
  profit: number;
  handsPlayed: number;
  bestHand?: string;
  duration: number; // minutes
  position: number;
  totalPlayers: number;
  createdAt: string;
}

// ============================================================
// ADMIN TYPES
// ============================================================

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalRevenue: number;
  activeTables: number;
  onlinePlayers: number;
  todayDeposits: number;
  todayWithdrawals: number;
  pendingWithdrawals: number;
}

// ============================================================
// LEADERBOARD
// ============================================================

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarIndex: number;
  totalWinnings: number;
  gamesWon: number;
  winRate: number;
  level: number;
}

// ============================================================
// REFERRAL
// ============================================================

export interface ReferralInfo {
  code: string;
  totalReferrals: number;
  totalEarned: number;
  referrals: {
    userId: string;
    username: string;
    joinDate: string;
    bonusEarned: number;
  }[];
}

// ============================================================
// PAYMENT GATEWAY (Future Integration)
// ============================================================

export interface PaymentGatewayConfig {
  name: string; // 'razorpay' | 'stripe' | 'paytm' | 'phonepe'
  isEnabled: boolean;
  keyId?: string;
  environment: 'sandbox' | 'production';
}

export interface DepositRequest {
  amount: number;
  gateway: string;
  userId: string;
  // Future: will contain gateway-specific fields
  orderId?: string;
  paymentId?: string;
  signature?: string;
}
