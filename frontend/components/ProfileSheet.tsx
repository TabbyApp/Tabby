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

export function ProfileSheet({ onClose, onNavigateToAccount, onNavigateToSettings, onNavigateToWallet }: ProfileSheetProps) {
  const { user } = useAuth();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto max-w-[430px] bg-card rounded-t-[20px] overflow-hidden">
          <div className="pt-3 pb-2 flex justify-center">
            <div className="w-9 h-1 bg-muted-foreground/30 rounded-full" />
          </div>

          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-[17px] font-semibold text-foreground">Profile</h3>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
            >
              <X size={16} strokeWidth={2.5} className="text-foreground" />
            </button>
          </div>

          <div className="px-4 py-5 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-md">
                <User size={28} strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-[20px] font-semibold text-foreground">{user?.name ?? 'User'}</div>
                <div className="text-[15px] text-muted-foreground">{user?.email ?? ''}</div>
              </div>
            </div>
          </div>

          <div className="px-4 py-2">
            <button
              onClick={() => { onClose(); onNavigateToAccount(); }}
              className="w-full flex items-center gap-4 px-4 py-4 active:bg-accent transition-colors rounded-xl text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={20} className="text-primary" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <div className="text-[17px] font-medium text-foreground">Account</div>
                <div className="text-[13px] text-muted-foreground">Manage your profile</div>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
            </button>

            <button
              onClick={() => { onClose(); onNavigateToWallet(); }}
              className="w-full flex items-center gap-4 px-4 py-4 active:bg-accent transition-colors rounded-xl text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet size={20} className="text-primary" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <div className="text-[17px] font-medium text-foreground">Virtual Wallet</div>
                <div className="text-[13px] text-muted-foreground">Manage your cards</div>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
            </button>

            <button
              onClick={() => { onClose(); onNavigateToSettings(); }}
              className="w-full flex items-center gap-4 px-4 py-4 active:bg-accent transition-colors rounded-xl text-left"
            >
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <Settings size={20} className="text-muted-foreground" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <div className="text-[17px] font-medium text-foreground">Settings</div>
                <div className="text-[13px] text-muted-foreground">App preferences</div>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
            </button>
          </div>

          {/* Safe area padding for home indicator */}
          <div className="h-8" />
        </div>
      </div>
    </>
  );
}