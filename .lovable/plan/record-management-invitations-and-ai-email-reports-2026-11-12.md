# Record management, invitations and AI email reports

## 1. Edit and delete controls
- Add consistent Edit and Delete actions to supplier, customer, user and business lists without changing the existing Swahivo appearance.
- Show a confirmation dialog before deletion. Explain when sales, orders or other linked records prevent permanent deletion; offer deactivation where appropriate rather than silently erasing history.
- Administrators manage users and businesses; workspace permissions continue to govern customer and supplier changes.
- Protect the current administrator from self-deletion and prevent removal of the last platform administrator. Record sensitive changes in the audit trail.

## 2. Confirmation emails and account invitations
- Send a confirmation to a valid email when adding a customer, supplier contact, team member or business account. Show delivery failures honestly, with a resend action instead of a misleading success message.
- Support both confirmation-only contacts and an explicit **Invite to create an account** choice for customers and supplier contacts. Adding a contact will not silently grant staff, supplier or administrator permissions.
- Repair team invitations so they actually send through the existing Resend integration. Cover invitation creation through the staff form and imports, with duplicate-send protection.
- New account invitations open a secure email-verification/password-setup page before the first normal sign-in. Existing users retain their passwords and receive an invitation to accept the new association.
- Continue using Supabase for sign-up confirmation, login links and password recovery; verify the available sender configuration rather than assuming custom SMTP is active.
- Keep authentication email confirmation separate from business registration approval and team invitation acceptance.

## 3. Customized AI reports
- Add an **AI email reports** area where pharmacy owners and suppliers choose recipients separately for daily, weekly and monthly reports.
- Default recipient choices to verified members of that business. Report access must respect each recipient's branch and role permissions; a customer contact must not receive confidential business reports merely because they have an account.
- Let owners choose report topics, preferred language and delivery time. Use Africa/Dar_es_Salaam as the initial timezone; daily reports cover the previous day, weekly reports the previous complete week, and monthly reports the previous complete month.
- Summarize real sales, expenses, stock levels, expiry risks and supplier/order activity with actionable AI recommendations. Distinguish recorded facts from recommendations and omit patient/customer identifying details from model input and email.
- Include delivery history and clear paused/failed states, with owner-controlled resume after credit or permission failures.

## Technical approach
- Keep application data mapping in the existing service layer. Use authenticated TanStack server functions for record management and email actions; verify permissions server-side before privileged Supabase operations.
- Extend Supabase through migrations with explicit grants and RLS. Store account associations, report preferences and durable AI-run progress as needed; never store credentials in tables or add an email queue.
- Reuse the existing Resend configuration and sender identity. Validate and escape email content, derive recipients from authorized records and use event-based idempotency keys.
- Use a verified invitation token and server-controlled onboarding state for first-password setup; do not trust a browser flag or user-editable metadata to grant access.
- Preserve existing AI model selections; new report generation uses the workspace default through AI Gateway with validated output.
- Scheduled AI work uses bounded batches, a database lease, durable progress, recipient/period deduplication and persisted pause guards at every entry point. Do not automatically replay an unknown generation outcome.
- External Supabase cannot use managed scheduled HTTP callbacks here. Use an authenticated external scheduler, with a Vercel-compatible scheduling configuration if the deployment supports it; never install hand-written database HTTP cron jobs. Scheduling activation requires the deployed origin and scheduler credentials to be available.

## Verification and delivery
- Add and run focused tests for permissions, administrator protections, linked-record deletion, contact-versus-login invitations, first-password setup, report periods, recipient scope and duplicate prevention.
- Test public password-setup states and email integration responses. Authenticated end-to-end checks remain unavailable for this external Supabase connection; clearly identify checks not performed.
- Verify email provider acceptance separately from inbox arrival. Confirm scheduled execution after deployment before claiming automatic reports are active.
- Deliver the controls and reporting settings together, with any remaining deployment or external-service steps named explicitly.