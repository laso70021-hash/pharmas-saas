import { describe, expect, it } from 'vitest';
import { whatsappTrackingUrl } from '@/lib/delivery-service';

describe('delivery sharing links', () => {
  it('creates a prefilled WhatsApp DM for a Tanzanian local number', () => {
    const url = whatsappTrackingUrl('0712 345 678', 'ABC17112026', 'https://example.com/track/job-id', 'Asha');

    expect(url).toBe(
      'https://wa.me/255712345678?text=Hi%20Asha%2C%20track%20your%20delivery%20ABC17112026%3A%20https%3A%2F%2Fexample.com%2Ftrack%2Fjob-id',
    );
  });

  it('preserves international numbers and rejects missing or unusable numbers', () => {
    expect(whatsappTrackingUrl('+44 20 1234 5678', 'ABC17112026', 'https://example.com/track/job-id')).toContain('wa.me/442012345678?');
    expect(whatsappTrackingUrl(null, 'ABC17112026', 'https://example.com/track/job-id')).toBeNull();
    expect(whatsappTrackingUrl('123', 'ABC17112026', 'https://example.com/track/job-id')).toBeNull();
  });
});
