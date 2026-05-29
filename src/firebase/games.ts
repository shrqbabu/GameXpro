import {
  doc,
  collection,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  increment,
  arrayUnion,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import {
  GameRoom,
  MatchmakingQueue,
  ColorPredictionRound,
  ColorChoice,
  PlayerInfo,
} from '../types';
import { addFunds, deductFunds } from './wallet';

// ===================== MATCHMAKING =====================

export const joinMatchmakingQueue = async (
  uid: string,
  userName: string,
  photoURL: string,
  entryFee: number,
  gameType: string
): Promise<string> => {
  const existingQ = query(
    collection(db, 'matchmakingQueue'),
    where('uid', '==', uid),
    where('status', '==', 'WAITING')
  );
  const existingSnap = await getDocs(existingQ);
  if (!existingSnap.empty) {
    return existingSnap.docs[0].id;
  }

  const qRef = await addDoc(collection(db, 'matchmakingQueue'), {
    uid,
    userName,
    photoURL: photoURL || '',
    entryFee,
    gameType,
    status: 'WAITING',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return qRef.id;
};

export const cancelMatchmaking = async (queueId: string) => {
  await updateDoc(doc(db, 'matchmakingQueue', queueId), {
    status: 'CANCELLED',
    updatedAt: serverTimestamp(),
  });
};

export const subscribeMatchmakingQueue = (
  queueId: string,
  callback: (entry: MatchmakingQueue | null) => void
) => {
  return onSnapshot(doc(db, 'matchmakingQueue', queueId), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as MatchmakingQueue) : null);
  });
};

/**
 * MATCHMAKING LOGIC:
 * - Dono players poll karte hain
 * - Jo player BAAD mein aaya (newer createdAt) woh MATCHER hai — woh room banata hai
 * - Jo pehle aaya (older) woh sirf wait karta hai subscribeMatchmakingQueue se
 * - Isse conflict nahi hota — sirf ek hi room banta hai
 */
