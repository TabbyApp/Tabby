import { motion } from 'motion/react';
import { ChevronLeft, Check, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { PageType, PageState } from '../App';

interface ReceiptItemsPageProps {
  receiptId: string;
  groupId: string;
  onNavigate: (target: PageType | PageState) => void;
  theme: 'light' | 'dark';
}

interface Item {
  id: string;
  name: string;
  price: number;
}

interface Member {
  id: string;
  name: string;
  email: string;
}

export function ReceiptItemsPage({ receiptId, groupId, onNavigate, theme }: ReceiptItemsPageProps) {
  const isDark = theme === 'dark';
  const { user } = useAuth();
  const [receipt, setReceipt] = useState<{
    items: Item[];
    claims: Record<string, string[]>;
    members: Member[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReceipt = () => {
    setError(null);
    setLoading(true);
    api.receipts
      .get(receiptId)
      .then((r) => {
        setReceipt({
          items: r.items,
          claims: r.claims || {},
          members: r.members,
        });
        if (!selectedMemberId && r.members.length > 0) {
          setSelectedMemberId(r.members[0].id);
        }
      })
      .catch((err) => {
        setReceipt(null);
        setError(err instanceof Error ? err.message : 'Failed to load receipt');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReceipt();
  }, [receiptId]);

  const toggleClaim = (itemId: string, userId: string) => {
    if (!receipt) return;
    const current = receipt.claims[itemId] || [];
    const next = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    api.receipts
      .updateClaims(receiptId, itemId, next)
      .then(() => {
        setReceipt({
          ...receipt,
          claims: { ...receipt.claims, [itemId]: next },
        });
      })
      .catch(() => {
        // Keep UI in sync - revert optimistic update on failure
        setReceipt({ ...receipt });
      });
  };

  const addItem = () => {
    const name = newItemName.trim();
    const price = parseFloat(newItemPrice);
    if (!name || isNaN(price) || price < 0) return;
    setAddingItem(true);
    api.receipts
      .addItem(receiptId, name, price)
      .then(() => {
        setNewItemName('');
        setNewItemPrice('');
        fetchReceipt();
      })
      .catch(() => {
        // fetchReceipt to refresh state; addItem failed
        fetchReceipt();
      })
      .finally(() => setAddingItem(false));
  };

  const total = receipt?.items.reduce((s, i) => s + i.price, 0) ?? 0;

  const getMemberTotal = (memberId: string) => {
    if (!receipt) return 0;
    return receipt.items.reduce((sum, item) => {
      const claimers = receipt.claims[item.id] || [];
      if (!claimers.includes(memberId)) return sum;
      return sum + item.price / claimers.length;
    }, 0);
  };

  const allItemsClaimed =
    receipt &&
    receipt.items.length > 0 &&
    receipt.items.every((item) => (receipt.claims[item.id] || []).length > 0);

  const handleComplete = () => {
    if (!allItemsClaimed) return;
    setSubmitting(true);
    api.receipts
      .complete(receiptId)
      .then(({ splits }) => {
        onNavigate({ page: 'processing', groupId, splits });
      })
      .catch(() => setSubmitting(false))
      .finally(() => setSubmitting(false));
  };

  if (error) {
    return (
      <div className={`h-[calc(100vh-48px-24px)] flex flex-col items-center justify-center px-6 ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
        <p className={`text-center mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{error}</p>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate({ page: 'groupDetail', groupId })}
            className={`px-4 py-2 rounded-xl font-medium ${isDark ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-800'}`}
          >
            Go back
          </button>
          <button
            onClick={fetchReceipt}
            className="px-4 py-2 rounded-xl font-medium bg-blue-500 text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading || !receipt) {
    return (
      <div className={`h-[calc(100vh-48px-24px)] flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
        <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Loading...</p>
      </div>
    );
  }

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}
      >
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => onNavigate({ page: 'groupDetail', groupId })}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <div className="flex-1">
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Split Items</h1>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Total: ${total.toFixed(2)}
            </p>
          </div>
        </div>

        {receipt.members.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {receipt.members.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMemberId(m.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full font-medium ${
                  selectedMemberId === m.id
                    ? 'bg-gradient-to-r from-slate-600 to-blue-500 text-white'
                    : isDark
                      ? 'bg-slate-700 text-slate-300'
                      : 'bg-gray-200 text-slate-600'
                }`}
              >
                {m.id === user?.id ? 'You' : m.name}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Add item */}
        <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 mb-4`}>
          <p className={`text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Add items from your receipt
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Item name"
              className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                isDark ? 'bg-slate-700 text-white' : 'bg-gray-100 text-slate-800'
              }`}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(e.target.value)}
              placeholder="Price"
              className={`w-20 px-3 py-2 rounded-lg text-sm ${
                isDark ? 'bg-slate-700 text-white' : 'bg-gray-100 text-slate-800'
              }`}
            />
            <button
              onClick={addItem}
              disabled={addingItem || !newItemName.trim() || !newItemPrice}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {receipt.items.length === 0 && (
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            No items yet. Add each line from your receipt above.
          </p>
        )}

        <div className="space-y-3">
          {receipt.items.map((item, index) => {
            const claimers = receipt.claims[item.id] || [];
            const isSelected = selectedMemberId ? claimers.includes(selectedMemberId) : false;
            const splitCount = claimers.length;
            const splitPrice = splitCount > 0 ? item.price / splitCount : item.price;

            return (
              <motion.button
                key={item.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() =>
                  selectedMemberId &&
                  toggleClaim(item.id, selectedMemberId)
                }
                className={`w-full text-left ${
                  isDark ? 'bg-slate-800' : 'bg-white'
                } rounded-xl p-4 ${
                  isSelected ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isSelected ? 'bg-blue-500 border-blue-500' : isDark ? 'border-slate-600' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <Check size={16} className="text-white" strokeWidth={3} />}
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.name}</p>
                    {splitCount > 0 && (
                      <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Split {splitCount} {splitCount === 1 ? 'way' : 'ways'} · ${splitPrice.toFixed(2)} each
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      ${item.price.toFixed(2)}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-t px-5 py-4`}>
        {selectedMemberId && (
          <div className="mb-3">
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {receipt.members.find((m) => m.id === selectedMemberId)?.id === user?.id
                ? 'Your total'
                : `${receipt.members.find((m) => m.id === selectedMemberId)?.name}'s total`}
            </p>
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
              ${getMemberTotal(selectedMemberId).toFixed(2)}
            </p>
          </div>
        )}
        {receipt.items.length > 0 && !allItemsClaimed && (
          <p className="text-xs text-orange-500 mb-2">All items must be assigned before submitting</p>
        )}
        <button
          onClick={handleComplete}
          disabled={!allItemsClaimed || submitting}
          className={`w-full py-4 rounded-xl font-semibold ${
            allItemsClaimed && !submitting
              ? 'bg-gradient-to-r from-slate-600 to-blue-500 text-white'
              : isDark
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {submitting ? 'Processing...' : 'Submit & Save Split'}
        </button>
      </div>
    </div>
  );
}
