<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Pages: public homepage at `/` (`src/components/landing/LandingPage.tsx`), sign-in + business registration wizard at `/auth` (`?mode=signup&plan=`) and `/reset-password`, provider account/approval status at `/_authenticated/account`, admin dashboard at `/_authenticated/admin` (`src/components/dashboard/AdminDashboard.tsx`) — ported from the original Next.js app, so keep their markup and Tailwind classes when editing.
- Data access goes through `src/lib/pharmacy-service.ts` (browser client, RLS applies); keep row mapping there so components stay schema-agnostic.
- Roles live only in `public.user_roles` (enum `user_role`), checked with `has_role` / `is_platform_admin`; never store roles on `profiles` — prevents privilege escalation.
- The signup trigger gives the first account `super_admin`; provider roles (`pharmacy_owner` / `supplier`) are granted only by the admin approval functions — bootstraps the platform owner without hardcoded IDs and keeps roles off user-editable metadata.
- Business registrations live in `pharmacies` (`business_type` pharmacy|supplier). Signup form data travels in auth metadata `registration` and is saved by `create_registration`; signed-in users call `submit_registration`. A trigger blocks non-admins from changing status/plan/billing dates — approval, payment confirmation and trial extension go through admin-only SQL functions.
- Subscription pricing/expiry rules live in `src/lib/billing.ts` (mirrored by `plan_yearly_price` in SQL; `price_tzs_annual` holds the exact yearly total); "expired" is derived from end dates at read time, not stored.
- Payment receipts go to the private `payment-receipts` bucket under `<user id>/…`; admins view them via short-lived signed URLs.
- Extra admins come from `public.admin_email_allowlist` (no client access); `super_admin` is granted only once the email is confirmed — so nobody can claim admin by signing up with an address they don't own.
- Tenant tables are scoped by `user_belongs_to_pharmacy(pharmacy_id)`; rows with null `pharmacy_id` are platform-level and admin-only.
- All AI capabilities use the server-only shared OpenRouter provider and record metadata-only request logs; never fabricate operational results.
- Auth state comes from `AuthProvider` in `src/hooks/useAuth.tsx`, mounted once in `__root.tsx`; it owns the single `onAuthStateChange` listener.
- Dashboard date filtering uses `src/lib/date-range.ts` (inclusive local calendar days; accepts ISO and "DD Mon YYYY" display dates); filter loaded records in the component, keep totals that describe the whole platform unfiltered — one rule for every dashboard.
- Pharmacy workspace lives at `/_authenticated/pharmacy` (`src/components/workspace/*`, data via `WorkspaceService` in `src/lib/pharmacy-service.ts`, UI rules in `src/lib/workspace.ts`); every query is filtered by one pharmacy id so admins can open any business with `?id=`.
- Tenant tables use two policies: members read via `user_belongs_to_pharmacy`, writes via `can_write_pharmacy(id, roles)` (owner counts as every role; requires a current trial/paid year) — this is what makes expired accounts read-only server-side.
- Plan limits (branches, staff seats incl. pending invites) are enforced by triggers reading `subscription_plans`; the UI only mirrors them.
- Staff join only via `pharmacy_invites` matched to a confirmed email (`my_invitations` / `accept_invitation`); pharmacy-scoped roles live in `pharmacy_memberships`, never in `user_roles`.
- Product photos are paths in the private `product-images` bucket (`<pharmacy id>/…`), shown via signed URLs — public buckets are blocked on this project.
- Wholesale orders (`wholesale_orders`/`_items`) are written only via `place_wholesale_order` / `review_wholesale_order` (prices and stock checked in SQL); accepting moves stock FIFO from supplier batches into the buyer branch, creating the buyer product if missing — so neither side can fake prices or stock.
- Till sales go only through `create_sale` (price from products, FIFO from the chosen branch's unexpired batches, payment row + stock movements in one transaction); the cash drawer is computed from that day's branch sales, not stored.
- Prescriptions queue in `prescriptions`; staff insert pending rows, but dispensing/rejecting goes only through `review_prescription` (pharmacist/manager), which reuses `create_sale` so stock and sales stay in one code path.
- In-app notifications are rows in `notifications` written only by SECURITY DEFINER triggers on business tables (users can just read/mark their own); expiry reminders are computed in the bell from end dates, not stored.
- Forms/templates share `entry-model.ts` via `EntryService`; imports and stock changes are transactional RPCs to prevent partial saves. Import fingerprints prevent repeat files.
- Membership `branch_ids` restrict selected branches (empty uses legacy branch_id or all); enforce tenant and branch scope in SQL, not just dropdowns.
- External database handoffs use ordered, byte-preserved migration copies and a separate current-configuration seed; verify destination accounts, private buckets and data independently after reconnecting.
- External Supabase sign-in uses Supabase Auth directly with a public `/auth` callback; role-based navigation follows session hydration because the Lovable OAuth broker does not serve external projects.
- Record actions use authenticated server functions with allowlisted fields and existing RLS; privileged account deletion refuses operational history and administrator accounts to preserve business records.
- Account invitations use the existing owner-supplied Resend key and Supabase-generated verification links; server-owned onboarding state requires first-password setup without granting tenant roles from contact records.
- AI reports use a secret-protected external scheduler, a database lease and unique recipient/period runs; failures pause preferences rather than replay uncertain model outcomes, and full-business reports require verified business-wide finance access.

