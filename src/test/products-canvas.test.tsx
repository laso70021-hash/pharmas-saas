import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WsProduct } from '@/lib/pharmacy-types';
import { ProductsCanvas } from '@/components/workspace/ProductsCanvas';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const product = (id: string, name: string, is_active = true): WsProduct => ({
  id,
  name,
  generic_name: '',
  sku: id,
  barcode: '',
  dosage_form: '',
  strength: '',
  cost_price: 10,
  selling_price: 20,
  min_stock_level: 1,
  is_prescription_required: false,
  is_active,
  image_path: null,
  image_src: null,
  stock: 0,
  stock_by_branch: {},
  nearest_expiry: null,
  created_at: new Date().toISOString(),
});

function renderCanvas(onBulkDelete: (ids: string[]) => Promise<boolean>, onReactivate = vi.fn().mockResolvedValue(undefined)) {
  return render(
    <ProductsCanvas
      products={[product('p1', 'Paracetamol'), product('p2', 'Ibuprofen'), product('p3', 'Inactive medicine', false)]}
      batches={[]}
      branches={[]}
      editable
      busy={false}
      onEdit={() => {}}
      onStock={() => {}}
      onReactivate={onReactivate}
      onBulkDelete={onBulkDelete}
    />,
  );
}

describe('bulk product removal', () => {
  it('removes selected active products from the catalogue and preserves inactive products', async () => {
    const onBulkDelete = vi.fn().mockResolvedValue(true);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderCanvas(onBulkDelete);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select active products on this page' }));
    expect(screen.getByRole('button', { name: 'Delete selected (2)' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Select product Inactive medicine' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected (2)' }));

    await waitFor(() => expect(onBulkDelete).toHaveBeenCalledWith(expect.arrayContaining(['p1', 'p2'])));
    expect(onBulkDelete.mock.calls[0]?.[0]).toHaveLength(2);
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Sales and stock history will be preserved.'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete selected (0)' })).toBeDisabled());
  }, 10000);

  it('keeps selection when removal is cancelled', () => {
    const onBulkDelete = vi.fn().mockResolvedValue(true);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderCanvas(onBulkDelete);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select product Paracetamol' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected (1)' }));

    expect(onBulkDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete selected (1)' })).toBeEnabled();
  });

  it('allows an inactive product to be reactivated', () => {
    const onReactivate = vi.fn().mockResolvedValue(undefined);
    renderCanvas(vi.fn().mockResolvedValue(true), onReactivate);

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Inactive medicine' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reactivate product' }));

    expect(onReactivate).toHaveBeenCalledWith('p3');
  });
});