export const findMatch = async (
  uid: string,
  queueId: string,
  entryFee: number,
  gameType: string
): Promise<string | null> => {
  // Sabse purani WAITING entries dhundo (pehle aaye players)
  const q = query(
    collection(db, 'matchmakingQueue'),
    where('status', '==', 'WAITING'),
    where('entryFee', '==', entryFee),
    where('gameType', '==', gameType),
    orderBy('createdAt', 'asc'),
    limit(10)
  );

  const snap = await getDocs(q);
  const allWaiting = snap.docs;

  // Apni entry dhundo
  const myEntry = allWaiting.find((d) => d.id === queueId);
  if (!myEntry) return null; // apni entry nahi mili — already matched/cancelled

  // Doosre players dhundo
  const others = allWaiting.filter((d) => d.data().uid !== uid);
  if (others.length === 0) return null; // koi opponent nahi

  // KEY FIX: Sirf NEWER player (baad mein aaya) room banata hai
  // Older player (pehle aaya) sirf wait karta hai
  const myCreatedAt = myEntry.data().createdAt?.toMillis?.() ?? 0;
  const opponent = others[0];
  const opponentCreatedAt = opponent.data().createdAt?.toMillis?.() ?? 0;

  // Agar main pehle aaya hoon toh main sirf wait karunga
  // Opponent (baad mein aaya) room banayega
  if (myCreatedAt <= opponentCreatedAt) {
    return null; // main older hoon — wait karo, opponent room banayega
  }

  // Main newer hoon — mera kaam hai room banana
  const roomRef = doc(collection(db, 'gameRooms'));
  const roomId = roomRef.id;

  try {
    await runTransaction(db, async (tx) => {
      // ── READS (sabse pehle) ────────────────────────────────────────────────
      const myQueueRef = doc(db, 'matchmakingQueue', queueId);
      const opponentQueueRef = doc(db, 'matchmakingQueue', opponent.id);

      const [mySnap, oppSnap] = await Promise.all([
        tx.get(myQueueRef),
        tx.get(opponentQueueRef),
      ]);

      if (!mySnap.exists() || !oppSnap.exists()) {
        throw new Error('Queue entry not found');
      }
      if (mySnap.data().status !== 'WAITING' || oppSnap.data().status !== 'WAITING') {
        throw new Error('Already matched');
      }

      const myData = mySnap.data();
      const oppData = oppSnap.data();

      // ── COMPUTE ────────────────────────────────────────────────────────────
      // Older player = player1, newer (me) = player2
      const player1: PlayerInfo = {
        uid: oppData.uid,
        name: oppData.userName,
        photoURL: oppData.photoURL || '',
      };

      const player2: PlayerInfo = {
        uid: myData.uid,
        name: myData.userName,
        photoURL: myData.photoURL || '',
      };

      // ── WRITES ─────────────────────────────────────────────────────────────
      tx.set(roomRef, {
        roomId,
        gameType,
        entryFee,
        status: 'WAITING',
        player1,
        player2,
        winner: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.update(myQueueRef, {
        status: 'MATCHED',
        roomId,
        updatedAt: serverTimestamp(),
      });

      tx.update(opponentQueueRef, {
        status: 'MATCHED',
        roomId,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (err: any) {
    // Already matched by someone else — normal race condition, ignore
    if (err.message === 'Already matched') return null;
    throw err;
  }

  return roomId;
};

// ===================== GAME ROOMS =====================

export const subscribeGameRoom = (
  roomId: string,
  callback: (room: GameRoom | null) => void
) => {
  return onSnapshot(doc(db, 'gameRooms', roomId), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as GameRoom) : null);
  });
};

export const startCardGame = async (roomId: string) => {
  const roomRef = doc(db, 'gameRooms', roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error('Room not found');

  const room = roomSnap.data() as GameRoom;
  if (room.status !== 'WAITING') return;

  const suits = ['♠', '♥', '♦', '♣'];
  const card1 = Math.floor(Math.random() * 13) + 1;
  const card2 = Math.floor(Math.random() * 13) + 1;
  const suit1 = suits[Math.floor(Math.random() * 4)];
  const suit2 = suits[Math.floor(Math.random() * 4)];

  let winnerId = '';
  let winnerName = '';

  if (card1 > card2) {
    winnerId = room.player1!.uid;
    winnerName = room.player1!.name;
  } else if (card2 > card1) {
    winnerId = room.player2!.uid;
    winnerName = room.player2!.name;
  } else {
    winnerId = 'TIE';
    winnerName = 'TIE';
  }

  await updateDoc(roomRef, {
    status: 'PLAYING',
    'player1.card': card1,
    'player1.cardSuit': suit1,
    'player2.card': card2,
    'player2.cardSuit': suit2,
    updatedAt: serverTimestamp(),
  });

  setTimeout(async () => {
    await settleCardGame(
      roomId,
      winnerId,
      winnerName,
      room.entryFee,
      room.player1!,
      room.player2!
    );
  }, 3000);
};

export const settleCardGame = async (
  roomId: string,
  winnerId: string,
  winnerName: string,
  entryFee: number,
  player1: PlayerInfo,
  player2: PlayerInfo
) => {
  const roomRef = doc(db, 'gameRooms', roomId);

  if (winnerId === 'TIE') {
    await Promise.all([
      addFunds(player1.uid, entryFee, 'winningBalance', 'Card game - Tie refund'),
      addFunds(player2.uid, entryFee, 'winningBalance', 'Card game - Tie refund'),
    ]);

    await updateDoc(roomRef, {
      status: 'FINISHED',
      winner: 'TIE',
      winnerName: 'TIE',
      updatedAt: serverTimestamp(),
    });
  } else {
    const loserId = winnerId === player1.uid ? player2.uid : player1.uid;
    const platformFee = entryFee * 0.1;
    const payout = entryFee * 2 - platformFee;

    await addFunds(winnerId, payout, 'winningBalance', `Card game win - ₹${payout}`);

    await updateDoc(roomRef, {
      status: 'FINISHED',
      winner: winnerId,
      winnerName,
      updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, 'transactions'), {
      uid: loserId,
      type: 'GAME_LOSS',
      amount: -entryFee,
      previousBalance: 0,
      currentBalance: 0,
      status: 'COMPLETED',
      description: 'Card game loss',
      createdAt: serverTimestamp(),
    });
  }

  await Promise.all([
    sendGameNotification(player1.uid, winnerId === player1.uid, 'Card Battle', entryFee),
    sendGameNotification(player2.uid, winnerId === player2.uid, 'Card Battle', entryFee),
  ]);
};

// ===================== COLOR PREDICTION =====================

export const subscribeColorGame = (
  callback: (round: ColorPredictionRound | null) => void
) => {
  const q = query(
    collection(db, 'colorPredictionGames'),
    orderBy('roundNumber', 'desc'),
    limit(1)
  );

  return onSnapshot(q, (snap) => {
    callback(
      snap.empty
        ? null
        : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as ColorPredictionRound)
    );
  });
};

export const getColorGameHistory = async (limitCount = 10) => {
  const q = query(
    collection(db, 'colorPredictionGames'),
    orderBy('roundNumber', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ColorPredictionRound));
};

export const placeBet = async (
  uid: string,
  userName: string,
  roundId: string,
  color: ColorChoice,
  amount: number
) => {
  // Validate PEHLE, phir deduct
  const roundRef = doc(db, 'colorPredictionGames', roundId);
  const roundSnap = await getDoc(roundRef);
  if (!roundSnap.exists()) throw new Error('Round not found');

  const round = roundSnap.data() as ColorPredictionRound;
  if (round.status !== 'BETTING') throw new Error('Betting is closed');

  const existingBet = round.bets?.find((b: any) => b.uid === uid);
  if (existingBet) throw new Error('Already placed a bet in this round');

  await deductFunds(uid, amount, 'GAME_LOSS', `Color prediction bet - ${color}`);

  const multiplier = color === 'VIOLET' ? 3 : 2;

  await updateDoc(roundRef, {
    bets: [
      ...(round.bets || []),
      { uid, userName, color, amount, multiplier, settled: false },
    ],
    updatedAt: serverTimestamp(),
  });
};

// ===================== DICE GAME =====================

export const playDiceGame = async (
  uid: string,
  bet: number,
  prediction: 'ODD' | 'EVEN'
): Promise<{ dice1: number; dice2: number; sum: number; won: boolean; payout: number }> => {
  await deductFunds(uid, bet, 'GAME_LOSS', `Dice game bet - ${prediction}`);

  const dice1 = Math.floor(Math.random() * 6) + 1;
  const dice2 = Math.floor(Math.random() * 6) + 1;
  const sum = dice1 + dice2;
  const result = sum % 2 === 0 ? 'EVEN' : 'ODD';
  const won = result === prediction;
  const payout = won ? bet * 2 : 0;

  if (won) {
    await addFunds(uid, payout, 'winningBalance', `Dice game win - ${sum} (${result})`);
  }

  await addDoc(collection(db, 'diceGames'), {
    uid,
    bet,
    prediction,
    dice1,
    dice2,
    sum,
    result,
    won,
    payout,
    status: 'SETTLED',
    createdAt: serverTimestamp(),
  });

  await sendGameNotification(uid, won, 'Dice Game', bet);

  return { dice1, dice2, sum, won, payout };
};

// ===================== NOTIFICATIONS =====================

export const sendGameNotification = async (
  uid: string,
  won: boolean,
  gameName: string,
  amount: number
) => {
  await addDoc(collection(db, 'notifications'), {
    uid,
    type: won ? 'GAME_WIN' : 'GAME_LOSS',
    title: won ? '🎉 You Won!' : '😔 Better Luck Next Time',
    message: won
      ? `Congratulations! You won ₹${amount * 2} in ${gameName}`
      : `You lost ₹${amount} in ${gameName}. Keep playing!`,
    read: false,
    createdAt: serverTimestamp(),
  });
};

export const subscribeNotifications = (
  uid: string,
  callback: (notifications: any[]) => void
) => {
  const q = query(
    collection(db, 'notifications'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(20)
  );

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};

export const markNotificationRead = async (notificationId: string) => {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true });
};

export const cleanupStaleRooms = async () => {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const q = query(
    collection(db, 'gameRooms'),
    where('status', '==', 'WAITING'),
    where('createdAt', '<', Timestamp.fromDate(tenMinutesAgo))
  );
  const snap = await getDocs(q);
  await Promise.all(
    snap.docs.map((d) =>
      updateDoc(d.ref, { status: 'CANCELLED', updatedAt: serverTimestamp() })
    )
  );
};


// src/firebase/games.ts
// =====================================================
// GAMES FIREBASE SERVICE
// Andar Bahar + Dragon Tiger + Poker
// Integrates with your existing wallet.ts
// =====================================================



// =====================================================
// CARD UTILITIES
// =====================================================

export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  value: string;
  numericValue: number;
}

const createDeck = (): Card[] => {
  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const numericMap: Record<string, number> = {
    A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13,
  };
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value, numericValue: numericMap[value] });
    }
  }
  return deck;
};

