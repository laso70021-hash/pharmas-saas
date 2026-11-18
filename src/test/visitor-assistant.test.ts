import { describe, expect, it } from 'vitest';
import { normalizeAfyadawaBrand } from '@/lib/visitor-assistant.functions';

describe('visitor assistant branding', () => {
  it('uses Afyadawa without altering the existing contact email', () => {
    expect(normalizeAfyadawaBrand('Hello! Karibu Swahivo (soon to be Afyadawa). Contact info@afyadawa.co.tz.'))
      .toBe('Hello! Karibu Afyadawa. Contact info@afyadawa.co.tz.');
  });
});
