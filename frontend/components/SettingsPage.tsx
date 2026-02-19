import { motion } from 'motion/react';
import { ChevronLeft, Bell, Lock, Eye, HelpCircle, Moon, Sun, Trash2, LogOut, Crown, Palette } from 'lucide-react';
import { useState } from 'react';
import { BottomNavigation } from './BottomNavigation';
import { ProfileSheet } from './ProfileSheet';
import { PageType } from '../App';

interface SettingsPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  onLogout: () => void;
}

export function SettingsPage({ onNavigate, theme, onThemeChange, onLogout }: SettingsPageProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const isDark = theme === 'dark';

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
            onClick={() => onNavigate('home')}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Settings</h1>
        </div>
      </motion.div>

      {/* Settings List */}
      <div className="flex-1 overflow-y-auto px-5 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
        <motion.div
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.12 }}
          className="space-y-6"
        >
          {/* Pro Account */}
          <div>
            <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
              Account
            </h2>
            <div className={`${isDark ? 'bg-gradient-to-br from-purple-900 to-indigo-900' : 'bg-gradient-to-br from-purple-600 to-indigo-600'} rounded-xl overflow-hidden shadow-sm relative`}>
              <button 
                onClick={() => onNavigate('proAccount')}
                className="w-full flex items-center gap-3 px-4 py-4 active:opacity-80 transition-opacity"
              >
                <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center">
                  <Crown size={20} className="text-purple-900" fill="currentColor" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-white">Tabby Pro</p>
                  <p className="text-xs text-purple-200">Unlock premium features</p>
                </div>
                <div className="bg-white/20 px-3 py-1.5 rounded-full">
                  <p className="text-xs font-bold text-white">Upgrade</p>
                </div>
              </button>
            </div>
          </div>

          {/* Appearance */}
          <div>
            <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
              Appearance
            </h2>
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm`}>
              <button 
                onClick={() => onNavigate('appearanceSettings')}
                className={`w-full flex items-center gap-3 px-4 py-4 ${isDark ? 'active:bg-slate-700' : 'active:bg-gray-100'} transition-colors`}
              >
                <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-purple-100'} flex items-center justify-center`}>
                  <Palette size={20} className="text-purple-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Theme</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Customize app appearance</p>
                </div>
              </button>
            </div>
          </div>

          {/* Preferences */}
          <div>
            <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
              Preferences
            </h2>
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm`}>
              <button 
                onClick={() => onNavigate('notificationsSettings')}
                className={`w-full flex items-center gap-3 px-4 py-4 ${isDark ? 'active:bg-slate-700' : 'active:bg-gray-100'} transition-colors border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}
              >
                <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-purple-100'} flex items-center justify-center`}>
                  <Bell size={20} className="text-purple-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Notifications</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Manage notification settings</p>
                </div>
              </button>
              
              <button 
                onClick={() => onNavigate('privacySettings')}
                className={`w-full flex items-center gap-3 px-4 py-4 ${isDark ? 'active:bg-slate-700' : 'active:bg-gray-100'} transition-colors`}
              >
                <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-green-100'} flex items-center justify-center`}>
                  <Lock size={20} className="text-green-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Privacy & Security</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Manage your privacy</p>
                </div>
              </button>
            </div>
          </div>

          {/* Support */}
          <div>
            <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
              Support
            </h2>
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm`}>
              <button 
                onClick={() => onNavigate('helpSupport')}
                className={`w-full flex items-center gap-3 px-4 py-4 ${isDark ? 'active:bg-slate-700' : 'active:bg-gray-100'} transition-colors`}
              >
                <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-blue-100'} flex items-center justify-center`}>
                  <HelpCircle size={20} className="text-blue-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Help & Support</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Get help with your account</p>
                </div>
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div>
            <h2 className="text-sm font-semibold text-red-500 uppercase tracking-wide mb-3">
              Danger Zone
            </h2>
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm`}>
              <button 
                onClick={() => setShowDeleteModal(true)}
                className={`w-full flex items-center gap-3 px-4 py-4 ${isDark ? 'active:bg-slate-700' : 'active:bg-gray-100'} transition-colors border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}
              >
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 size={20} className="text-red-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-red-500">Delete Account</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Permanently delete your account</p>
                </div>
              </button>

              <button 
                onClick={onLogout}
                className={`w-full flex items-center gap-3 px-4 py-4 ${isDark ? 'active:bg-slate-700' : 'active:bg-gray-100'} transition-colors`}
              >
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <LogOut size={20} className="text-orange-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-orange-500">Log Out</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Sign out of your account</p>
                </div>
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setShowDeleteModal(false)}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-sm"
          >
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 shadow-2xl`}>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className={`text-xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Delete Account?
              </h3>
              <p className={`text-center ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
                This action cannot be undone. All your data will be permanently deleted.
              </p>
              <div className="space-y-2">
                <button className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform">
                  Yes, Delete Account
                </button>
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  className={`w-full ${isDark ? 'bg-slate-700 text-white' : 'bg-gray-200 text-slate-800'} py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Bottom Navigation */}
      <BottomNavigation
        currentPage="settings"
        onNavigate={onNavigate}
        onProfileClick={() => setShowProfileSheet(true)}
        theme={theme}
      />

      {/* Profile Sheet */}
      {showProfileSheet && (
        <ProfileSheet 
          onClose={() => setShowProfileSheet(false)} 
          onNavigateToAccount={() => onNavigate('account')}
          onNavigateToSettings={() => onNavigate('settings')}
          onNavigateToWallet={() => onNavigate('wallet')}
          theme={theme}
        />
      )}
    </div>
  );
}