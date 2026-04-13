import React from 'react';
import { Database, Activity, Globe, Settings, Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';

export type ViewType = 'vault' | 'studio' | 'transmission';

interface Props {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  onOpenAppData: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const SidebarRail: React.FC<Props> = ({ currentView, setView, onOpenAppData, theme, setTheme }) => {
  const items = [
    { id: 'vault' as ViewType, icon: Database, label: 'Vault' },
    { id: 'studio' as ViewType, icon: Activity, label: 'Studio' },
    { id: 'transmission' as ViewType, icon: Globe, label: 'Transmission' },
  ];

  return (
    <div className="w-20 bg-black/40 border-r border-[var(--color-outline)] flex flex-col items-center py-10 gap-10 relative z-[60] backdrop-blur-3xl">
      <div className="w-12 h-12 bg-[var(--color-primary)] rounded-2xl flex items-center justify-center shadow-[0_0_20px_var(--color-primary)] mb-4">
          <div className="w-6 h-6 border-4 border-white rounded-full opacity-20" />
      </div>

      <div className="flex-1 flex flex-col gap-6">
        {items.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "group relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500",
                isActive ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-lg" : "hover:bg-white/5 opacity-40 hover:opacity-100"
              )}
            >
              <item.icon className={cn("w-6 h-6", isActive ? "scale-110" : "scale-100")} />
              
              {/* Tooltip */}
              <div className="absolute left-20 px-4 py-2 bg-[var(--color-surface-variant)] text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all shadow-2xl border border-[var(--color-outline)] whitespace-nowrap z-[100]">
                  {item.label}
              </div>

              {isActive && (
                <motion.div 
                    layoutId="active-indicator"
                    className="absolute -left-1 w-1 h-8 bg-white rounded-r-full"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-6">
        <button 
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="w-14 h-14 rounded-2xl flex items-center justify-center hover:bg-white/5 opacity-40 hover:opacity-100 transition-all"
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
        <button 
          onClick={onOpenAppData}
          className="w-14 h-14 rounded-2xl flex items-center justify-center hover:bg-white/5 opacity-40 hover:opacity-100 transition-all"
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}

export default SidebarRail;
