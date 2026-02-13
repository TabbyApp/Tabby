import { ChevronLeft, Users, UsersRound } from 'lucide-react';
import { PageType } from '../App';

interface CreateExpensePageProps {
  onNavigate: (page: PageType) => void;
  theme: 'light' | 'dark';
}

export function CreateExpensePage({ onNavigate, theme }: CreateExpensePageProps) {
  const isDark = theme === 'dark';

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Quick Actions</h1>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5">
        <div className="w-full space-y-4">
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-800'} text-center mb-6`}>
            How would you like to start?
          </h2>

          <button
            onClick={() => onNavigate('createGroup')}
            className={`w-full ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 shadow-sm active:scale-[0.98] transition-transform flex items-center gap-4`}
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
              <Users size={24} className="text-white" strokeWidth={2} />
            </div>
            <div className="flex-1 text-left">
              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'} text-lg`}>Create Group</h3>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Set up a new payment group</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('groups')}
            className={`w-full ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 shadow-sm active:scale-[0.98] transition-transform flex items-center gap-4`}
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <UsersRound size={24} className="text-white" strokeWidth={2} />
            </div>
            <div className="flex-1 text-left">
              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'} text-lg`}>View Groups</h3>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Open a group to pay or split</p>
            </div>
          </button>

          <p className={`text-center text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'} mt-4`}>
            Upload a receipt or enter total in a group to split
          </p>
        </div>
      </div>
    </div>
  );
}
