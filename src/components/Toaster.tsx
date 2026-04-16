/**
 * Professional Suite Styled Toaster Component
 */

import React, { useState, createContext, useContext } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '../utils';

type ToastType = 'info' | 'success' | 'error' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToasterContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToasterContext = createContext<ToasterContextType | undefined>(undefined);

export function useToaster() {
  const context = useContext(ToasterContext);
  if (!context) throw new Error('useToaster must be used within a ToasterProvider');
  return context;
}

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = (message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  return (
    <ToasterContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-24 right-8 z-[200] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className="pointer-events-auto"
            >
              <ToastItem toast={t} onClose={() => setToasts(prev => prev.filter(item => item.id !== t.id))} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToasterContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const icons = {
    info: <Info className="w-5 h-5 text-[var(--color-primary)]" />,
    success: <CheckCircle2 className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertCircle className="w-5 h-5 text-orange-500" />,
  };

  return (
    <div className={cn(
      "flex items-center gap-4 px-6 py-4 rounded-[var(--radius-element)] suite-glass-deep border border-[var(--color-outline)] shadow-2xl min-w-[300px] max-w-[450px]"
    )}>
      <div className="flex-shrink-0">{icons[toast.type]}</div>
      <p className="flex-1 text-sm font-medium leading-relaxed">{toast.message}</p>
      <button 
        onClick={onClose}
        className="flex-shrink-0 p-1 hover:bg-[var(--color-outline)] rounded-[var(--radius-element)] transition-colors"
      >
        <X className="w-4 h-4 opacity-50" />
      </button>
    </div>
  );
}
