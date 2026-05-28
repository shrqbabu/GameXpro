import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'green' | 'red' | 'ghost' | 'outline' | 'danger' | 'purple';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  glow?: boolean;
}

const variantClasses: Record<string, string> = {
  gold: 'bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 text-black font-bold hover:from-amber-500 hover:via-yellow-400 hover:to-amber-500 border border-amber-400/30',
  green: 'bg-gradient-to-r from-emerald-600 to-green-500 text-white font-semibold hover:from-emerald-500 hover:to-green-400 border border-emerald-400/30',
  red: 'bg-gradient-to-r from-red-600 to-rose-500 text-white font-semibold hover:from-red-500 hover:to-rose-400 border border-red-400/30',
  purple: 'bg-gradient-to-r from-purple-600 to-indigo-500 text-white font-semibold hover:from-purple-500 hover:to-indigo-400 border border-purple-400/30',
  danger: 'bg-gradient-to-r from-red-700 to-red-600 text-white font-semibold hover:from-red-600 hover:to-red-500 border border-red-500/30',
  ghost: 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/10',
  outline: 'bg-transparent text-amber-400 border border-amber-400/50 hover:bg-amber-400/10 hover:border-amber-400',
};

const sizeClasses: Record<string, string> = {
  xs: 'px-2 py-1 text-xs rounded-md',
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
  xl: 'px-8 py-4 text-lg rounded-2xl',
};

const glowClasses: Record<string, string> = {
  gold: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.5)]',
  green: 'hover:shadow-[0_0_20px_rgba(34,197,94,0.5)]',
  red: 'hover:shadow-[0_0_20px_rgba(239,68,68,0.5)]',
  purple: 'hover:shadow-[0_0_20px_rgba(168,85,247,0.5)]',
  danger: 'hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]',
  ghost: '',
  outline: 'hover:shadow-[0_0_15px_rgba(245,158,11,0.3)]',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'gold',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  glow = true,
  className = '',
  disabled,
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      whileHover={isDisabled ? {} : { scale: 1.02, y: -1 }}
      whileTap={isDisabled ? {} : { scale: 0.98, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`
        inline-flex items-center justify-center gap-2
        transition-all duration-200 cursor-pointer
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${glow ? glowClasses[variant] : ''}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      disabled={isDisabled}
      {...(props as React.ComponentPropsWithoutRef<typeof motion.button>)}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        iconPosition === 'left' && icon && <span className="flex-shrink-0">{icon}</span>
      )}
      {children}
      {!loading && iconPosition === 'right' && icon && (
        <span className="flex-shrink-0">{icon}</span>
      )}
    </motion.button>
  );
};

export default Button;
