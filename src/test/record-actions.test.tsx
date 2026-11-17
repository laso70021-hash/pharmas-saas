import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
const actions=vi.hoisted(()=>({manage:vi.fn().mockResolvedValue({ok:true}),email:vi.fn().mockResolvedValue({sent:true})}));
vi.mock('@tanstack/react-start',()=>({useServerFn:(f:unknown)=>f}));
vi.mock('@/lib/management.functions',()=>({manageRecord:actions.manage,sendRecordEmail:actions.email}));
import {RecordActions} from '../components/common/RecordActions';
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe('record action approval',()=>{
 it('does not delete until the confirmation is approved',async()=>{
  render(<RecordActions kind="suppliers" record={{id:'supplier-1',name:'Supplier'}} onChanged={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Delete Supplier'}));expect(actions.manage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:/^Delete$/}));
  await waitFor(()=>expect(actions.manage).toHaveBeenCalledWith({data:{kind:'suppliers',id:'supplier-1',action:'delete',values:{}}}));
 });
 it('sends confirmation without creating an account',async()=>{
  render(<RecordActions kind="customers" record={{id:'customer-1',full_name:'Customer',email:'customer@example.com'}} onChanged={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Email confirmation to Customer'}));
  await waitFor(()=>expect(actions.email).toHaveBeenCalledWith({data:{kind:'customers',id:'customer-1',invite:false}}));
 });
});