const shuffleDeck = (deck: Card[]): Card[] => {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
};

// =====================================================
// TYPES
// =====================================================

export type ABStatus = 'betting' | 'dealing' | 'result';
export type DTStatus = 'betting' | 'dealing' | 'result';
export type PokerStatus = 'waiting' | 'playing' | 'finished';
export type PokerPhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface ABBet {
  uid: string;
  name: string;
  amount: number;
  side: 'andar' | 'bahar';
  placedAt: any;
}

export interface DTBet {
  uid: string;
  name: string;
  amount: number;
  side: 'dragon' | 'tiger' | 'tie';
  placedAt: any;
}

export interface AndarBaharGame {
  id: string;
  status: ABStatus;
  roundNumber: number;
  jokerCard: Card | null;
  andarCards: Card[];
  baharCards: Card[];
  bets: ABBet[];
  winner: 'andar' | 'bahar' | null;
  pot: number;
  bettingEndsAt: any;
  createdAt: any;
  updatedAt: any;
}

export interface DragonTigerGame {
  id: string;
  status: DTStatus;
  roundNumber: number;
  dragonCard: Card | null;
  tigerCard: Card | null;
  bets: DTBet[];
  winner: 'dragon' | 'tiger' | 'tie' | null;
  pot: number;
  bettingEndsAt: any;
  createdAt: any;
  updatedAt: any;
}

export interface PokerPlayer {
  uid: string;
  name: string;
  avatar: string;
  chips: number;
  holeCards: Card[];
  bet: number;
  totalBet: number;
  status: 'waiting' | 'active' | 'folded' | 'allin' | 'left';
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isTurn: boolean;
  handRank?: string;
  seatIndex: number;
  joinedAt: any;
}

export interface PokerTable {
  id: string;
  name: string;
  status: PokerStatus;
  phase: PokerPhase;
  minBuyIn: number;
  maxBuyIn: number;
  smallBlind: number;
  bigBlind: number;
  maxPlayers: 4;
  players: PokerPlayer[];
  spectators: string[];
  communityCards: Card[];
  pot: number;
  sidePots: number[];
  currentBet: number;
  dealerSeat: number;
  activePlayerUid: string | null;
  deck: Card[];
  handNumber: number;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  lastActionAt: any;
}

// =====================================================
// ─── ANDAR BAHAR ─────────────────────────────────────
// =====================================================

const AB_COLLECTION = 'andarBaharGames';
const BETTING_DURATION_MS = 30000; // 30 seconds

export const createAndarBaharRound = async (): Promise<string> => {
  const ref = doc(collection(db, AB_COLLECTION));
  const bettingEndsAt = new Date(Date.now() + BETTING_DURATION_MS);

  await setDoc(ref, {
    id: ref.id,
    status: 'betting',
    roundNumber: Date.now(),
    jokerCard: null,
    andarCards: [],
    baharCards: [],
    bets: [],
    winner: null,
    pot: 0,
    bettingEndsAt,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
};

export const getActiveAndarBaharGame = async (): Promise<string | null> => {
  const q = query(
    collection(db, AB_COLLECTION),
    where('status', 'in', ['betting', 'dealing']),
    orderBy('createdAt', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].id;
  return null;
};

export const subscribeAndarBahar = (
  gameId: string,
  cb: (game: AndarBaharGame) => void
) => {
  return onSnapshot(doc(db, AB_COLLECTION, gameId), (snap) => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() } as AndarBaharGame);
  });
};

