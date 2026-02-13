import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { PageType, PageState } from '../App';

interface TransactionAllocationPageProps {
  transactionId: string;
  groupId: string;
  onNavigate: (target: PageType | PageState) => void;
  theme: 'light' | 'dark';
}

export function TransactionAllocationPage({ transactionId, groupId, onNavigate, theme }: TransactionAllocationPageProps) {
  const isDark = theme === 'dark';
  const { user } = useAuth();
  const [tx, setTx] = useState<{
    status: string;
    split_mode: string;
    tip_amount: number;
    subtotal: number;
    total: number;
    allocation_deadline_at: string | null;
    created_by: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tipInput, setTipInput] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const load = useCallback(() => {
    api.transactions.get(transactionId).then((data) => {
      setTx(data);
      setTipInput(data.tip_amount ?? 0);
    }).catch(() => setTx(null)).finally(() => setLoading(false));
  }, [transactionId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!tx?.allocation_deadline_at) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(tx.allocation_deadline_at!).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tx?.allocation_deadline_at]);

  const isCreator = user?.id === tx?.created_by;

  const handleTipChange = (v: number) => {
    if (!isCreator) return;
    setTipInput(v);
    api.transactions.setTip(transactionId, v).then(() => load()).catch(() => {});
  };

  const handleConfirm = () => {
    setSubmitting(true);
    api.transactions.finalize(transactionId)
      .then(({ allocations }) => {
        onNavigate({ page: 'processing', groupId, transactionId, splits: allocations });
      })
      .catch(() => setSubmitting(false))
      .finally(() => setSubmitting(false));
  };

  if (loading || !tx) {
    return (
      <div className={`h-[calc(100vh-48px-24px)] flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
        <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Loading...</p>
      </div>
    );
  }

  if (tx.status !== 'PENDING_ALLOCATION') {
    return (
      <div className={`h-[calc(100vh-48px-24px)] flex flex-col items-center justify-center px-5 ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
        <p className={`text-center mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          This transaction has already been {tx.status === 'SETTLED' ? 'settled' : 'finalized'}.
        </p>
        <button
          onClick={() => onNavigate({ page: 'groupDetail', groupId })}
          className="px-4 py-2 rounded-xl font-medium bg-purple-600 text-white"
        >
          Back to Group
        </button>
      </div>
    );
  }

  const subtotal = tx.subtotal ?? 0;
  const total = subtotal + tipInput;

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}
      >
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => onNavigate({ page: 'groupDetail', groupId })}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Even Split</h1>
        </div>
        {secondsLeft !== null && (
          <div className="flex items-center gap-2 text-sm">
            <Clock size={16} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
            <span className={isDark ? 'text-amber-400' : 'text-amber-600'}>
              {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, '0')} left
            </span>
          </div>
        )}
      </motion.div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4`}>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-2`}>Tip</p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max={Math.max(50, Math.ceil(subtotal * 0.5))}
              step="0.5"
              value={tipInput}
              onChange={(e) => handleTipChange(parseFloat(e.target.value) || 0)}
              disabled={!isCreator}
              className="flex-1"
            />
            <span className={`font-bold w-16 text-right ${isDark ? 'text-white' : 'text-slate-800'}`}>
              ${tipInput.toFixed(2)}
            </span>
          </div>
          {!isCreator && (
            <p className="text-xs text-slate-500 mt-1">Only the payer can adjust the tip</p>
          )}
        </div>

        <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4`}>
          <div className="flex justify-between mb-1">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Subtotal</span>
            <span className={isDark ? 'text-white' : 'text-slate-800'}>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Tip</span>
            <span className={isDark ? 'text-white' : 'text-slate-800'}>${tipInput.toFixed(2)}</span>
          </div>
          <div className={`flex justify-between font-bold text-lg pt-2 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
            <span className={isDark ? 'text-white' : 'text-slate-800'}>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {isCreator && (
        <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-t px-5 py-4`}>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-semibold disabled:opacity-60"
          >
            {submitting ? 'Processing...' : 'Confirm & Pay'}
          </button>
        </div>
      )}
    </div>
  );
}
