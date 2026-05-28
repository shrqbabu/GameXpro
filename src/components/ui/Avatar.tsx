import React from 'react';
import { AVATAR_COLORS, AVATAR_EMOJIS, getInitials } from '../../utils/helpers';

interface AvatarProps {
  username: string;
  avatarIndex?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showStatus?: boolean;
  isOnline?: boolean;
  className?: string;
  ring?: boolean;
}

const sizeMap: Record<string, { container: string; text: string; emoji: string; status: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-xs', emoji: 'text-xs', status: 'w-2 h-2' },
  sm: { container: 'w-8 h-8', text: 'text-xs', emoji: 'text-sm', status: 'w-2 h-2' },
  md: { container: 'w-10 h-10', text: 'text-sm', emoji: 'text-base', status: 'w-2.5 h-2.5' },
  lg: { container: 'w-12 h-12', text: 'text-base', emoji: 'text-xl', status: 'w-3 h-3' },
  xl: { container: 'w-16 h-16', text: 'text-xl', emoji: 'text-2xl', status: 'w-3.5 h-3.5' },
  '2xl': { container: 'w-20 h-20', text: 'text-2xl', emoji: 'text-3xl', status: 'w-4 h-4' },
};

export const Avatar: React.FC<AvatarProps> = ({
  username,
  avatarIndex = 0,
  size = 'md',
  showStatus = false,
  isOnline = false,
  className = '',
  ring = false,
}) => {
  const sizes = sizeMap[size];
  const colorClass = AVATAR_COLORS[avatarIndex % AVATAR_COLORS.length];
  const emoji = AVATAR_EMOJIS[avatarIndex % AVATAR_EMOJIS.length];
  const initials = getInitials(username);

  return (
    <div className={`relative inline-flex flex-shrink-0 ${className}`}>
      <div
        className={`
          ${sizes.container}
          rounded-full
          bg-gradient-to-br ${colorClass}
          flex items-center justify-center
          ${ring ? 'ring-2 ring-amber-400/50 ring-offset-2 ring-offset-gray-900' : ''}
          overflow-hidden
          select-none
        `}
      >
        <span className={sizes.emoji}>{emoji}</span>
        <span className={`sr-only`}>{initials}</span>
      </div>
      {showStatus && (
        <span
          className={`
            absolute bottom-0 right-0
            ${sizes.status}
            rounded-full border-2 border-gray-900
            ${isOnline ? 'bg-emerald-400' : 'bg-gray-500'}
          `}
        />
      )}
    </div>
  );
};

// Player chip display
interface ChipBadgeProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  color?: 'gold' | 'green' | 'white';
}

export const ChipBadge: React.FC<ChipBadgeProps> = ({
  amount,
  size = 'sm',
  color = 'gold',
}) => {
  const colorMap = {
    gold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    green: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    white: 'bg-white/10 text-white border-white/20',
  };
  const sizeMap2 = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  const formatAmount = (n: number): string => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1
        rounded-full border font-mono font-medium
        ${colorMap[color]}
        ${sizeMap2[size]}
      `}
    >
      <span className="opacity-70">🪙</span>
      {formatAmount(amount)}
    </span>
  );
};

export default Avatar;
