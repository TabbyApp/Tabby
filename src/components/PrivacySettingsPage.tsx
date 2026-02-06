import { motion } from 'motion/react';
import { ChevronLeft, Lock, Eye, Shield, Database } from 'lucide-react';
import { useState } from 'react';
import { PageType } from '../App';

interface PrivacySettingsPageProps {
  onNavigate: (page: PageType, groupId?: number) => void;
  theme: 'light' | 'dark';
}

export function PrivacySettingsPage({ onNavigate, theme }: PrivacySettingsPageProps) {
  const [privacy, setPrivacy] = useState({
    profileVisible: true,
    transactionHistory: false,
    dataSharing: false,
  });

  const isDark = theme === 'dark';

  const togglePrivacy = (key: keyof typeof privacy) => {
    setPrivacy(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      {/* Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
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
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Privacy & Security</h1>
        </div>
      </motion.div>

      {/* Settings List */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          {/* Privacy Controls */}
          <div>
            <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
              Privacy Controls
            </h2>
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm`}>
              <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Eye size={20} className="text-purple-500" />
                  </div>
                  <div>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Profile Visibility</p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Make your profile visible to others</p>
                  </div>
                </div>
                <button
                  onClick={() => togglePrivacy('profileVisible')}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    privacy.profileVisible ? 'bg-purple-600' : isDark ? 'bg-slate-700' : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    privacy.profileVisible ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Database size={20} className="text-blue-500" />
                  </div>
                  <div>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Transaction History</p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Share history with group members</p>
                  </div>
                </div>
                <button
                  onClick={() => togglePrivacy('transactionHistory')}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    privacy.transactionHistory ? 'bg-purple-600' : isDark ? 'bg-slate-700' : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    privacy.transactionHistory ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Shield size={20} className="text-green-500" />
                  </div>
                  <div>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Data Sharing</p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Share usage data to improve app</p>
                  </div>
                </div>
                <button
                  onClick={() => togglePrivacy('dataSharing')}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    privacy.dataSharing ? 'bg-purple-600' : isDark ? 'bg-slate-700' : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    privacy.dataSharing ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* Security Actions */}
          <div>
            <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
              Security Actions
            </h2>
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm`}>
              <button 
                onClick={() => onNavigate('changePassword')}
                className={`w-full flex items-center gap-3 px-4 py-4 ${isDark ? 'active:bg-slate-700' : 'active:bg-gray-100'} transition-colors border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}
              >
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <Lock size={20} className="text-orange-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Change Password</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Update your account password</p>
                </div>
              </button>

              <button 
                onClick={() => onNavigate('twoFactorAuth')}
                className={`w-full flex items-center gap-3 px-4 py-4 ${isDark ? 'active:bg-slate-700' : 'active:bg-gray-100'} transition-colors`}
              >
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Shield size={20} className="text-red-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Two-Factor Authentication</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Add an extra layer of security</p>
                </div>
              </button>
            </div>
          </div>

          {/* Privacy Info */}
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
              Your privacy is important to us. We never share your personal information with third parties without your consent. 
              <span className="text-purple-600 font-medium"> Learn more about our privacy policy</span>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}