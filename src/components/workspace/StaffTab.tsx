import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { registerStaffWithTemporaryPassword, sendRecordEmail } from '@/lib/management.functions';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserPlus, Copy, X, Mail } from 'lucide-react';
import { EntryForm } from './EntryForm';
import { EntryService, WorkspaceService } from '@/lib/pharmacy-service';
import type { EntryRow } from '@/lib/entry-model';
import { Button } from '@/components/ui/button';
import type { Workspace } from '@/lib/pharmacy-types';
import { STAFF_ROLES, can, limitLabel, limitReached, roleLabel, type StaffRole } from '@/lib/workspace';
import { formatDateDeterministic } from '@/lib/utils';
import { cardCls, Empty, Field, Modal, SectionHeader, errorText, ghostBtn, inputCls, primaryBtn } from './ws-ui';

export function inviteLink(email: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/auth?invite=${encodeURIComponent(email)}`;
}

export function StaffTab({ ws }: { ws: Workspace }) {
  const sendEmail=useServerFn(sendRecordEmail);
  const registerStaff=useServerFn(registerStaffWithTemporaryPassword);
  const pid = ws.id;
  const qc = useQueryClient();
  const editable = can(ws.role, 'manageStaff', ws.status);
  const { data: staff = [], isLoading } = useQuery({ queryKey: ['ws', pid, 'staff'], queryFn: () => WorkspaceService.getStaff(pid) });
  const { data: invites = [] } = useQuery({ queryKey: ['ws', pid, 'invites'], queryFn: () => WorkspaceService.getInvites(pid) });
  const { data: branches = [] } = useQuery({ queryKey: ['ws', pid, 'branches'], queryFn: () => WorkspaceService.getBranches(pid) });
  const { data: refs = {} } = useQuery({ queryKey: ['entry-refs', pid], queryFn: () => EntryService.references(pid) });
  const [inviting, setInviting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing,setEditing]=useState<EntryRow|null>(null);
  const { data: details = [] } = useQuery({ queryKey: ['staff-details',pid], queryFn:()=>EntryService.staffDetails(pid), enabled:editable });

  const activeCount = staff.filter((s) => s.is_active).length;
  const used = activeCount + invites.length;
  const full = ws.role !== 'admin' && limitReached(used, ws.limits.max_employees);

  const refresh = () => {
    void qc.invalidateQueries({queryKey:['staff-details',pid]});
    void qc.invalidateQueries({ queryKey: ['ws', pid, 'staff'] });
    void qc.invalidateQueries({ queryKey: ['ws', pid, 'invites'] });
  };
  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      refresh();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const copy = (email: string) => {
    void navigator.clipboard.writeText(inviteLink(email)).then(() => toast.success('Invite link copied'));
  };
  const copyCredentials = async () => {
    if (!createdCredentials) return;
    try {
      await navigator.clipboard.writeText(`Email: ${createdCredentials.email}\nTemporary password: ${createdCredentials.password}`);
      toast.success('Login details copied');
    } catch {
      toast.error('Could not copy login details. Select and copy the fields instead.');
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Staff & Roles"
        subtitle={`${limitLabel(used, ws.limits.max_employees)} staff seats used on the ${ws.plan_name} plan (pending invites count)`}
        action={editable && <div className="flex flex-wrap gap-2">
          <button className={primaryBtn} disabled={full} onClick={() => setRegistering(true)}>
            <UserPlus className="w-3.5 h-3.5" /> Register staff
          </button>
          <button className={ghostBtn} disabled={full} onClick={() => setInviting(true)}>
            <Mail className="w-3.5 h-3.5" /> Invite by email
          </button>
        </div>}
      />
      {full && editable && (
        <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-2.5 font-semibold">
          All staff seats on the {ws.plan_name} plan are used. Upgrade from My Account, or remove someone first.
        </div>
      )}

      <div className={`${cardCls} p-5 overflow-x-auto`}>
        <h3 className="font-black text-slate-900 text-sm mb-3">Team</h3>
        {isLoading ? (
          <Empty>Loading team…</Empty>
        ) : staff.length === 0 ? (
          <Empty>No staff yet. Invite your pharmacists, cashiers and managers.</Empty>
        ) : (
          <table className="w-full text-left text-xs min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-2">Name</th>
                <th className="py-2">Role</th>
                <th className="py-2">Branch</th>
                <th className="py-2">Joined</th>
                <th className="py-2 text-right">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((s) => (
                <tr key={s.membership_id} className={s.is_active ? '' : 'opacity-50'}>
                  <td className="py-2.5">
                    <div className="font-bold text-slate-900">{s.full_name}</div>
                    <div className="text-slate-400">{s.email}</div>
                    {editable&&<Button variant="link" size="sm" onClick={()=>{const d=details.find(x=>x.id===s.membership_id);const ids=d?.branch_ids?.length?d.branch_ids:d?.branch_id?[d.branch_id]:[];setEditing({id:s.membership_id,full_name:s.full_name,email:s.email,phone:d?.phone??'',staff_id:d?.staff_id??'',job_title:d?.job_title??'',role:s.role,employment_status:d?.employment_status??'active',branch_codes:ids.map((id:string)=>branches.find(b=>b.id===id)?.code??'').join(';')});}}>Edit staff details</Button>}
                  </td>
                  <td className="py-2.5">
                    {editable ? (
                      <select
                        aria-label={`Role for ${s.full_name}`}
                        className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                        value={s.role}
                        disabled={busy}
                        onChange={(e) => void run(() => WorkspaceService.updateMembership(s.membership_id, { role: e.target.value as StaffRole }), 'Role updated')}
                      >
                        {STAFF_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    ) : (
                      <span className="font-semibold">{roleLabel(s.role)}</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    {editable ? (
                      <select
                        aria-label={`Branch for ${s.full_name}`}
                        className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                        value={s.branch_id ?? ''}
                        disabled={busy}
                        onChange={(e) => void run(() => WorkspaceService.updateMembership(s.membership_id, { branch_id: e.target.value || null }), 'Branch updated')}
                      >
                        <option value="">All branches</option>
                        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    ) : (
                      branches.find((b) => b.id === s.branch_id)?.name ?? 'All branches'
                    )}
                  </td>
                  <td className="py-2.5 text-slate-500">{formatDateDeterministic(s.created_at)}</td>
                  <td className="py-2.5 text-right">
                    {editable ? (
                      <button
                        className={ghostBtn}
                        disabled={busy}
                        onClick={() => { if (s.is_active && !window.confirm(`Suspend ${s.full_name}? They will lose access until reactivated.`)) return; void run(() => WorkspaceService.updateMembership(s.membership_id, { is_active: !s.is_active }), s.is_active ? 'User suspended' : 'User reactivated'); }}
                      >
                        {s.is_active ? 'Suspend' : 'Reactivate'}
                      </button>
                    ) : (
                      <span className="font-semibold">{s.is_active ? 'Active' : 'Suspended'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={`${cardCls} p-5`}>
        <h3 className="font-black text-slate-900 text-sm mb-1">Pending invitations</h3>
        <p className="text-xs text-slate-500 mb-3">
          Share the invite link. The person signs up with that email, confirms it, and accepts from their account page.
        </p>
        {invites.length === 0 ? (
          <Empty>No pending invitations.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100 text-xs">
            {invites.map((i) => (
              <li key={i.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="font-bold text-slate-900">{i.full_name || i.email}</div>
                    <div className="text-slate-400">
                      {i.email} · {roleLabel(i.role)} · {branches.find((b) => b.id === i.branch_id)?.name ?? 'All branches'}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {editable&&<Button variant="outline" size="sm" disabled={busy} onClick={()=>void run(async()=>{await sendEmail({data:{kind:'pharmacy_invites',id:i.id,invite:true}});},'Invitation email sent')}><Mail className="size-3"/>Send email</Button>}
                  <button className={ghostBtn} onClick={() => copy(i.email)}>
                    <Copy className="w-3 h-3" /> Copy link
                  </button>
                  {editable && (
                    <button className={ghostBtn} disabled={busy} onClick={() => void run(() => WorkspaceService.revokeInvite(i.id), 'Invitation cancelled')}>
                      <X className="w-3 h-3" /> Cancel
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {inviting && <EntryForm module="staff" references={refs} onClose={()=>setInviting(false)} onSave={async row=>{await EntryService.save(pid,'staff',row);refresh();toast.success('Invitation saved');}} />}
      {registering && <EntryForm
        module="staff"
        references={refs}
        extraFields={<Field label="Temporary password" hint="At least 12 characters. Staff must verify their email and choose a new password before accessing the business.">
          <input className={inputCls} type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={temporaryPassword} onChange={(e)=>setTemporaryPassword(e.target.value)} />
        </Field>}
        onClose={()=>{setRegistering(false);setTemporaryPassword('');}}
        onSave={async row=>{
          const email=row['email']?.trim().toLowerCase();
          if(!email)throw new Error('Staff email is required.');
          const result=await registerStaff({data:{pharmacyId:pid,password:temporaryPassword,staff:{
            full_name:row['full_name']??'',email,phone:row['phone']??'',staff_id:row['staff_id']??'',
            job_title:row['job_title']??'',role:row['role'] as StaffRole,
            branch_codes:row['branch_codes']??'',employment_status:(row['employment_status']??'active') as 'active'|'on_leave'|'inactive',
          }}});
          setCreatedCredentials({email,password:temporaryPassword});
          refresh();
          if(result.emailSent)toast.success('Staff account created. Verification link sent by email.');
          else toast.error(`Staff account created, but verification email failed: ${result.emailError} Use Send email from Pending invitations to retry.`);
        }}
      />}
      {createdCredentials && <Modal title="Share staff login details" onClose={()=>setCreatedCredentials(null)}>
        <div className="space-y-3">
          <p className="text-sm text-slate-700">Give these credentials directly to the staff member. They must verify their email and replace the temporary password before they can use the business account. Do not send the password in the verification email.</p>
          <Field label="Username / email"><input className={inputCls} readOnly value={createdCredentials.email} /></Field>
          <Field label="Temporary password"><input className={inputCls} readOnly value={createdCredentials.password} /></Field>
          <div className="flex justify-end gap-2">
            <button className={ghostBtn} onClick={()=>void copyCredentials()}><Copy className="w-3.5 h-3.5" />Copy credentials</button>
            <button className={primaryBtn} onClick={()=>setCreatedCredentials(null)}>Done</button>
          </div>
        </div>
      </Modal>}
      {editing&&<EntryForm module="staff" initial={editing} references={refs} onClose={()=>setEditing(null)} onSave={async row=>{const id=editing['id'];if(!id)return;await EntryService.updateStaff(pid,id,row);refresh();toast.success('Staff updated');}}/>}

    </div>
  );
}
