import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { recordInput, safeRecordValues,guardAdminDeletion } from './management';

export const manageRecord=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>recordInput.parse(v)).handler(async({data,context})=>{
 const {data:admin}=await context.supabase.rpc('is_platform_admin');
 if((data.kind==='profiles'||data.kind==='pharmacies')&&!admin)throw new Error('Administrator access required.');
 if(data.kind==='profiles'&&data.action==='delete'){
  const {data:roles,error}=await context.supabase.from('user_roles').select('user_id').eq('role','super_admin');if(error)throw error;
  guardAdminDeletion(context.userId,data.id,(roles??[]).some(r=>r.user_id===data.id),new Set((roles??[]).map(r=>r.user_id)).size);
  // Only accounts without operational history can be permanently removed.
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  if((roles??[]).some(r=>r.user_id===data.id))throw new Error('Remove this administrator role before deleting the account.');
  const history=await Promise.all([
   supabaseAdmin.from('pharmacies').select('id',{count:'exact',head:true}).eq('owner_id',data.id),
   supabaseAdmin.from('pharmacy_memberships').select('id',{count:'exact',head:true}).eq('user_id',data.id),
   supabaseAdmin.from('sales').select('id',{count:'exact',head:true}).eq('cashier_id',data.id),
   supabaseAdmin.from('audit_logs').select('id',{count:'exact',head:true}).eq('user_id',data.id),
  ]);
  for(const h of history){if(h.error)throw h.error;if(h.count)throw new Error('This account has business or audit history. Remove workspace access instead of deleting it.');}
  const {error:e}=await supabaseAdmin.auth.admin.deleteUser(data.id);if(e)throw new Error('Account could not be deleted. It may have linked records.');
 }else{
  if(data.kind==='pharmacies'&&data.action==='delete'){
   const linked=await Promise.all([
    context.supabase.from('branches').select('id',{count:'exact',head:true}).eq('pharmacy_id',data.id),
    context.supabase.from('sales').select('id',{count:'exact',head:true}).eq('pharmacy_id',data.id),
    context.supabase.from('pharmacy_memberships').select('id',{count:'exact',head:true}).eq('pharmacy_id',data.id),
    context.supabase.from('products').select('id',{count:'exact',head:true}).eq('pharmacy_id',data.id),
    context.supabase.from('wholesale_orders').select('id',{count:'exact',head:true}).or(`buyer_pharmacy_id.eq.${data.id},supplier_id.eq.${data.id}`),
   ]);
   if(linked.some(r=>r.error||r.count))throw new Error('This business has linked records. Suspend it from the business list instead of deleting its history.');
  }
  const values=safeRecordValues(data.kind,data.values);
  if(data.action==='deactivate'&&data.kind!=='suppliers')throw new Error('This record cannot be deactivated here.');
  const result=data.action==='delete'?await context.supabase.from(data.kind).delete().eq('id',data.id).select('id'):
   data.kind==='suppliers'?await context.supabase.from('suppliers').update(data.action==='deactivate'?{is_active:false}:values).eq('id',data.id).select('id'):
   data.kind==='customers'?await context.supabase.from('customers').update({
    ...('full_name' in values?{full_name:z.string().parse(values['full_name'])}:{}),
    ...('email' in values?{email:values['email']??null}:{}),...('phone' in values?{phone:values['phone']??null}:{}),...('address' in values?{address:values['address']??null}:{}),...('allergies' in values?{allergies:values['allergies']??null}:{}),...('chronic_conditions' in values?{chronic_conditions:values['chronic_conditions']??null}:{})
   }).eq('id',data.id).select('id'):
   data.kind==='profiles'?await context.supabase.from('profiles').update({...('full_name' in values?{full_name:values['full_name']??null}:{}),...('phone' in values?{phone:values['phone']??null}:{})}).eq('id',data.id).select('id'):
   await context.supabase.from('pharmacies').update({
    ...('name' in values?{name:z.string().parse(values['name'])}:{}),...('owner_name' in values?{owner_name:values['owner_name']??null}:{}),...('email' in values?{email:values['email']??null}:{}),...('phone' in values?{phone:values['phone']??null}:{}),...('address' in values?{address:values['address']??null}:{}),...('city' in values?{city:values['city']??null}:{}),...('registration_number' in values?{registration_number:values['registration_number']??null}:{}),...('tax_number' in values?{tax_number:values['tax_number']??null}:{})
   }).eq('id',data.id).select('id');
  if(result.error){if(result.error.code==='23503')throw new Error('Linked records prevent deletion. Keep the history and deactivate this record instead.');throw new Error(result.error.message);}
  if(!result.data?.length)throw new Error('Record not found or permission denied.');
 }
 if(admin){await context.supabase.from('audit_logs').insert({user_id:context.userId,action:`record_${data.action}`,entity:data.kind,entity_id:data.id});}
 return {ok:true};
});

