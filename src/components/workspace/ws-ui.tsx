import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

export const inputCls =
  'w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:bg-slate-50';
export const labelCls = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1';
export const primaryBtn =
  'px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-sm transition-colors inline-flex items-center gap-1.5';
export const ghostBtn =
  'px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 text-xs font-bold transition-colors inline-flex items-center gap-1.5';
export const cardCls = 'bg-white rounded-2xl border border-slate-200/80 shadow-2xs';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string | undefined }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} p-5 space-y-4`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-black text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-center text-xs text-slate-400 font-medium py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">{children}</div>;
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-black text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}
