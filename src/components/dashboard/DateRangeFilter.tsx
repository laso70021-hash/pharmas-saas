import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { DATE_PRESETS, customRange, presetRange, rangeLabel, type DateRange } from '@/lib/date-range';

interface DateRangeFilterProps {
  value: DateRange | null;
  onChange: (range: DateRange) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(value?.from ?? '');
  const [draftTo, setDraftTo] = useState(value?.to ?? '');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftFrom(value?.from ?? '');
    setDraftTo(value?.to ?? '');
  }, [value?.from, value?.to]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activeLabel = DATE_PRESETS.find((p) => p.id === value?.preset)?.label ?? 'All time';

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Date Range"
        className="flex flex-wrap items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs text-xs font-semibold text-slate-700 hover:border-blue-300 transition-colors"
      >
        <span className="text-slate-400 text-[11px] uppercase tracking-wider font-bold">Date Range</span>
        <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg text-slate-800 border border-slate-200/80">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>{rangeLabel(value)}</span>
        </span>
        <span className="text-[11px] font-bold text-blue-600">{activeLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose dates"
          className="absolute right-0 mt-2 z-40 w-[300px] bg-white rounded-2xl border border-slate-200 shadow-lg p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-900">Filter by date</span>
            <button type="button" onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Close">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {DATE_PRESETS.filter((p) => p.id !== 'custom').map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(presetRange(p.id));
                  setOpen(false);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                  value?.preset === p.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <form
            className="space-y-2.5 border-t border-slate-100 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              onChange(customRange(draftFrom, draftTo));
              setOpen(false);
            }}
          >
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Custom dates</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500">From</span>
                <input
                  type="date"
                  value={draftFrom}
                  max={draftTo || undefined}
                  onChange={(e) => setDraftFrom(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500">To</span>
                <input
                  type="date"
                  value={draftTo}
                  min={draftFrom || undefined}
                  onChange={(e) => setDraftTo(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={!draftFrom && !draftTo}
              className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold"
            >
              Apply dates
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
