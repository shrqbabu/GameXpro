// src/components/games/GameHeader.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface GameHeaderProps {
  title: string;
  subtitle?: string;
}

const GameHeader: React.FC<GameHeaderProps> = ({ title, subtitle }) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#0a0612] border-b border-white/10 sticky top-0 z-50">
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/10
          text-gray-300 hover:bg-white/10 hover:text-white active:scale-95 transition-all"
        aria-label="Back to Dashboard"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div>
        <h1 className="text-white font-bold text-base leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-gray-400 text-xs leading-tight">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

export default GameHeader;
