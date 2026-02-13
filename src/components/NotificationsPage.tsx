import { motion } from 'motion/react';
import { ChevronLeft, Bell, Users, Receipt, UserPlus, Check, X } from 'lucide-react';
import { PageType } from '../App';

interface NotificationsPageProps {
  onNavigate: (page: PageType, groupId?: number) => void;
  theme: 'light' | 'dark';
  notifications: Array<{
    id: number;
    type: string;
    title: string;
    message: string;
    time: string;
    read: boolean;
  }>;
  setNotifications: (notifications: any[]) => void;
  unreadCount: number;
}

export function NotificationsPage({ onNavigate, theme, notifications, setNotifications, unreadCount }: NotificationsPageProps) {
  const isDark = theme === 'dark';

  const markAsRead = (id: number) => {
    setNotifications(notifications.map(notif => 
      notif.id === id ? { ...notif, read: true } : notif
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(notif => ({ ...notif, read: true })));
  };

  const clearNotification = (id: number) => {
    setNotifications(notifications.filter(notif => notif.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'invite': return UserPlus;
      case 'receipt': return Receipt;
      case 'payment': return Check;
      case 'group': return Users;
      default: return Bell;
    }
  };

  const getColor = (type: string) => {
    switch(type) {
      case 'invite': return 'bg-blue-500';
      case 'receipt': return 'bg-green-500';
      case 'payment': return 'bg-purple-500';
      case 'group': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50'}`}>
      {/* Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onNavigate('home')}
              className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
            >
              <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
            </button>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Notifications</h1>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-purple-600 text-sm font-semibold"
            >
              Mark All Read
            </button>
          )}
        </div>
        {unreadCount > 0 && (
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
          </p>
        )}
      </motion.div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className={`w-20 h-20 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'} flex items-center justify-center mb-4`}>
              <Bell size={32} className={isDark ? 'text-slate-600' : 'text-slate-400'} />
            </div>
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'} text-center`}>
              No notifications
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification, index) => {
              const Icon = getIcon(notification.type);
              return (
                <motion.div
                  key={notification.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                  className={`w-full ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-[20px] p-4 shadow-lg ${isDark ? 'shadow-none' : 'shadow-slate-200/50'} border ${isDark ? 'border-slate-700' : 'border-slate-100'} ${!notification.read ? 'ring-2 ring-purple-400' : ''} text-left`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="flex items-start gap-3 flex-1 active:scale-[0.98] transition-transform"
                    >
                      <div className={`w-10 h-10 rounded-full ${getColor(notification.type)} flex items-center justify-center flex-shrink-0`}>
                        <Icon size={20} className="text-white" strokeWidth={2.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <div className="w-2 h-2 rounded-full bg-purple-600 flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-2`}>
                          {notification.message}
                        </p>
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {notification.time}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearNotification(notification.id);
                      }}
                      className={`w-8 h-8 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-100'} flex items-center justify-center active:scale-95 transition-transform`}
                    >
                      <X size={16} className="text-red-500" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clear All Button */}
      {notifications.length > 0 && (
        <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-t px-5 py-4`}>
          <button
            onClick={clearAll}
            className={`w-full py-4 rounded-xl font-semibold transition-all ${isDark ? 'bg-red-600 text-white' : 'bg-red-500 text-white'} active:scale-[0.98]`}
          >
            Clear All Notifications
          </button>
        </div>
      )}
    </div>
  );
}