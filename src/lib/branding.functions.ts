import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { logoInput, validateLogo } from './logo';

export const saveBusinessLogo = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => logoInput.parse(value))
  .handler(async ({ data, context }) => {
    const { data: business, error } = await context.supabase.from('pharmacies').select('owner_id,settings').eq('id', data.pharmacyId).single();
    const { data: admin } = await context.supabase.rpc('is_platform_admin');
    if (error || !business || (business.owner_id !== context.userId && !admin)) throw new Error('Only the business owner or administrator can change its logo.');
    if (data.branchId) {
      const { data: branch } = await context.supabase.from('branches').select('id').eq('pharmacy_id', data.pharmacyId).eq('id', data.branchId).maybeSingle();
      if (!branch) throw new Error('Branch not found.');
    }
    const comma = data.data.indexOf(',');
    const type = data.data.slice(5, data.data.indexOf(';'));
    const bytes = Uint8Array.from(atob(data.data.slice(comma + 1)), c => c.charCodeAt(0));
    validateLogo({ type, size: bytes.length });
    const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
    if (!(type === 'image/png' ? png : type === 'image/jpeg' ? jpeg : webp)) throw new Error('This file is not a valid logo image.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const path = `${data.pharmacyId}/logo-${crypto.randomUUID()}.${type === 'image/jpeg' ? 'jpg' : type.split('/')[1]}`;
    const { error: uploadError } = await supabaseAdmin.storage.from('product-images').upload(path, bytes, { contentType: type });
    if (uploadError) throw new Error('Logo upload failed. Please try again.');
    const current = typeof business.settings === 'object' && business.settings && !Array.isArray(business.settings) ? business.settings : {};
    const branches = current['branch_logos'];
    const settings = data.branchId ? { ...current, branch_logos: { ...(typeof branches === 'object' && branches && !Array.isArray(branches) ? branches : {}), [data.branchId]: path } } : { ...current, logo_path: path };
    const { error: saveError } = await supabaseAdmin.from('pharmacies').update({ settings }).eq('id', data.pharmacyId);
    if (saveError) { await supabaseAdmin.storage.from('product-images').remove([path]); throw new Error('Could not save the logo.'); }
    return { saved: true };
  });