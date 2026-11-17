# Real-world pharmacy entry and bulk imports

## Goal
Extend the existing Swahivo screens without rebuilding them. Make manual entry and spreadsheet imports use the same business fields, validation and relationships, then configure and test one complete demo pharmacy through those workflows.

## Current findings
- The connected database already contains **34 public tables**, all with row-level security enabled. They do not need to be re-imported or replaced.
- Branches, products, batches and staff invitations already have basic entry screens, but several requested fields are missing.
- Product categories exist in the database but are not selectable in the workspace product form. Supplier management is missing from the workspace.
- Product brand, description, units, packaging and supplier links need additions. Manufacturing dates and employment details also need additions.
- Staff currently support one branch or all branches, not a selection of multiple branches; branch-specific authorization must be reviewed alongside this change.
- Stock receipt and adjustment currently save stock and movements separately; these need one transaction so a failure cannot leave inconsistent records.
- The uploaded document is a requirements brief, not a spreadsheet or database export containing records to import.

## 1. Complete manual entry
- Business settings: registration and tax details, owner/contact details and address; preserve the existing approval and payment process.
- Branches: main/additional designation, code, address, phone, eligible branch manager and active/closed status.
- Categories and suppliers: create, edit and deactivate business-owned records. Suppliers include company, contact person, email, phone, address and tax details.
- Products: existing fields plus brand, category, description, unit of measurement, packaging and supplier. Keep product photos and prescription requirements.
- Batches/opening stock: select a business product and branch; record batch number, manufacture/expiry dates, quantity and unit purchase cost. Support multiple batches per product.
- Staff: full name, email, phone, staff ID, job title, role, employment status and one/multiple/all-branch assignments. Joining still requires an invitation and confirmed email; imports never create passwords or platform admins.
- Support editing, deactivation and audited stock correction rather than deleting records that are referenced by sales or other history.

## 2. Bulk import workflow
Add an Imports screen for categories, branches, suppliers, products, batches/opening stock and staff invitations.

For each module:
1. Download a CSV or Excel template matching the canonical fields.
2. Upload `.csv` or `.xlsx` and choose the worksheet where applicable.
3. Detect headers and allow manual column mapping.
4. Preview and edit rows; show the exact row, field and reason for errors.
5. Validate required values, data types, dates, prices, integer quantities, duplicates and business-owned references.
6. Download an error report when validation fails.
7. Confirm the validated row count before saving.
8. Save the whole import atomically, or save none; show results and import history.

Use readable reference columns such as product SKU, branch code and supplier name, resolved to the actual related IDs within the selected business. Label these clearly in templates and mapping. Warn on ambiguous matches rather than guessing.

Prevent duplicate uploads with a business/module/file fingerprint and database duplicate validation. Any correction or retry requires a fresh preview and confirmation. No silent skipping and no blanket spreadsheet import into protected system tables.

## 3. Reproducible demo setup
- Create one clearly labeled synthetic demo pharmacy through registration and admin approval, using a plan that permits three branches and the required staff seats.
- Use normal forms and actual upload → preview → confirmation flows to create one main branch and two additional branches, two supplier records, categories, realistic pharmacy products and multiple dated batches across all branches.
- Use synthetic staff details and ordinary invitations; do not send invitations to unrelated real people or fabricate confirmed accounts. Confirmed staff access tests use controlled accounts where available; otherwise report that part as blocked.
- Keep demo records in the database, isolated from other businesses. Do not hardcode them into the interface.
- Do not generate fake sales, payment confirmations, AI logs or security records merely to populate every table.

## 4. Final database alignment — at the end
Apply all necessary table/field additions to the existing connected database and verify every change is present. This means aligning the database with the completed forms and imports, **not replacing the 34 existing tables**.

Check all business-table relationships, access policies, grants, indexes, defaults and generated types. Existing data, accounts, roles and private storage remain intact. Verify imported records appear in inventory, supplier selection, branch lists, staff invitations and reports.

Some schema additions must be applied before the associated screens can work; the final step checks the complete database rather than delaying every schema change until after testing.

## Testing and acceptance
- Automated tests for required fields, invalid dates/prices/quantities, duplicate SKUs/batches, reference resolution and cross-business rejection.
- Test CSV and Excel uploads through the real interface, including mapping, row corrections, rejected-row reports, confirmation, results and duplicate retries.
- Confirm manual and imported records read back through their normal management screens.
- Confirm failed imports leave no partially written records or stock movements.
- Test plan limits, role restrictions, expired read-only access and selected branch permissions.
- Verify one main and two additional demo branches, two suppliers, products, batches, staff invitations and reports.
- Test desktop and mobile layouts and review current error logs. Report any account-confirmation or email-domain blocker explicitly rather than calling it complete.

## Technical details
- Keep TanStack routes, the existing Swahivo visual style and data mapping in the service layer.
- Use a shared typed field registry and validation model for manual forms, templates and import mapping; use an established spreadsheet parser loaded only when needed.
- Add schema changes through the managed migration tool; preserve existing tables and use additive fields/tables. Grant appropriate access and enable RLS on new tables.
- Use authenticated, transactional database functions for imports and stock mutations, validating permissions and tenant relationships on the database side.
- Store tenant-scoped import history with creator, module, fingerprint, timestamp, counts and outcome; avoid storing unnecessary personal spreadsheet content.
- Maintain pharmacy-specific staff assignments separately from platform roles and enforce the same branch permissions in reads and writes.

## Out of scope
Importing an external database dump or copying another database's tables: no source export was supplied. Transactional email domain setup remains the separate existing blocker.