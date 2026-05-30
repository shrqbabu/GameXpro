// src/firebase/games.ts
import {
  doc, collection, setDoc, getDoc, updateDoc, onSnapshot,
  runTransaction, serverTimestamp, query, where, getDocs,
  orderBy, limit, increment, arrayUnion, addDoc, Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import {
  GameRoom, MatchmakingQueue, ColorPredictionRound,
  ColorChoice, PlayerInfo,
} from '../types';
import { addFunds, deductFunds } from './wallet';
import { calculateUsableBalance, deductFromWallet } from '../utils/helpers';

// ===================== MATCHMAKING =====================
export const joinMatchmakingQueue = async (
  uid: string, userName: string, photoURL: string,
  entryFee: number, gameType: string
): Promise<string> => {
  const existingQ = query(
    collection(db, 'matchmakingQueue'),
    where('uid', '==', uid),
    where('status', '==', 'WAITING')
  );
  const existingSnap = await getDocs(existingQ);
  if (!existingSnap.empty) return existingSnap.docs[0].id;

  const qRef = await addDoc(collection(db, 'matchmakingQueue'), {
    uid, userName, photoURL: photoURL || '', entryFee, gameType,
    status: 'WAITING', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return qRef.id;
};

export const cancelMatchmaking = async (queueId: string) => {
  await updateDoc(doc(db, 'matchmakingQueue', queueId), {
    status: 'CANCELLED', updatedAt: serverTimestamp(),
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

export const findMatch = async (
  uid: string, queueId: string, entryFee: number, gameType: string
): Promise<string | null> => {
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
  const myEntry = allWaiting.find((d) => d.id === queueId);
  if (!myEntry) return null;
  const others = allWaiting.filter((d) => d.data().uid !== uid);
  if (others.length === 0) return null;
  const myCreatedAt = myEntry.data().createdAt?.toMillis?.() ?? 0;
  const opponent = others[0];
  const opponentCreatedAt = opponent.data().createdAt?.toMillis?.() ?? 0;
  if (myCreatedAt <= opponentCreatedAt) return null;

  const roomRef = doc(collection(db, 'gameRooms'));
  const roomId = roomRef.id;

  try {
    await runTransaction(db, async (tx) => {
      const myQueueRef = doc(db, 'matchmakingQueue', queueId);
      const opponentQueueRef = doc(db, 'matchmakingQueue', opponent.id);
      const [mySnap, oppSnap] = await Promise.all([tx.get(myQueueRef), tx.get(opponentQueueRef)]);
      if (!mySnap.exists() || !oppSnap.exists()) throw new Error('Queue entry not found');
      if (mySnap.data().status !== 'WAITING' || oppSnap.data().status !== 'WAITING') throw new Error('Already matched');
      const myData = mySnap.data();
      const oppData = oppSnap.data();
      const player1: PlayerInfo = { uid: oppData.uid, name: oppData.userName, photoURL: oppData.photoURL || '' };
      const player2: PlayerInfo = { uid: myData.uid, name: myData.userName, photoURL: myData.photoURL || '' };
      tx.set(roomRef, {
        roomId, gameType, entryFee, status: 'WAITING', player1, player2,
        winner: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      tx.update(myQueueRef, { status: 'MATCHED', roomId, updatedAt: serverTimestamp() });
      tx.update(opponentQueueRef, { status: 'MATCHED', roomId, updatedAt: serverTimestamp() });
    });
  } catch (err: any) {
    if (err.message === 'Already matched') return null;
    throw err;
  }
  return roomId;
};

// ===================== GAME ROOMS =====================
export const subscribeGameRoom = (roomId: string, callback: (room: GameRoom | null) => void) => {
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
  if (card1 > card2) { winnerId = room.player1!.uid; winnerName = room.player1!.name; }
  else if (card2 > card1) { winnerId = room.player2!.uid; winnerName = room.player2!.name; }
  else { winnerId = 'TIE'; winnerName = 'TIE'; }
  await updateDoc(roomRef, {
    status: 'PLAYING',
    'player1.card': card1, 'player1.cardSuit': suit1,
    'player2.card': card2, 'player2.cardSuit': suit2,
    updatedAt: serverTimestamp(),
  });
  setTimeout(async () => {
    await settleCardGame(roomId, winnerId, winnerName, room.entryFee, room.player1!, room.player2!);
  }, 3000);
};

export const settleCardGame = async (
  roomId: string, winnerId: string, winnerName: string,
  entryFee: number, player1: PlayerInfo, player2: PlayerInfo
) => {
  const roomRef = doc(db, 'gameRooms', roomId);
  if (winnerId === 'TIE') {
    await Promise.all([
      addFunds(player1.uid, entryFee, 'winningBalance', 'Card game - Tie refund'),
      addFunds(player2.uid, entryFee, 'winningBalance', 'Card game - Tie refund'),
    ]);
    await updateDoc(roomRef, { status: 'FINISHED', winner: 'TIE', winnerName: 'TIE', updatedAt: serverTimestamp() });
  } else {
    const loserId = winnerId === player1.uid ? player2.uid : player1.uid;
    const payout = entryFee * 2 - entryFee * 0.1;
    await addFunds(winnerId, payout, 'winningBalance', `Card game win - ₹${payout}`);
    await updateDoc(roomRef, { status: 'FINISHED', winner: winnerId, winnerName, updatedAt: serverTimestamp() });
    await addDoc(collection(db, 'transactions'), {
      uid: loserId, type: 'GAME_LOSS', amount: -entryFee,
      previousBalance: 0, currentBalance: 0, status: 'COMPLETED',
      description: 'Card game loss', createdAt: serverTimestamp(),
    });
  }
  await Promise.all([
    sendGameNotification(player1.uid, winnerId === player1.uid, 'Card Battle', entryFee),
    sendGameNotification(player2.uid, winnerId === player2.uid, 'Card Battle', entryFee),
  ]);
};

// ===================== COLOR PREDICTION =====================
export const subscribeColorGame = (callback: (round: ColorPredictionRound | null) => void) => {
  const q = query(collection(db, 'colorPredictionGames'), orderBy('roundNumber', 'desc'), limit(1));
  return onSnapshot(q, (snap) => {
    callback(snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as ColorPredictionRound));
  });
};

export const getColorGameHistory = async (limitCount = 10) => {
  const q = query(collection(db, 'colorPredictionGames'), orderBy('roundNumber', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ColorPredictionRound));
};

export const placeBet = async (
  uid: string, userName: string, roundId: string, color: ColorChoice, amount: number
) => {
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
    bets: [...(round.bets || []), { uid, userName, color, amount, multiplier, settled: false }],
    updatedAt: serverTimestamp(),
  });
};

// ===================== DICE GAME =====================
export const playDiceGame = async (
  uid: string, bet: number, prediction: 'ODD' | 'EVEN'
): Promise<{ dice1: number; dice2: number; sum: number; won: boolean; payout: number }> => {
  await deductFunds(uid, bet, 'GAME_LOSS', `Dice game bet - ${prediction}`);
  const dice1 = Math.floor(Math.random() * 6) + 1;
  const dice2 = Math.floor(Math.random() * 6) + 1;
  const sum = dice1 + dice2;
  const result = sum % 2 === 0 ? 'EVEN' : 'ODD';
  const won = result === prediction;
  const payout = won ? bet * 2 : 0;
  if (won) await addFunds(uid, payout, 'winningBalance', `Dice game win - ${sum} (${result})`);
  await addDoc(collection(db, 'diceGames'), {
    uid, bet, prediction, dice1, dice2, sum, result, won, payout,
    status: 'SETTLED', createdAt: serverTimestamp(),
  });
  await sendGameNotification(uid, won, 'Dice Game', bet);
  return { dice1, dice2, sum, won, payout };
};

// ===================== NOTIFICATIONS =====================
export const sendGameNotification = async (uid: string, won: boolean, gameName: string, amount: number) => {
  await addDoc(collection(db, 'notifications'), {
    uid, type: won ? 'GAME_WIN' : 'GAME_LOSS',
    title: won ? '🎉 You Won!' : '😔 Better Luck Next Time',
    message: won
      ? `Congratulations! You won ₹${amount * 2} in ${gameName}`
      : `You lost ₹${amount} in ${gameName}. Keep playing!`,
    read: false, createdAt: serverTimestamp(),
  });
};

export const subscribeNotifications = (uid: string, callback: (notifications: any[]) => void) => {
  const q = query(
    collection(db, 'notifications'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  return onSnapshot(q, (snap) => { callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); });
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
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { status: 'CANCELLED', updatedAt: serverTimestamp() })));
};

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
  uid: string; name: string; amount: number;
  side: 'andar' | 'bahar'; placedAt: any;
}
export interface DTBet {
  uid: string; name: string; amount: number;
  side: 'dragon' | 'tiger' | 'tie'; placedAt: any;
}
export interface AndarBaharGame {
  id: string; status: ABStatus; roundNumber: number;
  jokerCard: Card | null; andarCards: Card[]; baharCards: Card[];
  bets: ABBet[]; winner: 'andar' | 'bahar' | null;
  pot: number; bettingEndsAt: any; createdAt: any; updatedAt: any;
}
export interface DragonTigerGame {
  id: string; status: DTStatus; roundNumber: number;
  dragonCard: Card | null; tigerCard: Card | null;
  bets: DTBet[]; winner: 'dragon' | 'tiger' | 'tie' | null;
  pot: number; bettingEndsAt: any; createdAt: any; updatedAt: any;
}
export interface PokerPlayer {
  uid: string; name: string; avatar: string; chips: number;
  holeCards: Card[]; bet: number; totalBet: number;
  status: 'waiting' | 'active' | 'folded' | 'allin' | 'left';
  isDealer: boolean; isSmallBlind: boolean; isBigBlind: boolean;
  isTurn: boolean; handRank?: string; seatIndex: number; joinedAt: any;
}
export interface PokerTable {
  id: string; name: string; status: PokerStatus; phase: PokerPhase;
  minBuyIn: number; maxBuyIn: number; smallBlind: number; bigBlind: number;
  maxPlayers: 6; players: PokerPlayer[]; spectators: string[];
  communityCards: Card[]; pot: number; sidePots: number[];
  currentBet: number; dealerSeat: number; activePlayerUid: string | null;
  deck: Card[]; handNumber: number; createdBy: string;
  createdAt: any; updatedAt: any; lastActionAt: any;
}

// =====================================================
// ANDAR BAHAR
// =====================================================
const AB_COLLECTION = 'andarBaharGames';
const BETTING_DURATION_MS = 20000; // 20 seconds

export const createAndarBaharRound = async (): Promise<string> => {
  // Check if active game already exists to prevent duplicates
  const existing = await getActiveAndarBaharGame();
  if (existing) return existing;

  const ref = doc(collection(db, AB_COLLECTION));
  const bettingEndsAt = Timestamp.fromDate(new Date(Date.now() + BETTING_DURATION_MS));

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

export const subscribeAndarBahar = (gameId: string, cb: (game: AndarBaharGame) => void) => {
  return onSnapshot(doc(db, AB_COLLECTION, gameId), (snap) => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() } as AndarBaharGame);
  });
};

