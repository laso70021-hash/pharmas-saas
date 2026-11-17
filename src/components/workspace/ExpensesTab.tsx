import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { WorkspaceService } from '@/lib/pharmacy-service';
import type { Workspace } from '@/lib/pharmacy-types';
import { filterByRange, toDayKey, type DateRange } from '@/lib/date-range';
import { can } from '@/lib/workspace';
import { formatNumber, formatDateDeterministic } from '@/lib/utils';
import { cardCls, Empty, Field, Modal, SectionHeader, errorText, ghostBtn, inputCls, primaryBtn } from './ws-ui';

const CATEGORIES = ['Rent', 'Salaries', 'Utilities', 'Transport', 'Licences & fees', 'Maintenance', 'Marketing', 'Other'];

export function ExpensesTab({ ws, userId, range }: { ws: Workspace; userId: string; range: DateRange | null }) {
  const pid = ws.id;
  const qc = useQueryClient();
  const editable = can(ws.role, 'manageExpenses', ws.status);
  const { data: all = [], isLoading } = useQuery({ queryKey: ['ws', pid, 'expenses'], queryFn: () => WorkspaceService.getExpenses(pid) });
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const expenses = filterByRange(all, (e) => e.expense_date, range);
  const total = expenses.reduce((a, e) => a + e.amount, 0);
  const byCategory = new Map<string, number>();
  for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      void qc.invalidateQueries({ queryKey: ['ws', pid, 'expenses'] });
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Expenses"
        subtitle={`TZS ${formatNumber(total)} in the selected dates`}
        action={editable && <button className={primaryBtn} onClick={() => setAdding(true)}><Plus className="w-3.5 h-3.5" /> Add expense</button>}
      />
      {byCategory.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...byCategory.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => (
            <span key={c} className="text-xs font-bold bg-white border border-slate-200 rounded-full px-3 py-1 text-slate-700">
              {c}: TZS {formatNumber(v)}
            </span>
          ))}
        </div>
      )}
      <div className={`${cardCls} p-5 overflow-x-auto`}>
        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : expenses.length === 0 ? (
          <Empty>No expenses in the selected dates.</Empty>
        ) : (
          <table className="w-full text-left text-xs min-w-[520px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-2">Date</th>
                <th className="py-2">Category</th>
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Amount</th>
                {editable && <th className="py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td className="py-2.5 text-slate-500">{formatDateDeterministic(e.expense_date)}</td>
                  <td className="py-2.5 font-bold text-slate-900">{e.category}</td>
                  <td className="py-2.5 text-slate-600">{e.description || '—'}</td>
                  <td className="py-2.5 text-right font-bold text-rose-600">TZS {formatNumber(e.amount)}</td>
                  {editable && (
                    <td className="py-2.5 text-right">
                      <button
                        className={ghostBtn}
                        aria-label="Delete expense"
                        disabled={busy}
                        onClick={() => confirm('Delete this expense?') && void run(() => WorkspaceService.deleteExpense(e.id), 'Expense deleted')}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {adding && <ExpenseForm busy={busy} onClose={() => setAdding(false)} onSave={(input) => void run(async () => {
        await WorkspaceService.addExpense(pid, userId, input);
        setAdding(false);
      }, 'Expense saved')} />}
    </div>
  );
}

function ExpenseForm({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean;
  onClose: () => void;
  onSave: (input: { category: string; amount: number; description: string; expense_date: string }) => void;
}) {
  const [category, setCategory] = useState(CATEGORIES[0] ?? 'Other');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => toDayKey(new Date()));
  return (
    <Modal title="Add expense" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const value = Number(amount);
          if (!value || value <= 0) return;
          onSave({ category, amount: value, description: description.trim(), expense_date: date });
        }}
      >
        <Field label="Category">
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Amount (TZS)"><input type="number" min={1} required className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Date"><input type="date" required className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Description"><input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <button type="submit" disabled={busy} className={`${primaryBtn} w-full justify-center py-2.5`}>{busy ? 'Saving…' : 'Save expense'}</button>
      </form>
    </Modal>
  );
}
