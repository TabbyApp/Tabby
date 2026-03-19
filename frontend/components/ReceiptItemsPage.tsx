import { motion } from 'motion/react';
import { ChevronLeft, Check, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { PageType } from '../App';
import { api, type ParsedReceipt } from '../lib/api';
import { validateReceipt } from '../lib/receiptValidation';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
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
/** Colors for "who claimed" dots on item cards (reference design) */
const MEMBER_DOT_COLORS = ['#22C55E', '#3B82F6', '#A855F7', '#F97316', '#EC4899', '#14B8A6'];

export function ReceiptItemsPage({ onNavigate, theme, setReceiptData, setItemSplitData, receiptId, groupId, onSelectionConfirmed }: ReceiptItemsPageProps) {
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
    // Default to current user's member for item selection (not creator)
    const myMember = mappedMembers.find((m: { _realId?: string }) => m._realId === user?.id);
    if (myMember) setSelectedMember(myMember.id);
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

  const { lastGroupUpdatedId, lastGroupUpdatedAt, lastReceiptClaimsUpdated } = useSocket();
  useEffect(() => {
    if (!receiptId || !lastReceiptClaimsUpdated || lastReceiptClaimsUpdated.receiptId !== receiptId) return;
    refetchReceipt();
  }, [receiptId, lastReceiptClaimsUpdated?.at, refetchReceipt]);
  useEffect(() => {
    if (!receiptId || !groupId || lastGroupUpdatedId !== groupId || lastGroupUpdatedAt === 0) return;
    api.receipts.get(receiptId).then((r) => {
      applyReceiptData(r);
      if (r.status === 'completed') {
        refetchReceipt();
        // Reroute members to group detail so they see the same "add tip" view as the host (read-only tip, their total)
        onSelectionConfirmed?.(groupId);
        onNavigate('groupDetail', groupId);
      }
    }).catch(() => {});
  }, [groupId, lastGroupUpdatedId, lastGroupUpdatedAt, receiptId, applyReceiptData, refetchReceipt, onNavigate]);

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

  // Only host can interact while receipt is in NEEDS_REVIEW/UPLOADED; after host confirms (DONE), everyone can select items
  const canSelectItems = user?.id === uploadedBy || !['NEEDS_REVIEW', 'UPLOADED'].includes(receiptStatus);
  const waitingForHostConfirm = !canSelectItems && !!uploadedBy && user?.id !== uploadedBy;

  const isSelectedMemberMe = members.some(m => m.id === selectedMember && m._realId === user?.id);

  const toggleItemSelection = (itemId: number) => {
    if (!canSelectItems || !isSelectedMemberMe) return;
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
        return sum + (item.price / item.selectedBy.length);
      }
      return sum;
    }, 0);
  };

  // Tax logic: tax = receipt total − items subtotal; each person's share of tax is proportional to their items
  const itemsSubtotal = items.reduce((s, i) => s + i.price, 0);
  const tax =
    receiptTotal != null && receiptTotal >= itemsSubtotal && itemsSubtotal > 0
      ? receiptTotal - itemsSubtotal
      : 0;
  const taxRatio = itemsSubtotal > 0 ? tax / itemsSubtotal : 0;
  const getMemberTaxShare = (memberId: number) => calculateMemberTotal(memberId) * taxRatio;
  const getMemberTotalWithTax = (memberId: number) =>
    calculateMemberTotal(memberId) + getMemberTaxShare(memberId);

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
      <div className="h-full min-h-0 flex flex-col bg-background overflow-hidden">
        <div className="bg-card border-border border-b px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => onNavigate('receiptScan')}
              className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
            >
              <ChevronLeft size={20} className="text-foreground" strokeWidth={2.5} />
            </button>
            <h1 className="text-xl font-bold text-foreground">Review Receipt</h1>
          </div>
          <div className="flex justify-center mb-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-success/20 border border-success/40 px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-success shrink-0" />
              <span className="text-sm font-medium text-success">Scanned Receipt</span>
            </div>
          </div>
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${reviewValidation?.isValid ? 'bg-success/10' : 'bg-destructive/10'}`}>
            {reviewValidation?.isValid ? (
              <CheckCircle2 size={20} className="text-success flex-shrink-0" />
            ) : (
              <AlertCircle size={20} className="text-destructive flex-shrink-0" />
            )}
            <span className={`text-sm font-medium ${reviewValidation?.isValid ? 'text-success' : 'text-destructive'}`}>
              {reviewValidation?.isValid ? 'Reconciles ✓' : "Doesn't reconcile"}
            </span>
            {!reviewValidation?.isValid && (
              <span className="text-xs text-destructive">
                {reviewValidation?.issues.join(' ')}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-4">
          {reviewReceipt.merchantName != null && (
            <div>
              <label className={`block text-xs font-medium mb-1 text-muted-foreground`}>Merchant</label>
              <input
                type="text"
                value={reviewReceipt.merchantName}
                onChange={(e) => setReviewReceipt((r) => (r ? { ...r, merchantName: e.target.value } : null))}
                className={`w-full px-3 py-2 rounded-lg border ${isLowConfidence('merchantName') ? 'border-amber-500' : ''} bg-card text-foreground border-border`}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-medium mb-1 text-muted-foreground`}>Subtotal</label>
              <input
                type="number"
                step="0.01"
                value={reviewReceipt.totals.subtotal ?? ''}
                onChange={(e) => updateTotals({ subtotal: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                className={`w-full px-3 py-2 rounded-lg border ${suggestedSet.has('subtotal') ? 'border-amber-500' : ''} bg-card text-foreground border-border`}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 text-muted-foreground`}>Tax</label>
              <input
                type="number"
                step="0.01"
                value={reviewReceipt.totals.tax ?? ''}
                onChange={(e) => updateTotals({ tax: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                className={`w-full px-3 py-2 rounded-lg border ${suggestedSet.has('tax') ? 'border-amber-500' : ''} bg-card text-foreground border-border`}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 text-muted-foreground`}>Tip</label>
              <input
                type="number"
                step="0.01"
                value={reviewReceipt.totals.tip ?? ''}
                onChange={(e) => updateTotals({ tip: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                className={`w-full px-3 py-2 rounded-lg border ${suggestedSet.has('tip') ? 'border-amber-500' : ''} bg-card text-foreground border-border`}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 text-muted-foreground`}>Total</label>
              <input
                type="number"
                step="0.01"
                value={reviewReceipt.totals.total ?? ''}
                onChange={(e) => updateTotals({ total: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                className={`w-full px-3 py-2 rounded-lg border ${suggestedSet.has('total') ? 'border-amber-500' : ''} bg-card text-foreground border-border`}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-foreground">Line items</label>
              <button
                type="button"
                onClick={addLineItem}
                className="text-sm font-medium text-success"
              >
                + Add item
              </button>
            </div>
            <div className="space-y-3">
              {reviewReceipt.lineItems.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 rounded-2xl p-4 bg-card border ${suggestedSet.has(`lineItems[${idx}].price`) ? 'border-amber-500' : 'border-border'}`}
                >
                  <input
                    type="text"
                    placeholder="Item name"
                    value={item.name}
                    onChange={(e) => updateLineItem(idx, { name: e.target.value })}
                    className="flex-1 min-w-0 bg-transparent text-foreground font-medium placeholder:text-muted-foreground focus:outline-none"
                  />
                  <div className="flex items-center gap-0">
                    <span className="text-success font-semibold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={item.price || ''}
                      onChange={(e) => updateLineItem(idx, { price: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                      className="w-20 text-right bg-transparent text-success font-semibold tabular-nums placeholder:text-muted-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLineItem(idx)}
                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
                    aria-label="Remove item"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {reviewReceipt.lineItems.length > 0 && (
              <div className="mt-4 rounded-2xl bg-success/20 border border-success/30 p-4 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Subtotal</span>
                <span className="text-lg font-bold text-foreground tabular-nums">
                  ${reviewReceipt.lineItems.reduce((s, i) => s + (Number(i.price) || 0), 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className={`bg-card border-border border-t px-5 py-4 flex gap-2 flex-shrink-0`}>
          {receiptStatus === 'FAILED' && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 bg-secondary text-foreground`}
            >
              <RotateCcw size={18} />
              {retrying ? 'Retrying...' : 'Retry processing'}
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirmReview}
            disabled={!reviewValidation?.isValid || confirmingReview}
            className={`flex-1 py-4 rounded-xl font-semibold ${reviewValidation?.isValid && !confirmingReview ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground cursor-not-allowed'}`}
          >
            {confirmingReview ? 'Saving...' : 'Confirm receipt'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-background overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-card border-border border-b px-5 py-4"
      >
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => onNavigate('groupDetail', groupId ?? undefined)}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft size={20} className="text-foreground" strokeWidth={2.5} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Split Items</h1>
            <p className="text-sm text-muted-foreground">
              Receipt • ${calculateTotal().toFixed(2)}
            </p>
          </div>
        </div>

        {!waitingForHostConfirm && canSelectItems && (
          <div className="flex justify-center mb-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-success/20 border border-success/40 px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-success shrink-0" />
              <span className="text-sm font-medium text-success">Tap items to claim</span>
            </div>
          </div>
        )}

        {waitingForHostConfirm && (
          <div className="mb-4 rounded-xl p-4 bg-destructive/10 border border-border">
            <p className="text-sm font-medium text-destructive">
              Waiting for host to confirm receipt. You can select your items once they confirm.
            </p>
          </div>
        )}
        {receiptStatus === 'FAILED' && realReceiptId && (
          <div className="mb-4 rounded-xl p-4 flex items-center justify-between bg-destructive/10 border border-border">
            <p className="text-sm font-medium text-destructive">Processing failed. You can retry or add items manually.</p>
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
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-destructive text-destructive-foreground"
            >
              <RotateCcw size={18} />
              {retrying ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2">
          {members.map((member, mi) => (
            <button
              key={member.id}
              onClick={() => setSelectedMember(member.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full font-medium transition-all ${
                selectedMember === member.id
                  ? 'bg-success/20 text-success border border-success/40'
                  : 'bg-secondary text-muted-foreground'
              }`}
            >
              <span className="mr-2">{member.avatar}</span>
              {member.name}
            </button>
          ))}
        </div>
      </motion.div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
        {loading ? (
          <p className="text-center mt-8 text-muted-foreground">Loading receipt items...</p>
        ) : items.length === 0 ? (
          <p className="text-center mt-8 text-muted-foreground">No items. Add items manually below.</p>
        ) : null}
        <div className="space-y-4">
          {items.map((item, index) => {
            const isSelected = item.selectedBy.includes(selectedMember);
            const splitCount = item.selectedBy.length;
            const splitPrice = splitCount > 0 ? item.price / splitCount : item.price;
            const firstClaimerId = item.selectedBy[0];
            const firstClaimer = firstClaimerId != null ? members.find(m => m.id === firstClaimerId) : null;
            const dotColor = firstClaimerId != null
              ? MEMBER_DOT_COLORS[members.findIndex(m => m.id === firstClaimerId) % MEMBER_DOT_COLORS.length]
              : undefined;
            const claimerNames = item.selectedBy
              .map((id) => members.find((m) => m.id === id)?.name)
              .filter((n): n is string => !!n);
            const claimerLabel = splitCount > 0
              ? claimerNames.length <= 3
                ? claimerNames.join(', ')
                : `${claimerNames.slice(0, 2).join(', ')} +${splitCount - 2}`
              : '';

            return (
              <motion.button
                key={item.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                onClick={() => toggleItemSelection(item.id)}
                disabled={!canSelectItems || !isSelectedMemberMe}
                className={`w-full text-left rounded-2xl p-4 transition-all border ${
                  isSelected ? 'bg-card border-success/50 ring-2 ring-success/30' : 'bg-card border-border'
                } ${!canSelectItems || !isSelectedMemberMe ? 'opacity-75 cursor-default' : 'active:scale-[0.99]'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {dotColor != null ? (
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: dotColor }}
                      />
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-muted shrink-0" />
                    )}
                    <p className="font-medium text-foreground truncate">{item.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {splitCount > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground">{claimerLabel}</p>
                        {splitCount > 1 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {splitCount} people splitting · ${splitPrice.toFixed(2)} each
                          </p>
                        )}
                      </>
                    )}
                    <p className="font-semibold text-success tabular-nums">${item.price.toFixed(2)}</p>
                  </div>
                </div>
                {isSelected && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <Check size={14} className="text-success shrink-0" />
                    <span className="text-xs font-medium text-success">Claimed by you</span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Manual Entry */}
        {showManualEntry && (
          <div className="mt-8">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Item Name"
                className="w-full px-4 py-2 rounded-xl bg-secondary text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="Price"
                className="w-full px-4 py-2 rounded-xl bg-secondary text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={addManualItem}
                className="px-4 py-2 rounded-xl font-semibold bg-primary text-primary-foreground active:scale-[0.98] transition-transform"
              >
                Add
              </button>
            </div>
          </div>
        )}
        {!showManualEntry && (
          <button
            onClick={() => setShowManualEntry(true)}
            className="w-full mt-8 py-3.5 rounded-xl font-medium bg-card border border-border text-foreground active:scale-[0.99] transition-transform"
          >
            Add Manual Item
          </button>
        )}
      </div>

      <div className="bg-card border-border border-t px-5 py-4 flex-shrink-0">
        <div className="rounded-2xl bg-success/20 border border-success/30 p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {members.find(m => m.id === selectedMember)?.name}'s Total
            </span>
            <span className="text-xl font-bold text-foreground tabular-nums">
              ${getMemberTotalWithTax(selectedMember).toFixed(2)}
            </span>
          </div>
          {tax > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Includes ${getMemberTaxShare(selectedMember).toFixed(2)} tax (proportional)
            </p>
          )}
        </div>
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-2">
            Items subtotal: ${itemsSubtotal.toFixed(2)}
            {receiptTotal != null && tax > 0 && (
              <span className="ml-1">• Tax: ${tax.toFixed(2)} • Receipt total: ${receiptTotal.toFixed(2)}</span>
            )}
            {receiptTotal != null && tax <= 0 && receiptTotal > itemsSubtotal && (
              <span className="ml-1">• Receipt total: ${receiptTotal.toFixed(2)}</span>
            )}
          </p>
          {!allItemsSelected && (
            <p className="text-xs text-destructive">
              ⚠️ All items must be selected before submitting
            </p>
          )}
          {user?.id !== uploadedBy && uploadedBy && (
            <p className={`text-xs mt-2 text-muted-foreground`}>
              Only the receipt uploader can confirm. Select your items; the host will complete payment.
            </p>
          )}
        </div>
        {user?.id === uploadedBy ? (
          <button
            onClick={handleSubmitClick}
            disabled={!allItemsSelected}
            className={`w-full py-4 rounded-xl font-semibold transition-all ${
              allItemsSelected
                ? 'bg-primary text-primary-foreground active:scale-[0.98]'
                : 'bg-secondary text-muted-foreground cursor-not-allowed'
            }`}
          >
            Confirm Selections
          </button>
        ) : null}
      </div>

      {/* Confirmation Modal - only uploader can open (button above is hidden for others) */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-5 z-50">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl`}
          >
            <h2 className={`text-xl font-bold text-foreground mb-2`}>
              Confirm Item Selections?
            </h2>
            <p className={`text-sm text-muted-foreground mb-6`}>
              Review each member's selections. You'll add tip and complete payment on the next screen.
            </p>
            
            {/* Member breakdown (items + proportional tax) */}
            <div className="bg-secondary rounded-xl p-4 mb-6 space-y-2">
              {members.map(member => {
                const itemsOnly = calculateMemberTotal(member.id);
                if (itemsOnly <= 0) return null;
                const totalWithTax = getMemberTotalWithTax(member.id);
                const taxShare = getMemberTaxShare(member.id);
                return (
                  <div key={member.id} className="flex justify-between items-center">
                    <span className="text-sm text-foreground">
                      {member.avatar} {member.name}
                    </span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      ${totalWithTax.toFixed(2)}
                      {taxShare > 0 && (
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          (incl. ${taxShare.toFixed(2)} tax)
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all bg-secondary text-foreground active:scale-[0.98]`}
              >
                Cancel
              </button>
              <button
                onClick={confirmSubmit}
                className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform"
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
