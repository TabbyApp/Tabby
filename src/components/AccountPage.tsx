import { motion } from 'motion/react';
import { ChevronLeft, User, Mail, Phone, CreditCard, MapPin, Building2, Edit2, Check, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { BottomNavigation } from './BottomNavigation';
import { ProfileSheet } from './ProfileSheet';
import { PageType } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

interface AccountPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
}

export function AccountPage({ onNavigate, theme }: AccountPageProps) {
  const isDark = theme === 'dark';
  const { user, setUser } = useAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [tempName, setTempName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState('');
  const [tempPhone, setTempPhone] = useState('');
  const [bankLinked, setBankLinked] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; type: string; last_four: string; brand: string | null }>>([]);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [linkingBank, setLinkingBank] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setTempName(user.name);
    }
  }, [user]);

  // Fetch full user profile from API
  useEffect(() => {
    api.users.me().then((data) => {
      setPhone(data.phone ?? '');
      setTempPhone(data.phone ?? '');
      setBankLinked(!!data.bank_linked);
      if (Array.isArray(data.paymentMethods)) {
        setPaymentMethods(data.paymentMethods as any[]);
      }
    }).catch(() => {});
  }, []);

  const handleSaveName = () => {
    const newName = tempName.trim();
    if (!newName) return;
    setName(newName);
    setIsEditingName(false);
    api.users.updateProfile({ name: newName })
      .then((updated) => {
        setUser({ id: updated.id, email: updated.email, name: updated.name });
      })
      .catch(() => {});
  };

  const handleSavePhone = () => {
    const newPhone = tempPhone.trim();
    setPhone(newPhone);
    setIsEditingPhone(false);
    api.users.updateProfile({ phone: newPhone }).catch(() => {});
  };

  const handleLinkBank = async () => {
    setLinkingBank(true);
    try {
      await api.users.linkBank();
      setBankLinked(true);
      // Refresh payment methods
      const data = await api.users.me();
      if (Array.isArray(data.paymentMethods)) {
        setPaymentMethods(data.paymentMethods as any[]);
      }
    } catch {} finally {
      setLinkingBank(false);
    }
  };

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
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Account</h1>
        </div>
      </motion.div>

      {/* Profile Picture */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.12 }}
          className="flex flex-col items-center mb-8"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white shadow-xl mb-4">
            <User size={40} strokeWidth={2.5} />
          </div>
          <button className="text-violet-600 font-medium text-sm active:scale-95 transition-transform">Change Photo</button>
        </motion.div>

        {/* Personal Information */}
        <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.12 }}>
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>Personal Information</h2>
          <div className="space-y-3">
            {/* Name */}
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-violet-100'} flex items-center justify-center`}>
                  <User size={20} className="text-violet-600" />
                </div>
                <div className="flex-1">
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-1`}>Full Name</p>
                  {isEditingName ? (
                    <input type="text" value={tempName} onChange={(e) => setTempName(e.target.value)}
                      className={`font-semibold ${isDark ? 'text-white bg-slate-700' : 'text-slate-800 bg-slate-50'} px-2 py-1 rounded w-full`} autoFocus
                    />
                  ) : (
                    <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{name}</p>
                  )}
                </div>
                {isEditingName ? (
                  <button onClick={handleSaveName} className="text-violet-600"><Check size={20} /></button>
                ) : (
                  <button onClick={() => { setIsEditingName(true); setTempName(name); }} className="text-violet-600"><Edit2 size={18} /></button>
                )}
              </div>
            </div>

            {/* Email */}
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-purple-100'} flex items-center justify-center`}>
                  <Mail size={20} className="text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-1`}>Email</p>
                  <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{user?.email ?? 'No email'}</p>
                </div>
              </div>
            </div>

            {/* Phone */}
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-green-100'} flex items-center justify-center`}>
                  <Phone size={20} className="text-green-600" />
                </div>
                <div className="flex-1">
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-1`}>Phone Number</p>
                  {isEditingPhone ? (
                    <input type="tel" value={tempPhone} onChange={(e) => setTempPhone(e.target.value)}
                      className={`font-semibold ${isDark ? 'text-white bg-slate-700' : 'text-slate-800 bg-slate-50'} px-2 py-1 rounded w-full`} autoFocus placeholder="+1 (555) 123-4567"
                    />
                  ) : (
                    <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{phone || 'Not set'}</p>
                  )}
                </div>
                {isEditingPhone ? (
                  <button onClick={handleSavePhone} className="text-violet-600"><Check size={20} /></button>
                ) : (
                  <button onClick={() => { setIsEditingPhone(true); setTempPhone(phone); }} className="text-violet-600"><Edit2 size={18} /></button>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bank Account */}
        <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.12 }} className="mt-6">
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>Bank Account</h2>
          
          {bankLinked ? (
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-5 shadow-sm mb-3`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg">
                  <Building2 size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Bank Account Linked</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Connected</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <Check size={16} className="text-green-600" strokeWidth={3} />
                </div>
              </div>
            </div>
          ) : (
            <button 
              onClick={handleLinkBank}
              disabled={linkingBank}
              className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-4 rounded-xl font-semibold shadow-xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {linkingBank ? (
                <><Loader2 size={20} className="animate-spin" /> Linking...</>
              ) : (
                <><Building2 size={20} /> Link Bank Account</>
              )}
            </button>
          )}

          <div className={`${isDark ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'} border rounded-xl p-4 mt-4`}>
            <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
              Your bank account must be linked to create groups and join payment sessions.
            </p>
          </div>
        </motion.div>

        {/* Payment Methods */}
        {paymentMethods.length > 0 && (
          <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.12 }} className="mt-6">
            <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>Payment Methods</h2>
            <div className="space-y-3">
              {paymentMethods.map((pm) => (
                <div key={pm.id} className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      <CreditCard size={20} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {pm.brand ?? pm.type} •••• {pm.last_four}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{pm.type}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      <BottomNavigation currentPage="account" onNavigate={onNavigate} onProfileClick={() => setShowProfileSheet(true)} theme={theme} />
      {showProfileSheet && (
        <ProfileSheet onClose={() => setShowProfileSheet(false)} onNavigateToAccount={() => onNavigate('account')} onNavigateToSettings={() => onNavigate('settings')} onNavigateToWallet={() => onNavigate('wallet')} theme={theme} />
      )}
    </div>
  );
}