export const placeAndarBaharBet = async (
  gameId: string,
  uid: string,
  name: string,
  amount: number,
  side: 'andar' | 'bahar'
): Promise<void> => {
  await runTransaction(db, async (tx) => {
    const gameRef = doc(db, AB_COLLECTION, gameId);
    const walletRef = doc(db, 'wallets', uid);

    const [gameSnap, walletSnap] = await Promise.all([
      tx.get(gameRef),
      tx.get(walletRef),
    ]);

    if (!gameSnap.exists()) throw new Error('Game not found');
    if (!walletSnap.exists()) throw new Error('Wallet not found');

    const game = gameSnap.data() as AndarBaharGame;
    const wallet = walletSnap.data();

    if (game.status !== 'betting') throw new Error('Betting is closed');

    const alreadyBet = game.bets?.some((b: ABBet) => b.uid === uid);
    if (alreadyBet) throw new Error('You already placed a bet this round');

    // Check balance using your helper
    const { calculateUsableBalance } = await import('../utils/helpers');
    const usable = calculateUsableBalance(wallet as any);
    if (usable < amount) throw new Error('Insufficient balance');

    // Deduct from wallet using priority order
    const { deductFromWallet } = await import('../utils/helpers');
    const newBalances = deductFromWallet(wallet as any, amount);
    if (!newBalances) throw new Error('Insufficient balance');

    // Update wallet
    tx.update(walletRef, {
      ...newBalances,
      updatedAt: serverTimestamp(),
    });

    // Record transaction
    const txRef = doc(collection(db, 'transactions'));
    const prevBalance = (wallet.depositBalance || 0) + (wallet.winningBalance || 0) +
      (wallet.bonusBalance || 0) + (wallet.referralBalance || 0);
    tx.set(txRef, {
      uid,
      type: 'GAME_BET',
      amount: -amount,
      previousBalance: prevBalance,
      currentBalance: prevBalance - amount,
      status: 'COMPLETED',
      description: `Andar Bahar bet - ${side.toUpperCase()}`,
      gameId,
      createdAt: serverTimestamp(),
    });

    // Add bet to game
    const newBet: ABBet = {
      uid,
      name,
      amount,
      side,
      placedAt: new Date(),
    };

    tx.update(gameRef, {
      bets: arrayUnion(newBet),
      pot: increment(amount),
      updatedAt: serverTimestamp(),
    });
  });
};

export const dealAndarBahar = async (gameId: string): Promise<void> => {
  const gameRef = doc(db, AB_COLLECTION, gameId);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error('Game not found');

  const game = gameSnap.data() as AndarBaharGame;
  if (game.status !== 'betting') return;

  // Update status to dealing
  await updateDoc(gameRef, {
    status: 'dealing',
    updatedAt: serverTimestamp(),
  });

  // Build and shuffle deck
  let deck = shuffleDeck(createDeck());
  const jokerCard = deck.pop()!;
  deck = shuffleDeck(deck);

  const andarCards: Card[] = [];
  const baharCards: Card[] = [];
  let winner: 'andar' | 'bahar' | null = null;

  // Bahar gets first card
  let currentSide: 'andar' | 'bahar' = 'bahar';
  let safetyCount = 0;

  while (safetyCount < 52 && winner === null) {
    const card = deck.pop()!;

    if (currentSide === 'andar') {
      andarCards.push(card);
    } else {
      baharCards.push(card);
    }

    // Check if card matches joker value
    if (card.value === jokerCard.value) {
      winner = currentSide;
      break;
    }

    currentSide = currentSide === 'andar' ? 'bahar' : 'andar';
    safetyCount++;
  }

  // Update game with result
  await updateDoc(gameRef, {
    status: 'result',
    jokerCard,
    andarCards,
    baharCards,
    winner,
    updatedAt: serverTimestamp(),
  });

  // Distribute winnings
  const bets: ABBet[] = game.bets || [];

  for (const bet of bets) {
    if (bet.side === winner) {
      // 90% payout (platform takes 10%)
      const winAmount = Math.floor(bet.amount * 1.9);
      try {
        await addFunds(
          bet.uid,
          winAmount,
          'winningBalance',
          `Andar Bahar WIN - ${winner?.toUpperCase()} - Round #${game.roundNumber}`
        );
      } catch (e) {
        console.error('Error paying winner:', bet.uid, e);
      }
    }
  }
};

// =====================================================
// ─── DRAGON TIGER ─────────────────────────────────────
// =====================================================

const DT_COLLECTION = 'dragonTigerGames';

export const createDragonTigerRound = async (): Promise<string> => {
  const ref = doc(collection(db, DT_COLLECTION));
  const bettingEndsAt = new Date(Date.now() + BETTING_DURATION_MS);

  await setDoc(ref, {
    id: ref.id,
    status: 'betting',
    roundNumber: Date.now(),
    dragonCard: null,
    tigerCard: null,
    bets: [],
    winner: null,
    pot: 0,
    bettingEndsAt,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
};

export const getActiveDragonTigerGame = async (): Promise<string | null> => {
  const q = query(
    collection(db, DT_COLLECTION),
    where('status', 'in', ['betting', 'dealing']),
    orderBy('createdAt', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].id;
  return null;
};

export const subscribeDragonTiger = (
  gameId: string,
  cb: (game: DragonTigerGame) => void
) => {
  return onSnapshot(doc(db, DT_COLLECTION, gameId), (snap) => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() } as DragonTigerGame);
  });
};

