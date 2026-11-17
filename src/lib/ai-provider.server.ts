/** All platform inference uses the owner's OpenRouter account. Never replay or switch providers on failure. */
import { z } from 'zod';
import { getRequestHeader } from '@tanstack/react-start/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export const OPENROUTER_MODEL = 'openai/gpt-5.6-terra';
export class GatewayError extends Error {
  constructor(public code: string, public httpStatus?: number) { super(code === 'token_quota' ? 'This business has used all AI tokens in its plan for this month. Upgrade the plan or wait for the monthly reset.' : `OpenRouter unavailable (${httpStatus ?? code}).`); }
  ids: Record<string, string> = {};
}
type Part = { type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail?: string } | { type: 'input_file'; filename: string; file_data: string };
type Msg = { role: 'user' | 'assistant' | 'system'; content: string | Part[] };
type Format = { type: 'json_object' } | { type: 'json_schema'; name: string; strict?: boolean; schema: unknown };
export interface AIRequest { model: string; instructions?: string; input: string | Msg[]; text?: { format: Format }; audit?: { supabase: SupabaseClient; userId?: string; pharmacyId?: string; feature: string } }
type Content = { type: 'output_text'; text: string } | { type: 'refusal'; refusal: string };
export type AIResult = { output: { type: 'message'; content: Content[] }[] };
const responseSchema = z.object({ usage: z.object({ total_tokens: z.number().optional() }).nullish(), choices: z.array(z.object({ message: z.object({ content: z.string().nullable().optional(), refusal: z.string().nullable().optional() }) })).min(1) });
function toChat(m: Msg) {
  return { role: m.role, content: typeof m.content === 'string' ? m.content : m.content.map(p => p.type === 'input_text' ? { type: 'text', text: p.text } : p.type === 'input_image' ? { type: 'image_url', image_url: { url: p.image_url } } : { type: 'file', file: { filename: p.filename, file_data: p.file_data } }) };
}
export async function generateResponse(req: AIRequest): Promise<AIResult> {
  const key = process.env['OPENROUTER_API'] || process.env['OPENROUTER_API_KEY'];
  const start = Date.now(); let status = 'failed'; let tokens: number | null = null;
  try {
    if (!key) throw new GatewayError('configuration');
    if (req.audit) {
      const featureFlags: Record<string, string> = { prescription: 'prescription-analysis', invoice_scan: 'ocr-import', import_category: 'ocr-import', recommendations: 'expiry-prediction', email_report: 'sales-insights', covlo: 'sales-insights', admin_assistant: 'sales-insights' };
      const slug = featureFlags[req.audit.feature];
      if (slug) {
        const { data, error } = await req.audit.supabase.from('ai_features').select('is_enabled').eq('slug', slug).maybeSingle();
        if (error) throw new GatewayError('feature_check_failed');
        if (data?.is_enabled === false) throw new GatewayError('feature_disabled');
      }
    }
    if (req.audit?.pharmacyId) {
      const { data: quota, error: quotaError } = await req.audit.supabase.rpc('pharmacy_ai_tokens' as never, { _pharmacy_id: req.audit.pharmacyId } as never);
      const row = (Array.isArray(quota) ? quota[0] : quota) as { token_limit: number | null; tokens_used: number } | null;
      if (!quotaError && row && row.token_limit != null && Number(row.tokens_used) >= row.token_limit) {
        status = 'quota_exceeded';
        throw new GatewayError('token_quota');
      }
    }
    const messages = [...(req.instructions ? [{ role: 'system', content: req.instructions }] : []), ...(typeof req.input === 'string' ? [{ role: 'user', content: req.input }] : req.input.map(toChat))];
    const f = req.text?.format;
    let origin: string | undefined;
    try { const h = getRequestHeader('origin'); if (h && /^https?:\/\//.test(h)) origin = new URL(h).origin; } catch { /* Offline provider tests have no incoming request. */ }
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Afyadawa', ...(origin ? { 'HTTP-Referer': origin } : {}) },
      body: JSON.stringify({ model: OPENROUTER_MODEL, messages, ...(f ? { response_format: f.type === 'json_object' ? { type: 'json_object' } : { type: 'json_schema', json_schema: { name: f.name, strict: f.strict ?? true, schema: f.schema } } } : {}) }),
    });
    if (!res.ok) throw new GatewayError(res.status === 402 ? 'payment_required' : res.status === 429 ? 'rate_limit' : 'request_failed', res.status);
    const parsed = responseSchema.parse(await res.json());
    tokens = parsed.usage?.total_tokens ?? null;
    const msg = parsed.choices[0]?.message;
    if (!msg || (!msg.content?.trim() && !msg.refusal)) throw new GatewayError('empty_response');
    status = msg.refusal ? 'refused' : 'success';
    return { output: [{ type: 'message', content: msg.refusal ? [{ type: 'refusal', refusal: msg.refusal }] : [{ type: 'output_text', text: msg.content ?? '' }] }] };
  } finally {
    if (req.audit) {
      const { supabase, userId, pharmacyId, feature } = req.audit;
      try {
        const { error } = await supabase.from('ai_request_logs').insert({ user_id: userId ?? null, pharmacy_id: pharmacyId ?? null, feature_slug: feature, status, tokens_used: tokens, execution_time_ms: Date.now() - start });
        if (error) console.error('AI request audit could not be saved');
      } catch { console.error('AI request audit unavailable'); }
    }
  }
}
export function outputText(res: AIResult) {
  return res.output.flatMap(i => i.content).filter((c): c is { type: 'output_text'; text: string } => c.type === 'output_text').map(c => c.text).join('').trim();
}
