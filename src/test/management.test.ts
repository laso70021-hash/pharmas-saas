import { describe,it,expect } from 'vitest';
import { guardAdminDeletion,safeRecordValues,reportPeriod,reportPreferenceInput } from '../lib/management';
describe('record security',()=>{
 it('blocks deleting the current administrator',()=>expect(()=>guardAdminDeletion('a','a',true,2)).toThrow('own account'));
 it('blocks deleting the last administrator',()=>expect(()=>guardAdminDeletion('a','b',true,1)).toThrow('last platform'));
 it('allows deleting a different unlinked ordinary account',()=>expect(()=>guardAdminDeletion('a','b',false,1)).not.toThrow());
 it('does not accept role or billing edits',()=>expect(safeRecordValues('profiles',{full_name:'Name',role:'super_admin',subscription_ends_at:'2099'})).toEqual({full_name:'Name'}));
 it('rejects invalid email addresses',()=>expect(()=>safeRecordValues('customers',{email:'bad'})).toThrow());
});
describe('Tanzania report periods',()=>{
 const now=new Date('2026-11-12T05:17:00Z');
 it('daily covers the previous local day',()=>expect(reportPeriod('daily',now)).toEqual({key:'daily:2026-11-11',start:'2026-11-10T21:00:00.000Z',end:'2026-11-11T21:00:00.000Z'}));
 it('weekly covers the previous complete Monday week',()=>expect(reportPeriod('weekly',now)).toEqual({key:'weekly:2026-11-02',start:'2026-11-01T21:00:00.000Z',end:'2026-11-08T21:00:00.000Z'}));
 it('monthly covers the previous calendar month',()=>expect(reportPeriod('monthly',now)).toEqual({key:'monthly:2026-10-01',start:'2026-09-30T21:00:00.000Z',end:'2026-10-31T21:00:00.000Z'}));
 it('rejects delivery hours outside a day',()=>expect(reportPreferenceInput.safeParse({pharmacyId:'25abb0d6-3fa5-48dd-85f0-4ebbaea48a27',frequency:'daily',recipient_ids:[],topics:['sales'],language:'English',enabled:false,delivery_hour:24}).success).toBe(false));
});