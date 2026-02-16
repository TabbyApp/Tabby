import { motion } from 'motion/react';
import { ChevronLeft, Mail, Check, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { PageType } from '../App';

interface ForgotPasswordPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export function ForgotPasswordPage({ onNavigate, onBack, theme }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'sent'>('email');
  const isDark = theme === 'dark';

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = () => {
    if (isValidEmail) {
      setStep('sent');
    }
  };

  if (step === 'sent') {
    return (
      <div className={`h-[calc(100vh-48px)] flex flex-col items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50'} px-5`}>
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="text-center max-w-md w-full"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-xl"
          >
            <Check size={48} className="text-white" strokeWidth={3} />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'} mb-2`}
          >
            Check Your Email
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            className={`${isDark ? 'text-slate-400' : 'text-slate-600'} mb-8`}
          >
            We've sent a password reset link to <span className="font-semibold">{email}</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 mb-6`}
          >
            <Mail size={40} className={`${isDark ? 'text-slate-600' : 'text-slate-300'} mx-auto mb-4`} />
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-4`}>
              Click the link in the email to reset your password. The link will expire in 1 hour.
            </p>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Didn't receive an email? Check your spam folder or{' '}
              <button onClick={() => setStep('email')} className="text-purple-600 font-medium">
                try again
              </button>
            </p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            onClick={onBack}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-semibold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            Back to Sign In
            <ArrowRight size={20} />
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`h-[calc(100vh-48px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50'}`}>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="px-5 pt-6 pb-4"
      >
        <button 
          onClick={onBack}
          className={`w-11 h-11 rounded-full ${isDark ? 'bg-slate-800' : 'bg-white'} flex items-center justify-center active:scale-95 transition-transform shadow-lg`}
        >
          <ChevronLeft size={22} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
        </button>
      </motion.div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.12 }}
          className="text-center max-w-md w-full"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Mail size={36} className="text-white" strokeWidth={2} />
          </div>

          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-2`}>
            Forgot Password?
          </h1>
          <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} mb-8`}>
            No worries! Enter your email and we'll send you a reset link
          </p>

          {/* Email Input */}
          <div className="mb-6">
            <div className="relative">
              <Mail size={20} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className={`w-full pl-12 pr-4 py-4 rounded-2xl text-[17px] ${
                  isDark 
                    ? 'bg-slate-800 text-white border-slate-700' 
                    : 'bg-white text-slate-800 border-slate-200'
                } border-2 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all shadow-sm`}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!isValidEmail}
            className={`w-full py-4 rounded-2xl font-semibold shadow-xl transition-all flex items-center justify-center gap-2 ${
              isValidEmail
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white active:scale-[0.98]'
                : isDark 
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Send Reset Link
            <ArrowRight size={20} />
          </button>

          <button
            onClick={onBack}
            className={`mt-6 text-purple-600 font-medium text-sm`}
          >
            Remember your password? Sign in
          </button>
        </motion.div>
      </div>
    </div>
  );
}
