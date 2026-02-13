import { motion } from 'motion/react';
import { ChevronLeft, CreditCard, Copy, Receipt } from 'lucide-react';
import { PageType } from '../App';

interface CardDetailsPageProps {
  onNavigate: (page: PageType) => void;
  theme: 'light' | 'dark';
}

export function CardDetailsPage({ onNavigate, theme }: CardDetailsPageProps) {
  const isDark = theme === 'dark';

  const transactions = [
    { id: 1, description: 'Pizza Palace', amount: 15.50, date: '2h ago' },
    { id: 2, description: 'Coffee Shop', amount: 18.10, date: '1d ago' },
  ];

  const copyCardNumber = () => {
    try {
      navigator.clipboard.writeText('4024007194824829');
      // Show toast notification in real app
    } catch (error) {
      // Clipboard API not available or blocked
      console.log('Copy attempted: 4024007194824829');
    }
  };

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
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
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Card Details</h1>
        </div>
      </motion.div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        {/* Card Display */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="bg-gradient-to-br from-slate-700 to-blue-600 rounded-2xl p-6 shadow-xl">
            <div className="flex items-start justify-between mb-8">
              <div>
                <p className="text-blue-100 text-xs mb-1">Virtual Group Card</p>
                <p className="text-white font-mono text-xl">4024 0071 9482 4829</p>
              </div>
              <button 
                onClick={copyCardNumber}
                className="p-2 bg-white/20 rounded-lg active:scale-95 transition-transform"
              >
                <Copy size={20} className="text-white" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-blue-100 text-xs mb-1">Expires</p>
                <p className="text-white font-mono">12/26</p>
              </div>
              <div>
                <p className="text-blue-100 text-xs mb-1">CVV</p>
                <p className="text-white font-mono">•••</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Transaction History */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
            Recent Sessions
          </h2>
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div key={transaction.id} className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100">
                    <Receipt size={20} className="text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {transaction.description}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {transaction.date}
                    </p>
                  </div>
                  <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    ${transaction.amount.toFixed(2)}
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