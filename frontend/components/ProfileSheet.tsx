import { User, Settings, ChevronRight, X, Wallet } from 'lucide-react';
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ProfileSheetProps {
  onClose: () => void;
  onNavigateToAccount: () => void;
  onNavigateToSettings: () => void;
  onNavigateToWallet: () => void;
  theme?: 'light' | 'dark';
}

export function ProfileSheet({ onClose, onNavigateToAccount, onNavigateToSettings, onNavigateToWallet, theme = 'light' }: ProfileSheetProps) {
  const isDark = theme === 'dark';
  const { user } = useAuth();

  useEffect(() => {
    // Prevent body scroll when sheet is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* iOS Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-300">
        <div className={`mx-auto max-w-[430px] ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-t-[20px] overflow-hidden`}>
          {/* Handle */}
          <div className="pt-3 pb-2 flex justify-center">
            <div className={`w-9 h-1 ${isDark ? 'bg-slate-600' : 'bg-gray-300'} rounded-full`} />
          </div>

          {/* Header */}
          <div className={`px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'} flex items-center justify-between`}>
            <h3 className={`text-[17px] font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Profile</h3>
            <button
              onClick={onClose}
              className={`w-7 h-7 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-200'} flex items-center justify-center active:scale-95 transition-transform`}
            >
              <X size={16} strokeWidth={2.5} className={isDark ? 'text-white' : 'text-slate-900'} />
            </button>
          </div>
          
          {/* User Info */}
          <div className={`px-4 py-5 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white shadow-md">
                <User size={28} strokeWidth={2.5} />
              </div>
              <div>
                <div className={`text-[20px] font-semibold ${isDark ? 'text-white' : 'text-black'}`}>{user?.name ?? 'User'}</div>
                <div className={`text-[15px] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{user?.email ?? ''}</div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="px-4 py-2">
            <button 
              onClick={() => {
                onClose();
                onNavigateToAccount();
              }}
              className={`w-full flex items-center gap-4 px-4 py-4 ${isDark ? 'active:bg-slate-700' : 'active:bg-gray-100'} transition-colors rounded-xl`}
            >
              <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'} flex items-center justify-center`}>
                <User size={20} className="text-blue-500" strokeWidth={2.5} />
              </div>
              <div className="flex-1 text-left">
                <div className={`text-[17px] font-medium ${isDark ? 'text-white' : 'text-black'}`}>Account</div>
                <div className={`text-[13px] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Manage your profile</div>
              </div>
              <ChevronRight size={20} className={`${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
            </button>

            <button 
              onClick={() => {
                onClose();
                onNavigateToWallet();
              }}
              className={`w-full flex items-center gap-4 px-4 py-4 ${isDark ? 'active:bg-slate-700' : 'active:bg-gray-100'} transition-colors rounded-xl`}
            >
              <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'} flex items-center justify-center`}>
                <Wallet size={20} className="text-purple-500" strokeWidth={2.5} />
              </div>
              <div className="flex-1 text-left">
                <div className={`text-[17px] font-medium ${isDark ? 'text-white' : 'text-black'}`}>Virtual Wallet</div>
                <div className={`text-[13px] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Manage your cards</div>
              </div>
              <ChevronRight size={20} className={`${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
            </button>
            
            <button 
              onClick={() => {
                onClose();
                onNavigateToSettings();
              }}
              className={`w-full flex items-center gap-4 px-4 py-4 ${isDark ? 'active:bg-slate-700' : 'active:bg-gray-100'} transition-colors rounded-xl`}
            >
              <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-200'} flex items-center justify-center`}>
                <Settings size={20} className={`${isDark ? 'text-slate-300' : 'text-gray-600'}`} strokeWidth={2.5} />
              </div>
              <div className="flex-1 text-left">
                <div className={`text-[17px] font-medium ${isDark ? 'text-white' : 'text-black'}`}>Settings</div>
                <div className={`text-[13px] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>App preferences</div>
              </div>
              <ChevronRight size={20} className={`${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
            </button>
          </div>

          {/* Safe area padding for home indicator */}
          <div className="h-8" />
        </div>
      </div>
    </>
  );
}