export const sendRecordEmail=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({kind:z.enum(['customers','suppliers','pharmacies','pharmacy_invites']),id:z.string().uuid(),invite:z.boolean().default(false)}).parse(v)).handler(async({data,context})=>{
 const {data:record,error}=await context.supabase.from(data.kind).select('*').eq('id',data.id).single();if(error||!record)throw new Error('Record not found or permission denied.');
 const {data:admin}=await context.supabase.rpc('is_platform_admin');
 const pid='pharmacy_id' in record?record.pharmacy_id:data.kind==='pharmacies'?record.id:null;
 if(!admin){if(!pid)throw new Error('Permission denied.');const {data:allowed}=await context.supabase.rpc('can_write_pharmacy',{_pharmacy_id:pid,_roles:data.kind==='customers'?['manager','cashier','pharmacist']:['manager','inventory_manager']});if(!allowed)throw new Error('Permission denied.');if(data.kind==='pharmacy_invites'){const {data:owner}=await context.supabase.rpc('is_pharmacy_owner',{_pharmacy_id:pid});if(!owner)throw new Error('Only the business owner can send team invitations.');}}
 const email=z.string().email().parse(record.email?.trim().toLowerCase());
 const {sendAppEmail}=await import('./resend.server');
 const origin=process.env['APP_ORIGIN']||'https://swahivo.com';
 if(!data.invite&&data.kind!=='pharmacy_invites')return sendAppEmail(email,'Your details were added — Afyadawa','Your contact details have been added to Afyadawa. If you did not expect this, contact info@swahivo.com.',`record-confirm:${data.kind}:${data.id}`);
 if(data.kind==='pharmacy_invites'&&'status' in record&&record.status!=='pending')throw new Error('This invitation is no longer pending.');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 // generateLink prepares a verification link; only clicking the email confirms ownership.
 const generated=await supabaseAdmin.auth.admin.generateLink({type:'invite',email,options:{redirectTo:`${origin}/set-password`}});
 if(generated.error){
  if(!['email_exists','user_already_exists'].includes(generated.error.code??''))throw new Error('Could not generate the account invitation.');
  const {data:profile}=await supabaseAdmin.from('profiles').select('id').eq('email',email).maybeSingle();
  if(profile){const {data:onboarding}=await supabaseAdmin.from('account_onboarding').select('password_required').eq('user_id',profile.id).maybeSingle();
   if(onboarding?.password_required){const recovery=await supabaseAdmin.auth.admin.generateLink({type:'recovery',email,options:{redirectTo:`${origin}/set-password`}});if(recovery.error)throw new Error('Could not regenerate the invitation.');return sendAppEmail(email,'Set your password — Afyadawa',`Verify your email and set your password: ${recovery.data.properties.action_link}`,`invite-recovery:${data.kind}:${data.id}:${Math.floor(Date.now()/86400000)}`);}
  }
  return sendAppEmail(email,'You are invited — Afyadawa',`Sign in to Afyadawa at ${origin}/auth to view your invitations. Your existing password has not changed.`,`existing-invite:${data.kind}:${data.id}`);
 }
 const invited=generated.data.user;if(!invited||!generated.data.properties.action_link)throw new Error('Could not generate the account invitation.');
 const {error:onboardError}=await supabaseAdmin.from('account_onboarding').upsert({user_id:invited.id,password_required:true});if(onboardError)throw onboardError;
 return sendAppEmail(email,'Confirm your invitation and set your password — Afyadawa',`You have been invited to Afyadawa. Verify your email and set your password: ${generated.data.properties.action_link}. This invitation does not grant workspace access until the team association is accepted.`,`new-invite:${data.kind}:${data.id}`);
});

