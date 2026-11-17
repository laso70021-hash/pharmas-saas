import { afterEach,describe,it,expect,vi } from 'vitest';
import { sendAppEmail } from '../lib/resend.server';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('confirmation email delivery',()=>{
 it('uses the Swahivo sender and a distinct event idempotency key',async()=>{
  vi.stubEnv('RESEND_API_KEY','test-key');const request=vi.fn().mockResolvedValue(new Response('{}',{status:200}));vi.stubGlobal('fetch',request);
  expect(await sendAppEmail('test@example.com','Confirmation','Saved','contact:123')).toEqual({sent:true});
  const args=request.mock.calls[0]?.[1];expect(JSON.parse(args.body)).toMatchObject({from:'Swahivo <info@swahivo.com>',to:['test@example.com']});expect(args.headers['Idempotency-Key']).toBe('contact:123');
 });
 it('does not report success when Resend rejects delivery',async()=>{
  vi.stubEnv('RESEND_API_KEY','test-key');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('Rejected',{status:403})));
  await expect(sendAppEmail('test@example.com','Confirmation','Saved','contact:123')).rejects.toThrow('Email was not sent (403)');
 });
});