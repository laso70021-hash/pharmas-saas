/** Role focus for Covlo; keeps advice relevant to each person's job. */
export const COVLO_ROLES: Record<string, { brief: string; prompts: string[] }> = {
  pharmacy_owner: { brief: 'You advise the pharmacy owner on profit, stock, staff and growth.', prompts: ['How is my business doing this month?', 'What should I restock this week?', 'Which batches should I sell first?'] },
  manager: { brief: 'You help the branch manager run daily operations, stock and staff.', prompts: ['What needs my attention today?', 'Which products are low?', 'Summarise this month\'s sales'] },
  pharmacist: { brief: 'You help the pharmacist with dispensing, prescriptions and expiry.', prompts: ['How many prescriptions are waiting?', 'Which batches expire soon?', 'General dosage of amoxicillin for adults?'] },
  cashier: { brief: 'You help the cashier with sales, payments and today\'s till.', prompts: ['How much have we sold today?', 'Which payment methods are used most?', 'Which products are out of stock?'] },
  accountant: { brief: 'You help the accountant with sales totals, margins and expenses.', prompts: ['Total sales for the last 30 days?', 'Give me a short finance summary', 'How do I export a sales report?'] },
  inventory_manager: { brief: 'You help the inventory manager with stock levels, reorders and expiry.', prompts: ['List low-stock products', 'How many batches expire within 90 days?', 'Suggest reorder quantities'] },
  delivery_rider: { brief: 'You help the delivery rider track orders and deliveries.', prompts: ['Which orders are in transit?', 'What is my next delivery?', 'How do I mark an order delivered?'] },
  supplier: { brief: 'You advise the wholesale supplier on orders, stock, demand and what pharmacies buy most.', prompts: ['Which orders need action?', 'What should I stock for next month?', 'Which of my products are low?'] },
  platform_admin: { brief: 'You help the platform administrator review this business.', prompts: ['Summarise this business', 'Any stock or expiry risks?', 'Recent wholesale activity?'] },
};
export const covloRoleBrief = (role: string) => (COVLO_ROLES[role] ?? COVLO_ROLES['manager']!).brief;
export const covloPrompts = (role: string) => (COVLO_ROLES[role] ?? COVLO_ROLES['manager']!).prompts;

export type DemandRow = { product: string; strength: string; units_90d: number; units_30d: number; units_prev_30d: number; pharmacies: number; your_stock: number };
/** Trend % vs previous 30 days, and next-month batch = recent 30-day demand grown by the trend (capped ±50%), minus stock on hand. */
export function demandPlan(r: DemandRow) {
  const trend = r.units_prev_30d > 0 ? Math.round(((r.units_30d - r.units_prev_30d) / r.units_prev_30d) * 100) : r.units_30d > 0 ? 100 : 0;
  const growth = Math.max(-50, Math.min(50, trend)) / 100;
  const expected = Math.round(r.units_30d * (1 + growth));
  return { trend, expected, nextBatch: Math.max(0, expected - r.your_stock), trending: trend >= 20 && r.units_30d >= 10 };
}
