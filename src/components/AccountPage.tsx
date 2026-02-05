import { motion } from 'motion/react';
import { ChevronLeft, User, Mail, Phone, CreditCard, MapPin } from 'lucide-react';
import { PageType } from '../App';

interface AccountPageProps {
  onNavigate: (page: PageType) => void;
  theme: 'light' | 'dark';
}

export function AccountPage({ onNavigate, theme }: AccountPageProps) {
  const isDark = theme === 'dark';

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
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-600 to-blue-500 flex items-center justify-center text-white shadow-lg mb-4">
            <User size={40} strokeWidth={2.5} />
          </div>
          <button className="text-blue-500 font-medium text-sm">Change Photo</button>
        </motion.div>

        {/* Account Details */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-blue-100'} flex items-center justify-center`}>
                <User size={20} className="text-blue-500" />
              </div>
              <div className="flex-1">
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Full Name</p>
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>John Doe</p>
              </div>
              <button className="text-blue-500 text-sm font-medium">Edit</button>
            </div>
          </div>

          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-purple-100'} flex items-center justify-center`}>
                <Mail size={20} className="text-purple-500" />
              </div>
              <div className="flex-1">
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Email</p>
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>john@example.com</p>
              </div>
              <button className="text-blue-500 text-sm font-medium">Edit</button>
            </div>
          </div>

          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-green-100'} flex items-center justify-center`}>
                <Phone size={20} className="text-green-500" />
              </div>
              <div className="flex-1">
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Phone Number</p>
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>+1 (555) 123-4567</p>
              </div>
              <button className="text-blue-500 text-sm font-medium">Edit</button>
            </div>
          </div>

          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-orange-100'} flex items-center justify-center`}>
                <MapPin size={20} className="text-orange-500" />
              </div>
              <div className="flex-1">
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Address</p>
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>123 Main St, City, ST</p>
              </div>
              <button className="text-blue-500 text-sm font-medium">Edit</button>
            </div>
          </div>
        </motion.div>

        {/* Payment Methods */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
            Payment Methods
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
              <button className="text-blue-500 text-sm font-medium">Manage</button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
