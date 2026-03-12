import type { Dispatch, SetStateAction } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Bell, Users, Receipt, UserPlus, Check, X } from 'lucide-react';
import { PageType } from '../App';

interface NotificationsPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
  notifications: Array<{
    id: string;
    type: 'invite' | 'receipt' | 'payment' | 'group';
    title: string;
    message: string;
    createdAt: string;
    read: boolean;
    groupId?: string;
    groupName?: string;
    inviterName?: string;
    inviteToken?: string;
    source?: 'server' | 'local';
  }>;
  setNotifications: Dispatch<SetStateAction<Array<{
    id: string;
    type: 'invite' | 'receipt' | 'payment' | 'group';
    title: string;
    message: string;
    createdAt: string;
    read: boolean;
    groupId?: string;
    groupName?: string;
    inviterName?: string;
    inviteToken?: string;
    source?: 'server' | 'local';
  }>>>;
  unreadCount: number;
  acceptInvite?: (inviteId: string) => void | Promise<void>;
  declineInvite?: (inviteId: string) => void | Promise<void>;
}

export function NotificationsPage({ onNavigate, theme, notifications, setNotifications, unreadCount, acceptInvite, declineInvite }: NotificationsPageProps) {
  const markAsRead = (id: string) => {
    setNotifications(notifications.map(notif => 
      notif.id === id ? { ...notif, read: true } : notif
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(notif => ({ ...notif, read: true })));
  };

  const clearNotification = (id: string) => {
    setNotifications(notifications.filter(notif => notif.id !== id));
  };

  const clearAll = () => {
    setNotifications(notifications.filter((notif) => notif.type === 'invite'));
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

  const getIconBg = (type: string) => {
    switch (type) {
      case 'invite': return 'bg-primary/20 text-primary';
      case 'receipt': return 'bg-success/20 text-success';
      case 'payment': return 'bg-primary/20 text-primary';
      case 'group': return 'bg-secondary text-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatRelativeTime = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.max(1, Math.floor(diffMs / 60000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-background">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-card border-b border-border px-5 py-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('home')}
              className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
            >
              <ChevronLeft size={20} className="text-foreground" strokeWidth={2.5} />
            </button>
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="text-primary text-sm font-semibold">
              Mark All Read
            </button>
          )}
        </div>
        {unreadCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
          </p>
        )}
      </motion.div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Bell size={32} className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-center">No notifications</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification, index) => {
              const Icon = getIcon(notification.type);
              return (
                <motion.div
                  key={notification.id}
                  initial={{ x: -6, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.02, duration: 0.1 }}
                  className={`w-full bg-card border border-border rounded-xl p-4 text-left ${!notification.read ? 'ring-2 ring-primary/50' : ''}`}
                  onClick={() => {
                    markAsRead(notification.id);
                    if (notification.type !== 'invite' && notification.groupId) {
                      onNavigate('groupDetail', notification.groupId);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getIconBg(notification.type)}`}>
                        <Icon size={20} strokeWidth={2.5} />
                      </div>
                      <p className="text-xs text-muted-foreground">{formatRelativeTime(notification.createdAt)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-foreground text-left">{notification.title}</h3>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground text-left mb-3">{notification.message}</p>
                      {notification.type === 'invite' && (
                        <div className="flex gap-2">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                              if (acceptInvite) await acceptInvite(notification.id);
                            }}
                            className="flex-1 bg-success text-success-foreground py-2 px-4 rounded-lg font-semibold text-sm active:scale-[0.98] transition-transform"
                          >
                            Accept
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              clearNotification(notification.id);
                              if (declineInvite) await declineInvite(notification.id);
                            }}
                            className="flex-1 bg-secondary text-foreground py-2 px-4 rounded-lg font-semibold text-sm active:scale-[0.98] transition-transform"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                    {notification.type !== 'invite' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          clearNotification(notification.id);
                        }}
                        className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
                      >
                        <X size={16} className="text-destructive" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="bg-card border-t border-border px-5 py-4">
          <button
            onClick={clearAll}
            className="w-full py-4 rounded-xl font-semibold bg-destructive text-destructive-foreground active:scale-[0.98] transition-transform"
          >
            Clear All Notifications
          </button>
        </div>
      )}
    </div>
  );
}