import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { reportPreferenceInput } from './management';
export const getReportSettings=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({pharmacyId:z.string().uuid()}).parse(v)).handler(async({data,context})=>{
 const {data:admin}=await context.supabase.rpc('is_platform_admin');const {data:owner}=await context.supabase.rpc('is_pharmacy_owner',{_pharmacy_id:data.pharmacyId});if(!admin&&!owner)throw new Error('Only owners and administrators can configure reports.');
 const [{data:prefs,error},{data:staff},{data:business}]=await Promise.all([context.supabase.from('ai_report_preferences').select('*').eq('pharmacy_id',data.pharmacyId),context.supabase.from('pharmacy_memberships').select('user_id,role,branch_id,branch_ids,is_active').eq('pharmacy_id',data.pharmacyId),context.supabase.from('pharmacies').select('owner_id').eq('id',data.pharmacyId).single()]);if(error)throw error;
 const ids=[...new Set([business?.owner_id,...(staff??[]).filter(s=>s.is_active&&['manager','accountant'].includes(s.role)&&!s.branch_id&&!s.branch_ids?.length).map(s=>s.user_id)].filter((s):s is string=>!!s))];
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const recipients=[] as {id:string;name:string;email:string}[];
 for(const id of ids){const {data:u}=await supabaseAdmin.auth.admin.getUserById(id);if(u.user?.email_confirmed_at&&u.user.email){const {data:profile}=await context.supabase.from('profiles').select('full_name').eq('id',id).maybeSingle();recipients.push({id,name:profile?.full_name||u.user.email,email:u.user.email});}}
 const prefIds=(prefs??[]).map(p=>p.id);const history=prefIds.length?await context.supabase.from('ai_report_runs').select('id,status,error,period_key,created_at').in('preference_id',prefIds).order('created_at',{ascending:false}).limit(30):{data:[]};
 const {data:eligibility}=await context.supabase.from('pharmacies').select('status,trial_ends_at,subscription_ends_at,subscription_plans!pharmacies_plan_id_fkey(has_ai_insights)').eq('id',data.pharmacyId).single();
 const until=eligibility?.status==='trial'?eligibility.trial_ends_at:eligibility?.status==='active'?eligibility.subscription_ends_at:null;
 const scheduledBlock=!eligibility?.subscription_plans?.has_ai_insights?'Scheduled reports require a plan that includes AI insights.':!until||new Date(until)<=new Date()?'Scheduled reports require a current trial or paid subscription.':null;
 return {preferences:prefs??[],recipients,history:history.data??[],scheduledBlock};
});
export const saveReportSettings=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>reportPreferenceInput.parse(v)).handler(async({data,context})=>{
 const {data:admin}=await context.supabase.rpc('is_platform_admin');const {data:owner}=await context.supabase.rpc('is_pharmacy_owner',{_pharmacy_id:data.pharmacyId});if(!admin&&!owner)throw new Error('Owner access required.');
 if(data.enabled){const {requirePlanFeature}=await import('./plan-access.server');await requirePlanFeature(context.supabase,data.pharmacyId,'ai');}
 const {pharmacyId,...values}=data;
 const {error}=await context.supabase.from('ai_report_preferences').upsert({pharmacy_id:pharmacyId,...values,pause_reason:null},{onConflict:'pharmacy_id,frequency'});if(error)throw error;return {ok:true};
});/** Owner/admin: generate a real AI report for the chosen period now and email it to their own confirmed address. */
export const sendReportNow=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({pharmacyId:z.string().uuid(),frequency:z.enum(['daily','weekly','monthly']),topics:z.array(z.enum(['sales','expenses','stock','orders'])).min(1),language:z.enum(['English','Swahili'])}).parse(v)).handler(async({data,context})=>{
 const {data:admin}=await context.supabase.rpc('is_platform_admin');const {data:owner}=await context.supabase.rpc('is_pharmacy_owner',{_pharmacy_id:data.pharmacyId});if(!admin&&!owner)throw new Error('Only owners and administrators can send reports.');
 const {requirePlanFeature}=await import('./plan-access.server');await requirePlanFeature(context.supabase,data.pharmacyId,'ai');
 const {data:business}=await context.supabase.from('pharmacies').select('name,business_type').eq('id',data.pharmacyId).single();if(!business)throw new Error('Business not found.');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:u}=await supabaseAdmin.auth.admin.getUserById(context.userId);if(!u.user?.email||!u.user.email_confirmed_at)throw new Error('Confirm your email address first.');
 const {reportPeriod}=await import('./management');const {buildReportText}=await import('./report-processor.server');const {sendAppEmail}=await import('./resend.server');const {GatewayError}=await import('./ai-provider.server');
 const now=new Date();const period=reportPeriod(data.frequency,now);
 let text:string;
 try{text=await buildReportText(data.pharmacyId,business,data,period,now);}catch(e){if(e instanceof GatewayError){if(e.httpStatus===402)throw new Error('AI credits are unavailable.');if(e.httpStatus===429)throw new Error('AI is busy, try again in a minute.');}throw new Error(e instanceof Error?e.message:'Could not generate the report.');}
 await sendAppEmail(u.user.email,`${data.frequency.slice(0,1).toUpperCase()}${data.frequency.slice(1)} report — ${business.name} | Afyadawa`,text,`ai-report-now:${data.pharmacyId}:${context.userId}:${Date.now()}`);
 return {email:u.user.email,period:period.key,summary:text};
});
