import { motion } from 'motion/react';
import { ChevronLeft, Receipt, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { PageType } from '../App';

interface ActivityPageProps {
  onNavigate: (page: PageType, groupId?: number) => void;
  theme: 'light' | 'dark';
}

export function ActivityPage({ onNavigate, theme }: ActivityPageProps) {
  const isDark = theme === 'dark';
  
  const transactions = [
    { id: 1, type: 'paid', group: 'Lunch Squad', amount: 15.50, date: '2h ago', description: 'Pizza Palace' },
    { id: 2, type: 'received', group: 'Roommates', amount: 40.00, date: '1d ago', description: 'Utilities split' },
    { id: 3, type: 'paid', group: 'Office Lunch', amount: 22.00, date: '2d ago', description: 'Sushi Bar' },
    { id: 4, type: 'received', group: 'Lunch Squad', amount: 18.30, date: '3d ago', description: 'Coffee run' },
  ];

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50'}`}>
      {/* Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
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
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Activity</h1>
        </div>
      </motion.div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-3">
          {transactions.map((transaction, index) => (
            <motion.div
              key={transaction.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  transaction.type === 'paid' 
                    ? 'bg-red-100' 
                    : 'bg-green-100'
                }`}>
                  {transaction.type === 'paid' ? (
                    <ArrowUpRight size={20} className="text-red-500" strokeWidth={2.5} />
                  ) : (
                    <ArrowDownLeft size={20} className="text-green-500" strokeWidth={2.5} />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{transaction.description}</h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{transaction.group} • {transaction.date}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-lg ${
                    transaction.type === 'paid' 
                      ? 'text-red-500' 
                      : 'text-green-500'
                  }`}>
                    {transaction.type === 'paid' ? '-' : '+'}${transaction.amount.toFixed(2)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}