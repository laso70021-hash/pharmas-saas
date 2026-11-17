import { describe, expect, it } from 'vitest';
import { validateLogo, LOGO_MAX_BYTES, logoInput } from '../lib/logo';
describe('Business logo validation', () => {
  it('accepts supported PNG, JPEG and WebP images', () => { for (const type of ['image/png','image/jpeg','image/webp']) expect(() => validateLogo({ type, size: 100 })).not.toThrow(); });
  it('accepts exactly 2 MB and rejects larger images', () => { expect(() => validateLogo({ type: 'image/png', size: LOGO_MAX_BYTES })).not.toThrow(); expect(() => validateLogo({ type: 'image/png', size: LOGO_MAX_BYTES + 1 })).toThrow(); });
  it('rejects SVG, PDF and empty files', () => { expect(() => validateLogo({ type: 'image/svg+xml', size: 100 })).toThrow(); expect(() => validateLogo({ type: 'application/pdf', size: 100 })).toThrow(); expect(() => validateLogo({ type: 'image/png', size: 0 })).toThrow(); });
  it('rejects remote URLs in the server upload contract', () => { expect(logoInput.safeParse({ pharmacyId: 'e4d9a6e3-ce6d-41e4-8ec4-acdd95e33200', data: 'https://example.com/logo.png' }).success).toBe(false); });
});