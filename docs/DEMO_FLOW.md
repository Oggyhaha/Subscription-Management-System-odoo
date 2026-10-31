# Official 9-Step Demonstration Guide — Brightloop Software

This guide outlines the end-to-end demonstration flow for Brightloop Software's Subscription Management Platform, corresponding directly to **Section 13 of the Hackathon Specification**.

---

## 🔑 Demo Accounts & Credentials

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@brightloop.com` | `Admin@Brightloop2026!` | Global System Control, Products, Plans, Taxes, Discounts, Staff, Executive Dashboard |
| **Internal Staff** | `sarah.chen@brightloop.com` | `Staff@Brightloop2026!` | Day-to-Day Operations, Quotes, Subscriptions, Invoices, Payments, Billing Queue |
| **Customer A** | `alex@acmecorp.com` | `Customer@Brightloop2026!` | Acme Corp Self-Service Portal (Subscriptions, Invoices, Receipts) |
| **Customer B** | `priya@techflow.io` | `Customer@Brightloop2026!` | TechFlow Systems Self-Service Portal (Isolated multi-tenant view) |

---

## 🎬 The 9-Step Verification Walkthrough

### Step 1: Create a Product and Plan
- **Actor:** Administrator (`admin@brightloop.com`)
- **Action & Click Path:**
  1. Open [http://localhost:3000/login](http://localhost:3000/login) and sign in as Administrator.
  2. Navigate to **Catalog ➔ Products** (`/admin/products`).
  3. Click **"New Product"**:
     - Name: `Cloud Storage Enterprise`
     - Type: `SOFTWARE`
     - Sales Price: `$150.00`
     - Cost Price: `$40.00`
     - Add Variant: Attribute `Storage Tier`, Value `10TB NVMe`, Price Modifier `+$100.00`.
     - Click **"Save Product"**.
  4. Navigate to **Catalog ➔ Plans** (`/admin/plans`).
  5. Click **"New Plan"**:
     - Name: `Enterprise Storage Monthly`
     - Code: `STORAGE-ENT-M`
     - Price: `$250.00`
     - Billing Frequency: `MONTHLY`
     - Min Quantity: `1`
     - Lifecycle Flags: Enable `Allow Pause`, `Allow Renewal`, `Allow Early Close`.
     - Link Product: Select `Cloud Storage Enterprise`.
     - Click **"Create Plan"**.
- **Expected Result:** Plan is created with active badge and appears in the plan catalog with accurate pricing.

---

### Step 2: Create a Quotation for a Customer
- **Actor:** Internal Staff (`sarah.chen@brightloop.com`)
- **Action & Click Path:**
  1. Sign in as Staff at `/login`.
  2. Go to **Quotations** (`/staff/quotations`).
  3. Click **"Create Quotation"**:
     - Customer: Select `Alex Vance (Acme Corporation)`.
     - Plan: Select `Enterprise Storage Monthly`.
     - Product Lines: `Cloud Storage Enterprise` (Quantity: `2`, Unit Price: `$250.00`).
     - Tax Rule: `Standard US Sales Tax (10%)`.
     - Discount Code: Apply `WELCOME10` (10% discount).
     - Payment Terms: `Net 30`.
     - Validity: `30 days`.
     - Click **"Create Offer"**.
- **Expected Result:** A new quote `QT-2026-XXXX` is created in `DRAFT` status with exact line calculations:
  - Subtotal: `$500.00`
  - Discount (10%): `-$50.00`
  - Tax (10% on $450): `+$45.00`
  - Total: `$495.00`

---

### Step 3: Convert Quotation into an Active Subscription
- **Actor:** Internal Staff (`sarah.chen@brightloop.com`)
- **Action & Click Path:**
  1. In the quotation detail page, click **"Confirm Quote"**. (Status transitions to `CONFIRMED`).
  2. Click **"Convert to Subscription"**.
- **Expected Result:**
  - System generates a new active contract (e.g. `SUB-2026-XXXX`).
  - Next billing date is automatically scheduled 30 days out.
  - Subscription status badge displays `ACTIVE` (Emerald).

---

### Step 4: Trigger a Test Billing Cycle
- **Actor:** Administrator or System Cron
- **Action & Click Path:**
  1. Navigate to **Billing Runs** (`/admin/billing-runs`).
  2. Click **"Run Automated Billing Now"** (or send a POST to `/api/cron/billing` with `Authorization: Bearer <CRON_SECRET>`).
- **Expected Result:**
  - The billing engine evaluates all active subscriptions where `nextBillingDate <= today`.
  - Creates idempotent billing cycle record preventing duplicate charges.
  - Logs execution summary in the billing run history table.

---

### Step 5: Generate an Invoice with Applicable Taxes & Discounts
- **Actor:** Internal Staff (`sarah.chen@brightloop.com`)
- **Action & Click Path:**
  1. Navigate to **Invoices** (`/staff/invoices`).
  2. Open the newly generated invoice for `Acme Corporation`.
- **Expected Result:**
  - Invoice header shows unique number `INV-2026-XXXX`, Status: `CONFIRMED`.
  - Snapshot lines show product name, variant, applied tax rules ($45.00), and discount voucher (-$50.00).
  - Total Amount: `$495.00`, Amount Paid: `$0.00`, Balance Due: `$495.00`.
  - Click **"Print / Download"** to view the printable invoice statement.

---

### Step 6: Record a Partial or Full Payment
- **Actor:** Internal Staff (`sarah.chen@brightloop.com`)
- **Action & Click Path:**
  1. On the invoice detail page (`/staff/invoices/[id]`), click the **"Record Payment"** button.
  2. Fill the payment dialog:
     - Payment Method: `Bank Transfer`
     - Payment Date: Today
     - Amount: `$200.00` *(Partial payment test)*
     - Reference / Note: `WIRE-TX-99881-PARTIAL`
     - Click **"Confirm Payment"**.
- **Expected Result:**
  - Payment is saved atomically within a database transaction.
  - Payment record appears in the invoice payment history table.

---

### Step 7: Show the Updated Balance Due
- **Actor:** Internal Staff or Administrator
- **Action & Click Path:**
  1. Inspect the updated Invoice summary card on `/staff/invoices/[id]`:
     - **Total Billed:** `$495.00`
     - **Amount Paid:** `$200.00`
     - **Remaining Balance Due:** `$295.00`
     - **Status:** `CONFIRMED` *(Still partially due)*
  2. Now click **"Record Payment"** again:
     - Amount: `$295.00` *(Paying exact remainder)*
     - Method: `Credit Card`
     - Reference: `CC-AUTH-7721-FULL`
     - Click **"Confirm Payment"**.
- **Expected Result:**
  - Balance Due reaches **`$0.00`**.
  - Invoice status automatically transitions to **`PAID`** with green status badge.

---

### Step 8: Display the Change in the Dashboard
- **Actor:** Administrator (`admin@brightloop.com`)
- **Action & Click Path:**
  1. Navigate to **Executive Dashboard** (`/admin`).
- **Expected Result:**
  - **Cash Collected KPI:** Increases by `+$495.00` (reflecting actual cash receipts in bank).
  - **Invoiced Receivables KPI:** Displays total invoiced amounts.
  - **MRR (Monthly Recurring Revenue):** Displays normalized monthly run rate with documented calculation tooltip.
  - **Recent Cash Receipts Table:** Displays both payment receipts (`WIRE-TX-99881-PARTIAL` and `CC-AUTH-7721-FULL`).
  - **Revenue Trend Bar Chart:** Visualizes Invoiced vs Collected cash bars.

---

### Step 9: Log In as the Customer and Verify Multi-Tenant Isolation
- **Actor:** Customer A (`alex@acmecorp.com`) and Customer B (`priya@techflow.io`)
- **Action & Click Path:**
  1. Log out, then log in as `alex@acmecorp.com` at `/login`.
  2. View **Customer Portal Dashboard** (`/customer`):
     - Displays Acme Corporation's active subscription, next renewal date, and recent paid invoice.
  3. Navigate to **My Invoices** (`/customer/invoices`):
     - Shows only Acme Corporation's invoices.
  4. **Strict Security Verification:**
     - Attempt to navigate to an invoice belonging to TechFlow Systems (e.g. `/customer/invoices/INV-2026-0001`).
     - **Result:** Displays clean `404 Not Found` (never leaks existence or forbidden error).
  5. Log out and log in as `priya@techflow.io`:
     - Sees exclusively TechFlow Systems's Annual Growth plan and zero data from Acme Corporation.

---

## 🎯 Verification Complete

All 9 steps demonstrate Brightloop's end-to-end subscription lifecycle:
1. Catalog configuration
2. Quotation generation with tax/discount calculation
3. Subscription conversion
4. Automated billing run
5. Real snapshot invoice generation
6. Payment execution with atomic transaction lock
7. Decimal balance reconciliation
8. Executive financial reporting
9. Multi-tenant customer security

