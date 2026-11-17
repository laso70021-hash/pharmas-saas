import { describe, it, expect } from 'vitest';
import { ean13Bits, ean13Check } from '@/lib/ean13';
describe('label barcodes', () => {
  it('computes the EAN-13 check digit', () => expect(ean13Check('400638133393')).toBe(1));
  it('valid code renders 95 bars', () => expect(ean13Bits('4006381333931')?.length).toBe(95));
  it('wrong check digit is rejected', () => expect(ean13Bits('4006381333932')).toBeNull());
});
