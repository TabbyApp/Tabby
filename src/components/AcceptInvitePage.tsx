import { motion } from 'motion/react';
import { Users, Check, X, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { PageType } from '../App';

interface AcceptInvitePageProps {
  onNavigate: (page: PageType, groupId?: number) => void;
  theme: 'light' | 'dark';
  inviteCode?: string;
}

export function AcceptInvitePage({ onNavigate, theme, inviteCode }: AcceptInvitePageProps) {
  const isDark = theme === 'dark';
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock invite data - would be fetched from API based on inviteCode
  const invite = {
    groupName: 'Weekend Brunch Club',
    inviterName: 'Sarah Mitchell',
    inviterAvatar: '👩',
    members: 5,
    recentActivity: 'Last expense: Coffee Shop - $23.50',
    color: '#F97316',
  };

  const handleAccept = async () => {
    setIsAccepting(true);
    setError(null);
    
    // Mock API call
    setTimeout(() => {
      // In real app: API call to accept invite
      console.log('Accepting invite:', inviteCode);
      setIsAccepting(false);
      // Navigate to the group after accepting
      onNavigate('groupDetail', 1); // Would use actual group ID from API
    }, 1500);
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    setError(null);
    
    // Mock API call
    setTimeout(() => {
      // In real app: API call to decline invite
      console.log('Declining invite:', inviteCode);
      setIsDeclining(false);
      // Navigate back to home
      onNavigate('home');
    }, 1000);
  };

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50'}`}>
      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="w-full max-w-md"
        >
          {/* Group Icon */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center mb-6"
          >
            <div 
              className="w-28 h-28 rounded-[32px] flex items-center justify-center shadow-2xl"
              style={{ backgroundColor: invite.color }}
            >
              <Users size={56} className="text-white" strokeWidth={2} />
            </div>
          </motion.div>

          {/* Group Info */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center mb-8"
          >
            <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-2`}>
              You're Invited!
            </h1>
            <p className={`text-lg ${isDark ? 'text-slate-300' : 'text-slate-700'} mb-4`}>
              Join <span className="font-bold">{invite.groupName}</span>
            </p>
            <div className={`${isDark ? 'bg-slate-800/50' : 'bg-white/70'} backdrop-blur-sm rounded-2xl p-4 inline-block`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center text-xl">
                  {invite.inviterAvatar}
                </div>
                <div className="text-left">
                  <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {invite.inviterName}
                  </p>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    invited you
                  </p>
                </div>
              </div>
              <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} text-left space-y-1 mt-3 pt-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <p>👥 {invite.members} members</p>
                <p>📊 {invite.recentActivity}</p>
              </div>
            </div>
          </motion.div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${isDark ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200'} border rounded-xl p-3 mb-4 flex items-center gap-2`}
            >
              <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
              <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-800'}`}>{error}</p>
            </motion.div>
          )}

          {/* Action Buttons */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="space-y-3"
          >
            <button
              onClick={handleAccept}
              disabled={isAccepting || isDeclining}
              className={`w-full py-4 rounded-[20px] font-bold shadow-2xl transition-all flex items-center justify-center gap-2.5 text-[17px] ${
                isAccepting || isDeclining
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-400/50 active:scale-[0.98]'
              }`}
            >
              {isAccepting ? (
                <>
                  <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <Check size={24} strokeWidth={2.5} />
                  Accept Invitation
                </>
              )}
            </button>

            <button
              onClick={handleDecline}
              disabled={isAccepting || isDeclining}
              className={`w-full py-4 rounded-[20px] font-bold transition-all flex items-center justify-center gap-2.5 text-[17px] ${
                isAccepting || isDeclining
                  ? isDark ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : isDark ? 'bg-slate-800 text-white active:scale-[0.98]' : 'bg-white text-slate-700 shadow-lg active:scale-[0.98]'
              }`}
            >
              {isDeclining ? (
                <>
                  <div className={`w-5 h-5 border-3 ${isDark ? 'border-white' : 'border-slate-700'} border-t-transparent rounded-full animate-spin`} />
                  Declining...
                </>
              ) : (
                <>
                  <X size={24} strokeWidth={2.5} />
                  Decline
                </>
              )}
            </button>
          </motion.div>

          {/* Info Message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className={`mt-6 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
          >
            <p>By accepting, you'll be able to split bills and track expenses with this group.</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
