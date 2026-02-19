import { User, Users, Plus, Receipt, Home } from 'lucide-react';
import { PageType } from '../App';

interface BottomNavigationProps {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  onProfileClick: () => void;
  theme: 'light' | 'dark';
}

export function BottomNavigation({ currentPage, onNavigate, onProfileClick, theme }: BottomNavigationProps) {
  const isDark = theme === 'dark';
  
  return (
    <div className={`fixed bottom-0 left-0 right-0 ${isDark ? 'bg-slate-800/95' : 'bg-white/95'} backdrop-blur-2xl border-t ${isDark ? 'border-slate-700' : 'border-slate-200'} z-20 pb-[env(safe-area-inset-bottom,0px)]`}>
      <div className="mx-auto max-w-[430px] px-6 pt-3 pb-7">
        <div className="flex items-center justify-around">
          <button 
            onClick={() => onNavigate('home')}
            className="flex flex-col items-center gap-1.5 min-w-[60px]"
          >
            <div className={`w-11 h-11 rounded-[16px] ${isDark ? 'bg-slate-700' : 'bg-slate-100'} flex items-center justify-center`}>
              <Home size={22} className="text-gray-500" strokeWidth={2.5} />
            </div>
            <span className="text-[11px] text-gray-500 font-medium">Home</span>
          </button>

          <button 
            onClick={() => onNavigate('groups')}
            className="flex flex-col items-center gap-1.5 min-w-[60px]"
          >
            <div className={`w-11 h-11 rounded-[16px] ${currentPage === 'groups' ? 'bg-purple-600' : isDark ? 'bg-slate-700' : 'bg-slate-100'} flex items-center justify-center`}>
              <Users size={22} className={currentPage === 'groups' ? 'text-white' : 'text-gray-500'} strokeWidth={2.5} />
            </div>
            <span className={`text-[11px] ${currentPage === 'groups' ? 'text-purple-600 font-semibold' : 'text-gray-500 font-medium'}`}>Groups</span>
          </button>

          <button 
            onClick={() => onNavigate('createGroup')}
            className="flex flex-col items-center gap-1.5 min-w-[60px] -mt-4"
          >
            <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center shadow-lg">
              <Plus size={28} className="text-white" strokeWidth={2.5} />
            </div>
          </button>

          <button 
            onClick={() => onNavigate('activity')}
            className="flex flex-col items-center gap-1.5 min-w-[60px]"
          >
            <div className={`w-11 h-11 rounded-[16px] ${currentPage === 'activity' ? 'bg-purple-600' : isDark ? 'bg-slate-700' : 'bg-slate-100'} flex items-center justify-center`}>
              <Receipt size={22} className={currentPage === 'activity' ? 'text-white' : 'text-gray-500'} strokeWidth={2.5} />
            </div>
            <span className={`text-[11px] ${currentPage === 'activity' ? 'text-purple-600 font-semibold' : 'text-gray-500 font-medium'}`}>Activity</span>
          </button>

          <button 
            onClick={onProfileClick}
            className="flex flex-col items-center gap-1.5 min-w-[60px]"
          >
            <div className={`w-11 h-11 rounded-[16px] ${isDark ? 'bg-slate-700' : 'bg-slate-100'} flex items-center justify-center`}>
              <User size={22} className="text-gray-500" strokeWidth={2.5} />
            </div>
            <span className="text-[11px] text-gray-500 font-medium">Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}