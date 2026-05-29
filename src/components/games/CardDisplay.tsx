
import React from 'react';
import { Card } from '../../firebase/games';

interface CardDisplayProps {
  card?: Card | null;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  animate?: boolean;
  className?: string;
}

const sizeMap = {
  xs: { outer: 'w-8 h-11', value: 'text-xs', suit: 'text-base' },
  sm: { outer: 'w-11 h-16', value: 'text-xs', suit: 'text-lg' },
  md: { outer: 'w-16 h-24', value: 'text-sm', suit: 'text-2xl' },
  lg: { outer: 'w-20 h-28', value: 'text-base', suit: 'text-3xl' },
};

const suitSymbol: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const isRed = (suit: string) => suit === 'hearts' || suit === 'diamonds';

const CardDisplay: React.FC<CardDisplayProps> = ({
  card,
  faceDown = false,
  size = 'md',
  animate = false,
  className = '',
}) => {
  const s = sizeMap[size];

  if (faceDown || !card) {
    return (
      <div
        className={`
          ${s.outer} rounded-xl border-2 border-yellow-600/40
          bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-800
          flex items-center justify-center shadow-lg
          ${animate ? 'animate-pulse' : ''}
          ${className}
        `}
      >
        <div className="w-full h-full rounded-lg m-0.5 bg-blue-900/60
          flex items-center justify-center">
          <span className="text-yellow-500/40 text-xl select-none">🂠</span>
        </div>
      </div>
    );
  }

  const red = isRed(card.suit);

  return (
    <div
      className={`
        ${s.outer} rounded-xl border border-gray-200
        bg-white flex flex-col justify-between p-1
        shadow-lg select-none
        ${animate ? 'animate-[deal_0.3s_ease-out]' : ''}
        ${className}
      `}
    >
      <div className={`leading-none font-bold ${red ? 'text-red-600' : 'text-gray-900'}`}>
        <div className={s.value}>{card.value}</div>
        <div className="text-xs">{suitSymbol[card.suit]}</div>
      </div>
      <div className={`text-center font-bold ${s.suit} ${red ? 'text-red-600' : 'text-gray-900'}`}>
        {suitSymbol[card.suit]}
      </div>
      <div className={`leading-none font-bold rotate-180 text-right ${red ? 'text-red-600' : 'text-gray-900'}`}>
        <div className={s.value}>{card.value}</div>
        <div className="text-xs">{suitSymbol[card.suit]}</div>
      </div>
    </div>
  );
};

export default CardDisplay;
