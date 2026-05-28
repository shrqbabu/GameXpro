import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'gold' | 'green' | 'purple' | 'red' | 'none';
  onClick?: () => void;
  animate?: boolean;
  delay?: number;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const glowVariants: Record<string, string> = {
  gold: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] hover:border-amber-500/30',
  green: 'hover:shadow-[0_0_30px_rgba(34,197,94,0.2)] hover:border-emerald-500/30',
  purple: 'hover:shadow-[0_0_30px_rgba(168,85,247,0.2)] hover:border-purple-500/30',
  red: 'hover:shadow-[0_0_30px_rgba(239,68,68,0.2)] hover:border-red-500/30',
  none: '',
};

const paddingVariants: Record<string, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4 md:p-6',
  lg: 'p-6 md:p-8',
};

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  hover = false,
  glow = 'none',
  onClick,
  animate = true,
  delay = 0,
  padding = 'md',
}) => {
  const content = (
    <div
      className={`
        glass rounded-2xl
        ${paddingVariants[padding]}
        ${hover || onClick ? `cursor-pointer transition-all duration-300 ${glowVariants[glow]}` : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );

  if (!animate) return content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      whileHover={hover || onClick ? { y: -2 } : undefined}
    >
      {content}
    </motion.div>
  );
};

// Stat Card variant
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'gold' | 'green' | 'purple' | 'blue' | 'red';
  trend?: { value: number; label: string };
  delay?: number;
}

const colorMap: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  gold: {
    bg: 'from-amber-900/20 to-amber-800/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    iconBg: 'bg-amber-500/20',
  },
  green: {
    bg: 'from-emerald-900/20 to-emerald-800/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    iconBg: 'bg-emerald-500/20',
  },
  purple: {
    bg: 'from-purple-900/20 to-purple-800/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20',
    iconBg: 'bg-purple-500/20',
  },
  blue: {
    bg: 'from-blue-900/20 to-blue-800/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    iconBg: 'bg-blue-500/20',
  },
  red: {
    bg: 'from-red-900/20 to-red-800/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    iconBg: 'bg-red-500/20',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = 'gold',
  trend,
  delay = 0,
}) => {
  const colors = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      className={`
        relative overflow-hidden rounded-2xl p-4 md:p-6
        bg-gradient-to-br ${colors.bg}
        border ${colors.border}
        backdrop-blur-md
      `}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-24 h-24 opacity-5">
        <div className={`w-full h-full rounded-full ${colors.iconBg} blur-xl`} />
      </div>

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-xs md:text-sm font-medium mb-1">{title}</p>
          <p className={`text-xl md:text-2xl font-bold ${colors.text} font-mono`}>
            {value}
          </p>
          {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs ${trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
              <span className="text-gray-500">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`p-2 md:p-3 rounded-xl ${colors.iconBg} ${colors.text} flex-shrink-0 ml-3`}>
            {icon}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default GlassCard;
