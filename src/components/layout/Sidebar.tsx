import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Wallet, PlusCircle, Spade, History,
  User, Trophy, Gift, Users, LogOut, X, ChevronRight,
  Shield, TrendingUp, Settings, Home,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppStore } from '../../store/useAppStore';
import { Avatar } from '../ui/Avatar';
import { formatCurrency } from '../../utils/helpers';
import toast from 'react-hot-toast';

const navItems = [
  { icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard', path: '/dashboard' },
  { icon: <Spade className="w-5 h-5" />, label: 'Poker Table', path: '/table' },
  { icon: <Wallet className="w-5 h-5" />, label: 'Wallet', path: '/wallet' },
  { icon: <PlusCircle className="w-5 h-5" />, label: 'Add Money', path: '/add-money' },
  { icon: <History className="w-5 h-5" />, label: 'Match History', path: '/history' },
  { icon: <Trophy className="w-5 h-5" />, label: 'Leaderboard', path: '/leaderboard' },
  { icon: <Gift className="w-5 h-5" />, label: 'Daily Bonus', path: '/bonus' },
  { icon: <Users className="w-5 h-5" />, label: 'Referral', path: '/referral' },
  { icon: <User className="w-5 h-5" />, label: 'Profile', path: '/profile' },
];

const adminItems = [
  { icon: <Shield className="w-5 h-5" />, label: 'Admin Panel', path: '/admin' },
  { icon: <Users className="w-5 h-5" />, label: 'Users', path: '/admin/users' },
  { icon: <Wallet className="w-5 h-5" />, label: 'Wallet Control', path: '/admin/wallet' },
  { icon: <TrendingUp className="w-5 h-5" />, label: 'Analytics', path: '/admin/analytics' },
  { icon: <Settings className="w-5 h-5" />, label: 'Settings', path: '/admin/settings' },
];

const SidebarContent: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
    toast.success('Logged out successfully!');
    onClose?.();
  };

  const totalBalance = userProfile
    ? userProfile.wallet.depositBalance + userProfile.wallet.winningBalance
    : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between p-5 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(245,158,11,0.4)]">
            ♠
          </div>
          <div>
            <span className="font-display text-lg font-bold text-gradient-gold">RoyalFlush</span>
            <p className="text-xs text-gray-500">Premium Poker</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* User Info */}
      {userProfile && (
        <div className="m-3 p-3 rounded-xl glass-gold">
          <div className="flex items-center gap-3">
            <Avatar
              username={userProfile.username}
              avatarIndex={userProfile.avatarIndex}
              size="sm"
              showStatus
              isOnline
            />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{userProfile.username}</p>
              <p className="text-amber-400 text-xs font-mono">{formatCurrency(totalBalance)}</p>
            </div>
            <div className="text-xs text-gray-400 bg-white/5 rounded-lg px-2 py-1">
              Lv.{userProfile.level}
            </div>
          </div>
          <div className="mt-2 flex gap-1">
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-500">Chips</p>
              <p className="text-xs text-emerald-400 font-mono font-bold">
                {(userProfile.demoChips / 1000).toFixed(1)}K
              </p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-500">Games</p>
              <p className="text-xs text-blue-400 font-mono font-bold">{userProfile.gamesPlayed}</p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-500">Wins</p>
              <p className="text-xs text-purple-400 font-mono font-bold">{userProfile.gamesWon}</p>
            </div>
          </div>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <p className="text-xs font-medium text-gray-500 uppercase px-3 py-2 tracking-wider">Main Menu</p>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-xl
              transition-all duration-200 group
              ${isActive
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }
            `}
          >
            {({ isActive }) => (
              <>
                <span className={`transition-colors ${isActive ? 'text-amber-400' : 'text-gray-500 group-hover:text-gray-300'}`}>
                  {item.icon}
                </span>
                <span className="flex-1 text-sm font-medium">{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 opacity-50" />}
              </>
            )}
          </NavLink>
        ))}

        {/* Admin section */}
        {userProfile?.role === 'admin' && (
          <>
            <p className="text-xs font-medium text-gray-500 uppercase px-3 py-2 tracking-wider mt-4">
              Admin
            </p>
            {adminItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 rounded-xl
                  transition-all duration-200 group
                  ${isActive
                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }
                `}
              >
                {({ isActive }) => (
                  <>
                    <span className={`transition-colors ${isActive ? 'text-purple-400' : 'text-gray-500 group-hover:text-gray-300'}`}>
                      {item.icon}
                    </span>
                    <span className="flex-1 text-sm font-medium">{item.label}</span>
                    {isActive && <ChevronRight className="w-4 h-4 opacity-50" />}
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/8 space-y-1">
        <NavLink
          to="/"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all duration-200"
        >
          <Home className="w-5 h-5" />
          <span className="text-sm font-medium">Landing Page</span>
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const { sidebarOpen, setSidebarOpen } = useAppStore();

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col w-64 xl:w-72 h-screen sticky top-0 bg-gray-950/80 backdrop-blur-xl border-r border-white/8 overflow-hidden flex-shrink-0">
        <SidebarContent />
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-screen w-72 bg-gray-950 border-r border-white/8 z-50 lg:hidden overflow-hidden"
            >
              <SidebarContent onClose={() => setSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
