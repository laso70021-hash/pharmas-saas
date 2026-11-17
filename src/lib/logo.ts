import { z } from 'zod';

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export function validateLogo(file: { type: string; size: number }) {
  if (!LOGO_TYPES.some(type => type === file.type)) throw new Error('Choose a PNG, JPEG or WebP logo.');
  if (!file.size || file.size > LOGO_MAX_BYTES) throw new Error('Logo must be 2 MB or smaller.');
}
export const logoInput = z.object({ pharmacyId: z.string().uuid(), branchId: z.string().uuid().optional(), data: z.string().max(2800000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/) });