// Subscribe to latest active AB game (collection level)
export const subscribeLatestAndarBahar = (
  cb: (gameId: string, game: AndarBaharGame) => void
) => {
  const q = query(
    collection(db, AB_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(1)
  );
  return onSnapshot(q, (snap) => {
    if (!snap.empty) {
      const d = snap.docs[0];
      cb(d.id, { id: d.id, ...d.data() } as AndarBaharGame);
    }
  });
};

export const placeAndarBaharBet = async (
  gameId: string, uid: string, name: string, amount: number, side: 'andar' | 'bahar'
): Promise<void> => {
  await runTransaction(db, async (tx) => {
    const gameRef = doc(db, AB_COLLECTION, gameId);
    const walletRef = doc(db, 'wallets', uid);
    const [gameSnap, walletSnap] = await Promise.all([tx.get(gameRef), tx.get(walletRef)]);
    if (!gameSnap.exists()) throw new Error('Game not found');
    if (!walletSnap.exists()) throw new Error('Wallet not found');
    const game = gameSnap.data() as AndarBaharGame;
    const wallet = walletSnap.data();
    if (game.status !== 'betting') throw new Error('Betting is closed');
    const alreadyBet = game.bets?.some((b: ABBet) => b.uid === uid);
    if (alreadyBet) throw new Error('You already placed a bet this round');
    const usable = calculateUsableBalance(wallet as any);
    if (usable < amount) throw new Error('Insufficient balance');
    const newBalances = deductFromWallet(wallet as any, amount);
    if (!newBalances) throw new Error('Insufficient balance');
    tx.update(walletRef, { ...newBalances, updatedAt: serverTimestamp() });
    const txRef = doc(collection(db, 'transactions'));
    tx.set(txRef, {
      uid, type: 'GAME_BET', amount: -amount,
      previousBalance: (wallet.depositBalance || 0) + (wallet.winningBalance || 0),
      currentBalance: (wallet.depositBalance || 0) + (wallet.winningBalance || 0) - amount,
      status: 'COMPLETED', description: `Andar Bahar bet - ${side.toUpperCase()}`,
      gameId, createdAt: serverTimestamp(),
    });
    const newBet: ABBet = { uid, name, amount, side, placedAt: Timestamp.now() };
    tx.update(gameRef, {
      bets: arrayUnion(newBet),
      pot: increment(amount),
      updatedAt: serverTimestamp(),
    });
  });
};

export const dealAndarBahar = async (gameId: string): Promise<void> => {
  const gameRef = doc(db, AB_COLLECTION, gameId);

  // Atomic status change to prevent double dealing
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(gameRef);
      if (!snap.exists()) throw new Error('Game not found');
      const game = snap.data() as AndarBaharGame;
      if (game.status !== 'betting') throw new Error('Already dealing');
      tx.update(gameRef, { status: 'dealing', updatedAt: serverTimestamp() });
    });
  } catch (e: any) {
    if (e.message === 'Already dealing') return;
    throw e;
  }

  const gameSnap = await getDoc(gameRef);
  const game = gameSnap.data() as AndarBaharGame;

  let deck = shuffleDeck(createDeck());
  const jokerCard = deck.pop()!;
  deck = shuffleDeck(deck);

  // Update joker card immediately
  await updateDoc(gameRef, { jokerCard, updatedAt: serverTimestamp() });

  const andarCards: Card[] = [];
  const baharCards: Card[] = [];
  let winner: 'andar' | 'bahar' | null = null;

  // First card to BAHAR, then alternate ANDAR → BAHAR
  let currentSide: 'andar' | 'bahar' = 'bahar';
  let safetyCount = 0;

  while (safetyCount < 52 && winner === null) {
    const card = deck.pop()!;
    if (!card) break;

    if (currentSide === 'bahar') {
      baharCards.push(card);
      // Update Firestore with new bahar card
      await updateDoc(gameRef, {
        baharCards: [...baharCards],
        updatedAt: serverTimestamp(),
      });
    } else {
      andarCards.push(card);
      // Update Firestore with new andar card
      await updateDoc(gameRef, {
        andarCards: [...andarCards],
        updatedAt: serverTimestamp(),
      });
    }

    // Small delay for animation effect
    await new Promise(r => setTimeout(r, 600));

    if (card.value === jokerCard.value) {
      winner = currentSide;
      break;
    }

    // Toggle: bahar → andar → bahar → andar...
    currentSide = currentSide === 'bahar' ? 'andar' : 'bahar';
    safetyCount++;
  }

  if (!winner) winner = 'andar';

  // Final result update
  await updateDoc(gameRef, {
    status: 'result',
    andarCards,
    baharCards,
    winner,
    updatedAt: serverTimestamp(),
  });

  // Distribute winnings
  const bets: ABBet[] = game.bets || [];
  for (const bet of bets) {
    if (bet.side === winner) {
      const winAmount = Math.floor(bet.amount * 1.9);
      try {
        await addFunds(bet.uid, winAmount, 'winningBalance',
          `Andar Bahar WIN - ${winner.toUpperCase()} - Round #${game.roundNumber}`);
      } catch (e) {
        console.error('Error paying winner:', bet.uid, e);
      }
    }
  }
};

