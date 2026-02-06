import { motion } from 'motion/react';
import { ChevronLeft, Sun, Moon, Smartphone, Check } from 'lucide-react';
import { PageType } from '../App';

interface AppearanceSettingsPageProps {
  onNavigate: (page: PageType, groupId?: number) => void;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  themePreference: 'light' | 'dark' | 'system';
}

export function AppearanceSettingsPage({ onNavigate, theme, onThemeChange, themePreference }: AppearanceSettingsPageProps) {
  const isDark = theme === 'dark';

  const themes = [
    { 
      id: 'light' as const, 
      name: 'Light', 
      icon: Sun, 
      description: 'A bright and clear interface',
      gradient: 'from-amber-400 to-orange-500'
    },
    { 
      id: 'dark' as const, 
      name: 'Dark', 
      icon: Moon, 
      description: 'Easy on the eyes in low light',
      gradient: 'from-slate-600 to-slate-800'
    },
    { 
      id: 'system' as const, 
      name: 'System', 
      icon: Smartphone, 
      description: 'Match your device settings',
      gradient: 'from-purple-500 to-indigo-600'
    },
  ];

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
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Appearance</h1>
        </div>
      </motion.div>

      {/* Theme Selection */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-4`}>
            Theme
          </h2>

          <div className="space-y-3">
            {themes.map((themeOption, index) => {
              const Icon = themeOption.icon;
              const isSelected = themePreference === themeOption.id;

              return (
                <motion.button
                  key={themeOption.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 + index * 0.1 }}
                  onClick={() => onThemeChange(themeOption.id)}
                  className={`w-full ${
                    isDark ? 'bg-slate-800' : 'bg-white'
                  } rounded-2xl p-5 active:scale-[0.98] transition-all ${
                    isSelected 
                      ? 'ring-2 ring-purple-500 shadow-lg' 
                      : 'shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${themeOption.gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                      <Icon size={24} className="text-white" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'} mb-1`}>
                        {themeOption.name}
                      </h3>
                      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {themeOption.description}
                      </p>
                    </div>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500 }}
                        className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0"
                      >
                        <Check size={18} className="text-white" strokeWidth={3} />
                      </motion.div>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Info Box */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className={`${isDark ? 'bg-purple-900/30 border-purple-700' : 'bg-purple-50 border-purple-200'} border rounded-2xl p-4 mt-6`}
          >
            <p className={`text-sm ${isDark ? 'text-purple-300' : 'text-purple-900'}`}>
              {themePreference === 'system' 
                ? '📱 Your app appearance will automatically match your iOS device settings. Currently using ' + (isDark ? 'Dark' : 'Light') + ' mode.'
                : '🎨 Your theme preference has been saved and will be applied across the app.'}
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
