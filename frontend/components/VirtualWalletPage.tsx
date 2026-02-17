import { motion } from 'motion/react';
import { ChevronLeft, CreditCard, Plus, Power, PowerOff } from 'lucide-react';
import { useMemo, useState, useCallback } from 'react';
import { PageType } from '../App';
import { useAuth } from '../contexts/AuthContext';

const CARD_COLORS = ['#3B82F6', '#A855F7', '#22C55E', '#F97316', '#EC4899'];

interface VirtualWalletPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
}

export function VirtualWalletPage({ onNavigate, theme }: VirtualWalletPageProps) {
  const isDark = theme === 'dark';
  const { virtualCards } = useAuth();
  const [deactivatedIds, setDeactivatedIds] = useState<Set<string>>(new Set());
  const cards = useMemo(() =>
    virtualCards.map((c, i) => ({
      id: c.groupId,
      group: c.groupName,
      cardNumber: c.cardLastFour ?? '0000',
      active: !deactivatedIds.has(c.groupId) && c.active,
      balance: c.groupTotal ?? 0,
      color: CARD_COLORS[i % CARD_COLORS.length],
    })),
    [virtualCards, deactivatedIds]
  );

  const toggleCardStatus = useCallback((groupId: string) => {
    setDeactivatedIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50'}`}>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}
      >
        <div className="flex items-center gap-3 mb-4">
          <button 
            onClick={() => onNavigate('home')}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Virtual Wallet</h1>
        </div>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Manage your group payment cards
        </p>
      </motion.div>

      {/* Cards List */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="space-y-4">
          {cards.map((card, index) => (
            <motion.div
              key={card.id}
              initial={{ x: -6, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.02, duration: 0.1 }}
              className={`relative rounded-2xl overflow-hidden ${card.active ? 'opacity-100' : 'opacity-60'}`}
            >
              {/* Card */}
              <div 
                className="p-5 shadow-xl"
                style={{ backgroundColor: card.color }}
              >
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <p className="text-white/80 text-xs mb-1">{card.group}</p>
                    <p className="text-white font-mono text-lg">•••• •••• •••• {card.cardNumber}</p>
                  </div>
                  <CreditCard size={24} className="text-white/70" />
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-white/80 text-xs mb-1">Balance</p>
                    <p className="text-white text-2xl font-bold">${card.balance.toFixed(2)}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full ${card.active ? 'bg-white/20' : 'bg-black/20'} backdrop-blur-sm`}>
                    <p className="text-white text-xs font-semibold">
                      {card.active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} p-4 flex items-center gap-3`}>
                <button 
                  onClick={() => onNavigate('cardDetails', card.id)}
                  className="flex-1 bg-gradient-to-r from-slate-600 to-blue-500 text-white py-2.5 rounded-lg font-medium active:scale-[0.98] transition-transform text-sm"
                >
                  View Details
                </button>
                <button 
                  onClick={() => toggleCardStatus(card.id)}
                  className={`px-4 py-2.5 rounded-lg font-medium active:scale-[0.98] transition-transform flex items-center gap-2 ${
                    card.active 
                      ? 'bg-red-100 text-red-600' 
                      : 'bg-green-100 text-green-600'
                  }`}
                >
                  {card.active ? <PowerOff size={18} /> : <Power size={18} />}
                  <span className="text-sm">{card.active ? 'Deactivate' : 'Activate'}</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Add New Card Button */}
      <motion.div
        initial={{ y: 6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.12 }}
        className="px-5 pb-6"
      >
        <button 
          onClick={() => onNavigate('createGroup')}
          className="w-full bg-gradient-to-r from-slate-600 to-blue-500 text-white py-4 rounded-xl font-semibold shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          <Plus size={24} strokeWidth={2.5} />
          Create New Group Card
        </button>
      </motion.div>
    </div>
  );
}