// =====================================================
// DRAGON TIGER
// =====================================================
const DT_COLLECTION = 'dragonTigerGames';

export const createDragonTigerRound = async (): Promise<string> => {
  const existing = await getActiveDragonTigerGame();
  if (existing) return existing;

  const ref = doc(collection(db, DT_COLLECTION));
  const bettingEndsAt = Timestamp.fromDate(new Date(Date.now() + BETTING_DURATION_MS));

  await setDoc(ref, {
    id: ref.id, status: 'betting', roundNumber: Date.now(),
    dragonCard: null, tigerCard: null, bets: [], winner: null,
    pot: 0, bettingEndsAt, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
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

export const subscribeDragonTiger = (gameId: string, cb: (game: DragonTigerGame) => void) => {
  return onSnapshot(doc(db, DT_COLLECTION, gameId), (snap) => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() } as DragonTigerGame);
  });
};

export const subscribeLatestDragonTiger = (
  cb: (gameId: string, game: DragonTigerGame) => void
) => {
  const q = query(collection(db, DT_COLLECTION), orderBy('createdAt', 'desc'), limit(1));
  return onSnapshot(q, (snap) => {
    if (!snap.empty) {
      const d = snap.docs[0];
      cb(d.id, { id: d.id, ...d.data() } as DragonTigerGame);
    }
  });
};