export const placeDragonTigerBet = async (
  gameId: string,
  uid: string,
  name: string,
  amount: number,
  side: 'dragon' | 'tiger' | 'tie'
): Promise<void> => {
  await runTransaction(db, async (tx) => {
    const gameRef = doc(db, DT_COLLECTION, gameId);
    const walletRef = doc(db, 'wallets', uid);

    const [gameSnap, walletSnap] = await Promise.all([
      tx.get(gameRef),
      tx.get(walletRef),
    ]);

    if (!gameSnap.exists()) throw new Error('Game not found');
    if (!walletSnap.exists()) throw new Error('Wallet not found');

    const game = gameSnap.data() as DragonTigerGame;
    const wallet = walletSnap.data();

    if (game.status !== 'betting') throw new Error('Betting is closed');

    const alreadyBet = game.bets?.some((b: DTBet) => b.uid === uid);
    if (alreadyBet) throw new Error('You already placed a bet this round');

    const { calculateUsableBalance, deductFromWallet } = await import('../utils/helpers');
    const usable = calculateUsableBalance(wallet as any);
    if (usable < amount) throw new Error('Insufficient balance');

    const newBalances = deductFromWallet(wallet as any, amount);
    if (!newBalances) throw new Error('Insufficient balance');

    tx.update(walletRef, {
      ...newBalances,
      updatedAt: serverTimestamp(),
    });

    const prevBalance = (wallet.depositBalance || 0) + (wallet.winningBalance || 0) +
      (wallet.bonusBalance || 0) + (wallet.referralBalance || 0);
    const txRef = doc(collection(db, 'transactions'));
    tx.set(txRef, {
      uid,
      type: 'GAME_BET',
      amount: -amount,
      previousBalance: prevBalance,
      currentBalance: prevBalance - amount,
      status: 'COMPLETED',
      description: `Dragon Tiger bet - ${side.toUpperCase()}`,
      gameId,
      createdAt: serverTimestamp(),
    });

    const newBet: DTBet = {
      uid,
      name,
      amount,
      side,
      placedAt: new Date(),
    };

    tx.update(gameRef, {
      bets: arrayUnion(newBet),
      pot: increment(amount),
      updatedAt: serverTimestamp(),
    });
  });
};

export const dealDragonTiger = async (gameId: string): Promise<void> => {
  const gameRef = doc(db, DT_COLLECTION, gameId);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error('Game not found');

  const game = gameSnap.data() as DragonTigerGame;
  if (game.status !== 'betting') return;

  await updateDoc(gameRef, {
    status: 'dealing',
    updatedAt: serverTimestamp(),
  });

  const deck = shuffleDeck(createDeck());
  const dragonCard = deck[0];
  const tigerCard = deck[1];

  let winner: 'dragon' | 'tiger' | 'tie';
  if (dragonCard.numericValue > tigerCard.numericValue) {
    winner = 'dragon';
  } else if (tigerCard.numericValue > dragonCard.numericValue) {
    winner = 'tiger';
  } else {
    winner = 'tie';
  }

  await updateDoc(gameRef, {
    status: 'result',
    dragonCard,
    tigerCard,
    winner,
    updatedAt: serverTimestamp(),
  });

  // Distribute winnings
  const bets: DTBet[] = game.bets || [];

  for (const bet of bets) {
    let winAmount = 0;

    if (bet.side === winner) {
      if (winner === 'tie') {
        winAmount = bet.amount * 8; // 8x for tie
      } else {
        winAmount = Math.floor(bet.amount * 1.95); // 1.95x for dragon/tiger
      }
    } else if (winner === 'tie' && bet.side !== 'tie') {
      // Return half on tie for non-tie bets
      winAmount = Math.floor(bet.amount * 0.5);
    }

    if (winAmount > 0) {
      try {
        await addFunds(
          bet.uid,
          winAmount,
          'winningBalance',
          `Dragon Tiger WIN - ${winner.toUpperCase()} - Round #${game.roundNumber}`
        );
      } catch (e) {
        console.error('Error paying winner:', bet.uid, e);
      }
    }
  }
};

// =====================================================
// ─── POKER ────────────────────────────────────────────
// =====================================================

const POKER_COLLECTION = 'pokerTables';

// Hand evaluation helpers
const evaluateHand = (cards: Card[]): { rank: number; name: string } => {
  if (cards.length < 2) return { rank: 0, name: 'No Cards' };

  const sorted = [...cards].sort((a, b) => b.numericValue - a.numericValue);
  const suits = sorted.map((c) => c.suit);
  const values = sorted.map((c) => c.numericValue);

  const isFlush = cards.length >= 5 && suits.every((s) => s === suits[0]);
  const isStraight =
    cards.length >= 5 &&
    values.every((v, i) => i === 0 || v === values[i - 1] - 1);

  const freq: Record<number, number> = {};
  values.forEach((v) => (freq[v] = (freq[v] || 0) + 1));
  const counts = Object.values(freq).sort((a, b) => b - a);

  if (isFlush && isStraight && values[0] === 14) return { rank: 10, name: 'Royal Flush 👑' };
  if (isFlush && isStraight) return { rank: 9, name: 'Straight Flush' };
  if (counts[0] === 4) return { rank: 8, name: 'Four of a Kind' };
  if (counts[0] === 3 && counts[1] === 2) return { rank: 7, name: 'Full House' };
  if (isFlush) return { rank: 6, name: 'Flush' };
  if (isStraight) return { rank: 5, name: 'Straight' };
  if (counts[0] === 3) return { rank: 4, name: 'Three of a Kind' };
  if (counts[0] === 2 && counts[1] === 2) return { rank: 3, name: 'Two Pair' };
  if (counts[0] === 2) return { rank: 2, name: 'One Pair' };
  return { rank: 1, name: 'High Card' };
};

