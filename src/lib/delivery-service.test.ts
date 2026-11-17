import { describe, expect, it } from 'vitest';
import { deliveryLabel, nextStage, workflowStatus } from './delivery-service';

describe('delivery stages', () => {
  it('uses the deployed pickup lifecycle and ends at delivered', () => {
    expect(nextStage('in_process')).toBe('pickup');
    expect(nextStage('pickup')).toBe('in_transit');
    expect(nextStage('arrived')).toBe('delivered');
    expect(nextStage('delivered')).toBeNull();
    expect(nextStage('cancelled')).toBeNull();
  });

  it('normalizes legacy delivery states for existing jobs', () => {
    expect(workflowStatus('pending')).toBe('in_process');
    expect(workflowStatus('accepted')).toBe('in_process');
    expect(workflowStatus('picked_up')).toBe('in_transit');
    expect(workflowStatus('returned')).toBe('returned');
  });

  it('distinguishes an accepted assignment from a waiting offer', () => {
    expect(deliveryLabel('in_process', 'available')).toBe('Waiting for rider');
    expect(deliveryLabel('in_process', 'assigned')).toBe('Rider accepted');
  });
});