export const placeDragonTigerBet = async (
  gameId: string, uid: string, name: string, amount: number,
  side: 'dragon' | 'tiger' | 'tie'
): Promise<void> => {
  await runTransaction(db, async (tx) => {
    const gameRef = doc(db, DT_COLLECTION, gameId);
    const walletRef = doc(db, 'wallets', uid);
    const [gameSnap, walletSnap] = await Promise.all([tx.get(gameRef), tx.get(walletRef)]);
    if (!gameSnap.exists()) throw new Error('Game not found');
    if (!walletSnap.exists()) throw new Error('Wallet not found');
    const game = gameSnap.data() as DragonTigerGame;
    const wallet = walletSnap.data();
    if (game.status !== 'betting') throw new Error('Betting is closed');
    const alreadyBet = game.bets?.some((b: DTBet) => b.uid === uid);
    if (alreadyBet) throw new Error('You already placed a bet this round');
    const usable = calculateUsableBalance(wallet as any);
    if (usable < amount) throw new Error('Insufficient balance');
    const newBalances = deductFromWallet(wallet as any, amount);
    if (!newBalances) throw new Error('Insufficient balance');
    tx.update(walletRef, { ...newBalances, updatedAt: serverTimestamp() });
    const txRef = doc(collection(db, 'transactions'));
    tx.set(txRef, {
      uid, type: 'GAME_BET', amount: -amount,
      previousBalance: (wallet.depositBalance || 0) + (wallet.winningBalance || 0),
      currentBalance: (wallet.depositBalance || 0) + (wallet.winningBalance || 0) - amount,
      status: 'COMPLETED', description: `Dragon Tiger bet - ${side.toUpperCase()}`,
      gameId, createdAt: serverTimestamp(),
    });
    const newBet: DTBet = { uid, name, amount, side, placedAt: Timestamp.now() };
    tx.update(gameRef, { bets: arrayUnion(newBet), pot: increment(amount), updatedAt: serverTimestamp() });
  });
};

