import { describe, expect, it } from 'vitest';
import { canUsePlanFeature, hasPlanFeature, type PlanFeatureFlags } from '@/lib/plan-features';

const essential: PlanFeatureFlags = { has_ai_insights: false, has_prescription_stt_ttt: false, has_advanced_ai_forecasting: false, has_bulk_import_ocr: false, has_delivery_management: false };
const retail: PlanFeatureFlags = { ...essential, has_ai_insights: true, has_prescription_stt_ttt: true };
const pro: PlanFeatureFlags = { has_ai_insights: true, has_prescription_stt_ttt: true, has_advanced_ai_forecasting: true, has_bulk_import_ocr: true, has_delivery_management: true };
describe('assigned plan access', () => {
  it('uses plan flags, not a role or assumed plan name', () => {
    expect(hasPlanFeature(essential, 'ai')).toBe(false);
    expect(hasPlanFeature(retail, 'ai')).toBe(true);
  });
  it('keeps prescription AI separate from the manual prescription queue', () => {
    expect(hasPlanFeature(essential, 'prescription')).toBe(false);
    expect(hasPlanFeature(retail, 'prescription')).toBe(true);
  });
  it('requires advanced forecasting for market demand', () => {
    expect(hasPlanFeature(retail, 'forecasting')).toBe(false);
    expect(hasPlanFeature(pro, 'forecasting')).toBe(true);
  });
  it('gates AI import matching independently from ordinary spreadsheet imports', () => {
    expect(hasPlanFeature(retail, 'import_ai')).toBe(false);
    expect(hasPlanFeature(pro, 'import_ai')).toBe(true);
  });
  it('requires the delivery management flag', () => {
    expect(hasPlanFeature(retail, 'delivery')).toBe(false);
    expect(hasPlanFeature(pro, 'delivery')).toBe(true);
  });
  it('blocks expired, suspended and pending businesses even with an eligible plan', () => {
    for (const status of ['expired', 'suspended', 'pending', 'rejected'] as const) expect(canUsePlanFeature(pro, 'ai', status)).toBe(false);
    expect(canUsePlanFeature(pro, 'ai', 'trial')).toBe(true);
    expect(canUsePlanFeature(pro, 'ai', 'active')).toBe(true);
  });
  it('fails closed for missing plan or flag', () => {
    expect(hasPlanFeature(null, 'ai')).toBe(false);
    expect(hasPlanFeature({}, 'ai')).toBe(false);
  });
  it('retains platform administrator support access', () => {
    expect(canUsePlanFeature(essential, 'ai', 'expired', true)).toBe(true);
    expect(canUsePlanFeature(essential, 'ai', 'expired', false)).toBe(false);
  });
  it('applies changed plan flags to existing accounts', () => {
    expect(canUsePlanFeature(retail, 'import_ai', 'active')).toBe(false);
    expect(canUsePlanFeature(pro, 'import_ai', 'active')).toBe(true);
    expect(canUsePlanFeature(essential, 'ai', 'active')).toBe(false);
  });
});