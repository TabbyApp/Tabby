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
  const { virtualCards } = useAuth();
  const [deactivatedIds, setDeactivatedIds] = useState<Set<string>>(new Set());
  const cards = useMemo(() =>
    virtualCards.map((c, i) => ({
      id: c.groupId,
      group: c.groupName,
      cardNumber: c.cardLastFour ?? '0000',
      active: !deactivatedIds.has(c.groupId) && c.active,
      balance: c.groupTotal ?? 0,
      accentColor: CARD_COLORS[i % CARD_COLORS.length],
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
    <div className="h-full flex flex-col bg-background">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-card border-b border-border px-5 py-4"
      >
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => onNavigate('home')}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft size={20} className="text-foreground" strokeWidth={2.5} />
          </button>
          <h1 className="text-2xl font-bold text-foreground">Virtual Wallet</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage your group payment cards
        </p>
      </motion.div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="space-y-4">
          {cards.map((card, index) => (
            <motion.div
              key={card.id}
              initial={{ x: -6, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.02, duration: 0.1 }}
              className={`relative rounded-2xl overflow-hidden border border-border ${card.active ? 'opacity-100' : 'opacity-60'}`}
            >
              <div
                className="p-5 bg-card"
                style={{ borderLeft: `4px solid ${card.accentColor}` }}
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">{card.group}</p>
                    <p className="text-foreground font-mono text-lg tracking-wide">•••• •••• •••• {card.cardNumber}</p>
                  </div>
                  <CreditCard size={24} className="text-muted-foreground" strokeWidth={1.5} />
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Balance</p>
                    <p className="text-foreground text-2xl font-bold tabular-nums">${card.balance.toFixed(2)}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${card.active ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>
                    {card.active ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>

              <div className="bg-card border-t border-border p-4 flex items-center gap-3">
                <button
                  onClick={() => onNavigate('cardDetails', card.id)}
                  className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg font-medium active:scale-[0.98] transition-transform text-sm"
                >
                  View Details
                </button>
                <button
                  onClick={() => toggleCardStatus(card.id)}
                  className={`px-4 py-2.5 rounded-lg font-medium active:scale-[0.98] transition-transform flex items-center gap-2 text-sm ${
                    card.active ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                  }`}
                >
                  {card.active ? <PowerOff size={18} /> : <Power size={18} />}
                  {card.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ y: 6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.12 }}
        className="px-5 pb-6"
      >
        <button
          onClick={() => onNavigate('createGroup')}
          className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-semibold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          <Plus size={24} strokeWidth={2.5} />
          Create New Group Card
        </button>
      </motion.div>
    </div>
  );
}