import React from 'react';
import { Database, Activity, Globe, Settings, Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';

declare const __BUILD_ID__: string;

export type ViewType = 'vault' | 'studio' | 'yt-dlp';

interface Props {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  onOpenSettings: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const SidebarRail: React.FC<Props> = ({ 
    currentView, 
    setView, 
    onOpenSettings, 
    theme, 
    setTheme 
}) => {
  const items = [
    { id: 'vault' as ViewType, icon: Database, label: 'Vault' },
    { id: 'studio' as ViewType, icon: Activity, label: 'Studio' },
    { id: 'yt-dlp' as ViewType, icon: Globe, label: 'yt-dlp' },
  ];

  return (
    <div className="w-20 flex flex-col items-center py-10 gap-10 relative z-[60] suite-glass-deep border-r border-[var(--color-outline)]">
      <div className="w-12 h-12 flex items-center justify-center mb-4 relative overflow-hidden group border border-[var(--color-outline)] bg-[var(--color-primary)]/10 rounded-[var(--radius-element)]">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <img src="/icon.png" className="w-8 h-8 object-contain opacity-80 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 select-none" alt="Material Suite Logo" />
      </div>

      <div className="flex-1 flex flex-col gap-6">
        {items.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "group relative w-14 h-14 transition-all duration-300 flex items-center justify-center rounded-[var(--radius-element)]",
                isActive 
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-lg" 
                    : "hover:bg-[var(--color-primary)]/10 opacity-40 hover:opacity-100"
              )}
            >
              <item.icon className={cn(
                  "w-6 h-6", 
                  isActive ? "scale-110" : "scale-100"
              )} />
              
              {/* Tooltip */}
              <div className="absolute left-20 px-4 py-2 text-[var(--color-on-surface)] text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap z-[100] suite-glass-subtle rounded-[var(--radius-element)] shadow-2xl border border-[var(--color-outline)]">
                  {item.label}
              </div>

              {isActive && (
                <motion.div 
                    layoutId="active-indicator"
                    className="absolute -left-1 w-1 h-8 bg-[var(--color-primary)] rounded-r-full"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-6">
        <button 
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="w-14 h-14 flex items-center justify-center transition-all rounded-[var(--radius-element)] opacity-40 hover:opacity-100 hover:bg-[var(--color-primary)]/10"
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
        <button 
          onClick={onOpenSettings}
          className="w-14 h-14 flex items-center justify-center transition-all rounded-[var(--radius-element)] opacity-40 hover:opacity-100 hover:bg-[var(--color-primary)]/10"
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>

      {/* Build Versioning */}
      <div className="absolute bottom-4 select-none pointer-events-none">
        <span className="text-[7px] font-black tracking-[0.3em] opacity-10 vertical-text uppercase">Build {__BUILD_ID__}</span>
      </div>
    </div>
  );
};

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}

export default SidebarRail;
