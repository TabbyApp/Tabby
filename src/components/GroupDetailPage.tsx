import { motion } from 'motion/react';
import { ChevronLeft, Users, Receipt, Trash2, UserMinus, LogOut, Plus, MoreVertical } from 'lucide-react';
import { useState } from 'react';
import { PageType } from '../App';

interface GroupDetailPageProps {
  onNavigate: (page: PageType, groupId?: number) => void;
  theme: 'light' | 'dark';
  groupId: number | null;
  groups: Array<{ id: number; name: string; members: number; balance: number; color: string; createdBy: number }>;
  deleteGroup: (groupId: number) => void;
  leaveGroup: (groupId: number) => void;
  currentUserId: number;
}

export function GroupDetailPage({ onNavigate, theme, groupId, groups, deleteGroup, leaveGroup, currentUserId }: GroupDetailPageProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const isDark = theme === 'dark';

  // Find current group from groups array
  const currentGroup = groups.find(g => g.id === groupId);
  const isCreator = currentGroup?.createdBy === currentUserId;

  // Mock data - would come from props/state in real app
  const groupDataBase = {
    1: { 
      id: 1, 
      name: 'Lunch Squad', 
      members: [
        { id: 1, name: 'You', balance: 15.50, avatar: '👤', isYou: true },
        { id: 2, name: 'Sarah Mitchell', balance: -12.20, avatar: '👩', isYou: false },
        { id: 3, name: 'Mike Johnson', balance: 18.10, avatar: '👨', isYou: false },
        { id: 4, name: 'Emma Davis', balance: -21.40, avatar: '👧', isYou: false },
      ],
      balance: 45.80,
      yourBalance: 15.50,
      transactions: [
        { id: 1, description: 'Pizza Palace', amount: 45.80, date: '2h ago', type: 'expense', receipts: 3 },
        { id: 2, description: 'Coffee Shop', amount: 18.20, date: '1d ago', type: 'expense', receipts: 2 },
        { id: 3, description: 'Sarah paid you', amount: 12.20, date: '2d ago', type: 'payment', receipts: 0 },
      ]
    },
    2: { 
      id: 2, 
      name: 'Roommates',
      members: [
        { id: 1, name: 'You', balance: 50.00, avatar: '👤', isYou: true },
        { id: 2, name: 'Alex', balance: -25.00, avatar: '👨', isYou: false },
        { id: 3, name: 'Jordan', balance: -25.00, avatar: '👩', isYou: false },
      ],
      balance: 120.00,
      yourBalance: 50.00,
      transactions: [
        { id: 1, description: 'Groceries', amount: 120.00, date: '1d ago', type: 'expense', receipts: 5 },
      ]
    },
    3: { 
      id: 3, 
      name: 'Road Trip 2026',
      members: [
        { id: 1, name: 'You', balance: 0, avatar: '👤', isYou: true },
        { id: 2, name: 'James', balance: 0, avatar: '👨', isYou: false },
        { id: 3, name: 'Lisa', balance: 0, avatar: '👩', isYou: false },
        { id: 4, name: 'David', balance: 0, avatar: '👨', isYou: false },
        { id: 5, name: 'Emily', balance: 0, avatar: '👧', isYou: false },
        { id: 6, name: 'Chris', balance: 0, avatar: '👦', isYou: false },
      ],
      balance: 0,
      yourBalance: 0,
      transactions: []
    },
    4: { 
      id: 4, 
      name: 'Office Lunch',
      members: [
        { id: 1, name: 'You', balance: 25.00, avatar: '👤', isYou: true },
        { id: 2, name: 'Tom', balance: -12.50, avatar: '👨', isYou: false },
        { id: 3, name: 'Rachel', balance: 30.00, avatar: '👩', isYou: false },
        { id: 4, name: 'Steve', balance: -18.00, avatar: '👨', isYou: false },
        { id: 5, name: 'Megan', balance: -24.50, avatar: '👧', isYou: false },
      ],
      balance: 67.50,
      yourBalance: 25.00,
      transactions: [
        { id: 1, description: 'Sushi Restaurant', amount: 67.50, date: '3h ago', type: 'expense', receipts: 2 },
        { id: 2, description: 'Coffee & Bagels', amount: 28.00, date: '2d ago', type: 'expense', receipts: 1 },
      ]
    },
  };

  // Track removed members
  const [removedMembers, setRemovedMembers] = useState<number[]>([]);

  const baseGroup = groupDataBase[groupId as keyof typeof groupDataBase] || groupDataBase[1];
  
  // Filter out removed members
  const group = {
    ...baseGroup,
    members: baseGroup.members.filter(m => !removedMembers.includes(m.id))
  };

  const handleRemoveMember = (member: any) => {
    setSelectedMember(member);
    setShowRemoveMemberModal(true);
    setShowMenu(false);
  };

  const confirmRemoveMember = () => {
    if (selectedMember) {
      setRemovedMembers([...removedMembers, selectedMember.id]);
      setShowRemoveMemberModal(false);
      setSelectedMember(null);
    }
  };

  const handleDeleteGroup = () => {
    // Mock implementation - in real app would delete from database
    console.log('Deleting group:', groupId);
    if (groupId) {
      deleteGroup(groupId);
    }
    setShowDeleteModal(false);
    // Navigate back to groups page
    setTimeout(() => {
      onNavigate('groups');
    }, 100);
  };

  const handleLeaveGroup = () => {
    // Mock implementation - in real app would remove user from group
    console.log('Leaving group:', groupId);
    if (groupId) {
      leaveGroup(groupId);
    }
    setShowLeaveModal(false);
    // Navigate back to groups page
    setTimeout(() => {
      onNavigate('groups');
    }, 100);
  };

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50'}`}>
      {/* Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white/80 border-slate-200'} backdrop-blur-xl border-b px-5 py-5`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onNavigate('groups')}
              className={`w-11 h-11 rounded-[16px] ${isDark ? 'bg-slate-700' : 'bg-gradient-to-br from-purple-100 to-indigo-100'} flex items-center justify-center active:scale-95 transition-transform shadow-sm`}
            >
              <ChevronLeft size={22} className={isDark ? 'text-white' : 'text-purple-600'} strokeWidth={2.5} />
            </button>
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{group.name}</h1>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{group.members.length} members</p>
            </div>
          </div>
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className={`w-11 h-11 rounded-[16px] ${isDark ? 'bg-slate-700' : 'bg-gradient-to-br from-purple-100 to-indigo-100'} flex items-center justify-center active:scale-95 transition-transform shadow-sm`}
            >
              <MoreVertical size={20} className={isDark ? 'text-white' : 'text-purple-600'} />
            </button>
            
            {/* Dropdown Menu */}
            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`absolute right-0 top-14 w-56 ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl shadow-2xl overflow-hidden z-20 border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}
                >
                  <button 
                    onClick={() => {
                      setShowLeaveModal(true);
                      setShowMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50'} transition-colors border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}
                  >
                    <LogOut size={18} className="text-orange-500" />
                    <span className={`text-sm font-medium text-orange-500`}>Leave Group</span>
                  </button>
                  {isCreator && (
                    <button 
                      onClick={() => {
                        setShowDeleteModal(true);
                        setShowMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50'} transition-colors`}
                    >
                      <Trash2 size={18} className="text-red-500" />
                      <span className={`text-sm font-medium text-red-500`}>Delete Group</span>
                    </button>
                  )}
                </motion.div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* Balance Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-[24px] p-6 shadow-lg ${isDark ? 'shadow-none' : 'shadow-slate-200/50'} border mb-6`}
        >
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-2`}>Your Balance</p>
          <p className={`text-4xl font-bold mb-1 ${group.yourBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {group.yourBalance >= 0 ? '+' : ''}${Math.abs(group.yourBalance).toFixed(2)}
          </p>
          <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            {group.yourBalance >= 0 ? 'You are owed' : 'You owe'}
          </p>
        </motion.div>

        {/* Members Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <h2 className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'} uppercase tracking-wider mb-3 px-1`}>
            Members
          </h2>
          <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-[24px] shadow-lg ${isDark ? 'shadow-none' : 'shadow-slate-200/50'} border overflow-hidden`}>
            {group.members.map((member, index) => (
              <div 
                key={member.id}
                className={`flex items-center justify-between p-4 ${
                  index !== group.members.length - 1 ? `border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}` : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center text-xl shadow-lg shadow-purple-200/40">
                    {member.avatar}
                  </div>
                  <div>
                    <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {member.name}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {member.balance >= 0 ? 'Owed' : 'Owes'} ${Math.abs(member.balance).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`font-bold ${member.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {member.balance >= 0 ? '+' : ''}${member.balance.toFixed(2)}
                  </p>
                  {!member.isYou && (
                    <button 
                      onClick={() => handleRemoveMember(member)}
                      className={`w-8 h-8 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-100'} flex items-center justify-center active:scale-95 transition-transform`}
                    >
                      <UserMinus size={16} className="text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Transaction History */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <h2 className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'} uppercase tracking-wider mb-3 px-1`}>
            Transaction History
          </h2>
          <div className="space-y-3">
            {group.transactions.map((transaction, index) => (
              <motion.div
                key={transaction.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-[20px] p-4 shadow-lg ${isDark ? 'shadow-none' : 'shadow-slate-200/50'} border`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      transaction.type === 'expense' ? 'bg-red-100' : 'bg-green-100'
                    }`}>
                      <Receipt size={20} className={transaction.type === 'expense' ? 'text-red-500' : 'text-green-500'} />
                    </div>
                    <div>
                      <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {transaction.description}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {transaction.date}
                      </p>
                    </div>
                  </div>
                  <p className={`font-bold ${transaction.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>
                    {transaction.type === 'expense' ? '-' : '+'}${transaction.amount.toFixed(2)}
                  </p>
                </div>
                {transaction.receipts > 0 && (
                  <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'} pl-13`}>
                    {transaction.receipts} receipt{transaction.receipts > 1 ? 's' : ''} attached
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Add Receipt Button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="px-5 pb-7"
      >
        <button 
          onClick={() => onNavigate('receiptScan', groupId!)}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-[20px] font-bold shadow-2xl shadow-purple-400/50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2.5 text-[17px]"
        >
          <Plus size={24} strokeWidth={2.5} />
          Add Receipt
        </button>
      </motion.div>

      {/* Delete Group Modal */}
      {showDeleteModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setShowDeleteModal(false)}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-sm"
          >
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 shadow-2xl`}>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className={`text-xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Delete {group.name}?
              </h3>
              <p className={`text-center ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
                This action cannot be undone. All transaction history will be permanently deleted.
              </p>
              <div className="space-y-2">
                <button 
                  onClick={handleDeleteGroup}
                  className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform"
                >
                  Yes, Delete Group
                </button>
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  className={`w-full ${isDark ? 'bg-slate-700 text-white' : 'bg-gray-200 text-slate-800'} py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Leave Group Modal */}
      {showLeaveModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setShowLeaveModal(false)}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-sm"
          >
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 shadow-2xl`}>
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <LogOut size={24} className="text-orange-500" />
              </div>
              <h3 className={`text-xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Leave {group.name}?
              </h3>
              <p className={`text-center ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
                You'll no longer have access to this group's transactions and receipts.
              </p>
              <div className="space-y-2">
                <button 
                  onClick={handleLeaveGroup}
                  className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform"
                >
                  Yes, Leave Group
                </button>
                <button 
                  onClick={() => setShowLeaveModal(false)}
                  className={`w-full ${isDark ? 'bg-slate-700 text-white' : 'bg-gray-200 text-slate-800'} py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Remove Member Modal */}
      {showRemoveMemberModal && selectedMember && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setShowRemoveMemberModal(false)}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-sm"
          >
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 shadow-2xl`}>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <UserMinus size={24} className="text-red-500" />
              </div>
              <h3 className={`text-xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Remove {selectedMember.name}?
              </h3>
              <p className={`text-center ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
                They'll be removed from {group.name} and won't have access to the group anymore.
              </p>
              <div className="space-y-2">
                <button 
                  onClick={confirmRemoveMember}
                  className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform"
                >
                  Yes, Remove Member
                </button>
                <button 
                  onClick={() => setShowRemoveMemberModal(false)}
                  className={`w-full ${isDark ? 'bg-slate-700 text-white' : 'bg-gray-200 text-slate-800'} py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}