export const dealDragonTiger = async (gameId: string): Promise<void> => {
  const gameRef = doc(db, DT_COLLECTION, gameId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(gameRef);
      if (!snap.exists()) throw new Error('Game not found');
      const game = snap.data() as DragonTigerGame;
      if (game.status !== 'betting') throw new Error('Already dealing');
      tx.update(gameRef, { status: 'dealing', updatedAt: serverTimestamp() });
    });
  } catch (e: any) {
    if (e.message === 'Already dealing') return;
    throw e;
  }

  const gameSnap = await getDoc(gameRef);
  const game = gameSnap.data() as DragonTigerGame;

  const deck = shuffleDeck(createDeck());
  const dragonCard = deck[0];

  // Show dragon card first
  await updateDoc(gameRef, { dragonCard, updatedAt: serverTimestamp() });
  await new Promise(r => setTimeout(r, 1000));

  const tigerCard = deck[1];
  // Show tiger card
  await updateDoc(gameRef, { tigerCard, updatedAt: serverTimestamp() });
  await new Promise(r => setTimeout(r, 800));

  let winner: 'dragon' | 'tiger' | 'tie';
  if (dragonCard.numericValue > tigerCard.numericValue) winner = 'dragon';
  else if (tigerCard.numericValue > dragonCard.numericValue) winner = 'tiger';
  else winner = 'tie';

  await updateDoc(gameRef, { status: 'result', winner, updatedAt: serverTimestamp() });

  // Distribute winnings
  const bets: DTBet[] = game.bets || [];
  for (const bet of bets) {
    let winAmount = 0;
    if (bet.side === winner) {
      winAmount = winner === 'tie' ? bet.amount * 8 : Math.floor(bet.amount * 1.95);
    } else if (winner === 'tie' && bet.side !== 'tie') {
      winAmount = Math.floor(bet.amount * 0.5);
    }
    if (winAmount > 0) {
      try {
        await addFunds(bet.uid, winAmount, 'winningBalance',
          `Dragon Tiger WIN - ${winner.toUpperCase()} - Round #${game.roundNumber}`);
      } catch (e) { console.error('Error paying:', bet.uid, e); }
    }
  }
};

