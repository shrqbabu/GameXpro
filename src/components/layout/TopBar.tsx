import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, Bell, Search, ChevronRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../ui/Avatar';
import { formatCurrency } from '../../utils/helpers';

const routeLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/table': 'Poker Table',
  '/wallet': 'My Wallet',
  '/add-money': 'Add Money',
  '/history': 'Match History',
  '/leaderboard': 'Leaderboard',
  '/bonus': 'Daily Bonus',
  '/referral': 'Referral Program',
  '/profile': 'My Profile',
  '/admin': 'Admin Dashboard',
  '/admin/users': 'User Management',
  '/admin/wallet': 'Wallet Control',
  '/admin/analytics': 'Analytics',
  '/admin/settings': 'Settings',
};

export const TopBar: React.FC = () => {
  const { toggleSidebar } = useAppStore();
  const { userProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const pageTitle = routeLabels[location.pathname] || 'RoyalFlush';
  const totalBalance = userProfile
    ? userProfile.wallet.depositBalance + userProfile.wallet.winningBalance
    : 0;

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-6 py-3 bg-gray-950/80 backdrop-blur-xl border-b border-white/8"
    >
      {/* Mobile menu button */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page title */}
      <div className="flex-1">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>RoyalFlush</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-400">{pageTitle}</span>
        </div>
        <h1 className="text-lg font-semibold text-white hidden sm:block">{pageTitle}</h1>
      </div>

      {/* Search (decorative for now) */}
      <button className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-gray-400 hover:text-white hover:bg-white/8 transition-colors text-sm">
        <Search className="w-4 h-4" />
        <span>Search...</span>
        <kbd className="ml-4 text-xs bg-white/10 px-1.5 py-0.5 rounded">⌘K</kbd>
      </button>

      {/* Balance quick view */}
      {userProfile && (
        <button
          onClick={() => navigate('/wallet')}
          className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-colors"
        >
          <span className="text-amber-400 text-sm">🪙</span>
          <span className="text-amber-400 text-sm font-mono font-bold">
            {formatCurrency(totalBalance)}
          </span>
        </button>
      )}

      {/* Notifications */}
      <button className="relative p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
        <Bell className="w-5 h-5" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
      </button>

      {/* User avatar */}
      {userProfile && (
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Avatar
            username={userProfile.username}
            avatarIndex={userProfile.avatarIndex}
            size="sm"
            ring
          />
          <span className="hidden sm:block text-sm font-medium text-gray-300">
            {userProfile.username}
          </span>
        </button>
      )}
    </motion.header>
  );
};

export default TopBar;
