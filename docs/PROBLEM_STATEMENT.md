# Subscription Management System — Brightloop Software

Build one system to run plans, subscriptions, and recurring billing in one place.

---

## 1) The Challenge
Your task is to build one unified software platform that runs the full life of a subscription business, from setting up products and plans to sending invoices, collecting payments, and reporting revenue. Think of it as the digital backbone of a company that earns its money every month, not just once. 

Read the scenes that follow as things that actually happen in an ordinary billing month, and design the system that makes each of them easy.

---

## 2) Meet Brightloop Software
Brightloop Software sells everything on subscription: business software billed by the month or the year, add-ons customers switch on and off, and a few products that come in different variants. Customers range from small shops on a monthly plan to large companies on yearly contracts. 

An admin sets up products, plans, taxes, and discounts; a small internal team handles customers day to day; and customers want to see and manage their own subscriptions without having to email anyone.

### How Things Run Today
- **Customer subscriptions**: Tracked in a spreadsheet
- **Renewals**: Remembered by whoever notices first
- **Invoices**: Typed up by hand every month
- **Payments**: Matched to invoices by scrolling through bank statements
- **Revenue reports**: Built manually at the end of each quarter

*Outcome:* Renewals get missed, invoices go out wrong, and nobody can say how much recurring revenue the company actually has.

---

## 3) A Month at Brightloop

### Scene 1: A new customer signs up
A small business finds Brightloop online and creates an account with their email and a password.
- Each email can belong to only one account.
- The password must be more than eight characters, with an uppercase letter, a lowercase letter, and a special character.
- If they forget it later, a reset link should arrive at their registered email.

**Role-Based Access Control (RBAC):**
- Not everyone who logs in should see the same things.
- **Admin**: Controls the whole system, configures settings, manages staff members. Only the admin can add a new member of staff.
- **Internal Staff**: Handle day-to-day work with limited access (customers, quotes, subscriptions, billing, payments, reporting).
- **Customers**: See only their own subscriptions and invoices through a dedicated self-service portal.

---

### Scene 2: Launching a new plan
Brightloop is launching a new product.
- **Product Details**: Admin adds it with its name, type, sales price, cost price, and notes.
- **Variants**: Admin offers it in variants (for example by brand, where choosing the "Odoo" brand adds 560 to the price).
- **Plans**: 
  - Pricing and billing frequency: **daily, weekly, monthly, or yearly**.
  - Minimum quantity requirements.
  - Dates the plan is available (start date, end date).
  - Lifecycle rules: Some plans should close on their own when they end, while others can be closed early, paused, or renewed. The admin decides these rules, plan by plan.

---

### Scene 3: Turning a quote into a subscription
A sales rep is preparing an offer for a large customer.
- Instead of building it from scratch, they start from a **quotation template** that already has the right plan and product lines, and stays valid for a set number of days.
- **Subscription Fields**:
  - Unique subscription number
  - Customer
  - Plan
  - Start date
  - Expiry date
  - Payment terms
  - Lines showing: product, variant (if applicable), quantity, unit price, taxes, discounts, and line amount.
- **Lifecycle States**:
  Moves from `Draft` ➔ `Quotation` ➔ `Confirmed` ➔ `Active` ➔ `Closed` (with pause/resume capability where allowed).
- **Visibility**: Anyone on the internal team should be able to see where each subscription stands.

---

### Scene 4: Billing day
It is billing day, and hundreds of subscriptions are due at once.
- Nobody should be typing invoices by hand.
- Each invoice should be automatically created from its subscription, with customer details, product lines, taxes, discounts, and totals pre-filled.
- **Taxes**: Calculated automatically from tax rules the admin has configured.
- **Invoice Actions**: The team can confirm, cancel, send (email simulation), or print/download any invoice.
- **Invoice Lifecycle**: Moves from `Draft` ➔ `Confirmed` ➔ `Paid` (or `Cancelled`).
- **Idempotency Rule**: Nothing should ever be billed twice or skipped.

---

### Scene 5: A customer asks for a better price (Discounts)
A customer wants a discount for taking more seats.
- Only the admin can create discount rules.
- **Discount Types**: Fixed amount or percentage.
- **Rules & Constraints**:
  - Minimum purchase amount or minimum quantity.
  - Start and end validity dates.
  - Usage limit (maximum number of times it can be used).
- **Scope**: Can apply to specific products or to whole subscriptions.
- **Recurring Behavior**: Once applied, it automatically appears on subsequent invoices without manual intervention, and stops when expired or usage limit is exhausted.

---

### Scene 6: The money comes in (Payments)
Payments arrive by different methods and on different days.
- Each payment is recorded with:
  - Payment method (Credit Card, Bank Transfer, UPI, Cash, Check, etc.)
  - Amount paid
  - Payment date
  - Transaction note / reference
  - Linked to the specific invoice.
- **Receivables Tracking**: At any moment, the team should be able to see which invoices are paid and which are still outstanding, so overdue ones can be chased before turning into lost revenue.

---

### Scene 7: The finance lead, at the end of the month (Analytics & Dashboard)
How many subscriptions are active? How much revenue came in, and how much is still owed? Which invoices are overdue?
- The finance lead wants one central place to see:
  - Active subscriptions
  - Total revenue collected
  - Payments received
  - Outstanding balances and overdue invoices
- Filters and summary views (by date range, customer, plan, status).
- **Performance Requirement**: With thousands of subscriptions on the books, every page and query must respond in under 2 seconds.

---

## 4) Technical Stack & Architectural Standards
- **Framework**: Next.js App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **Design Standard**: Hallmark design guidance (`.agents/skills/hallmark/`)
- **Data Visualizations**: Recharts
- **Forms & Validation**: React Hook Form + Zod
- **Data Tables**: TanStack Table
- **Database & ORM**: PostgreSQL + Prisma ORM
- **Financial Calculations**: Decimal precision (Prisma Decimal + decimal.js) — *never fake or hardcode totals, never use IEEE floating point for currency*
- **Email Delivery**: Nodemailer SMTP
- **Deployment Target**: Vercel
- **Contracts**:
  - `src/server/services/*`
  - `src/server/actions/*`
  - `src/schemas/*`
  - `src/components/ui/*`
  - `src/components/shared/*`
  - `src/lib/*`

