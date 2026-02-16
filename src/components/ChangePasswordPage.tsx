import { motion } from 'motion/react';
import { ChevronLeft, Lock, Eye, EyeOff, Check } from 'lucide-react';
import { useState } from 'react';
import { PageType } from '../App';

interface ChangePasswordPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
}

export function ChangePasswordPage({ onNavigate, theme }: ChangePasswordPageProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  const isDark = theme === 'dark';

  const passwordRequirements = [
    { text: 'At least 8 characters', met: newPassword.length >= 8 },
    { text: 'Contains uppercase letter', met: /[A-Z]/.test(newPassword) },
    { text: 'Contains number', met: /\d/.test(newPassword) },
    { text: 'Passwords match', met: newPassword === confirmPassword && newPassword.length > 0 },
  ];

  const allRequirementsMet = passwordRequirements.every(req => req.met) && currentPassword.length > 0;

  const handleSubmit = () => {
    if (allRequirementsMet) {
      // Mock password change
      setSuccess(true);
      setTimeout(() => {
        onNavigate('privacySettings');
      }, 2000);
    }
  };

  if (success) {
    return (
      <div className={`h-[calc(100vh-48px-24px)] flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="text-center px-5"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-6 shadow-xl"
          >
            <Check size={48} className="text-white" strokeWidth={3} />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'} mb-2`}
          >
            Password Updated!
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            className={isDark ? 'text-slate-400' : 'text-slate-600'}
          >
            Your password has been changed successfully
          </motion.p>
        </motion.div>
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
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate('privacySettings')}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Change Password</h1>
        </div>
      </motion.div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <motion.div
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.12 }}
          className="space-y-5"
        >
          {/* Current Password */}
          <div>
            <label className={`block text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-2`}>
              Current Password
            </label>
            <div className="relative">
              <Lock size={20} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className={`w-full pl-12 pr-12 py-4 rounded-2xl text-[17px] ${
                  isDark 
                    ? 'bg-slate-800 text-white border-slate-700' 
                    : 'bg-white text-slate-800 border-slate-200'
                } border focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all`}
              />
              <button
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                {showCurrent ? (
                  <EyeOff size={20} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                ) : (
                  <Eye size={20} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                )}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className={`block text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-2`}>
              New Password
            </label>
            <div className="relative">
              <Lock size={20} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className={`w-full pl-12 pr-12 py-4 rounded-2xl text-[17px] ${
                  isDark 
                    ? 'bg-slate-800 text-white border-slate-700' 
                    : 'bg-white text-slate-800 border-slate-200'
                } border focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all`}
              />
              <button
                onClick={() => setShowNew(!showNew)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                {showNew ? (
                  <EyeOff size={20} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                ) : (
                  <Eye size={20} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className={`block text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-2`}>
              Confirm New Password
            </label>
            <div className="relative">
              <Lock size={20} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className={`w-full pl-12 pr-12 py-4 rounded-2xl text-[17px] ${
                  isDark 
                    ? 'bg-slate-800 text-white border-slate-700' 
                    : 'bg-white text-slate-800 border-slate-200'
                } border focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all`}
              />
              <button
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                {showConfirm ? (
                  <EyeOff size={20} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                ) : (
                  <Eye size={20} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                )}
              </button>
            </div>
          </div>

          {/* Password Requirements */}
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-4`}>
            <p className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'} mb-3`}>
              Password Requirements:
            </p>
            <div className="space-y-2">
              {passwordRequirements.map((req, index) => (
                <motion.div
                  key={index}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.02, duration: 0.1 }}
                  className="flex items-center gap-2"
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    req.met ? 'bg-green-500' : isDark ? 'bg-slate-700' : 'bg-slate-200'
                  } transition-colors`}>
                    {req.met && <Check size={14} className="text-white" strokeWidth={3} />}
                  </div>
                  <p className={`text-sm ${
                    req.met 
                      ? 'text-green-500' 
                      : isDark ? 'text-slate-400' : 'text-slate-600'
                  } transition-colors`}>
                    {req.text}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Submit Button */}
      <motion.div
        initial={{ y: 6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.12 }}
        className="px-5 pb-6"
      >
        <button
          onClick={handleSubmit}
          disabled={!allRequirementsMet}
          className={`w-full py-4 rounded-2xl font-semibold shadow-lg transition-all ${
            allRequirementsMet
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white active:scale-[0.98]'
              : isDark 
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Update Password
        </button>
      </motion.div>
    </div>
  );
}
