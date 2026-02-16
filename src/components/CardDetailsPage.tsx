import { motion } from 'motion/react';
import { ChevronLeft, CreditCard, ArrowUpRight, ArrowDownLeft, Users, Wallet } from 'lucide-react';
import { PageType } from '../App';

interface CardDetailsPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
}

export function CardDetailsPage({ onNavigate, theme }: CardDetailsPageProps) {
  const isDark = theme === 'dark';

  const transactions = [
    { id: 1, type: 'charge', description: 'Pizza Palace', amount: 15.50, date: '2h ago', user: 'You' },
    { id: 2, type: 'payment', description: 'Sarah paid in', amount: 12.20, date: '3h ago', user: 'Sarah' },
    { id: 3, type: 'charge', description: 'Coffee Shop', amount: 18.10, date: '1d ago', user: 'Mike' },
  ];

  const groupMembers = [
    { id: 1, name: 'You', balance: 15.50, avatar: '👤' },
    { id: 2, name: 'Sarah', balance: -12.20, avatar: '👩' },
    { id: 3, name: 'Mike', balance: 18.10, avatar: '👨' },
    { id: 4, name: 'Emma', balance: 12.20, avatar: '👧' },
  ];

  const addToAppleWallet = () => {
    // Mock implementation for adding to Apple Wallet
    console.log('Adding card to Apple Wallet');
    // In a real app, this would trigger the Apple Wallet API
  };

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50'}`}>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}
      >
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate('home')}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Card Details</h1>
        </div>
      </motion.div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        {/* Card Display */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.12 }}
          className="mb-6"
        >
          <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 rounded-2xl p-6 shadow-xl">
            <div className="flex items-start justify-between mb-8">
              <div>
                <p className="text-purple-200 text-xs mb-1">Virtual Group Card</p>
                <p className="text-white font-mono text-xl">4024 0071 9482 4829</p>
              </div>
              <CreditCard size={24} className="text-white/80" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-purple-200 text-xs mb-1">Expires</p>
                <p className="text-white font-mono">12/26</p>
              </div>
              <div>
                <p className="text-purple-200 text-xs mb-1">CVV</p>
                <p className="text-white font-mono">•••</p>
              </div>
            </div>
          </div>
          
          {/* Add to Apple Wallet Button */}
          <button 
            onClick={addToAppleWallet}
            className="w-full mt-4 bg-black rounded-xl p-3 active:scale-[0.98] transition-transform flex items-center justify-center gap-3"
          >
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Colorful wallet icon */}
              <rect x="8" y="10" width="24" height="20" rx="3" fill="#E8E8ED" />
              <rect x="8" y="10" width="24" height="4" fill="#34C759" />
              <rect x="8" y="14" width="24" height="4" fill="#007AFF" />
              <rect x="8" y="18" width="24" height="4" fill="#FF9500" />
              <rect x="8" y="22" width="24" height="4" fill="#FF3B30" />
              <path d="M20 26C20 28 18 30 16 30C18 30 20 32 20 34C20 32 22 30 24 30C22 30 20 28 20 26Z" fill="#FF2D55" />
            </svg>
            <div className="text-left">
              <p className="text-white font-semibold text-lg leading-tight">Add to</p>
              <p className="text-white font-semibold text-lg leading-tight">Apple Wallet</p>
            </div>
          </button>
        </motion.div>

        {/* Balance Summary */}
        <motion.div
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.12 }}
          className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-5 shadow-sm mb-6`}
        >
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-2`}>Total Balance</p>
          <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-800'} mb-4`}>$45.80</p>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {groupMembers.slice(0, 3).map((member) => (
                <div key={member.id} className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white flex items-center justify-center text-sm">
                  {member.avatar}
                </div>
              ))}
            </div>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {groupMembers.length} members in group
            </p>
          </div>
        </motion.div>

        {/* Group Members */}
        <motion.div
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.12 }}
          className="mb-6"
        >
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
            Group Members
          </h2>
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm`}>
            {groupMembers.map((member, index) => (
              <div 
                key={member.id}
                className={`flex items-center justify-between p-4 ${
                  index !== groupMembers.length - 1 ? `border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}` : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-lg">
                    {member.avatar}
                  </div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{member.name}</p>
                </div>
                <p className={`font-semibold ${member.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {member.balance >= 0 ? '+' : ''}${member.balance.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Transaction History */}
        <motion.div
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.12 }}
        >
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
            Recent Transactions
          </h2>
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div key={transaction.id} className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    transaction.type === 'charge' ? 'bg-red-100' : 'bg-green-100'
                  }`}>
                    {transaction.type === 'charge' ? (
                      <ArrowUpRight size={20} className="text-red-500" />
                    ) : (
                      <ArrowDownLeft size={20} className="text-green-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {transaction.description}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {transaction.user} • {transaction.date}
                    </p>
                  </div>
                  <p className={`font-bold ${
                    transaction.type === 'charge' ? 'text-red-500' : 'text-green-500'
                  }`}>
                    {transaction.type === 'charge' ? '-' : '+'}${transaction.amount.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}