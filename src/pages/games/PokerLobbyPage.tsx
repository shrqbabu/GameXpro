// src/pages/PokerLobbyPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  subscribePokerTables,
  createPokerTable,
  joinPokerTable,
  PokerTable,
} from '../firebase/games';
import { formatCurrency, calculateUsableBalance } from '../utils/helpers';
import {
  Plus, Users, ChevronRight, Loader2, X, Lock,
  Clock, Spade, Trophy, DollarSign, Settings,
  Zap, Shield,
} from 'lucide-react';

const STAKES = [
  { label: 'Micro', sb: 5, bb: 10, min: 200, max: 1000, color: 'text-gray-400', border: 'border-gray-600' },
  { label: 'Low', sb: 10, bb: 20, min: 500, max: 2000, color: 'text-green-400', border: 'border-green-600' },
  { label: 'Medium', sb: 25, bb: 50, min: 1000, max: 5000, color: 'text-blue-400', border: 'border-blue-600' },
  { label: 'High', sb: 50, bb: 100, min: 2000, max: 10000, color: 'text-purple-400', border: 'border-purple-600' },
  { label: 'VIP', sb: 100, bb: 200, min: 5000, max: 25000, color: 'text-yellow-400', border: 'border-yellow-600' },
];

const PokerLobbyPage: React.FC = () => {
  const { user, wallet } = useAuth();
  const navigate = useNavigate();

  const [tables, setTables] = useState<PokerTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [selectedTable, setSelectedTable] = useState<PokerTable | null>(null);
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [buyIn, setBuyIn] = useState(500);
  const [filterStake, setFilterStake] = useState<string>('all');
  const [error, setError] = useState('');

  const [newTable, setNewTable] = useState({
    name: '',
    stakeIndex: 1,
    buyIn: 500,
  });

  useEffect(() => {
    const unsub = subscribePokerTables((data) => {
      setTables(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const usable = wallet ? calculateUsableBalance(wallet) : 0;

  const filteredTables = tables.filter((t) => {
    if (filterStake === 'all') return true;
    return t.name.toLowerCase().includes(filterStake.toLowerCase());
  });

  const handleOpenJoin = (table: PokerTable) => {
    setSelectedTable(table);
    setBuyIn(table.minBuyIn);
    setError('');
    setShowJoin(true);
  };

  const handleJoin = async () => {
    if (!user || !selectedTable) return;
    setError('');
    setJoining(true);
    try {
      await joinPokerTable(
        selectedTable.id,
        user.uid,
        user.name || 'Player',
        user.photoURL || '',
        buyIn
      );
      setShowJoin(false);
      navigate(`/poker/${selectedTable.id}`);
    } catch (e: any) {
      setError(e.message || 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    setError('');

    const stake = STAKES[newTable.stakeIndex];
    if (!newTable.name.trim()) {
      setError('Enter a table name');
      return;
    }
    if (newTable.buyIn < stake.min) {
      setError(`Minimum buy-in is ${formatCurrency(stake.min)}`);
      return;
    }
    if (usable < newTable.buyIn) {
      setError('Insufficient balance');
      return;
    }

    setCreating(true);
    try {
      const tableId = await createPokerTable(
        user.uid,
        newTable.name.trim(),
        stake.sb,
        stake.bb,
        stake.min,
        stake.max
      );
      await joinPokerTable(
        tableId,
        user.uid,
        user.name || 'Player',
        user.photoURL || '',
        newTable.buyIn
      );
      setShowCreate(false);
      navigate(`/poker/${tableId}`);
    } catch (e: any) {
      setError(e.message || 'Failed to create table');
    } finally {
      setCreating(false);
    }
  };

  const getTableStatusBadge = (table: PokerTable) => {
    const count = table.players.length;
    if (table.status === 'playing') {
      return <span className="text-xs bg-amber-500/20 text-amber-400
        border border-amber-500/30 rounded-full px-2 py-0.5">In Progress</span>;
    }
    if (count >= 4) {
      return <span className="text-xs bg-red-500/20 text-red-400
        border border-red-500/30 rounded-full px-2 py-0.5">Full</span>;
    }
    if (count >= 2) {
      return <span className="text-xs bg-emerald-500/20 text-emerald-400
        border border-emerald-500/30 rounded-full px-2 py-0.5 animate-pulse">
        Ready to Start
      </span>;
    }
    return <span className="text-xs bg-blue-500/20 text-blue-400
      border border-blue-500/30 rounded-full px-2 py-0.5">Waiting</span>;
  };

  const getStakeLabel = (table: PokerTable) => {
    const match = STAKES.find(
      (s) => s.sb === table.smallBlind && s.bb === table.bigBlind
    );
    return match || null;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-xl
                flex items-center justify-center border border-purple-500/30">
                <Spade className="w-5 h-5 text-purple-400" />
              </div>
              Texas Hold'em Lobby
            </h1>
            <p className="text-gray-500 mt-1">
              Join a table or create your own • Min 2, Max 4 players
            </p>
          </div>

          <button
            onClick={() => { setError(''); setShowCreate(true); }}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600
              to-indigo-600 text-white font-bold px-5 py-3 rounded-xl
              hover:from-purple-500 hover:to-indigo-500 transition-all
              shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40
              active:scale-95">
            <Plus className="w-4 h-4" />
            Create Table
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Active Tables', icon: Spade,
              value: tables.filter(t => t.status === 'waiting').length,
              color: 'text-purple-400', bg: 'bg-purple-500/10'
            },
            {
              label: 'In Progress', icon: Zap,
              value: tables.filter(t => t.status === 'playing').length,
              color: 'text-amber-400', bg: 'bg-amber-500/10'
            },
            {
              label: 'Players Online',
              icon: Users,
              value: tables.reduce((s, t) => s + t.players.length, 0),
              color: 'text-blue-400', bg: 'bg-blue-500/10'
            },
            {
              label: 'Your Balance', icon: Trophy,
              value: formatCurrency(usable),
              color: 'text-yellow-400', bg: 'bg-yellow-500/10'
            },
          ].map(({ label, icon: Icon, value, color, bg }) => (
            <div key={label} className="bg-gray-900 border border-gray-700/50
              rounded-2xl p-4 flex items-center gap-3">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-gray-500 text-xs">{label}</p>
                <p className={`font-bold text-sm ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Stake Filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setFilterStake('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all
              ${filterStake === 'all'
                ? 'bg-white text-gray-900 border-white'
                : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
            All Stakes
          </button>
          {STAKES.map((s) => (
            <button
              key={s.label}
              onClick={() => setFilterStake(filterStake === s.label ? 'all' : s.label)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all
                ${filterStake === s.label
                  ? `bg-gray-800 ${s.border} ${s.color}`
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
              {s.label} ({formatCurrency(s.sb)}/{formatCurrency(s.bb)})
            </button>
          ))}
        </div>

        {/* Tables Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent
                rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500">Loading tables...</p>
            </div>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="text-center py-24 bg-gray-900/50 rounded-3xl
            border border-dashed border-gray-700">
            <Spade className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-white text-xl font-bold mb-2">No Tables Available</h3>
            <p className="text-gray-600 mb-6">Create the first table to start playing!</p>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold
                px-6 py-3 rounded-xl transition-colors">
              Create Table
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTables.map((table) => {
              const isJoined = table.players.some((p) => p.uid === user?.uid);
              const isFull = table.players.length >= 4;
              const isPlaying = table.status === 'playing';
              const stakeInfo = getStakeLabel(table);

              return (
                <div key={table.id}
                  className="bg-gray-900 border border-gray-700/50 rounded-2xl
                    overflow-hidden hover:border-purple-500/40 transition-all group
                    hover:shadow-xl hover:shadow-purple-500/10">

                  {/* Table Header */}
                  <div className="bg-gradient-to-r from-purple-900/40 via-indigo-900/30
                    to-purple-900/40 border-b border-gray-700/50 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-white font-bold text-base mb-1 truncate">
                          {table.name}
                        </h3>
                        <div className="flex items-center gap-2">
                          {getTableStatusBadge(table)}
                          {stakeInfo && (
                            <span className={`text-xs font-bold ${stakeInfo.color}`}>
                              {stakeInfo.label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Player Seats Visual */}
                      <div className="flex gap-1 ml-3">
                        {[...Array(4)].map((_, i) => {
                          const player = table.players[i];
                          return (
                            <div key={i}
                              className={`w-8 h-8 rounded-full border-2 flex items-center
                                justify-center text-xs font-bold transition-all
                                ${player
                                  ? 'bg-purple-600 border-purple-400 text-white'
                                  : 'bg-gray-800 border-gray-700 text-gray-600'}`}>
                              {player ? player.name.charAt(0).toUpperCase() : '+'}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    {/* Table Info Grid */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {[
                        {
                          label: 'Blinds',
                          value: `${formatCurrency(table.smallBlind)} / ${formatCurrency(table.bigBlind)}`
                        },
                        {
                          label: 'Players',
                          value: `${table.players.length} / 4`
                        },
                        {
                          label: 'Min Buy-in',
                          value: formatCurrency(table.minBuyIn)
                        },
                        {
                          label: 'Max Buy-in',
                          value: formatCurrency(table.maxBuyIn)
                        },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-gray-800/60 rounded-xl p-2.5">
                          <p className="text-gray-600 text-xs mb-0.5">{label}</p>
                          <p className="text-white font-bold text-xs">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Players List */}
                    {table.players.length > 0 && (
                      <div className="mb-4">
                        <p className="text-gray-600 text-xs mb-1.5">At table:</p>
                        <div className="flex flex-wrap gap-1">
                          {table.players.map((p) => (
                            <span key={p.uid}
                              className={`text-xs px-2 py-0.5 rounded-full border
                                ${p.uid === user?.uid
                                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                                  : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                              {p.uid === user?.uid ? 'You' : p.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    {isJoined ? (
                      <button
                        onClick={() => navigate(`/poker/${table.id}`)}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600
                          text-white font-bold py-2.5 rounded-xl hover:from-purple-500
                          hover:to-indigo-500 transition-all flex items-center
                          justify-center gap-2">
                        Return to Table
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : isFull ? (
                      <button disabled
                        className="w-full bg-gray-800 text-gray-600 font-bold py-2.5
                          rounded-xl cursor-not-allowed flex items-center justify-center gap-2">
                        <Lock className="w-4 h-4" />
                        Table Full
                      </button>
                    ) : isPlaying ? (
                      <button disabled
                        className="w-full bg-gray-800 text-gray-600 font-bold py-2.5
                          rounded-xl cursor-not-allowed flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4" />
                        Game in Progress
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenJoin(table)}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600
                          text-white font-bold py-2.5 rounded-xl hover:from-purple-500
                          hover:to-indigo-500 transition-all flex items-center
                          justify-center gap-2 active:scale-95">
                        Join Table
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── JOIN MODAL ───────────────────────────────────── */}
      {showJoin && selectedTable && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex
          items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl
            p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-white text-xl font-bold">Join Table</h3>
                <p className="text-gray-500 text-sm">{selectedTable.name}</p>
              </div>
              <button onClick={() => setShowJoin(false)}
                className="text-gray-600 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl
                p-3 mb-4 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Table Info */}
            <div className="bg-gray-800/50 rounded-xl p-4 mb-5 space-y-2 text-sm">
              {[
                ['Blinds', `${formatCurrency(selectedTable.smallBlind)} / ${formatCurrency(selectedTable.bigBlind)}`],
                ['Players', `${selectedTable.players.length} / 4`],
                ['Min Buy-in', formatCurrency(selectedTable.minBuyIn)],
                ['Max Buy-in', formatCurrency(selectedTable.maxBuyIn)],
                ['Your Balance', formatCurrency(usable)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-500">{label}</span>
                  <span className={label === 'Your Balance' ? 'text-yellow-400 font-bold' : 'text-white'}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* Buy-in Input */}
            <div className="mb-5">
              <label className="text-gray-400 text-sm mb-2 block">
                Buy-in Amount
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2
                  text-gray-500 w-4 h-4" />
                <input
                  type="number"
                  value={buyIn}
                  onChange={(e) => setBuyIn(Number(e.target.value))}
                  min={selectedTable.minBuyIn}
                  max={Math.min(selectedTable.maxBuyIn, usable)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl
                    pl-9 pr-4 py-3 text-white text-sm
                    focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Quick Buy-in */}
              <div className="flex gap-2 mt-2">
                {[
                  selectedTable.minBuyIn,
                  Math.round((selectedTable.minBuyIn + selectedTable.maxBuyIn) / 2),
                  selectedTable.maxBuyIn,
                ].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setBuyIn(Math.min(amount, usable))}
                    className="flex-1 text-xs bg-gray-800 border border-gray-700
                      text-gray-400 rounded-lg py-1.5
                      hover:border-purple-500 hover:text-purple-400 transition-colors">
                    {formatCurrency(amount)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleJoin}
              disabled={joining || buyIn < selectedTable.minBuyIn || buyIn > usable}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600
                text-white font-bold py-3 rounded-xl hover:from-purple-500
                hover:to-indigo-500 transition-all disabled:opacity-50
                flex items-center justify-center gap-2">
              {joining ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                `Join with ${formatCurrency(buyIn)}`
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── CREATE MODAL ─────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex
          items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl
            p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white text-xl font-bold">Create Table</h3>
              <button onClick={() => setShowCreate(false)}
                className="text-gray-600 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl
                p-3 mb-4 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Table Name */}
              <div>
                <label className="text-gray-400 text-sm mb-1.5 block">Table Name</label>
                <input
                  type="text"
                  value={newTable.name}
                  onChange={(e) => setNewTable({ ...newTable, name: e.target.value })}
                  placeholder="e.g. High Rollers, Friday Night..."
                  maxLength={30}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl
                    px-4 py-3 text-white text-sm placeholder-gray-600
                    focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Stakes */}
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Stakes Level</label>
                <div className="grid grid-cols-1 gap-2">
                  {STAKES.map((stake, i) => (
                    <button
                      key={stake.label}
                      onClick={() => setNewTable({
                        ...newTable,
                        stakeIndex: i,
                        buyIn: stake.min,
                      })}
                      className={`flex items-center justify-between px-4 py-3
                        rounded-xl border-2 text-sm transition-all
                        ${newTable.stakeIndex === i
                          ? `${stake.border} bg-gray-800`
                          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'}`}>
                      <div className="flex items-center gap-3">
                        <span className={`font-bold ${newTable.stakeIndex === i ? stake.color : 'text-gray-400'}`}>
                          {stake.label}
                        </span>
                        <span className="text-gray-500 text-xs">
                          Blinds: {formatCurrency(stake.sb)}/{formatCurrency(stake.bb)}
                        </span>
                      </div>
                      <span className="text-gray-500 text-xs">
                        {formatCurrency(stake.min)}–{formatCurrency(stake.max)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Your Buy-in */}
              <div>
                <label className="text-gray-400 text-sm mb-1.5 block">Your Buy-in</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2
                    text-gray-500 w-4 h-4" />
                  <input
                    type="number"
                    value={newTable.buyIn}
                    onChange={(e) => setNewTable({ ...newTable, buyIn: Number(e.target.value) })}
                    min={STAKES[newTable.stakeIndex].min}
                    max={Math.min(STAKES[newTable.stakeIndex].max, usable)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl
                      pl-9 pr-4 py-3 text-white text-sm
                      focus:outline-none focus:border-purple-500"
                  />
                </div>
                <p className="text-gray-600 text-xs mt-1">
                  Min: {formatCurrency(STAKES[newTable.stakeIndex].min)} •
                  Your balance: {formatCurrency(usable)}
                </p>
              </div>
            </div>

            <div className="bg-purple-500/10 border border-purple-500/20
              rounded-xl p-3 mt-4 mb-4 text-xs text-purple-300">
              <Shield className="w-3.5 h-3.5 inline mr-1" />
              You'll be the first player. Game starts when 2+ players join.
            </div>

            <button
              onClick={handleCreate}
              disabled={creating || !newTable.name.trim() ||
                newTable.buyIn < STAKES[newTable.stakeIndex].min}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600
                text-white font-bold py-3 rounded-xl hover:from-purple-500
                hover:to-indigo-500 transition-all disabled:opacity-50
                flex items-center justify-center gap-2">
              {creating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Create & Join Table'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PokerLobbyPage;
