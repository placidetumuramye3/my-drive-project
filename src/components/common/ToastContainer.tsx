import React from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  Loader2, 
  X 
} from 'lucide-react';
import { useToast, ToastType } from '../../context/ToastContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'loading':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-blue-600 shrink-0" />;
    }
  };

  const getBorderAndBg = (type: ToastType) => {
    switch (type) {
      case 'loading':
        return 'bg-white border-blue-200 shadow-blue-500/10';
      case 'success':
        return 'bg-white border-emerald-200 shadow-emerald-500/10';
      case 'error':
        return 'bg-white border-red-200 shadow-red-500/10';
      case 'warning':
        return 'bg-white border-amber-200 shadow-amber-500/10';
      default:
        return 'bg-white border-slate-200 shadow-slate-500/10';
    }
  };

  return (
    <div 
      aria-live="polite" 
      className="fixed top-20 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-xl transition-all animate-in slide-in-from-top-3 fade-in duration-200 ${getBorderAndBg(
            toast.type
          )}`}
        >
          <div className="mt-0.5">{getIcon(toast.type)}</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-slate-900 leading-snug">
              {toast.title}
            </h4>
            {toast.message && (
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed break-words">
                {toast.message}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0 ml-1"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
