import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'gold' | 'green' | 'red' | 'blue' | 'purple' | 'gray' | 'orange';
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
  className?: string;
  pulse?: boolean;
}

const variantClasses: Record<string, string> = {
  gold: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  green: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  red: 'bg-red-500/20 text-red-400 border border-red-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  gray: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  orange: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
};

const dotColors: Record<string, string> = {
  gold: 'bg-amber-400',
  green: 'bg-emerald-400',
  red: 'bg-red-400',
  blue: 'bg-blue-400',
  purple: 'bg-purple-400',
  gray: 'bg-gray-400',
  orange: 'bg-orange-400',
};

const sizeClasses: Record<string, string> = {
  xs: 'text-xs px-1.5 py-0.5 rounded-md',
  sm: 'text-xs px-2 py-1 rounded-lg',
  md: 'text-sm px-3 py-1 rounded-lg',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'gold',
  size = 'sm',
  dot = false,
  className = '',
  pulse = false,
}) => {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {dot && (
        <span
          className={`
            w-1.5 h-1.5 rounded-full flex-shrink-0
            ${dotColors[variant]}
            ${pulse ? 'animate-pulse' : ''}
          `}
        />
      )}
      {children}
    </span>
  );
};

export default Badge;
