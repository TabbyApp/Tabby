import { motion } from 'motion/react';
import { ChevronLeft, Bell, Lock, HelpCircle, Trash2, LogOut, Crown, Palette } from 'lucide-react';
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

  return (
    <div className="h-full min-h-0 flex flex-col bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate('home')}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft size={20} className="text-foreground" strokeWidth={2.5} />
          </button>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        </div>
      </div>

      {/* Settings List */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="space-y-6">
          {/* Pro Account */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Account
            </h2>
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm relative">
              <button 
                onClick={() => onNavigate('proAccount')}
                className="w-full flex items-center gap-3 px-4 py-4 active:bg-secondary/80 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Crown size={20} className="text-primary" fill="currentColor" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-foreground">Tabby Pro</p>
                  <p className="text-xs text-muted-foreground">Unlock premium features</p>
                </div>
                <div className="bg-primary px-3 py-1.5 rounded-full">
                  <p className="text-xs font-bold text-primary-foreground">Upgrade</p>
                </div>
              </button>
            </div>
          </div>

          {/* Appearance */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Appearance
            </h2>
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <button 
                onClick={() => onNavigate('appearanceSettings')}
                className="w-full flex items-center gap-3 px-4 py-4 active:bg-secondary/80 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Palette size={20} className="text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">Theme</p>
                  <p className="text-xs text-muted-foreground">Customize app appearance</p>
                </div>
              </button>
            </div>
          </div>

          {/* Preferences */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Preferences
            </h2>
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <button 
                onClick={() => onNavigate('notificationsSettings')}
                className="w-full flex items-center gap-3 px-4 py-4 active:bg-secondary/80 transition-colors border-b border-border"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bell size={20} className="text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">Notifications</p>
                  <p className="text-xs text-muted-foreground">Manage notification settings</p>
                </div>
              </button>
              
              <button 
                onClick={() => onNavigate('privacySettings')}
                className="w-full flex items-center gap-3 px-4 py-4 active:bg-secondary/80 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                  <Lock size={20} className="text-success" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">Privacy & Security</p>
                  <p className="text-xs text-muted-foreground">Manage your privacy</p>
                </div>
              </button>
            </div>
          </div>

          {/* Support */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Support
            </h2>
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <button 
                onClick={() => onNavigate('helpSupport')}
                className="w-full flex items-center gap-3 px-4 py-4 active:bg-secondary/80 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <HelpCircle size={20} className="text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">Help & Support</p>
                  <p className="text-xs text-muted-foreground">Get help with your account</p>
                </div>
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div>
            <h2 className="text-sm font-semibold text-destructive uppercase tracking-wide mb-3">
              Danger Zone
            </h2>
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <button 
                onClick={() => setShowDeleteModal(true)}
                className="w-full flex items-center gap-3 px-4 py-4 active:bg-secondary/80 transition-colors border-b border-border"
              >
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Trash2 size={20} className="text-destructive" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-destructive">Delete Account</p>
                  <p className="text-xs text-muted-foreground">Permanently delete your account</p>
                </div>
              </button>

              <button 
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-4 active:bg-secondary/80 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <LogOut size={20} className="text-destructive" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-destructive">Log Out</p>
                  <p className="text-xs text-muted-foreground">Sign out of your account</p>
                </div>
              </button>
            </div>
          </div>
        </div>
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
            <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-destructive" />
              </div>
              <h3 className="text-xl font-bold text-center mb-2 text-foreground">
                Delete Account?
              </h3>
              <p className="text-center text-muted-foreground mb-6">
                This action cannot be undone. All your data will be permanently deleted.
              </p>
              <div className="space-y-2">
                <button className="w-full bg-destructive text-destructive-foreground py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform">
                  Yes, Delete Account
                </button>
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  className="w-full bg-secondary text-foreground py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform"
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