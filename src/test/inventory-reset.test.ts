import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase-client', () => ({ supabase: api }));
import { WorkspaceService } from '@/lib/pharmacy-service';
import type { WsBatch } from '@/lib/pharmacy-types';

const batches: WsBatch[] = [
  { id: 'b1', product_id: 'p1', product_name: 'Product 1', branch_id: 'branch', batch_number: 'B1', quantity: 4, cost_per_unit: 10, expiry_date: '2030-01-01', received_date: null, days_to_expiry: 100, created_at: '' },
  { id: 'b2', product_id: 'p2', product_name: 'Product 2', branch_id: 'branch', batch_number: 'B2', quantity: 2, cost_per_unit: 10, expiry_date: '2030-01-01', received_date: null, days_to_expiry: 100, created_at: '' },
  { id: 'b3', product_id: 'p3', product_name: 'Product 3', branch_id: 'branch', batch_number: 'B3', quantity: 0, cost_per_unit: 10, expiry_date: '2030-01-01', received_date: null, days_to_expiry: 100, created_at: '' },
];

afterEach(() => {
  vi.restoreAllMocks();
  api.rpc.mockReset();
});

describe('inventory reset', () => {
  it('sets only positive batches to zero through the audited correction RPC', async () => {
    vi.spyOn(WorkspaceService, 'getBatches').mockResolvedValue(batches);
    api.rpc.mockResolvedValue({ error: null });

    await expect(WorkspaceService.resetInventory('pharmacy')).resolves.toEqual({ reset: 2, total: 2, failures: [] });
    expect(api.rpc).toHaveBeenCalledTimes(2);
    expect(api.rpc).toHaveBeenCalledWith('correct_batch_stock', {
      _pharmacy: 'pharmacy', _batch: 'b1', _quantity: 0, _reason: 'Inventory reset to zero',
    });
  });

  it('reports partial failures so the user can refresh and retry', async () => {
    vi.spyOn(WorkspaceService, 'getBatches').mockResolvedValue(batches);
    api.rpc.mockImplementation(async (_name: string, args: { _batch: string }) => ({
      error: args._batch === 'b2' ? { message: 'Not permitted' } : null,
    }));

    await expect(WorkspaceService.resetInventory('pharmacy')).resolves.toEqual({
      reset: 1, total: 2, failures: ['Product 2 (B2): Not permitted'],
    });
  });
});