// =====================================================
// POKER
// =====================================================
// src/firebase/games.ts - POKER SECTION ONLY (baaki same rahega)

// =====================================================
// POKER — FIXED VERSION
// =====================================================
const POKER_COLLECTION = 'pokerTables';

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
    maxPlayers: 6,
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
    autoStart: true,
    lastBrokePlayers: [],
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
    if (table.players.length >= 6) throw new Error('Table is full');
    if (table.status === 'playing') throw new Error('Game in progress');
    if (table.players.some((p) => p.uid === uid))
      throw new Error('Already at this table');
    if (buyIn < table.minBuyIn)
      throw new Error(`Min buy-in is ₹${table.minBuyIn}`);
    if (buyIn > table.maxBuyIn)
      throw new Error(`Max buy-in is ₹${table.maxBuyIn}`);
    const usable = calculateUsableBalance(wallet as any);
    if (usable < buyIn) throw new Error('Insufficient balance');
    const newBalances = deductFromWallet(wallet as any, buyIn);
    if (!newBalances) throw new Error('Insufficient balance');

    const occupied = table.players.map((p) => p.seatIndex);
    let seat = 0;
    while (occupied.includes(seat)) seat++;

    const newPlayer: PokerPlayer = {
      uid,
      name,
      avatar,
      chips: buyIn,
      holeCards: [],
      bet: 0,
      totalBet: 0,
      status: 'waiting',
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
      isTurn: false,
      seatIndex: seat,
      joinedAt: Timestamp.now(),
    };

    tx.update(walletRef, { ...newBalances, updatedAt: serverTimestamp() });
    const txRef = doc(collection(db, 'transactions'));
    tx.set(txRef, {
      uid,
      type: 'GAME_BET',
      amount: -buyIn,
      previousBalance:
        (wallet.depositBalance || 0) + (wallet.winningBalance || 0),
      currentBalance:
        (wallet.depositBalance || 0) +
        (wallet.winningBalance || 0) -
        buyIn,
      status: 'COMPLETED',
      description: `Poker buy-in at "${table.name}"`,
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
    const tableSnap = await tx.get(tableRef);
    if (!tableSnap.exists()) throw new Error('Table not found');
    const table = tableSnap.data() as PokerTable;
    const player = table.players.find((p) => p.uid === uid);
    if (!player) return;

    const chips = player.chips;
    const updatedPlayers = table.players
      .filter((p) => p.uid !== uid)
      .map((p, i) => ({ ...p, seatIndex: i }));

    if (chips > 0) {
      const walletRef = doc(db, 'wallets', uid);
      tx.update(walletRef, {
        winningBalance: increment(chips),
        updatedAt: serverTimestamp(),
      });
      const txRef = doc(collection(db, 'transactions'));
      tx.set(txRef, {
        uid,
        type: 'GAME_WIN',
        amount: chips,
        previousBalance: 0,
        currentBalance: chips,
        status: 'COMPLETED',
        description: `Poker cash-out from "${table.name}"`,
        tableId,
        createdAt: serverTimestamp(),
      });
    }

    tx.update(tableRef, {
      players: updatedPlayers,
      status: updatedPlayers.length < 2 ? 'waiting' : table.status,
      phase: updatedPlayers.length < 2 ? 'waiting' : table.phase,
      activePlayerUid:
        updatedPlayers.length < 2 ? null : table.activePlayerUid,
      updatedAt: serverTimestamp(),
    });
  });
};

export const checkAndAutoStart = async (tableId: string): Promise<void> => {
  const tableRef = doc(db, POKER_COLLECTION, tableId);
  const tableSnap = await getDoc(tableRef);
  if (!tableSnap.exists()) return;
  const table = tableSnap.data() as PokerTable;
  if (
    table.status === 'waiting' &&
    table.phase === 'waiting' &&
    table.players.length >= 2
  ) {
    try {
      await startPokerHand(tableId);
    } catch (e) {
      console.error('Auto-start failed:', e);
    }
  }
};

