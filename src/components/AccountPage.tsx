import { motion } from 'motion/react';
import { ChevronLeft, User, Mail, Phone, CreditCard, MapPin, Building2, Edit2, Check } from 'lucide-react';
import { useState } from 'react';
import { PageType } from '../App';

interface AccountPageProps {
  onNavigate: (page: PageType, groupId?: number) => void;
  theme: 'light' | 'dark';
}

export function AccountPage({ onNavigate, theme }: AccountPageProps) {
  const isDark = theme === 'dark';
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState('John Doe');
  const [tempName, setTempName] = useState('John Doe');

  const handleSaveName = () => {
    setName(tempName);
    setIsEditingName(false);
  };

  const connectPlaid = () => {
    // Mock Plaid integration
    console.log('Opening Plaid Link...');
    // In real app: window.Plaid.create({ ... }).open();
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
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center mb-8"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white shadow-xl mb-4">
            <User size={40} strokeWidth={2.5} />
          </div>
          <button className="text-violet-600 font-medium text-sm active:scale-95 transition-transform">Change Photo</button>
        </motion.div>

        {/* Personal Information */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
            Personal Information
          </h2>
          <div className="space-y-3">
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-violet-100'} flex items-center justify-center`}>
                  <User size={20} className="text-violet-600" />
                </div>
                <div className="flex-1">
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-1`}>Full Name</p>
                  {isEditingName ? (
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className={`font-semibold ${isDark ? 'text-white bg-slate-700' : 'text-slate-800 bg-slate-50'} px-2 py-1 rounded w-full`}
                      autoFocus
                    />
                  ) : (
                    <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{name}</p>
                  )}
                </div>
                {isEditingName ? (
                  <button onClick={handleSaveName} className="text-violet-600">
                    <Check size={20} />
                  </button>
                ) : (
                  <button onClick={() => {
                    setIsEditingName(true);
                    setTempName(name);
                  }} className="text-violet-600">
                    <Edit2 size={18} />
                  </button>
                )}
              </div>
            </div>

            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-purple-100'} flex items-center justify-center`}>
                  <Mail size={20} className="text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-1`}>Email</p>
                  <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>john@example.com</p>
                </div>
                <button className="text-violet-600">
                  <Edit2 size={18} />
                </button>
              </div>
            </div>

            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-green-100'} flex items-center justify-center`}>
                  <Phone size={20} className="text-green-600" />
                </div>
                <div className="flex-1">
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-1`}>Phone Number</p>
                  <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>+1 (555) 123-4567</p>
                </div>
                <button className="text-violet-600">
                  <Edit2 size={18} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bank Account */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
            Bank Account
          </h2>
          
          {/* Plaid Connection */}
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-5 shadow-sm mb-3`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg">
                <Building2 size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Chase Bank •••• 4567</p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Checking Account</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <Check size={16} className="text-green-600" strokeWidth={3} />
              </div>
            </div>
            <button 
              onClick={connectPlaid}
              className={`w-full ${isDark ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'} py-3 rounded-xl font-medium active:scale-[0.98] transition-transform`}
            >
              Change Bank Account
            </button>
          </div>

          {/* Add Another Bank */}
          <button 
            onClick={connectPlaid}
            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-4 rounded-xl font-semibold shadow-xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <Building2 size={20} />
            Connect Bank Account via Plaid
          </button>

          {/* Plaid Info */}
          <div className={`${isDark ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'} border rounded-xl p-4 mt-4`}>
            <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
              🔒 We use Plaid to securely connect your bank account. Your credentials are never stored on our servers.
            </p>
          </div>
        </motion.div>

        {/* Payment Method */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
            Payment Method
          </h2>
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <CreditCard size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Visa •••• 1234</p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Expires 12/26</p>
              </div>
              <button className="text-violet-600 text-sm font-medium">Manage</button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}