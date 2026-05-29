// ─── App.tsx mein ye routes add karo ──────────────────────────────────────────
// Existing imports ke saath ye add karo:

import { DragonTiger } from './pages/games/DragonTiger';
import { AndarBahar } from './pages/games/AndarBahar';
import { PokerGame } from './pages/games/PokerGame';

// Routes ke andar (existing routes ke saath) add karo:
//
//   <Route path="/games/dragon-tiger" element={<DragonTiger />} />
//   <Route path="/games/andar-bahar" element={<AndarBahar />} />
//   <Route path="/games/poker" element={<PokerGame />} />
//
// ─── Full updated routes section ──────────────────────────────────────────────

/*
<Route element={<ProtectedRoute />}>
  <Route element={<MainLayout />}>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/wallet" element={<Wallet />} />
    <Route path="/add-money" element={<AddMoney />} />
    <Route path="/withdrawal" element={<Withdrawal />} />
    <Route path="/withdrawal-history" element={<WithdrawalHistory />} />
    <Route path="/transactions" element={<TransactionHistory />} />
    <Route path="/referral" element={<Referral />} />
    <Route path="/profile" element={<Profile />} />
    <Route path="/notifications" element={<Notifications />} />
    <Route path="/matchmaking" element={<Matchmaking />} />
    <Route path="/game-room/:roomId" element={<GameRoom />} />
    <Route path="/games/color-prediction" element={<ColorPrediction />} />
    <Route path="/games/dice" element={<DiceGame />} />

    {/* ── NEW GAMES ──────────────────────────────── */}
    <Route path="/games/dragon-tiger" element={<DragonTiger />} />
    <Route path="/games/andar-bahar" element={<AndarBahar />} />
    <Route path="/games/poker" element={<PokerGame />} />
    {/* ─────────────────────────────────────────── */}

    <Route element={<AdminRoute />}>
      <Route path="/admin" element={<AdminDashboard />} />
    </Route>
  </Route>
</Route>
*/

// ─── Dashboard mein game cards add karne ke liye ──────────────────────────────
// useNavigate use karke:
//
//   navigate('/games/dragon-tiger')
//   navigate('/games/andar-bahar')
//   navigate('/games/poker')
//
// ─── types/index.ts mein ye add karo ─────────────────────────────────────────

/*
// Dragon Tiger
export type DragonTigerChoice = 'DRAGON' | 'TIGER' | 'TIE';
export interface DragonTigerGame {
  id?: string;
  uid: string;
  bet: number;
  choice: DragonTigerChoice;
  dragonCard?: string;
  tigerCard?: string;
  result?: DragonTigerChoice;
  won?: boolean;
  payout?: number;
  status: 'PLAYING' | 'SETTLED';
  createdAt: Timestamp;
}

// Andar Bahar
export type AndarBaharSide = 'ANDAR' | 'BAHAR';
export interface AndarBaharGame {
  id?: string;
  uid: string;
  bet: number;
  choice: AndarBaharSide;
  jokerCard?: string;
  result?: AndarBaharSide;
  won?: boolean;
  payout?: number;
  status: 'PLAYING' | 'SETTLED';
  createdAt: Timestamp;
}

// Poker
export interface PokerGame {
  id?: string;
  uid: string;
  buyIn: number;
  result?: 'WIN' | 'LOSE' | 'TIE';
  payout?: number;
  playerHand?: string[];
  handName?: string;
  status: 'PLAYING' | 'SETTLED';
  createdAt: Timestamp;
}
*/
