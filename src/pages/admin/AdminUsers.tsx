import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, UserCheck, UserX, Shield, Eye, MoreVertical
} from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatCurrency, generateMockUsers, timeAgo } from '../../utils/helpers';
import toast from 'react-hot-toast';
import type { UserProfile } from '../../types';

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>(generateMockUsers() as UserProfile[]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const FILTERS = ['All', 'Active', 'Blocked', 'Admin'];

  const filteredUsers = users.filter((u) => {
    const matchSearch = u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'All' ? true :
      filter === 'Active' ? u.status === 'active' :
      filter === 'Blocked' ? u.status === 'blocked' :
      filter === 'Admin' ? u.role === 'admin' : true;
    return matchSearch && matchFilter;
  });

  const handleToggleBlock = (uid: string) => {
    setUsers((prev) => prev.map((u) =>
      u.uid === uid
        ? { ...u, status: u.status === 'blocked' ? 'active' as const : 'blocked' as const }
        : u
    ));
    const user = users.find((u) => u.uid === uid);
    if (user) {
      toast.success(`User ${user.status === 'blocked' ? 'unblocked' : 'blocked'} successfully`);
    }
  };

  const handleGiveChips = (uid: string) => {
    setUsers((prev) => prev.map((u) =>
      u.uid === uid ? { ...u, demoChips: u.demoChips + 5000 } : u
    ));
    toast.success('5000 demo chips added to user');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-display font-bold text-white">User Management</h1>
          <p className="text-gray-400 text-sm">{users.length} total users</p>
        </div>
        <Button size="sm" icon={<Shield className="w-4 h-4" />}>
          Export Users
        </Button>
      </motion.div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search by username or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-500 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                filter === f
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* User Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-2xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left p-4 text-xs text-gray-500 font-medium">User</th>
                <th className="text-left p-4 text-xs text-gray-500 font-medium hidden md:table-cell">Email</th>
                <th className="text-right p-4 text-xs text-gray-500 font-medium hidden lg:table-cell">Balance</th>
                <th className="text-right p-4 text-xs text-gray-500 font-medium hidden lg:table-cell">Chips</th>
                <th className="text-center p-4 text-xs text-gray-500 font-medium">Status</th>
                <th className="text-center p-4 text-xs text-gray-500 font-medium">Role</th>
                <th className="text-center p-4 text-xs text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, i) => (
                <motion.tr
                  key={user.uid}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-white/3 hover:bg-white/2 transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar username={user.username} avatarIndex={user.avatarIndex} size="sm" />
                      <div>
                        <p className="text-white text-sm font-medium">{user.username}</p>
                        <p className="text-gray-500 text-xs">{timeAgo(user.lastSeen)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <span className="text-gray-400 text-sm">{user.email}</span>
                  </td>
                  <td className="p-4 text-right hidden lg:table-cell">
                    <span className="text-amber-400 font-mono text-sm">
                      {formatCurrency(user.wallet.depositBalance + user.wallet.winningBalance)}
                    </span>
                  </td>
                  <td className="p-4 text-right hidden lg:table-cell">
                    <span className="text-emerald-400 font-mono text-sm">
                      {user.demoChips.toLocaleString()}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <Badge
                      variant={user.status === 'active' ? 'green' : 'red'}
                      size="xs"
                      dot
                    >
                      {user.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-center">
                    <Badge
                      variant={user.role === 'admin' ? 'purple' : 'blue'}
                      size="xs"
                    >
                      {user.role}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleBlock(user.uid)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          user.status === 'blocked'
                            ? 'hover:bg-emerald-500/10 text-emerald-400'
                            : 'hover:bg-red-500/10 text-gray-400 hover:text-red-400'
                        }`}
                        title={user.status === 'blocked' ? 'Unblock' : 'Block'}
                      >
                        {user.status === 'blocked'
                          ? <UserCheck className="w-3.5 h-3.5" />
                          : <UserX className="w-3.5 h-3.5" />
                        }
                      </button>
                      <button
                        onClick={() => handleGiveChips(user.uid)}
                        className="p-1.5 rounded-lg hover:bg-amber-500/10 text-gray-400 hover:text-amber-400 transition-colors"
                        title="Give Chips"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">👤</div>
            <p className="text-gray-400">No users found</p>
          </div>
        )}
      </motion.div>

      {/* User Detail Modal */}
      {selectedUser && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedUser(null)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="glass rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">User Details</h3>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <Avatar username={selectedUser.username} avatarIndex={selectedUser.avatarIndex} size="xl" ring />
              <div>
                <h4 className="text-white font-bold text-xl">{selectedUser.username}</h4>
                <p className="text-gray-400 text-sm">{selectedUser.email}</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant={selectedUser.status === 'active' ? 'green' : 'red'} size="xs">{selectedUser.status}</Badge>
                  <Badge variant={selectedUser.role === 'admin' ? 'purple' : 'blue'} size="xs">{selectedUser.role}</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: 'Deposit Balance', value: formatCurrency(selectedUser.wallet.depositBalance) },
                { label: 'Winning Balance', value: formatCurrency(selectedUser.wallet.winningBalance) },
                { label: 'Bonus Balance', value: formatCurrency(selectedUser.wallet.bonusBalance) },
                { label: 'Demo Chips', value: selectedUser.demoChips.toLocaleString() },
                { label: 'Games Played', value: selectedUser.gamesPlayed },
                { label: 'Games Won', value: selectedUser.gamesWon },
              ].map((stat) => (
                <div key={stat.label} className="p-3 rounded-xl bg-white/5">
                  <p className="text-gray-500 text-xs">{stat.label}</p>
                  <p className="text-white font-mono font-bold">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                variant={selectedUser.status === 'blocked' ? 'green' : 'danger'}
                fullWidth
                size="sm"
                onClick={() => {
                  handleToggleBlock(selectedUser.uid);
                  setSelectedUser(null);
                }}
              >
                {selectedUser.status === 'blocked' ? '✓ Unblock User' : '✕ Block User'}
              </Button>
              <Button
                variant="gold"
                fullWidth
                size="sm"
                onClick={() => {
                  handleGiveChips(selectedUser.uid);
                  setSelectedUser(null);
                }}
              >
                +5000 Chips
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default AdminUsers;