export const completePasswordSetup=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({password:z.string().min(8).max(128)}).parse(v)).handler(async({data,context})=>{
 const {data:pending}=await context.supabase.from('account_onboarding').select('password_required').eq('user_id',context.userId).single();if(!pending?.password_required)throw new Error('No password setup is pending.');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {error}=await supabaseAdmin.auth.admin.updateUserById(context.userId,{password:data.password});if(error)throw new Error('Password could not be updated.');
 const {error:e}=await supabaseAdmin.from('account_onboarding').update({password_required:false}).eq('user_id',context.userId);if(e)throw e;return {ok:true};
});

export const registerStaffWithTemporaryPassword=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({
 pharmacyId:z.string().uuid(),
 password:z.string().min(12).max(128),
 staff:z.object({
  full_name:z.string().trim().min(1).max(200),
  email:z.string().trim().email().max(320).transform(value=>value.toLowerCase()),
  phone:z.string().max(80).optional().default(''),
  staff_id:z.string().max(100).optional().default(''),
  job_title:z.string().max(150).optional().default(''),
  role:z.enum(['manager','pharmacist','cashier','accountant','inventory_manager','delivery_rider']),
  branch_codes:z.string().max(4000).optional().default(''),
  employment_status:z.enum(['active','on_leave','inactive']).default('active'),
 }),
}).parse(v)).handler(async({data,context})=>{
 const {data:isOwner,error:ownerError}=await context.supabase.rpc('is_pharmacy_owner',{_pharmacy_id:data.pharmacyId});
 if(ownerError)throw ownerError;
 if(!isOwner)throw new Error('Only this business owner can create staff accounts.');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const origin=process.env['APP_ORIGIN']||'https://swahivo.com';
 let userId:string|null=null;
 let inviteId:string;
 let actionLink:string;
 try{
  const generated=await supabaseAdmin.auth.admin.generateLink({type:'invite',email:data.staff.email,options:{redirectTo:`${origin}/set-password`,data:{full_name:data.staff.full_name}}});
  if(generated.error){
   if(['email_exists','user_already_exists'].includes(generated.error.code??''))throw new Error('This email already has an account. Use the regular staff invitation flow instead.');
   throw new Error('Could not create the staff account invitation.');
  }
  userId=generated.data.user?.id??null;
  actionLink=generated.data.properties.action_link;
  if(!userId||!actionLink)throw new Error('Could not create the staff account invitation.');

  const {error:passwordError}=await supabaseAdmin.auth.admin.updateUserById(userId,{password:data.password});
  if(passwordError)throw new Error('Could not set the temporary password.');
  const {error:onboardingError}=await supabaseAdmin.from('account_onboarding').upsert({user_id:userId,password_required:true});
  if(onboardingError)throw onboardingError;
  const {data:savedInvite,error:inviteError}=await context.supabase.rpc('save_business_entry',{
   _pharmacy:data.pharmacyId,_module:'staff',_row:data.staff,
  });
  if(inviteError)throw inviteError;
  inviteId=String(savedInvite);
 }catch(error){
  if(userId){
   const {error:cleanupError}=await supabaseAdmin.auth.admin.deleteUser(userId);
   if(cleanupError)throw new Error(`${error instanceof Error?error.message:'Staff account setup failed.'} The new account could not be cleaned up; contact support before retrying.`);
  }
  throw error;
 }
 try{
  const {sendAppEmail}=await import('./resend.server');
  await sendAppEmail(data.staff.email,'Verify your staff account — Afyadawa',`An Afyadawa staff account has been created for you. Verify your email and choose a new password here: ${actionLink}. Your temporary password was provided separately by your business owner.`,`staff-invite:${inviteId}`);
  return {inviteId,emailSent:true};
 }catch(error){
  return {inviteId,emailSent:false,emailError:error instanceof Error?error.message:'Verification email could not be sent.'};
 }
});