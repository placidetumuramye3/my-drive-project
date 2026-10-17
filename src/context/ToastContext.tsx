import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'loading';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, 0 means sticky until updated/dismissed
  createdAt: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'createdAt' | 'id'> & { id?: string }) => string;
  updateToast: (id: string, updates: Partial<Omit<ToastItem, 'id' | 'createdAt'>>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, number>>({});

  const dismissToast = useCallback((id: string) => {
    if (timersRef.current[id]) {
      window.clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ id, type, title, message, duration }: Omit<ToastItem, 'createdAt' | 'id'> & { id?: string }): string => {
      const toastId = id || 'toast_' + Math.random().toString(36).substring(2, 9);
      const autoDismissDuration = duration !== undefined ? duration : type === 'loading' ? 0 : 4500;

      // Clear existing timer if updating with same id
      if (timersRef.current[toastId]) {
        window.clearTimeout(timersRef.current[toastId]);
        delete timersRef.current[toastId];
      }

      setToasts((prev) => {
        const filtered = prev.filter((t) => t.id !== toastId);
        return [
          ...filtered,
          {
            id: toastId,
            type,
            title,
            message,
            duration: autoDismissDuration,
            createdAt: Date.now(),
          },
        ];
      });

      if (autoDismissDuration > 0) {
        timersRef.current[toastId] = window.setTimeout(() => {
          dismissToast(toastId);
        }, autoDismissDuration);
      }

      return toastId;
    },
    [dismissToast]
  );

  const updateToast = useCallback(
    (id: string, updates: Partial<Omit<ToastItem, 'id' | 'createdAt'>>) => {
      if (timersRef.current[id]) {
        window.clearTimeout(timersRef.current[id]);
        delete timersRef.current[id];
      }

      const newDuration =
        updates.duration !== undefined
          ? updates.duration
          : updates.type === 'loading'
          ? 0
          : 4500;

      setToasts((prev) =>
        prev.map((t) => {
          if (t.id === id) {
            return {
              ...t,
              ...updates,
              duration: newDuration,
            };
          }
          return t;
        })
      );

      if (newDuration > 0) {
        timersRef.current[id] = window.setTimeout(() => {
          dismissToast(id);
        }, newDuration);
      }
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, updateToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
