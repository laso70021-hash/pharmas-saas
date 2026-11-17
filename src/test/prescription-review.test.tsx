import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PrescriptionAssistant } from '@/components/workspace/PrescriptionAssistant';
const analyze = vi.hoisted(() => vi.fn(async () => ({
  analysis: { transcription: 'Paracetamol 500mg', warnings: [], medicines: [{ written_name: 'Paracetamol 500mg', product_id: 'our-product', quantity: null, instructions: '1 tablet twice daily', uncertain: false }] },
  catalogue: [{ id: 'our-product', name: 'Paracetamol', strength: '500mg', stock: 12 }],
})));
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock('@/lib/prescription-assistant.functions', () => ({ analyzePrescription: analyze }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('requires explicit approval and a valid reviewed quantity before entering the queue', async () => {
  const apply = vi.fn();
  render(<PrescriptionAssistant pharmacyId="our-pharmacy" branchId="our-branch" onApply={apply} />);
  fireEvent.change(screen.getByLabelText('Prescription medicine details'), { target: { value: 'Paracetamol 500mg, 1 tablet twice daily' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /I am authorized/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
  const approval = await screen.findByRole('checkbox', { name: 'Approve Paracetamol 500mg' });
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(approval);
  expect(screen.getByRole('button', { name: 'Use reviewed medicines (0)' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Reviewed quantity 1'), { target: { value: '13' } });
  expect(screen.getByRole('button', { name: 'Use reviewed medicines (0)' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Reviewed quantity 1'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Use reviewed medicines (1)' }));
  expect(apply).toHaveBeenCalledWith([{ product_id: 'our-product', name: 'Paracetamol 500mg', quantity: 10, instructions: '1 tablet twice daily' }]);
  expect(analyze).toHaveBeenCalledWith({ data: { pharmacyId: 'our-pharmacy', branchId: 'our-branch', text: 'Paracetamol 500mg, 1 tablet twice daily', image: undefined } });
});