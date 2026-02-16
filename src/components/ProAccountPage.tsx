import { motion } from 'motion/react';
import { ChevronLeft, Check, Crown, Zap } from 'lucide-react';
import { useState } from 'react';
import { PageType } from '../App';

interface ProAccountPageProps {
  onNavigate: (page: PageType) => void;
  theme: 'light' | 'dark';
  currentPlan: 'standard' | 'pro';
  onUpgrade: (duration: '1week' | '1month' | '6months' | '1year') => void;
}

const plans = [
  { id: '1week' as const, duration: '1 Week', price: 2.99, savings: null },
  { id: '1month' as const, duration: '1 Month', price: 9.99, savings: null },
  { id: '6months' as const, duration: '6 Months', price: 49.99, savings: '17%', popular: true },
  { id: '1year' as const, duration: '1 Year', price: 89.99, savings: '25%' },
];

export function ProAccountPage({ onNavigate, theme, currentPlan, onUpgrade }: ProAccountPageProps) {
  const [selectedPlan, setSelectedPlan] = useState<'1week' | '1month' | '6months' | '1year'>('6months');
  const isDark = theme === 'dark';

  const handleUpgrade = () => {
    onUpgrade(selectedPlan);
    // Navigate back after upgrade
    setTimeout(() => onNavigate('settings'), 1000);
  };

  const proFeatures = [
    'Retain groups after payment settlement',
    'Unlimited group history',
    'Priority customer support',
    'Advanced analytics and insights',
    'Custom group colors and themes',
    'Export receipts and transaction history',
    'No ads',
  ];

  const standardLimitations = [
    'Groups auto-delete after payment settled',
    'Limited to 30 days of history',
    'Standard support',
  ];

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}
      >
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate('settings')}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Tabby Pro</h1>
        </div>
      </motion.div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {/* Hero Section */}
        <motion.div
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.12 }}
          className={`${isDark ? 'bg-gradient-to-br from-purple-900 to-indigo-900' : 'bg-gradient-to-br from-purple-600 to-indigo-600'} rounded-3xl p-8 text-center mb-6 relative overflow-hidden`}
        >
          <div className="absolute top-4 right-4">
            <Crown size={48} className="text-yellow-300 opacity-20" />
          </div>
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="w-20 h-20 rounded-full bg-yellow-400 flex items-center justify-center mx-auto mb-4"
          >
            <Crown size={36} className="text-purple-900" strokeWidth={2.5} />
          </motion.div>
          <h2 className="text-3xl font-bold text-white mb-2">Upgrade to Pro</h2>
          <p className="text-purple-200">Unlock premium features and keep your group history forever</p>
        </motion.div>

        {/* Current Plan Badge */}
        {currentPlan === 'pro' && (
          <motion.div
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.12 }}
            className={`${isDark ? 'bg-green-900/30 border-green-700' : 'bg-green-50 border-green-200'} border rounded-2xl p-4 mb-6 flex items-center gap-3`}
          >
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
              <Check size={20} className="text-white" strokeWidth={3} />
            </div>
            <div>
              <p className={`font-bold ${isDark ? 'text-green-300' : 'text-green-800'}`}>You're already Pro!</p>
              <p className={`text-sm ${isDark ? 'text-green-400' : 'text-green-700'}`}>Enjoying all premium features</p>
            </div>
          </motion.div>
        )}

        {/* Plan Selection */}
        <motion.div
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.12 }}
        >
          <h3 className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'} uppercase tracking-wider mb-3 px-1`}>
            Choose Your Plan
          </h3>
          <div className="space-y-3 mb-6">
            {plans.map((plan, index) => (
              <motion.button
                key={plan.id}
                initial={{ x: -6, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.02, duration: 0.1 }}
                onClick={() => setSelectedPlan(plan.id)}
                className={`w-full rounded-2xl p-5 border-2 transition-all active:scale-[0.98] relative ${
                  selectedPlan === plan.id
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                    : isDark 
                    ? 'border-slate-700 bg-slate-800' 
                    : 'border-slate-200 bg-white'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-purple-900 text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
                    <Zap size={12} fill="currentColor" />
                    Most Popular
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      selectedPlan === plan.id
                        ? 'border-purple-600 bg-purple-600'
                        : isDark ? 'border-slate-600' : 'border-slate-300'
                    }`}>
                      {selectedPlan === plan.id && (
                        <Check size={16} className="text-white" strokeWidth={3} />
                      )}
                    </div>
                    <div className="text-left">
                      <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{plan.duration}</p>
                      {plan.savings && (
                        <p className="text-xs text-green-600 font-semibold">Save {plan.savings}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>${plan.price}</p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      ${(plan.price / (plan.id === '1week' ? 1 : plan.id === '1month' ? 4 : plan.id === '6months' ? 26 : 52)).toFixed(2)}/week
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Pro Features */}
        <motion.div
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.12 }}
          className="mb-6"
        >
          <h3 className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'} uppercase tracking-wider mb-3 px-1`}>
            Pro Features
          </h3>
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-5`}>
            {proFeatures.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 mb-3 last:mb-0">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check size={14} className="text-white" strokeWidth={3} />
                </div>
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{feature}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Standard Limitations */}
        <motion.div
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.12 }}
          className="mb-24"
        >
          <h3 className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'} uppercase tracking-wider mb-3 px-1`}>
            Standard Account Limitations
          </h3>
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-5`}>
            {standardLimitations.map((limitation, index) => (
              <div key={index} className="flex items-start gap-3 mb-3 last:mb-0">
                <div className={`w-6 h-6 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <div className={`w-3 h-0.5 ${isDark ? 'bg-slate-500' : 'bg-slate-400'}`}></div>
                </div>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{limitation}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Upgrade Button */}
      {currentPlan === 'standard' && (
        <div className={`${isDark ? 'bg-slate-800/95 border-slate-700' : 'bg-white/95 border-slate-200'} border-t backdrop-blur-xl px-5 py-4`}>
          <motion.button
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.12 }}
            onClick={handleUpgrade}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-bold text-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <Crown size={24} className="text-yellow-300" fill="currentColor" />
            Upgrade to Pro - ${plans.find(p => p.id === selectedPlan)?.price}
          </motion.button>
          <p className={`text-center text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'} mt-3`}>
            Cancel anytime. 7-day money back guarantee.
          </p>
        </div>
      )}
    </div>
  );
}
