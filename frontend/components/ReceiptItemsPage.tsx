import { motion } from 'motion/react';
import { ChevronLeft, Check, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { PageType } from '../App';
import { api, type ParsedReceipt } from '../lib/api';
import { validateReceipt } from '../lib/receiptValidation';
import { useAuth } from '../contexts/AuthContext';
import { useReceiptClaimsRealtime } from '../hooks/useReceiptClaimsRealtime';

interface ReceiptItemsPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
  setReceiptData: (data: { members: Array<{ id: number; name: string; amount: number; avatar: string }>; total: number }) => void;
  setItemSplitData: (data: { hasSelectedItems: boolean; yourItemsTotal: number; receiptTotal?: number; subtotal?: number }) => void;
  receiptId?: string | null;
  groupId?: string | null;
  onSelectionConfirmed?: (groupId: string) => void;
}

interface Item {
  id: number;
  name: string;
  price: number;
  selectedBy: number[];
  _realId?: string;
}

interface Member {
  id: number;
  name: string;
  avatar: string;
  _realId?: string;
}

const MEMBER_AVATARS = ['👤', '👩', '👨', '👧', '🧑', '👦', '👩‍🦰', '🧔'];

export function ReceiptItemsPage({ onNavigate, theme, setReceiptData, setItemSplitData, receiptId, groupId, onSelectionConfirmed }: ReceiptItemsPageProps) {
  const isDark = theme === 'dark';
  const { user } = useAuth();
  
  const [members, setMembers] = useState<Member[]>([
    { id: 1, name: 'You', avatar: '👤' },
  ]);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(!!receiptId);
  const [realReceiptId, setRealReceiptId] = useState<string | null>(receiptId ?? null);
  const [receiptTotal, setReceiptTotal] = useState<number | null>(null);
  const [uploadedBy, setUploadedBy] = useState<string | null>(null);
  const [receiptStatus, setReceiptStatus] = useState<string>('');
  const [reviewReceipt, setReviewReceipt] = useState<ParsedReceipt | null>(null);
  const [confidenceMap, setConfidenceMap] = useState<Record<string, number | number[]> | null>(null);
  const [confirmingReview, setConfirmingReview] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const applyReceiptData = useCallback((data: any) => {
    setRealReceiptId(data.id);
    setUploadedBy((data as { uploaded_by?: string }).uploaded_by ?? null);
    const rt = (data as { total?: number | null }).total;
    setReceiptTotal(rt != null && !Number.isNaN(Number(rt)) ? Number(rt) : null);
    setReceiptStatus(data.status || '');
    if (data.confidence_map) setConfidenceMap(data.confidence_map);
    if (data.status === 'NEEDS_REVIEW' && data.parsed_output) {
      setReviewReceipt({
        merchantName: data.parsed_output.merchantName,
        receiptDate: data.parsed_output.receiptDate ?? null,
        totals: { ...data.parsed_output.totals },
        lineItems: data.parsed_output.lineItems.map((i) => ({ ...i })),
      });
    } else {
      setReviewReceipt(null);
    }
    const mappedMembers = data.members.map((m: { id: string; name: string }, i: number) => ({
      id: i + 1,
      name: m.id === user?.id ? 'You' : m.name,
      avatar: MEMBER_AVATARS[i % MEMBER_AVATARS.length],
      _realId: m.id,
    }));
    setMembers(mappedMembers);
    const mappedItems = data.items.map((item: { id: string; name: string; price: number }, i: number) => {
      const claimUserIds = data.claims[item.id] ?? [];
      const selectedBy = claimUserIds
        .map((uid: string) => mappedMembers.find(m => m._realId === uid)?.id)
        .filter((id): id is number => id !== undefined);
      return {
        id: i + 1,
        name: item.name,
        price: item.price,
        selectedBy,
        _realId: item.id,
      };
    });
    setItems(mappedItems);
  }, [user?.id]);

  const refetchReceipt = useCallback(() => {
    if (!receiptId) return;
    api.receipts.get(receiptId).then(applyReceiptData).catch(() => {});
  }, [receiptId, applyReceiptData]);

  useReceiptClaimsRealtime(receiptId ?? null, refetchReceipt);

  // Load receipt data from backend if receiptId is provided
  useEffect(() => {
    if (!receiptId) {
      setItems([{ id: 1, name: 'Item 1', price: 0, selectedBy: [] }]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api.receipts.get(receiptId).then(applyReceiptData).catch(() => {
      setItems([]);
    }).finally(() => setLoading(false));
  }, [receiptId, applyReceiptData]);

  const reviewValidation = useMemo(
    () => (reviewReceipt ? validateReceipt(reviewReceipt) : null),
    [reviewReceipt]
  );

  const suggestedSet = useMemo(
    () => new Set(reviewValidation?.suggestedFieldsToReview ?? []),
    [reviewValidation]
  );

  const isLowConfidence = (field: string, index?: number) => {
    if (!confidenceMap) return false;
    const v = confidenceMap[field];
    if (typeof v === 'number') return v < 0.6;
    if (Array.isArray(v) && typeof index === 'number') return (v[index] ?? 1) < 0.6;
    return false;
  };

  const [selectedMember, setSelectedMember] = useState<number>(1);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const toggleItemSelection = (itemId: number) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id === itemId) {
        const alreadySelected = item.selectedBy.includes(selectedMember);
        const newSelectedBy = alreadySelected
          ? item.selectedBy.filter(id => id !== selectedMember)
          : [...item.selectedBy, selectedMember];
        
        // Sync claims to backend if we have a real receipt
        if (realReceiptId && item._realId) {
          const realUserIds = newSelectedBy
            .map(fakeId => members.find(m => m.id === fakeId)?._realId)
            .filter((id): id is string => !!id);
          api.receipts.updateClaims(realReceiptId, item._realId, realUserIds).catch(() => {});
        }
        
        return { ...item, selectedBy: newSelectedBy };
      }
      return item;
    }));
  };

  const calculateTotal = () => {
    return items
      .filter(item => item.selectedBy.length > 0)
      .reduce((sum, item) => sum + item.price, 0);
  };

  const calculateMemberTotal = (memberId: number) => {
    return items.reduce((sum, item) => {
      if (item.selectedBy.includes(memberId)) {
        // Split the cost among all people who selected this item
        return sum + (item.price / item.selectedBy.length);
      }
      return sum;
    }, 0);
  };

  const allItemsSelected = items.every(item => item.selectedBy.length > 0);

  const handleSubmitClick = () => {
    if (allItemsSelected) {
      setShowConfirmation(true);
    }
  };

  const confirmSubmit = () => {
    // Only the receipt uploader can complete (finalize) the split
    if (realReceiptId && user?.id && uploadedBy && user.id === uploadedBy) {
      api.receipts.complete(realReceiptId).catch(() => {});
    }

    const subtotal = items.reduce((s, i) => s + i.price, 0);
    const storedReceiptTotal = receiptTotal != null && receiptTotal >= subtotal ? receiptTotal : subtotal;
    const receiptDataPayload = {
      members: members.map(member => ({
        id: member.id,
        name: member.name,
        amount: calculateMemberTotal(member.id),
        avatar: member.avatar
      })),
      total: calculateTotal()
    };
    setReceiptData(receiptDataPayload);
    
    // Find current user's member id (the one named "You")
    const myMember = members.find(m => m._realId === user?.id) ?? members[0];
    const yourTotal = calculateMemberTotal(myMember.id);
    setItemSplitData({
      hasSelectedItems: true,
      yourItemsTotal: yourTotal,
      receiptTotal: storedReceiptTotal,
      subtotal
    });
    
    setShowConfirmation(false);
    if (groupId) onSelectionConfirmed?.(groupId);
    // Navigate back to group detail
    onNavigate('groupDetail', groupId ?? undefined);
  };

  const addManualItem = () => {
    if (newItemName && newItemPrice) {
      const newPrice = parseFloat(newItemPrice);
      if (!isNaN(newPrice)) {
        const newItem: Item = {
          id: items.length + 1,
          name: newItemName,
          price: newPrice,
          selectedBy: []
        };
        // Add to backend if receipt exists
        if (realReceiptId) {
          api.receipts.addItem(realReceiptId, newItemName, newPrice)
            .then((item) => {
              newItem._realId = item.id;
            })
            .catch(() => {});
        }
        setItems([...items, newItem]);
        setNewItemName('');
        setNewItemPrice('');
        setShowManualEntry(false);
      }
    }
  };

  // Review receipt mode: edit parsed data, see live validation, confirm to finalize
  if (reviewReceipt && realReceiptId) {
    const updateTotals = (patch: Partial<ParsedReceipt['totals']>) => {
      setReviewReceipt((r) => (r ? { ...r, totals: { ...r.totals, ...patch } } : null));
    };
    const updateLineItem = (idx: number, patch: Partial<ParsedReceipt['lineItems'][0]>) => {
      setReviewReceipt((r) => {
        if (!r) return null;
        const next = [...r.lineItems];
        next[idx] = { ...next[idx], ...patch };
        return { ...r, lineItems: next };
      });
    };
    const addLineItem = () => {
      setReviewReceipt((r) => (r ? { ...r, lineItems: [...r.lineItems, { name: '', price: 0 }] } : null));
    };
    const removeLineItem = (idx: number) => {
      setReviewReceipt((r) => {
        if (!r || r.lineItems.length <= 1) return r;
        const next = r.lineItems.filter((_, i) => i !== idx);
        return { ...r, lineItems: next };
      });
    };
    const handleConfirmReview = () => {
      if (!reviewValidation?.isValid) return;
      setConfirmingReview(true);
      api.receipts
        .confirm(realReceiptId, reviewReceipt)
        .then(() => {
          setReviewReceipt(null);
          return api.receipts.get(realReceiptId);
        })
        .then((data) => {
          setReceiptStatus(data.status || '');
          const mappedMembers = data.members.map((m, j) => ({
            id: j + 1,
            name: m.id === user?.id ? 'You' : m.name,
            avatar: MEMBER_AVATARS[j % MEMBER_AVATARS.length],
            _realId: m.id,
          }));
          setMembers(mappedMembers);
          setItems(
            data.items.map((item, i) => {
              const claimUserIds = data.claims[item.id] ?? [];
              const selectedBy = claimUserIds
                .map((uid) => mappedMembers.find((m) => m._realId === uid)?.id)
                .filter((id): id is number => id !== undefined);
              return { id: i + 1, name: item.name, price: item.price, selectedBy, _realId: item.id };
            })
          );
        })
        .catch(() => {})
        .finally(() => setConfirmingReview(false));
    };
    const handleRetry = () => {
      setRetrying(true);
      api.receipts
        .retry(realReceiptId)
        .then((data) => {
          if (data.parsed_output) {
            setReviewReceipt({
              merchantName: data.parsed_output.merchantName,
              receiptDate: data.parsed_output.receiptDate ?? null,
              totals: { ...data.parsed_output.totals },
              lineItems: data.parsed_output.lineItems.map((i) => ({ ...i })),
            });
          }
          if (data.confidence_map) setConfidenceMap(data.confidence_map as Record<string, number | number[]>);
          setReceiptStatus(data.status || '');
        })
        .catch(() => {})
        .finally(() => setRetrying(false));
    };

    return (
      <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
        <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}>
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => onNavigate('receiptScan')}
              className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
            >
              <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
            </button>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Review Receipt</h1>
          </div>
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${reviewValidation?.isValid ? (isDark ? 'bg-green-900/30' : 'bg-green-50') : (isDark ? 'bg-amber-900/30' : 'bg-amber-50')}`}>
            {reviewValidation?.isValid ? (
              <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle size={20} className="text-amber-600 flex-shrink-0" />
            )}
            <span className={`text-sm font-medium ${reviewValidation?.isValid ? 'text-green-700' : 'text-amber-700'}`}>
              {reviewValidation?.isValid ? 'Reconciles ✓' : "Doesn't reconcile"}
            </span>
            {!reviewValidation?.isValid && (
              <span className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
                {reviewValidation?.issues.join(' ')}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {reviewReceipt.merchantName != null && (
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Merchant</label>
              <input
                type="text"
                value={reviewReceipt.merchantName}
                onChange={(e) => setReviewReceipt((r) => (r ? { ...r, merchantName: e.target.value } : null))}
                className={`w-full px-3 py-2 rounded-lg border ${isLowConfidence('merchantName') ? 'border-amber-500' : ''} ${isDark ? 'bg-slate-800 text-white border-slate-600' : 'bg-white text-slate-800 border-slate-200'}`}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Subtotal</label>
              <input
                type="number"
                step="0.01"
                value={reviewReceipt.totals.subtotal ?? ''}
                onChange={(e) => updateTotals({ subtotal: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                className={`w-full px-3 py-2 rounded-lg border ${suggestedSet.has('subtotal') ? 'border-amber-500' : ''} ${isDark ? 'bg-slate-800 text-white border-slate-600' : 'bg-white text-slate-800 border-slate-200'}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tax</label>
              <input
                type="number"
                step="0.01"
                value={reviewReceipt.totals.tax ?? ''}
                onChange={(e) => updateTotals({ tax: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                className={`w-full px-3 py-2 rounded-lg border ${suggestedSet.has('tax') ? 'border-amber-500' : ''} ${isDark ? 'bg-slate-800 text-white border-slate-600' : 'bg-white text-slate-800 border-slate-200'}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tip</label>
              <input
                type="number"
                step="0.01"
                value={reviewReceipt.totals.tip ?? ''}
                onChange={(e) => updateTotals({ tip: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                className={`w-full px-3 py-2 rounded-lg border ${suggestedSet.has('tip') ? 'border-amber-500' : ''} ${isDark ? 'bg-slate-800 text-white border-slate-600' : 'bg-white text-slate-800 border-slate-200'}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total</label>
              <input
                type="number"
                step="0.01"
                value={reviewReceipt.totals.total ?? ''}
                onChange={(e) => updateTotals({ total: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                className={`w-full px-3 py-2 rounded-lg border ${suggestedSet.has('total') ? 'border-amber-500' : ''} ${isDark ? 'bg-slate-800 text-white border-slate-600' : 'bg-white text-slate-800 border-slate-200'}`}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Line items</label>
              <button
                type="button"
                onClick={addLineItem}
                className={`text-sm font-medium ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}
              >
                + Add item
              </button>
            </div>
            <div className="space-y-2">
              {reviewReceipt.lineItems.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2 items-center rounded-lg p-2 ${isDark ? 'bg-slate-800' : 'bg-white'} border ${suggestedSet.has(`lineItems[${idx}].price`) ? 'border-amber-500' : 'border-transparent'}`}
                >
                  <input
                    type="text"
                    placeholder="Name"
                    value={item.name}
                    onChange={(e) => updateLineItem(idx, { name: e.target.value })}
                    className={`flex-1 min-w-0 px-3 py-2 rounded border ${isDark ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Price"
                    value={item.price || ''}
                    onChange={(e) => updateLineItem(idx, { price: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className={`w-20 px-3 py-2 rounded border ${isDark ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeLineItem(idx)}
                    className={`p-2 rounded ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                    aria-label="Remove item"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-t px-5 py-4 flex gap-2`}>
          {receiptStatus === 'FAILED' && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 ${isDark ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}
            >
              <RotateCcw size={18} />
              {retrying ? 'Retrying...' : 'Retry processing'}
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirmReview}
            disabled={!reviewValidation?.isValid || confirmingReview}
            className={`flex-1 py-4 rounded-xl font-semibold ${reviewValidation?.isValid && !confirmingReview ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white' : isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
          >
            {confirmingReview ? 'Saving...' : 'Confirm receipt'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}
      >
        <div className="flex items-center gap-3 mb-4">
          <button 
            onClick={() => onNavigate('groupDetail', groupId ?? undefined)}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <div className="flex-1">
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Split Items</h1>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Receipt • ${calculateTotal().toFixed(2)}
            </p>
          </div>
        </div>

        {receiptStatus === 'FAILED' && realReceiptId && (
          <div className={`mb-4 rounded-xl p-4 flex items-center justify-between ${isDark ? 'bg-amber-900/30 border border-amber-700' : 'bg-amber-50 border border-amber-200'}`}>
            <p className={`text-sm font-medium ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>Processing failed. You can retry or add items manually.</p>
            <button
              type="button"
              onClick={() => {
                setRetrying(true);
                api.receipts.retry(realReceiptId).then((data) => {
                  setReceiptStatus(data.status || '');
                  if (data.parsed_output) {
                    setReviewReceipt({
                      merchantName: data.parsed_output.merchantName,
                      receiptDate: data.parsed_output.receiptDate ?? null,
                      totals: { ...data.parsed_output.totals },
                      lineItems: data.parsed_output.lineItems.map((i) => ({ ...i })),
                    });
                  }
                  if (data.confidence_map) setConfidenceMap(data.confidence_map as Record<string, number | number[]>);
                }).catch(() => {}).finally(() => setRetrying(false));
              }}
              disabled={retrying}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${isDark ? 'bg-amber-700 text-white' : 'bg-amber-600 text-white'}`}
            >
              <RotateCcw size={18} />
              {retrying ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        )}

        {/* Member Selection */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {members.map((member) => (
            <button
              key={member.id}
              onClick={() => setSelectedMember(member.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full font-medium transition-all ${
                selectedMember === member.id
                  ? 'bg-gradient-to-r from-slate-600 to-blue-500 text-white shadow-lg'
                  : isDark
                    ? 'bg-slate-700 text-slate-300'
                    : 'bg-gray-200 text-slate-600'
              }`}
            >
              <span className="mr-2">{member.avatar}</span>
              {member.name}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <p className={`text-center mt-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading receipt items...</p>
        ) : items.length === 0 ? (
          <p className={`text-center mt-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No items. Add items manually below.</p>
        ) : null}
        <div className="space-y-3">{items.map((item, index) => {
          const isSelected = item.selectedBy.includes(selectedMember);
          const splitCount = item.selectedBy.length;
          const splitPrice = splitCount > 0 ? item.price / splitCount : item.price;

          return (
            <motion.button
              key={item.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              onClick={() => toggleItemSelection(item.id)}
              className={`w-full ${
                isDark ? 'bg-slate-800' : 'bg-white'
              } rounded-xl p-4 shadow-sm active:scale-[0.98] transition-all ${
                isSelected ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  isSelected 
                    ? 'bg-blue-500 border-blue-500' 
                    : isDark 
                      ? 'border-slate-600' 
                      : 'border-gray-300'
                }`}>
                  {isSelected && <Check size={16} className="text-white" strokeWidth={3} />}
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {item.name}
                  </p>
                  {splitCount > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex -space-x-1">
                        {item.selectedBy.map((memberId) => {
                          const member = members.find(m => m.id === memberId);
                          return (
                            <div 
                              key={memberId}
                              className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border border-white flex items-center justify-center text-xs"
                            >
                              {member?.avatar}
                            </div>
                          );
                        })}
                      </div>
                      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Split {splitCount} {splitCount === 1 ? 'way' : 'ways'}
                      </p>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    ${item.price.toFixed(2)}
                  </p>
                  {splitCount > 0 && (
                    <p className="text-xs text-blue-500 font-medium">
                      ${splitPrice.toFixed(2)} each
                    </p>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
        </div>

        {/* Manual Entry */}
        {showManualEntry && (
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Item Name"
                className={`w-full px-4 py-2 rounded-xl ${isDark ? 'bg-slate-800 text-white' : 'bg-gray-100 text-slate-800'} border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              <input
                type="text"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="Price"
                className={`w-full px-4 py-2 rounded-xl ${isDark ? 'bg-slate-800 text-white' : 'bg-gray-100 text-slate-800'} border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              <button
                onClick={addManualItem}
                className={`px-4 py-2 rounded-xl font-semibold shadow-lg transition-all ${
                  isDark
                    ? 'bg-gradient-to-r from-slate-600 to-blue-500 text-white active:scale-[0.98]'
                    : 'bg-blue-500 text-white active:scale-[0.98]'
                }`}
              >
                Add
              </button>
            </div>
          </div>
        )}
        {!showManualEntry && (
          <button
            onClick={() => setShowManualEntry(true)}
            className={`w-full py-4 rounded-xl font-semibold shadow-lg transition-all ${
              isDark
                ? 'bg-gradient-to-r from-slate-600 to-blue-500 text-white active:scale-[0.98]'
                : 'bg-blue-500 text-white active:scale-[0.98]'
            }`}
          >
            Add Manual Item
          </button>
        )}
      </div>

      {/* Summary Bar */}
      <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-t px-5 py-4`}>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {members.find(m => m.id === selectedMember)?.name}'s Total
            </p>
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
              ${calculateMemberTotal(selectedMember).toFixed(2)}
            </p>
          </div>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'} mb-2`}>
            Items total: ${items.reduce((s, i) => s + i.price, 0).toFixed(2)}
            {receiptTotal != null && receiptTotal > items.reduce((s, i) => s + i.price, 0) && (
              <span className="ml-1">• Receipt total: ${receiptTotal.toFixed(2)}</span>
            )}
          </p>
          {!allItemsSelected && (
            <p className="text-xs text-orange-500">
              ⚠️ All items must be selected before submitting
            </p>
          )}
        </div>
        <button
          onClick={handleSubmitClick}
          disabled={!allItemsSelected}
          className={`w-full py-4 rounded-xl font-semibold shadow-lg transition-all ${
            allItemsSelected
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white active:scale-[0.98]'
              : isDark 
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Confirm Selections
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-5 z-50">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 max-w-sm w-full shadow-2xl`}
          >
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'} mb-2`}>
              Confirm Item Selections?
            </h2>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
              Review each member's selections. You'll add tip and complete payment on the next screen.
            </p>
            
            {/* Member breakdown */}
            <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} rounded-xl p-4 mb-6 space-y-2`}>
              {members.map(member => {
                const amount = calculateMemberTotal(member.id);
                if (amount > 0) {
                  return (
                    <div key={member.id} className="flex justify-between items-center">
                      <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {member.avatar} {member.name}
                      </span>
                      <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        ${amount.toFixed(2)}
                      </span>
                    </div>
                  );
                }
                return null;
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all ${isDark ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'} active:scale-[0.98]`}
              >
                Cancel
              </button>
              <button
                onClick={confirmSubmit}
                className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg active:scale-[0.98] transition-all"
              >
                Confirm Selection
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}