import { ChevronLeft, CreditCard, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { PageType } from '../App';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface CardDetailsPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
  groupId?: string;
}

export function CardDetailsPage({ onNavigate, theme, groupId }: CardDetailsPageProps) {
  const { user, virtualCards } = useAuth();
  const [groupData, setGroupData] = useState<{
    name: string; cardLastFour: string; groupTotal: number;
    members: { id: string; name: string }[];
    allocations: { user_id: string; amount: number; name: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(!!groupId);

  const cardFromContext = groupId ? virtualCards.find(c => c.groupId === groupId) : null;

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      api.groups.get(groupId),
      api.groups.getBatch([groupId]),
    ]).then(([group, batch]) => {
      const b = batch[groupId];
      const receipts = b?.receipts ?? [];
      const txIds = receipts.map((r: any) => r.transaction_id).filter(Boolean);
      const total = cardFromContext?.groupTotal ?? 0;
      setGroupData({
        name: group.name,
        cardLastFour: group.cardLastFour ?? '0000',
        groupTotal: total,
        members: group.members,
        allocations: [],
      });
    }).catch(() => setGroupData(null)).finally(() => setLoading(false));
  }, [groupId, cardFromContext?.groupTotal]);

  const addToAppleWallet = () => {
    console.log('Adding card to Apple Wallet');
  };

  if (!groupId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5 bg-background">
        <p className="mb-4 text-muted-foreground">No card selected</p>
        <button onClick={() => onNavigate('home')} className="text-primary font-semibold">Back to Home</button>
      </div>
    );
  }

  if (loading || !groupData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const { name, cardLastFour, groupTotal, members } = groupData;

  return (
    <div className="h-full min-h-0 flex flex-col bg-background">
      <div className="bg-card border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft size={20} className="text-foreground" strokeWidth={2.5} />
          </button>
          <h1 className="text-2xl font-bold text-foreground">Card Details</h1>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="mb-6">
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-start justify-between mb-8">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Virtual Group Card</p>
                <p className="text-foreground font-mono text-xl tracking-wide">•••• •••• •••• {cardLastFour}</p>
              </div>
              <CreditCard size={24} className="text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Expires</p>
                <p className="text-foreground font-mono">12/26</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">CVV</p>
                <p className="text-foreground font-mono">•••</p>
              </div>
            </div>
          </div>

          <button
            onClick={addToAppleWallet}
            className="w-full mt-5 bg-foreground text-background rounded-xl p-3 active:scale-[0.98] transition-transform flex items-center justify-center gap-3"
          >
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="8" y="10" width="24" height="20" rx="3" fill="#E8E8ED" />
              <rect x="8" y="10" width="24" height="4" fill="#34C759" />
              <rect x="8" y="14" width="24" height="4" fill="#007AFF" />
              <rect x="8" y="18" width="24" height="4" fill="#FF9500" />
              <rect x="8" y="22" width="24" height="4" fill="#FF3B30" />
              <path d="M20 26C20 28 18 30 16 30C18 30 20 32 20 34C20 32 22 30 24 30C22 30 20 28 20 26Z" fill="#FF2D55" />
            </svg>
            <div className="text-left">
              <p className="font-semibold text-lg leading-tight">Add to</p>
              <p className="font-semibold text-lg leading-tight">Apple Wallet</p>
            </div>
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <p className="text-sm text-muted-foreground mb-2">Group Balance</p>
          <p className="text-3xl font-bold text-foreground tabular-nums mb-4">${groupTotal.toFixed(2)}</p>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {members.slice(0, 3).map((m) => (
                <div key={m.id} className="w-8 h-8 rounded-full bg-primary/20 border-2 border-card flex items-center justify-center text-sm text-foreground font-medium">
                  {m.name.charAt(0)}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {members.length} members in group
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Group Members
          </h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {members.map((m, index) => (
              <div
                key={m.id}
                className={`flex items-center justify-between p-4 ${index !== members.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-foreground font-medium">
                    {m.name.charAt(0)}
                  </div>
                  <p className="font-medium text-foreground">
                    {m.id === user?.id ? 'You' : m.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <button
            onClick={() => onNavigate('groupDetail', groupId)}
            className="w-full bg-card border border-border rounded-xl p-4 flex items-center justify-between active:scale-[0.99] transition-transform"
          >
            <span className="font-medium text-foreground">View Group Details</span>
            <ChevronLeft size={20} className="rotate-180 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}