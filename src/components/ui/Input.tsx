import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  variant?: 'default' | 'gold' | 'glass';
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  icon,
  rightElement,
  type,
  variant = 'default',
  className = '',
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const baseInput = `
    w-full bg-white/5 border rounded-xl px-4 py-3
    text-white placeholder-gray-500
    transition-all duration-200
    ${icon ? 'pl-11' : ''}
    ${isPassword || rightElement ? 'pr-11' : ''}
    ${error
      ? 'border-red-500/50 focus:border-red-400'
      : variant === 'gold'
      ? 'border-amber-500/30 focus:border-amber-400 focus:bg-amber-500/5'
      : 'border-white/10 focus:border-amber-400/50 focus:bg-white/8'
    }
  `;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4">
            {icon}
          </div>
        )}
        <input
          type={inputType}
          className={`${baseInput} ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
        {!isPassword && rightElement && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
      {hint && !error && (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
};

export default Input;
