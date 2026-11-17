import type { AccountStatus } from './billing';

export const PLAN_FEATURES = {
  ai: 'Covlo AI and AI email reports',
  prescription: 'AI Prescription Assistant',
  forecasting: 'Market demand forecasting',
  import_ai: 'AI import matching',
  delivery: 'Delivery management',
} as const;
export type PlanFeature = keyof typeof PLAN_FEATURES;
export const FEATURE_COLUMNS = {
  ai: 'has_ai_insights', prescription: 'has_prescription_stt_ttt',
  forecasting: 'has_advanced_ai_forecasting', import_ai: 'has_bulk_import_ocr', delivery: 'has_delivery_management',
} as const;
export type PlanFeatureFlags = Partial<Record<(typeof FEATURE_COLUMNS)[PlanFeature], boolean | null>>;

/** Flags from the assigned plan are authoritative; missing flags never unlock features. */
export function hasPlanFeature(plan: PlanFeatureFlags | null | undefined, feature: PlanFeature): boolean {
  return plan?.[FEATURE_COLUMNS[feature]] === true;
}
export function canUsePlanFeature(plan: PlanFeatureFlags | null | undefined, feature: PlanFeature, status: AccountStatus, isAdmin = false): boolean {
  return isAdmin || ((status === 'active' || status === 'trial') && hasPlanFeature(plan, feature));
}