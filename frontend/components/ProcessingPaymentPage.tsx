import { motion, AnimatePresence } from 'motion/react';
import { Check, CreditCard, Users, Loader } from 'lucide-react';
import { useState, useEffect } from 'react';
import { PageType } from '../App';
import { api } from '../lib/api';

interface ProcessingPaymentPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
  groupId: string | null;
  accountType: 'standard' | 'pro';
  transactionId?: string | null;
  onSettlementComplete?: () => void;
  receiptData: {
    members: Array<{ id: number; name: string; amount: number; avatar: string }>;
    total: number;
  } | null;
  itemSplitData?: { hasSelectedItems: boolean; yourItemsTotal: number };
}

export function ProcessingPaymentPage({ onNavigate, theme, groupId, accountType, transactionId, receiptData, onSettlementComplete }: ProcessingPaymentPageProps) {
  const isDark = theme === 'dark';
  const [step, setStep] = useState<'processing' | 'success'>('processing');
  // Transaction total and allocations (include tip + tax) from API; overrides receiptData when present
  const [txDisplay, setTxDisplay] = useState<{ total: number; members: Array<{ id: number; name: string; amount: number; avatar: string }> } | null>(null);

  useEffect(() => {
    if (!transactionId) return;
    api.transactions
      .get(transactionId)
      .then((data) => {
        const total = Number(data.total ?? 0);
        const membersById = new Map((data.members ?? []).map((m) => [m.id, m]));
        const members = (data.allocations ?? []).map((a, i) => {
          const m = membersById.get(a.user_id);
          return {
            id: i + 1,
            name: m?.name ?? 'Member',
            amount: a.amount,
            avatar: '👤',
          };
        });
        setTxDisplay({ total, members });
      })
      .catch(() => {});
  }, [transactionId]);

  useEffect(() => {
    // If we have a transaction, try to settle it
    const settleTransaction = async () => {
      if (transactionId) {
        try {
          await api.transactions.settle(transactionId);
          onSettlementComplete?.();
        } catch {
          // Transaction may already be settled by finalize
        }
      }
    };

    settleTransaction();

    const timer = setTimeout(() => {
      setStep('success');
    }, 2500);

    const redirectTimer = setTimeout(() => {
      onNavigate('home');
    }, 4000);

    return () => {
      clearTimeout(timer);
      clearTimeout(redirectTimer);
    };
  }, [onNavigate, transactionId, onSettlementComplete]);

  const fallbackMembers = receiptData?.members || [
    { id: 1, name: 'You', amount: 0, avatar: '👤' },
  ];
  const members = txDisplay?.members?.length ? txDisplay.members : fallbackMembers;
  const total = txDisplay?.total ?? receiptData?.total ?? members.reduce((sum, m) => sum + m.amount, 0);

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'} px-5`}>
      <AnimatePresence mode="wait">
        {step === 'processing' ? (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="text-center"
          >
            <div className="relative w-32 h-32 mx-auto mb-8">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="w-32 h-32 border-4 border-blue-200 border-t-blue-500 rounded-full" />
              <div className="absolute inset-0 flex items-center justify-center">
                <CreditCard size={40} className="text-blue-500" />
              </div>
            </div>

            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'} mb-3`}>Processing Payments</h2>
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} mb-8`}>Charging cards for each member...</p>

            <div className="space-y-3 max-w-sm mx-auto">
              {members.map((member, index) => (
                <motion.div
                  key={member.id}
                  initial={{ x: -6, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 flex items-center gap-3`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-lg">{member.avatar}</div>
                  <div className="flex-1 text-left">
                    <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{member.name}</p>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>${member.amount.toFixed(2)}</p>
                  </div>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                    <Loader size={20} className="text-blue-500" />
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }} className="w-32 h-32 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-8 shadow-2xl">
              <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}>
                <Check size={64} className="text-white" strokeWidth={3} />
              </motion.div>
            </motion.div>

            <motion.h2 initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }} className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-800'} mb-3`}>Payment Complete!</motion.h2>
            <motion.p initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className={`${isDark ? 'text-slate-400' : 'text-slate-600'} mb-8`}>All charges have been processed successfully</motion.p>

            <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }} className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 max-w-sm mx-auto shadow-lg`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users size={20} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
                  <p className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{members.length} members charged</p>
                </div>
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>${total.toFixed(2)}</p>
              </div>
              <div className={`border-t ${isDark ? 'border-slate-700' : 'border-gray-200'} pt-4 space-y-2`}>
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{member.avatar}</span>
                      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{member.name}</p>
                    </div>
                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>${member.amount.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className={`mt-6 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Returning to home...</motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
