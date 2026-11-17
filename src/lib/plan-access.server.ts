import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { effectiveStatus } from './billing';
import { canUsePlanFeature, PLAN_FEATURES, type PlanFeature } from './plan-features';

/** Called only inside authenticated handlers, with the caller's RLS client. */
export async function requirePlanFeature(sb: SupabaseClient<Database>, pharmacyId: string, feature: PlanFeature) {
  const { data: business, error } = await sb.from('pharmacies').select('plan_id,status,trial_ends_at,subscription_ends_at').eq('id', pharmacyId).maybeSingle();
  if (error || !business) throw new Error('Business not found or not accessible.');
  const { data: admin, error: adminError } = await sb.rpc('is_platform_admin');
  if (adminError) throw new Error('Could not verify access.');
  const { data: plan, error: planError } = business.plan_id ? await sb.from('subscription_plans').select('has_ai_insights,has_prescription_stt_ttt,has_advanced_ai_forecasting,has_bulk_import_ocr,has_delivery_management').eq('id', business.plan_id).maybeSingle() : { data: null, error: null };
  if (planError) throw new Error('Could not verify your plan.');
  if (!canUsePlanFeature(plan, feature, effectiveStatus({ ...business, status: business.status ?? 'pending' }), admin === true)) throw new Error(`${PLAN_FEATURES[feature]} requires an eligible plan and a current trial or paid subscription. Ask the business owner to upgrade or renew.`);
  return plan;
}