export const startPokerHand = async (tableId: string): Promise<void> => {
  const tableRef = doc(db, POKER_COLLECTION, tableId);
  const tableSnap = await getDoc(tableRef);
  if (!tableSnap.exists()) throw new Error('Table not found');
  const table = tableSnap.data() as PokerTable;
  if (table.players.length < 2) throw new Error('Need at least 2 players');
  // Prevent double start
  if (table.status === 'playing') return;

  const players = table.players.map((p) => ({ ...p }));
  const handNumber = (table.handNumber || 0) + 1;
  const numPlayers = players.length;
  const dealerSeat = handNumber % numPlayers;
  const sbIdx = (dealerSeat + 1) % numPlayers;
  const bbIdx = (dealerSeat + 2) % numPlayers;

  players.forEach((p, i) => {
    p.holeCards = [];
    p.bet = 0;
    p.totalBet = 0;
    p.status = 'active';
    p.isTurn = false;
    p.handRank = '';
    p.isDealer = i === dealerSeat;
    p.isSmallBlind = i === sbIdx;
    p.isBigBlind = i === bbIdx;
  });

  let deck = shuffleDeck(createDeck());
  players.forEach((p) => {
    p.holeCards = [deck.pop()!, deck.pop()!];
  });

  // Post blinds — only what player can afford
  const sbAmount = Math.min(table.smallBlind, players[sbIdx].chips);
  players[sbIdx].chips -= sbAmount;
  players[sbIdx].bet = sbAmount;
  players[sbIdx].totalBet = sbAmount;
  if (players[sbIdx].chips === 0) players[sbIdx].status = 'allin';

  const bbAmount = Math.min(table.bigBlind, players[bbIdx].chips);
  players[bbIdx].chips -= bbAmount;
  players[bbIdx].bet = bbAmount;
  players[bbIdx].totalBet = bbAmount;
  if (players[bbIdx].chips === 0) players[bbIdx].status = 'allin';

  const effectiveBB = Math.max(sbAmount, bbAmount);
  const pot = sbAmount + bbAmount;

  // Find first active player after BB
  let firstToAct = (bbIdx + 1) % numPlayers;
  let attempts = 0;
  while (players[firstToAct].status !== 'active' && attempts < numPlayers) {
    firstToAct = (firstToAct + 1) % numPlayers;
    attempts++;
  }
  players[firstToAct].isTurn = true;

  await updateDoc(tableRef, {
    status: 'playing',
    phase: 'preflop',
    players,
    deck,
    pot,
    currentBet: effectiveBB,
    dealerSeat,
    activePlayerUid: players[firstToAct].uid,
    communityCards: [],
    handNumber,
    lastBrokePlayers: [],
    updatedAt: serverTimestamp(),
    lastActionAt: serverTimestamp(),
  });
};

