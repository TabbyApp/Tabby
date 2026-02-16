import { motion } from 'motion/react';
import { ChevronLeft, MessageCircle, Mail, BookOpen, ExternalLink, FileText } from 'lucide-react';
import { PageType } from '../App';

interface HelpSupportPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
}

export function HelpSupportPage({ onNavigate, theme }: HelpSupportPageProps) {
  const isDark = theme === 'dark';

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
            onClick={() => onNavigate('settings')}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Help & Support</h1>
        </div>
      </motion.div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <motion.div
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.12 }}
          className="space-y-6"
        >
          {/* Quick Actions */}
          <div>
            <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
              Get Help
            </h2>
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm`}>
              <button className={`w-full flex items-center gap-3 px-4 py-4 ${isDark ? 'active:bg-slate-700' : 'active:bg-gray-100'} transition-colors border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <MessageCircle size={20} className="text-blue-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Live Chat</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Chat with our support team</p>
                </div>
                <ExternalLink size={18} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
              </button>

              <button className={`w-full flex items-center gap-3 px-4 py-4 ${isDark ? 'active:bg-slate-700' : 'active:bg-gray-100'} transition-colors`}>
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Mail size={20} className="text-purple-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Email Support</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>support@tabby.app</p>
                </div>
                <ExternalLink size={18} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
              </button>
            </div>
          </div>

          {/* Resources */}
          <div>
            <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
              Resources
            </h2>
            <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm`}>
              <button className={`w-full flex items-center gap-3 px-4 py-4 ${isDark ? 'active:bg-slate-700' : 'active:bg-gray-100'} transition-colors border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <BookOpen size={20} className="text-green-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Help Center</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Browse articles and guides</p>
                </div>
                <ExternalLink size={18} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
              </button>

              <button className={`w-full flex items-center gap-3 px-4 py-4 ${isDark ? 'active:bg-slate-700' : 'active:bg-gray-100'} transition-colors border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <FileText size={20} className="text-orange-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Getting Started Guide</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Learn how to use Tabby</p>
                </div>
                <ExternalLink size={18} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
              </button>

              <button className={`w-full flex items-center gap-3 px-4 py-4 ${isDark ? 'active:bg-slate-700' : 'active:bg-gray-100'} transition-colors`}>
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <FileText size={20} className="text-red-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Terms of Service</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Read our terms and conditions</p>
                </div>
                <ExternalLink size={18} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
              </button>
            </div>
          </div>

          {/* FAQs */}
          <div>
            <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
              Frequently Asked Questions
            </h2>
            <div className="space-y-3">
              <motion.div
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.12 }}
                className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}
              >
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'} mb-2`}>
                  How do I split a bill with my group?
                </p>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Simply create a group, add members, and upload a receipt. Each person can select their items and Tabby will automatically calculate everyone's share.
                </p>
              </motion.div>

              <motion.div
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.12 }}
                className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}
              >
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'} mb-2`}>
                  Is my payment information secure?
                </p>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Yes! We use bank-level encryption and never store your full card details. All payments are processed through secure, PCI-compliant payment providers.
                </p>
              </motion.div>

              <motion.div
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.12 }}
                className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}
              >
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'} mb-2`}>
                  Can I use Tabby for business expenses?
                </p>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Absolutely! Many teams use Tabby for business lunches, team events, and shared expenses. You can export transaction histories for expense reports.
                </p>
              </motion.div>
            </div>
          </div>

          {/* App Info */}
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 text-center shadow-sm`}>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-1`}>Tabby Version 1.0.0</p>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>© 2026 Tabby Inc. All rights reserved.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
