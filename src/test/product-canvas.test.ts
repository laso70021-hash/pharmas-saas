import { describe, it, expect } from 'vitest';
import { costMarkup, profitMargin } from '@/lib/product-canvas';
describe('product canvas pricing', () => {
  it('markup is profit over cost', () => expect(costMarkup(80, 200)).toBe(150));
  it('margin is profit over selling price', () => expect(profitMargin(80, 200)).toBe(60));
  it('no cost gives zero markup', () => expect(costMarkup(0, 200)).toBe(0));
});
