import { afterEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => ({ result: { data: [] as any[], error: null as { message: string } | null } }));
vi.mock('@/lib/supabase-client', () => ({
  supabase: { from: () => ({ select: () => {
    const chain = {
      then: (resolve: (value: typeof query.result) => unknown) => Promise.resolve(query.result).then(resolve),
      order: () => chain,
      limit: () => chain,
    };
    return chain;
  } }) },
}));
import { PharmacyService } from '@/lib/pharmacy-service';

afterEach(() => { query.result = { data: [], error: null }; });

describe('backend data is authoritative', () => {
  it('does not invent healthy services when no checks exist', async () => {
    expect(await PharmacyService.getSystemHealth()).toEqual([]);
  });

  it('surfaces backend failures instead of returning successful empty data', async () => {
    query.result.error = { message: 'Backend unavailable' };
    await expect(PharmacyService.getSystemHealth()).rejects.toThrow('Backend unavailable');
    await expect(PharmacyService.getPlans()).rejects.toThrow('Backend unavailable');
    await expect(PharmacyService.getSoldProducts()).rejects.toThrow('Backend unavailable');
  });

  it('reads sold product rows without inventing results', async () => {
    expect(await PharmacyService.getSoldProducts()).toEqual([]);
  });

  it('derives product stock and sales from backend batches and sale items', async () => {
    query.result.data = [{ id: 'p', name: 'Medicine', categories: { name: 'Stored category' },
      inventory_batches: [{ quantity: 4, expiry_date: '2030-01-01' }, { quantity: 6, expiry_date: '2029-01-01' }],
      sale_items: [{ quantity: 2, total_price: 400 }],
    }, { id: 'empty', name: 'No stock' }];
    const products = await PharmacyService.getProducts();
    expect(products[0]).toMatchObject({ stock_quantity: 10, units_sold: 2, total_sales: 400, expiry_date: '2029-01-01', category: 'Stored category' });
    expect(products[1]).toMatchObject({ stock_quantity: 0, dosage: '', sku: '', expiry_date: '' });
  });

  it('preserves stored annual totals and plan token allowances', async () => {
    query.result.data = [{ id: 'plan', slug: 'custom', annual_price: 123456, ai_tokens_monthly: 42, features: [] }];
    expect((await PharmacyService.getPlans())[0]).toMatchObject({ price_tzs_annual: 123456, ai_tokens_monthly: 42, features: [] });
  });
});