export const createPokerTable = async (
  uid: string,
  name: string,
  smallBlind: number,
  bigBlind: number,
  minBuyIn: number,
  maxBuyIn: number
): Promise<string> => {
  const ref = doc(collection(db, POKER_COLLECTION));

  await setDoc(ref, {
    id: ref.id,
    name,
    status: 'waiting',
    phase: 'waiting',
    smallBlind,
    bigBlind,
    minBuyIn,
    maxBuyIn,
    maxPlayers: 4,
    players: [],
    spectators: [],
    communityCards: [],
    pot: 0,
    sidePots: [],
    currentBet: 0,
    dealerSeat: 0,
    activePlayerUid: null,
    deck: [],
    handNumber: 0,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActionAt: serverTimestamp(),
  });

  return ref.id;
};

export const subscribePokerTables = (cb: (tables: PokerTable[]) => void) => {
  const q = query(
    collection(db, POKER_COLLECTION),
    where('status', 'in', ['waiting', 'playing']),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PokerTable)));
  });
};

export const subscribePokerTable = (
  tableId: string,
  cb: (table: PokerTable) => void
) => {
  return onSnapshot(doc(db, POKER_COLLECTION, tableId), (snap) => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() } as PokerTable);
  });
};

export const joinPokerTable = async (
  tableId: string,
  uid: string,
  name: string,
  avatar: string,
  buyIn: number
): Promise<void> => {
  await runTransaction(db, async (tx) => {
    const tableRef = doc(db, POKER_COLLECTION, tableId);
    const walletRef = doc(db, 'wallets', uid);

    const [tableSnap, walletSnap] = await Promise.all([
      tx.get(tableRef),
      tx.get(walletRef),
    ]);

    if (!tableSnap.exists()) throw new Error('Table not found');
    if (!walletSnap.exists()) throw new Error('Wallet not found');

    const table = tableSnap.data() as PokerTable;
    const wallet = walletSnap.data();

    if (table.players.length >= 4) throw new Error('Table is full (max 4 players)');
    if (table.status === 'playing') throw new Error('Game already in progress');

    const alreadyJoined = table.players.some((p: PokerPlayer) => p.uid === uid);
    if (alreadyJoined) throw new Error('Already at this table');

    if (buyIn < table.minBuyIn) throw new Error(`Minimum buy-in is ₹${table.minBuyIn}`);
    if (buyIn > table.maxBuyIn) throw new Error(`Maximum buy-in is ₹${table.maxBuyIn}`);

    const { calculateUsableBalance, deductFromWallet } = await import('../utils/helpers');
    const usable = calculateUsableBalance(wallet as any);
    if (usable < buyIn) throw new Error('Insufficient balance');

    const newBalances = deductFromWallet(wallet as any, buyIn);
    if (!newBalances) throw new Error('Insufficient balance');

    // Find available seat
    const occupiedSeats = table.players.map((p: PokerPlayer) => p.seatIndex);
    let seatIndex = 0;
    while (occupiedSeats.includes(seatIndex)) seatIndex++;

    const newPlayer: PokerPlayer = {
      uid,
      name,
      avatar,
      chips: buyIn,
      holeCards: [],
      bet: 0,
      totalBet: 0,
      status: 'waiting',
      isDealer: table.players.length === 0,
      isSmallBlind: false,
      isBigBlind: false,
      isTurn: false,
      seatIndex,
      joinedAt: new Date(),
    };

    tx.update(walletRef, {
      ...newBalances,
      updatedAt: serverTimestamp(),
    });

    const prevBal = (wallet.depositBalance || 0) + (wallet.winningBalance || 0) +
      (wallet.bonusBalance || 0) + (wallet.referralBalance || 0);
    const txRef = doc(collection(db, 'transactions'));
    tx.set(txRef, {
      uid,
      type: 'GAME_BET',
      amount: -buyIn,
      previousBalance: prevBal,
      currentBalance: prevBal - buyIn,
      status: 'COMPLETED',
      description: `Poker buy-in at table "${table.name}"`,
      tableId,
      createdAt: serverTimestamp(),
    });

    tx.update(tableRef, {
      players: arrayUnion(newPlayer),
      updatedAt: serverTimestamp(),
    });
  });
};

