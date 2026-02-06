import { motion } from 'motion/react';
import { ChevronLeft, Bell, DollarSign, Users, Receipt } from 'lucide-react';
import { useState } from 'react';
import { PageType } from '../App';

interface NotificationsSettingsPageProps {
  onNavigate: (page: PageType, groupId?: number) => void;
  theme: 'light' | 'dark';
}

export function NotificationsSettingsPage({ onNavigate, theme }: NotificationsSettingsPageProps) {
  const [notifications, setNotifications] = useState({
    payments: true,
    groupActivity: true,
    receipts: false,
    reminders: true,
  });

  const isDark = theme === 'dark';

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
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
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Notifications</h1>
        </div>
      </motion.div>

      {/* Settings List */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-4`}>
            Manage which notifications you'd like to receive
          </p>

          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm`}>
            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <DollarSign size={20} className="text-green-500" />
                </div>
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Payments</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Get notified when payments are made</p>
                </div>
              </div>
              <button
                onClick={() => toggleNotification('payments')}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  notifications.payments ? 'bg-purple-600' : isDark ? 'bg-slate-700' : 'bg-gray-300'
                }`}
              >
                <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  notifications.payments ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Users size={20} className="text-purple-500" />
                </div>
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Group Activity</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Updates when members join or leave</p>
                </div>
              </div>
              <button
                onClick={() => toggleNotification('groupActivity')}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  notifications.groupActivity ? 'bg-purple-600' : isDark ? 'bg-slate-700' : 'bg-gray-300'
                }`}
              >
                <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  notifications.groupActivity ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Receipt size={20} className="text-blue-500" />
                </div>
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Receipts</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>When new receipts are uploaded</p>
                </div>
              </div>
              <button
                onClick={() => toggleNotification('receipts')}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  notifications.receipts ? 'bg-purple-600' : isDark ? 'bg-slate-700' : 'bg-gray-300'
                }`}
              >
                <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  notifications.receipts ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <Bell size={20} className="text-orange-500" />
                </div>
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Reminders</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Payment reminders and due dates</p>
                </div>
              </div>
              <button
                onClick={() => toggleNotification('reminders')}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  notifications.reminders ? 'bg-purple-600' : isDark ? 'bg-slate-700' : 'bg-gray-300'
                }`}
              >
                <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  notifications.reminders ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
