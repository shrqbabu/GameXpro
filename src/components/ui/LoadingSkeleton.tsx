import React from 'react';

interface SkeletonProps {
  className?: string;
  lines?: number;
  avatar?: boolean;
  card?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  lines,
  avatar = false,
  card = false,
}) => {
  if (card) {
    return (
      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="skeleton w-12 h-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-5/6 rounded" />
          <div className="skeleton h-3 w-4/6 rounded" />
        </div>
      </div>
    );
  }

  if (avatar) {
    return (
      <div className="flex items-center gap-3">
        <div className="skeleton w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-1/3 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
        </div>
      </div>
    );
  }

  if (lines) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`skeleton h-4 rounded`}
            style={{ width: `${100 - i * 10}%` }}
          />
        ))}
      </div>
    );
  }

  return <div className={`skeleton ${className}`} />;
};

export const PageLoader: React.FC = () => (
  <div className="min-h-screen animated-bg flex items-center justify-center">
    <div className="text-center">
      <div className="relative inline-flex">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-600 to-yellow-400 flex items-center justify-center text-2xl shadow-[0_0_30px_rgba(245,158,11,0.5)] animate-pulse">
          ♠
        </div>
        <div className="absolute inset-0 rounded-2xl border-2 border-amber-400 animate-ping opacity-30" />
      </div>
      <p className="mt-4 text-gray-400 text-sm animate-pulse">Loading RoyalFlush...</p>
    </div>
  </div>
);

export const TableLoader: React.FC = () => (
  <div className="space-y-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="glass rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="skeleton w-10 h-10 rounded-xl" />
            <div className="space-y-2">
              <div className="skeleton h-4 w-32 rounded" />
              <div className="skeleton h-3 w-24 rounded" />
            </div>
          </div>
          <div className="skeleton h-8 w-24 rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

export default Skeleton;
