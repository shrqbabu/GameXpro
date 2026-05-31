import React from 'react';
import { motion } from 'framer-motion';

interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  value: string;
  numericValue: number;
}

interface CardDisplayProps {
  card?: Card | null;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  animate?: boolean;
  delay?: number;
  isJoker?: boolean;
  isWinner?: boolean;
}

const suitSymbols: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const suitColors: Record<string, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-black',
  spades: 'text-black',
};

const valueDisplay: Record<string, string> = {
  A: 'A', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
  '8': '8', '9': '9', '10': '10', J: 'J', Q: 'Q', K: 'K'
};

const sizeClasses = {
  xs: 'w-[44px] h-[60px] text-xs',
  sm: 'w-[52px] h-[70px] text-sm',
  md: 'w-[60px] h-[80px] text-base',
  lg: 'w-[68px] h-[90px] text-lg',
};

export const CardDisplay: React.FC<CardDisplayProps> = ({
  card,
  faceDown = false,
  size = 'sm',
  animate = false,
  delay = 0,
  isJoker = false,
  isWinner = false,
}) => {
  if (!card && !faceDown) {
    return (
      <div className={`bg-white rounded-lg shadow-md border border-gray-200 ${sizeClasses[size] || sizeClasses.sm}`} />
    );
  }

  if (faceDown) {
    return (
      <motion.div
        initial={animate ? { opacity: 0, y: -20 } : false}
        animate={animate ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: delay / 1000, duration: 0.3 }}
        className={`bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg shadow-md ${sizeClasses[size] || sizeClasses.sm} flex items-center justify-center`}
      >
        <span className="text-white text-2xl font-black">🂡</span>
      </motion.div>
    );
  }

  const symbol = suitSymbols[card!.suit];
  const colorClass = suitColors[card!.suit];
  const displayValue = valueDisplay[card!.value] || card!.value;

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: -20 } : false}
      animate={animate ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: delay / 1000, duration: 0.3 }}
      className={`
        bg-white rounded-lg shadow-md border border-gray-200
        ${sizeClasses[size] || sizeClasses.sm}
        ${isJoker ? 'ring-2 ring-red-500 ring-opacity-50' : ''}
        ${isWinner ? 'ring-2 ring-green-500 ring-opacity-50' : ''}
        flex flex-col items-center justify-center
        ${card?.suit === 'hearts' || card?.suit === 'diamonds' ? 'text-red-500' : 'text-black'}
      `}
    >
      <span className="font-bold text-left w-full pl-1">{displayValue}</span>
      <span className="text-xl">{symbol}</span>
    </motion.div>
  );
};

export default CardDisplay;
