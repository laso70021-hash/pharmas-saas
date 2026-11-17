import { expect, it } from 'vitest';
import { operationalRecommendations } from '../lib/ai-recommendations';
const products = [{ id: 'p1', pharmacy_id: 'business', name: 'Amoxicillin', min_stock_level: 10 }];
it('excludes expired units from restock availability and flags expired stock', () => {
  const alerts = operationalRecommendations(products, [{ product_id: 'p1', quantity: 25, expiry_date: '2026-11-15' }, { product_id: 'p1', quantity: 5, expiry_date: '2027-12-01' }], '2026-11-16');
  expect(alerts.find(a => a.category === 'inventory')?.description).toContain('5 usable units');
  expect(alerts.find(a => a.category === 'safety')?.description).toContain('25 expired units');
});
it('flags recorded positive stock within the inclusive 90-day expiry window', () => {
  const alerts = operationalRecommendations(products, [{ product_id: 'p1', quantity: 15, expiry_date: '2027-02-14' }, { product_id: 'p1', quantity: 30, expiry_date: '2027-02-15' }], '2026-11-16');
  expect(alerts.find(a => a.category === 'expiry')?.description).toContain('15 units');
  expect(alerts.some(a => a.category === 'inventory')).toBe(false);
});