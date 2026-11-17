import { describe, it, expect } from 'vitest';
import { homeFor, HOME_COPY, riderHomeData } from '@/lib/role-home';
import { canAcceptDelivery } from '@/lib/workspace';

describe('role home dashboards', () => {
  it('owners, admins and managers keep the full business overview', () => {
    expect(homeFor('owner')).toBe('business');
    expect(homeFor('admin')).toBe('business');
    expect(homeFor('manager')).toBe('business');
  });
  it('each staff role gets its own home', () => {
    expect(homeFor('cashier')).toBe('cashier');
    expect(homeFor('pharmacist')).toBe('pharmacist');
    expect(homeFor('inventory_manager')).toBe('inventory');
    expect(homeFor('accountant')).toBe('accountant');
    expect(homeFor('delivery_rider')).toBe('rider');
  });
  it('cashiers are not offered finance or ordering shortcuts', () => {
    const tabs = HOME_COPY.cashier.actions.map((a) => a.tab);
    expect(tabs).not.toContain('expenses');
    expect(tabs).not.toContain('restock');
  });
  it('shows unassigned delivery jobs as available to riders', () => {
    const data = riderHomeData([
      { tracking_number: 'AAA16112026', status: 'pending', assignment_state: 'available', rider_id: null, dropoff_address: 'Available address' },
      { tracking_number: 'BBB16112026', status: 'in_process', assignment_state: 'assigned', rider_id: 'rider-1', dropoff_address: 'Assigned address' },
      { tracking_number: 'CCC16112026', status: 'in_process', assignment_state: 'assigned', rider_id: 'rider-2', dropoff_address: 'Other rider address' },
      { tracking_number: 'DDD16112026', status: 'delivered', assignment_state: 'assigned', rider_id: 'rider-1', dropoff_address: 'Delivered address' },
      { tracking_number: 'EEE16112026', status: 'in_process', assignment_state: 'available', rider_id: null, dropoff_address: 'New workflow address' },
    ], 'rider-1');

    expect(data.stats).toEqual({ available: 2, assigned: 1, delivered: 1 });
    expect(data.rows.map((row) => row.label)).toEqual(['AAA16112026', 'BBB16112026', 'DDD16112026', 'EEE16112026']);
  });
  it('gives riders a direct route to claim deliveries', () => {
    expect(HOME_COPY.rider.actions.map((action) => action.tab)).toContain('deliveries');
  });
  it('does not grant delivery acceptance to a role preview', () => {
    expect(canAcceptDelivery('delivery_rider')).toBe(true);
    expect(canAcceptDelivery('owner')).toBe(false);
    expect(canAcceptDelivery('admin')).toBe(false);
    expect(canAcceptDelivery('manager')).toBe(false);
  });
});
