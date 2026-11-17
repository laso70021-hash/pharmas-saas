import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { operationalRecommendations } from './ai-recommendations';
export const refreshRecommendations = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const sb = context.supabase;
  const { data: admin } = await sb.rpc('is_platform_admin');
  if (!admin) throw new Error('Administrator access required.');
  const readAll = async <T,>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) => {
    const rows: T[] = [];
    for (let from = 0; ; from += 500) {
      const result = await query(from, from + 499);
      if (result.error) throw new Error('Could not read live inventory.');
      rows.push(...(result.data ?? []));
      if ((result.data?.length ?? 0) < 500) return rows;
    }
  };
  const [products, batches] = await Promise.all([
    readAll((f, t) => sb.from('products').select('id,pharmacy_id,name,min_stock_level').eq('is_active', true).order('id').range(f, t)),
    readAll((f, t) => sb.from('inventory_batches').select('id,product_id,quantity,expiry_date').gt('quantity', 0).order('id').range(f, t)),
  ]);
  const alerts = operationalRecommendations(products, batches, new Date().toISOString().slice(0, 10));
  if (alerts.length) {
    const { generateResponse, outputText } = await import('./ai-provider.server');
    const res = await generateResponse({ model: 'openai/gpt-5.6-terra', audit: { supabase: sb, userId: context.userId, feature: 'recommendations' },
      instructions: 'Prioritize recorded operational alerts. Return JSON {keys:[alert keys in priority order]}. Only select supplied keys. Expired medicines first. Never invent alerts or clinical advice.', input: JSON.stringify(alerts.slice(0, 100)), text: { format: { type: 'json_object' } } });
    const priority = z.object({ keys: z.array(z.string()).max(100) }).parse(JSON.parse(outputText(res))).keys;
    if (priority.some(key => !alerts.some(a => a.key === key))) throw new Error('AI returned an invalid alert reference.');
    alerts.sort((a, b) => { const ai = priority.indexOf(a.key), bi = priority.indexOf(b.key); return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi); });
  }
  const { error: clearError } = await sb.from('ai_recommendations').delete().contains('metadata', { source: 'live_inventory' });
  if (clearError) throw new Error('Could not update recommendations.');
  for (let i = 0; i < alerts.length; i += 100) {
    const { error } = await sb.from('ai_recommendations').insert(alerts.slice(i, i + 100).map(({ key, ...alert }) => ({ ...alert, status: 'pending', metadata: { source: 'live_inventory', key, generated_at: new Date().toISOString() } })));
    if (error) throw new Error('Could not save recommendations.');
  }
  return { count: alerts.length };
});
