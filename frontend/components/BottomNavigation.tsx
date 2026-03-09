import { User, Users, Plus, Receipt, Home } from 'lucide-react';
import { PageType } from '../App';

interface BottomNavigationProps {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  onProfileClick: () => void;
  theme: 'light' | 'dark';
}

export function BottomNavigation({ currentPage, onNavigate, onProfileClick, theme }: BottomNavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border z-20">
      <div className="mx-auto max-w-[430px] px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex items-center justify-around">
          <button
            onClick={() => onNavigate('home')}
            className="flex flex-col items-center gap-1 min-w-[60px]"
          >
            {currentPage === 'home' ? (
              <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center">
                <Home size={22} className="text-primary-foreground" strokeWidth={2.5} />
              </div>
            ) : (
              <Home size={22} className="text-muted-foreground" strokeWidth={2} />
            )}
            <span className={`text-[10px] font-semibold ${currentPage === 'home' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Home
            </span>
          </button>

          <button
            onClick={() => onNavigate('groups')}
            className="flex flex-col items-center gap-1 min-w-[60px]"
          >
            {currentPage === 'groups' ? (
              <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center">
                <Users size={22} className="text-primary-foreground" strokeWidth={2.5} />
              </div>
            ) : (
              <Users size={22} className="text-muted-foreground" strokeWidth={2} />
            )}
            <span className={`text-[10px] font-semibold ${currentPage === 'groups' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Groups
            </span>
          </button>

          <button
            onClick={() => onNavigate('createGroup')}
            className="flex flex-col items-center gap-1 min-w-[60px] -mt-2"
          >
            <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform shadow-lg">
              <Plus size={24} className="text-primary-foreground" strokeWidth={2.5} />
            </div>
          </button>

          <button
            onClick={() => onNavigate('activity')}
            className="flex flex-col items-center gap-1 min-w-[60px]"
          >
            {currentPage === 'activity' ? (
              <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center">
                <Receipt size={22} className="text-primary-foreground" strokeWidth={2.5} />
              </div>
            ) : (
              <Receipt size={22} className="text-muted-foreground" strokeWidth={2} />
            )}
            <span className={`text-[10px] font-semibold ${currentPage === 'activity' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Activity
            </span>
          </button>

          <button
            onClick={onProfileClick}
            className="flex flex-col items-center gap-1 min-w-[60px]"
          >
            {currentPage === 'account' ? (
              <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center">
                <User size={22} className="text-primary-foreground" strokeWidth={2.5} />
              </div>
            ) : (
              <User size={22} className="text-muted-foreground" strokeWidth={2} />
            )}
            <span className={`text-[10px] font-semibold ${currentPage === 'account' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Profile
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