export const leavePokerTable = async (
  tableId: string,
  uid: string
): Promise<void> => {
  await runTransaction(db, async (tx) => {
    const tableRef = doc(db, POKER_COLLECTION, tableId);
    const walletRef = doc(db, 'wallets', uid);

    const tableSnap = await tx.get(tableRef);
    if (!tableSnap.exists()) throw new Error('Table not found');

    const table = tableSnap.data() as PokerTable;
    const player = table.players.find((p: PokerPlayer) => p.uid === uid);
    if (!player) throw new Error('Not at this table');

    const remainingChips = player.chips;
    const updatedPlayers = table.players.filter((p: PokerPlayer) => p.uid !== uid);

    // Return remaining chips to winning balance
    if (remainingChips > 0) {
      tx.update(walletRef, {
        winningBalance: increment(remainingChips),
        updatedAt: serverTimestamp(),
      });

      const txRef = doc(collection(db, 'transactions'));
      tx.set(txRef, {
        uid,
        type: 'GAME_WIN',
        amount: remainingChips,
        previousBalance: 0,
        currentBalance: remainingChips,
        status: 'COMPLETED',
        description: `Poker cash-out from table "${table.name}"`,
        tableId,
        createdAt: serverTimestamp(),
      });
    }

    const newStatus = updatedPlayers.length === 0 ? 'finished' : table.status;

    tx.update(tableRef, {
      players: updatedPlayers,
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
  });
};

export const startPokerHand = async (tableId: string): Promise<void> => {
  const tableRef = doc(db, POKER_COLLECTION, tableId);
  const tableSnap = await getDoc(tableRef);
  if (!tableSnap.exists()) throw new Error('Table not found');

  const table = tableSnap.data() as PokerTable;

  if (table.players.length < 2) throw new Error('Need at least 2 players to start');
  if (table.status === 'playing' && table.phase !== 'waiting') {
    throw new Error('Hand already in progress');
  }

  const players = [...table.players];
  const handNumber = (table.handNumber || 0) + 1;

  // Rotate dealer
  const dealerSeat = handNumber % players.length;

  // Assign roles
  players.forEach((p, i) => {
    p.holeCards = [];
    p.bet = 0;
    p.totalBet = 0;
    p.status = 'active';
    p.isTurn = false;
    p.isDealer = i === dealerSeat;
    p.isSmallBlind = i === (dealerSeat + 1) % players.length;
    p.isBigBlind = i === (dealerSeat + 2) % players.length;
    p.handRank = undefined;
  });

  // Deal 2 cards each
  let deck = shuffleDeck(createDeck());
  players.forEach((p) => {
    p.holeCards = [deck.pop()!, deck.pop()!];
  });

  // Post blinds
  const sbIndex = (dealerSeat + 1) % players.length;
  const bbIndex = (dealerSeat + 2) % players.length;
  const sb = table.smallBlind;
  const bb = table.bigBlind;

  players[sbIndex].chips -= Math.min(sb, players[sbIndex].chips);
  players[sbIndex].bet = Math.min(sb, players[sbIndex].chips + sb);
  players[sbIndex].totalBet = players[sbIndex].bet;

  players[bbIndex].chips -= Math.min(bb, players[bbIndex].chips);
  players[bbIndex].bet = Math.min(bb, players[bbIndex].chips + bb);
  players[bbIndex].totalBet = players[bbIndex].bet;

  // First to act: player after BB
  const firstToAct = (bbIndex + 1) % players.length;
  players[firstToAct].isTurn = true;

  const pot = players[sbIndex].bet + players[bbIndex].bet;

  await updateDoc(tableRef, {
    status: 'playing',
    phase: 'preflop',
    players,
    deck,
    pot,
    currentBet: bb,
    dealerSeat,
    activePlayerUid: players[firstToAct].uid,
    communityCards: [],
    handNumber,
    updatedAt: serverTimestamp(),
    lastActionAt: serverTimestamp(),
  });
};

export const pokerAction = async (
  tableId: string,
  uid: string,
  action: 'fold' | 'check' | 'call' | 'raise' | 'allin',
  raiseAmount?: number
): Promise<void> => {
  await runTransaction(db, async (tx) => {
    const tableRef = doc(db, POKER_COLLECTION, tableId);
    const tableSnap = await tx.get(tableRef);
    if (!tableSnap.exists()) throw new Error('Table not found');

    const table = tableSnap.data() as PokerTable;
    const players = [...table.players];
    const pIndex = players.findIndex((p) => p.uid === uid);

    if (pIndex === -1) throw new Error('Player not found');
    if (table.activePlayerUid !== uid) throw new Error('Not your turn');

    const player = { ...players[pIndex] };
    let pot = table.pot;
    let currentBet = table.currentBet;

    switch (action) {
      case 'fold':
        player.status = 'folded';
        player.isTurn = false;
        break;

      case 'check':
        if (player.bet < currentBet) throw new Error('Cannot check, must call or raise');
        player.isTurn = false;
        break;

      case 'call': {
        const toCall = Math.min(currentBet - player.bet, player.chips);
        player.chips -= toCall;
        player.bet += toCall;
        player.totalBet += toCall;
        pot += toCall;
        if (player.chips === 0) player.status = 'allin';
        player.isTurn = false;
        break;
      }

      case 'raise': {
        const minRaise = currentBet * 2;
        const amount = raiseAmount && raiseAmount >= minRaise ? raiseAmount : minRaise;
        const toAdd = Math.min(amount - player.bet, player.chips);
        player.chips -= toAdd;
        player.bet += toAdd;
        player.totalBet += toAdd;
        pot += toAdd;
        currentBet = player.bet;
        if (player.chips === 0) player.status = 'allin';
        player.isTurn = false;
        break;
      }

      case 'allin': {
        const allInAmount = player.chips;
        pot += allInAmount;
        player.bet += allInAmount;
        player.totalBet += allInAmount;
        if (player.bet > currentBet) currentBet = player.bet;
        player.chips = 0;
        player.status = 'allin';
        player.isTurn = false;
        break;
      }
    }

    players[pIndex] = player;

    // Find next active player
    const activePlayers = players.filter(
      (p) => p.status === 'active' || p.status === 'allin'
    );
    const foldedOrLeft = players.filter(
      (p) => p.status !== 'folded' && p.status !== 'left'
    );

    let nextPlayerUid: string | null = null;
    let shouldAdvancePhase = false;

    // Check if only one player remains
    if (foldedOrLeft.length === 1) {
      // Last player wins
      const winner = foldedOrLeft[0];
      const winnerIndex = players.findIndex((p) => p.uid === winner.uid);
      players[winnerIndex].chips += pot;

      // Return chips to wallet
      tx.update(tableRef, {
        players,
        pot: 0,
        currentBet: 0,
        activePlayerUid: null,
        phase: 'showdown',
        status: 'waiting',
        updatedAt: serverTimestamp(),
        lastActionAt: serverTimestamp(),
      });

      // Cash out winner
      const winnerWalletRef = doc(db, 'wallets', winner.uid);
      tx.update(winnerWalletRef, {
        winningBalance: increment(pot),
        updatedAt: serverTimestamp(),
      });

      const txRef = doc(collection(db, 'transactions'));
      tx.set(txRef, {
        uid: winner.uid,
        type: 'GAME_WIN',
        amount: pot,
        previousBalance: 0,
        currentBalance: pot,
        status: 'COMPLETED',
        description: `Poker win (others folded) at table`,
        tableId,
        createdAt: serverTimestamp(),
      });

      return;
    }

    // Find next player to act
    const currentIndex = pIndex;
    let nextIndex = (currentIndex + 1) % players.length;
    let looped = 0;

    while (looped < players.length) {
      const candidate = players[nextIndex];
      if (candidate.status === 'active') {
        // Check if betting round is complete
        const allActed = players.every(
          (p) =>
            p.status !== 'active' ||
            p.bet === currentBet
        );

        if (allActed && nextIndex !== currentIndex) {
          shouldAdvancePhase = true;
          break;
        }

        if (!allActed) {
          nextPlayerUid = candidate.uid;
          players[nextIndex].isTurn = true;
          break;
        }
      }
      nextIndex = (nextIndex + 1) % players.length;
      looped++;
    }

    if (shouldAdvancePhase || looped >= players.length) {
      // Advance to next phase
      const deck = [...(table.deck || [])];
      const communityCards = [...(table.communityCards || [])];
      let newPhase: PokerPhase = table.phase;

      // Reset bets for new round
      players.forEach((p) => {
        if (p.status === 'active') {
          p.bet = 0;
          p.isTurn = false;
        }
      });

      switch (table.phase) {
        case 'preflop':
          communityCards.push(deck.pop()!, deck.pop()!, deck.pop()!);
          newPhase = 'flop';
          break;
        case 'flop':
          communityCards.push(deck.pop()!);
          newPhase = 'turn';
          break;
        case 'turn':
          communityCards.push(deck.pop()!);
          newPhase = 'river';
          break;
        case 'river':
          newPhase = 'showdown';
          break;
      }

      if (newPhase === 'showdown') {
        // Evaluate hands and find winner
        const activeFinal = players.filter(
          (p) => p.status === 'active' || p.status === 'allin'
        );

        let bestRank = -1;
        let winner: PokerPlayer | null = null;

        activeFinal.forEach((p) => {
          const allCards = [...p.holeCards, ...communityCards];
          const hand = evaluateHand(allCards);
          p.handRank = hand.name;
          if (hand.rank > bestRank) {
            bestRank = hand.rank;
            winner = p;
          }
        });

        if (winner) {
          const winnerIndex = players.findIndex((p) => p.uid === (winner as PokerPlayer).uid);
          players[winnerIndex].chips += pot;

          // Pay winner
          const winnerWalletRef = doc(db, 'wallets', (winner as PokerPlayer).uid);
          tx.update(winnerWalletRef, {
            winningBalance: increment(pot),
            updatedAt: serverTimestamp(),
          });

          const txRef = doc(collection(db, 'transactions'));
          tx.set(txRef, {
            uid: (winner as PokerPlayer).uid,
            type: 'GAME_WIN',
            amount: pot,
            previousBalance: 0,
            currentBalance: pot,
            status: 'COMPLETED',
            description: `Poker win (${(winner as PokerPlayer).handRank}) at table`,
            tableId,
            createdAt: serverTimestamp(),
          });
        }

        tx.update(tableRef, {
          players,
          communityCards,
          deck,
          pot,
          currentBet,
          phase: 'showdown',
          status: 'waiting',
          activePlayerUid: null,
          updatedAt: serverTimestamp(),
          lastActionAt: serverTimestamp(),
        });
        return;
      }

      // Set first active player for new phase
      const firstActive = players.find((p) => p.status === 'active');
      if (firstActive) {
        firstActive.isTurn = true;
        nextPlayerUid = firstActive.uid;
      }

      tx.update(tableRef, {
        players,
        communityCards,
        deck,
        pot,
        currentBet: 0,
        phase: newPhase,
        activePlayerUid: nextPlayerUid,
        updatedAt: serverTimestamp(),
        lastActionAt: serverTimestamp(),
      });
      return;
    }

    tx.update(tableRef, {
      players,
      pot,
      currentBet,
      activePlayerUid: nextPlayerUid,
      updatedAt: serverTimestamp(),
      lastActionAt: serverTimestamp(),
    });
  });
};
