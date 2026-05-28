import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile, GameTable, BonusConfig, AdminStats, LeaderboardEntry } from '../types';

// ============================================================
// BONUS CONFIGURATION
// ============================================================
export const DEFAULT_BONUS_CONFIG: BonusConfig = {
  usagePercentage: 10, // Only 10% of bonus usable per game
  maxBonusPerGame: 500,
  wageringRequirement: 5, // 5x wagering before withdrawal
  expiryDays: 30,
};

// ============================================================
// APP STORE
// ============================================================
interface AppState {
  // UI State
  sidebarOpen: boolean;
  currentTheme: 'dark';
  isLoading: boolean;

  // Game State
  currentTable: GameTable | null;
  activeTables: GameTable[];

  // Admin State
  adminStats: AdminStats | null;
  bonusConfig: BonusConfig;
  allUsers: UserProfile[];

  // Leaderboard
  leaderboard: LeaderboardEntry[];

  // Sidebar
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Loading
  setLoading: (loading: boolean) => void;

  // Game Actions
  setCurrentTable: (table: GameTable | null) => void;
  setActiveTables: (tables: GameTable[]) => void;

  // Admin
  setAdminStats: (stats: AdminStats) => void;
  setBonusConfig: (config: BonusConfig) => void;
  setAllUsers: (users: UserProfile[]) => void;

  // Leaderboard
  setLeaderboard: (entries: LeaderboardEntry[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      currentTheme: 'dark',
      isLoading: false,
      currentTable: null,
      activeTables: [],
      adminStats: null,
      bonusConfig: DEFAULT_BONUS_CONFIG,
      allUsers: [],
      leaderboard: [],

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setLoading: (loading) => set({ isLoading: loading }),
      setCurrentTable: (table) => set({ currentTable: table }),
      setActiveTables: (tables) => set({ activeTables: tables }),
      setAdminStats: (stats) => set({ adminStats: stats }),
      setBonusConfig: (config) => set({ bonusConfig: config }),
      setAllUsers: (users) => set({ allUsers: users }),
      setLeaderboard: (entries) => set({ leaderboard: entries }),
    }),
    {
      name: 'royalflush-app-store',
      partialize: (state) => ({
        bonusConfig: state.bonusConfig,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