// Helper — settles the hand, pays winner, kicks broke players
// IMPORTANT: This runs inside a runTransaction, so no await allowed
// only tx.get, tx.set, tx.update (synchronous in Firestore v9)
const settleHand = (
  tx: any,
  tableRef: any,
  tableId: string,
  players: PokerPlayer[],
  pot: number,
  communityCards: Card[],
  forcedWinnerUid?: string
): void => {
  let winnerUid = forcedWinnerUid;

  // Evaluate hands if no forced winner
  if (!winnerUid) {
    const contenders = players.filter(
      (p) => p.status === 'active' || p.status === 'allin'
    );
    let bestRank = -1;
    contenders.forEach((p) => {
      const allCards = [...p.holeCards, ...communityCards];
      const hand = evaluateHand(allCards);
      p.handRank = hand.name;
      if (hand.rank > bestRank) {
        bestRank = hand.rank;
        winnerUid = p.uid;
      }
    });
  }

  // Pay winner
  if (winnerUid) {
    const wIdx = players.findIndex((p) => p.uid === winnerUid);
    if (wIdx !== -1) {
      players[wIdx].chips += pot;

      const walletRef = doc(db, 'wallets', winnerUid);
      tx.update(walletRef, {
        winningBalance: increment(pot),
        updatedAt: serverTimestamp(),
      });

      const txnRef = doc(collection(db, 'transactions'));
      tx.set(txnRef, {
        uid: winnerUid,
        type: 'GAME_WIN',
        amount: pot,
        previousBalance: 0,
        currentBalance: pot,
        status: 'COMPLETED',
        description: `Poker win${
          players[wIdx].handRank ? ` (${players[wIdx].handRank})` : ''
        }`,
        tableId,
        createdAt: serverTimestamp(),
      });
    }
  }

  // Separate broke vs surviving players
  const brokePlayers: Array<{ uid: string; name: string }> = [];
  const survivingPlayers: PokerPlayer[] = [];

  players.forEach((p) => {
    if (p.chips <= 0) {
      brokePlayers.push({ uid: p.uid, name: p.name });
    } else {
      survivingPlayers.push(p);
    }
  });

  // Reassign seats
  const finalPlayers = survivingPlayers.map((p, i) => ({
    ...p,
    seatIndex: i,
  }));

  tx.update(tableRef, {
    players: finalPlayers,
    pot: 0,
    currentBet: 0,
    activePlayerUid: null,
    phase: 'showdown',
    status: 'waiting',
    communityCards,
    lastBrokePlayers: brokePlayers,
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
    const players = table.players.map((p) => ({ ...p }));
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
        if (player.bet < currentBet)
          throw new Error('Cannot check, must call or raise');
        player.isTurn = false;
        break;

      case 'call': {
        const toCall = Math.min(
          currentBet - player.bet,
          player.chips
        );
        player.chips -= toCall;
        player.bet += toCall;
        player.totalBet += toCall;
        pot += toCall;
        if (player.chips === 0) player.status = 'allin';
        player.isTurn = false;
        break;
      }

      case 'raise': {
        const minR = currentBet * 2 || table.bigBlind * 2;
        const amount =
          raiseAmount && raiseAmount >= minR ? raiseAmount : minR;
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
        const allIn = player.chips;
        pot += allIn;
        player.bet += allIn;
        player.totalBet += allIn;
        if (player.bet > currentBet) currentBet = player.bet;
        player.chips = 0;
        player.status = 'allin';
        player.isTurn = false;
        break;
      }
    }

    players[pIndex] = player;

    // Check non-folded players
    const nonFolded = players.filter(
      (p) => p.status !== 'folded' && p.status !== 'left'
    );
    const activePlayers = players.filter((p) => p.status === 'active');

    // Only 1 non-folded → instant win
    if (nonFolded.length === 1) {
      settleHand(
        tx,
        tableRef,
        tableId,
        players,
        pot,
        table.communityCards || [],
        nonFolded[0].uid
      );
      return;
    }

    // Check if round is complete
    const allMatched =
      activePlayers.length === 0 ||
      activePlayers.every((p) => p.bet >= currentBet);

    const allDone = nonFolded.every(
      (p) =>
        p.status === 'allin' ||
        (p.status === 'active' && p.bet >= currentBet)
    );

    if (allMatched && allDone) {
      const deck = [...(table.deck || [])];
      const communityCards = [...(table.communityCards || [])];

      // Reset bets
      players.forEach((p) => {
        if (p.status === 'active') {
          p.bet = 0;
          p.isTurn = false;
        }
      });

      // All remaining are all-in → run out all cards
      if (activePlayers.length === 0) {
        while (communityCards.length < 5 && deck.length > 0) {
          communityCards.push(deck.pop()!);
        }
        settleHand(tx, tableRef, tableId, players, pot, communityCards);
        return;
      }

      // Normal phase progression
      let newPhase = table.phase;
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
        settleHand(tx, tableRef, tableId, players, pot, communityCards);
        return;
      }

      // Next active player
      const firstActive = players.find((p) => p.status === 'active');
      if (firstActive) firstActive.isTurn = true;

      tx.update(tableRef, {
        players,
        communityCards,
        deck,
        pot,
        currentBet: 0,
        phase: newPhase,
        activePlayerUid: firstActive?.uid || null,
        updatedAt: serverTimestamp(),
        lastActionAt: serverTimestamp(),
      });
      return;
    }

    // Find next active player
    let nextIdx = (pIndex + 1) % players.length;
    let loops = 0;
    while (loops < players.length) {
      if (players[nextIdx].status === 'active') {
        players[nextIdx].isTurn = true;
        break;
      }
      nextIdx = (nextIdx + 1) % players.length;
      loops++;
    }

    tx.update(tableRef, {
      players,
      pot,
      currentBet,
      activePlayerUid: players[nextIdx]?.uid || null,
      updatedAt: serverTimestamp(),
      lastActionAt: serverTimestamp(),
    });
  });
};
