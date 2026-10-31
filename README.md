# 🚀 Brightloop Subscription Management System (SMS)

> **A high-precision, enterprise-grade recurring billing and subscription lifecycle management platform built for the Odoo Hackathon.**  
> Crafted with Next.js 15 App Router, TypeScript (Strict Mode), PostgreSQL, Prisma ORM, Decimal.js financial math, and tailored for Indian enterprises (INR ₹ / GST).

---

## 📑 Table of Contents
- [Key Highlights](#-key-highlights)
- [1-Click Interactive Demo Environments](#-1-click-interactive-demo-environments)
- [Complete Feature Modules](#-complete-feature-modules)
- [Indian Market Localization (INR ₹ & GST)](#-indian-market-localization-inr--gst)
- [Financial Precision & Security Architecture](#-financial-precision--security-architecture)
- [Tech Stack](#-tech-stack)
- [Architecture & Directory Structure](#-architecture--directory-structure)
- [Pre-Seeded Accounts & Credentials](#-pre-seeded-accounts--credentials)
- [Getting Started & Local Setup](#-getting-started--local-setup)
- [Automated Testing Suite (164/164 Passing)](#-automated-testing-suite-164164-passing)
- [API & Cron Endpoints](#-api--cron-endpoints)

---

## 🌟 Key Highlights

- **⚡ Instant 1-Click Role Switcher:** Switch between Administrator, Staff Operations, and Customer Portal with a single click directly from the homepage and login screen.
- **🇮🇳 100% Indian Enterprise Ready:** Localized to Indian Rupee (`₹` / `INR`) with `en-IN` numbering formatting and pre-configured GST rules (18% Standard, 5% Reduced across states).
- **🛡️ Rock-Solid Financial Math:** 28-digit precision using `Decimal.js` with `ROUND_HALF_UP` (Banker's rounding). Zero floating-point rounding errors or penny slippage.
- **🔄 Complete Subscription Lifecycle:** DRAFT &rarr; QUOTATION &rarr; CONFIRMED &rarr; ACTIVE &rarr; PAUSED &rarr; CLOSED with automated interval renewals and auto-close triggers.
- **🧾 Automated Billing & Idempotent Invoicing:** Automated recurring invoice generation backed by unique cycle keys (`subscriptionId_periodStart_periodEnd`) to guarantee zero duplicate charges.
- **🔒 Enterprise Security:** Edge middleware origin checks (CSRF protection), rate limiting, timing-safe crypto hashing, bcrypt password security, and automated security audit logs.
- **🎨 Hallmark Design System:** Tailored UI with clean typography, contrast standards, instant client-side routing, and support for dark and light modes.

---

## ⚡ 1-Click Interactive Demo Environments

On the homepage (`/`) and sign-in page (`/login`), click any of the 3 quick-launch demo environment cards to immediately access realistic workspaces:

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│     🛡️ Administrator Portal     │   │      👥 Staff Operations        │   │    🧾 Customer Self-Service     │
├─────────────────────────────────┤   ├─────────────────────────────────┤   ├─────────────────────────────────┤
│ • Full platform governance      │   │ • Daily quote drafting          │   │ • Acme Corporation portal       │
│ • Tax & GST rule management     │   │ • Subscription activation       │   │ • Active ₹120/mo Cloud ERP sub  │
│ • Coupon & discount engine      │   │ • Manual renewal & pause/resume │   │ • Invoice history & receipts    │
│ • Staff account provisioning    │   │ • Invoice dispatch & PDF print  │   │ • 1-click mock payment gateway  │
│ 👤 admin@brightloop.com         │   │ 👤 sarah.chen@brightloop.com     │   │ 👤 alex@acmecorp.com            │
└─────────────────────────────────┘   └─────────────────────────────────┘   └─────────────────────────────────┘
```

---

## 📦 Complete Feature Modules

### 1. Products & Variant Catalog (`/admin/products`, `/admin/products/variants`)
- Product master catalog with base sales prices, SKU codes, descriptions, and active status.
- Configurable product attributes (e.g., Storage: 100GB, 500GB; License tier: Single, Enterprise).
- Variant price modifiers (fixed amount add-ons or percentage markups) with real-time effective price calculation.

### 2. Subscription Plans & Billing Intervals (`/admin/plans`)
- Recurring plans supporting **DAILY**, **WEEKLY**, **MONTHLY**, and **YEARLY** billing cadences.
- Plan policies: configurable flags for `allowPause`, `allowRenewal`, `allowEarlyClose`, and `autoCloseAtEnd`.
- Bundle predefined product lines and default trial period configurations.

### 3. Quotations & Quotation Templates (`/admin/quotations`, `/staff/quotations`)
- Create tailored commercial offers for prospective subscribers with expiration dates.
- Reusable quotation templates with predefined product lines for fast sales rep turnaround.
- Accept-to-Subscription workflow: converting an accepted quotation atomically provisions an active subscription.
- Automated email dispatch of formal quotation notifications with audit tracking.

### 4. Subscription Lifecycle Management (`/admin/subscriptions`, `/staff/subscriptions`)
- Comprehensive status tracking: `DRAFT`, `QUOTATION`, `CONFIRMED`, `ACTIVE`, `PAUSED`, `CLOSED`.
- Visual lifecycle stepper showing progression through contract stages.
- Actions: Manual Activation, Pause (suspends billing), Resume (restores billing), Renew, and Early Close.
- Automated background processor (`processAutoClosuresAction`) to close subscriptions that reached period end.

### 5. Invoicing & Billing Runs (`/admin/invoices`, `/staff/invoices`, `/staff/billing`)
- Automated recurring charge generation for subscriptions reaching their `nextBillingDate`.
- Idempotent execution: prevents duplicate billing runs using unique composite billing cycle keys.
- Complete invoice details view with line item tax, discount breakdowns, and printable PDF invoice view (`/invoices/[id]/print`).
- Payment status states: `DRAFT`, `CONFIRMED`, `PAID`, `PARTIALLY_PAID`, `OVERDUE`, `CANCELLED`.

### 6. Taxes & Regional GST Engine (`/admin/taxes`)
- Configurable regional tax rules with support for tax inclusion (inclusive vs. exclusive pricing).
- Default Indian GST configuration: Standard GST (18%) and Reduced GST (5%).
- Live Tax Simulator calculator to test rounding policies and inclusive tax extraction formulas.

### 7. Coupons & Discount Rules (`/admin/discounts`)
- Fixed Rupee amount (`₹`) and percentage (`%`) discount vouchers.
- Flexible application scopes: entire subscription, specific plans, or specific add-on products.
- Minimum purchase requirements, start/end validity windows, and total redemption limits.

### 8. Customer Self-Service Portal (`/customer`)
- Customer dashboard with active subscription summaries, next billing dates, and outstanding balance in `₹`.
- Subscription manager: view plan details, add-on lines, and terms.
- Invoices & Receipts: download and view past invoices with full tax breakdowns.
- Instant mock payment gateway: record full or partial payments with real-time balance reconciliation.

---

## 🇮🇳 Indian Market Localization (INR ₹ & GST)

All financial data, inputs, invoices, charts, and test cases are formatted for the Indian market:
- **Currency Code:** `INR` (Indian Rupee)
- **Symbol:** `₹`
- **Number Formatting:** `en-IN` format with proper lakh/crore group separators (e.g., `₹1,20,000.00`).
- **GST Compliance:** Pre-seeded with Goods & Services Tax rules for Indian states (e.g., Maharashtra `MH`, Delhi `DL`).
- **Clean Display:** Sanitized all legacy currency symbols, ensuring zero mixed dollar/rupee labels.

---

## 🛡️ Financial Precision & Security Architecture

### Zero Floating-Point Slippage
```typescript
// All monetary arithmetic utilizes Decimal.js with Banker's Rounding
import Decimal from "decimal.js";
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });
```
- Line item total: `lineTotal = roundMoney((unitPrice * qty - discount) * (1 + taxRate))`
- Database storage: PostgreSQL `DECIMAL(12, 2)` column types across all financial balances.

### Edge Middleware & Security Headers
- **CSRF Protection:** Validates Origin & Referer headers against application origins on mutating requests (`POST`, `PUT`, `DELETE`, `PATCH`).
- **Strict Headers:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`.
- **RBAC Guards:** Independent route trees protected via cryptographic session verification:
  - `/admin/*` &rarr; Strict `ADMIN` role
  - `/staff/*` &rarr; `STAFF` or `ADMIN` role
  - `/customer/*` &rarr; Authenticated customer session linked to `CustomerProfile`

---

## 💻 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework** | Next.js 15.5 (App Router, Server Actions, React 19) |
| **Language** | TypeScript 5.9 (Strict Mode, 0 errors) |
| **Styling** | Tailwind CSS 3.4 + Radix UI Primitives (shadcn/ui Hallmark Theme) |
| **Database** | PostgreSQL + Prisma ORM 6.19 (21 normalized tables) |
| **Financial Engine** | `decimal.js` (Banker's Half-Up rounding, 28-digit precision) |
| **Forms & Validation** | React Hook Form + Zod 3.24 |
| **Data Tables** | TanStack Table v8 with pagination, filtering, and sorting |
| **Charts & Metrics** | Recharts responsive analytics |
| **Email Service** | Nodemailer with non-blocking error handling & secret sanitization |
| **Testing** | Vitest 2.1 (164 tests across 15 test suites) |

---

## 📂 Architecture & Directory Structure

```
├── prisma/
│   ├── schema.prisma            # 21 relational models with Decimal financial fields
│   └── seed.ts                  # Comprehensive demo data (users, plans, subs, invoices, GST)
├── src/
│   ├── app/
│   │   ├── (admin)/admin/       # Admin portals: plans, products, taxes, discounts, staff
│   │   ├── (staff)/staff/       # Staff operational tools: quotations, subscriptions, billing
│   │   ├── (customer)/customer/ # Customer self-service portal: subscriptions, invoices, pay
│   │   ├── (auth)/              # Authentication routes: /login, /register, /reset-password
│   │   ├── api/                 # REST endpoints: /api/taxes, /api/discounts, /api/cron/*
│   │   ├── layout.tsx           # Global root layout with theme script
│   │   └── page.tsx             # Hallmark homepage with 1-Click Demo Portals
│   ├── components/
│   │   ├── auth/                # LoginForm, RegisterForm, DemoPortalBoxes
│   │   ├── catalog/             # TaxFormDialog, TaxCalculatorCard, PlanDialogs
│   │   ├── discounts/           # DiscountFormDialog, DiscountRulesList
│   │   ├── invoice/             # InvoiceDetailView, InvoicesListView, InvoicePrint
│   │   ├── layout/              # AppSidebar, AppTopbar, ThemeToggle, DashboardShell
│   │   ├── quotations/          # QuotationsListView, QuotationDetailView, TemplatesView
│   │   ├── shared/              # DataTable, PageHeader, MoneyText, StatusBadge
│   │   ├── subscriptions/       # SubscriptionsListView, SubscriptionDetailView
│   │   └── ui/                  # Atomic shadcn/ui primitives
│   ├── lib/
│   │   ├── money.ts             # Precision financial arithmetic & INR formatting
│   │   ├── dates.ts             # Safe date-fns interval math & leap-year clamps
│   │   ├── audit.ts             # Audit trail writer
│   │   ├── errors.ts            # Typed AppError classes
│   │   └── env.ts               # Zod-validated environment schema
│   ├── schemas/                 # Form & server action validation schemas
│   ├── server/
│   │   ├── actions/             # Next.js Server Actions (auth, catalog, quotation, etc.)
│   │   ├── auth/                # Session cookies, password policy, guards
│   │   └── services/            # Core business services (billing, invoice, subscription, tax)
│   └── middleware.ts            # Global edge security, CSRF checks & RBAC redirects
├── test/                        # Comprehensive Vitest test suites (164 tests)
├── next.config.ts               # Security headers, body limit, devIndicators configuration
└── package.json
```

---

## 🔑 Pre-Seeded Accounts & Credentials

| Role | Email | Password | Pre-seeded Workspace Context |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@brightloop.com` | `Admin@Brightloop2026!` | Full administrative privileges, revenue dashboards, taxes, discounts |
| **Staff Member** | `sarah.chen@brightloop.com` | `Staff@Brightloop2026!` | Sales rep with active quotation templates and billing workflows |
| **Staff Member** | `david.miller@brightloop.com` | `Staff@Brightloop2026!` | Operational staff handling recurring subscriptions and renewals |
| **Staff Member** | `elena.rostova@brightloop.com` | `Staff@Brightloop2026!` | Accounts specialist monitoring invoices and payment reconciliation |
| **Customer (Acme)** | `alex@acmecorp.com` | `Customer@Brightloop2026!` | Acme Corp portal with active Starter Monthly Cloud ERP subscription |
| **Customer (TechFlow)** | `priya@techflow.io` | `Customer@Brightloop2026!` | Annual SaaS subscription with paid invoice history and payment records |
| **Customer (Greenleaf)** | `marcus@greenleaf.org` | `Customer@Brightloop2026!` | Retail customer with overdue invoice scenario for dunning testing |

---

## 🚀 Getting Started & Local Setup

### 1. Prerequisites
- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **Package Manager**: `pnpm` (recommended) or `npm`
- **PostgreSQL**: Running locally (`localhost:5432`) or hosted cloud database

### 2. Environment Configuration
Create a `.env` file in the project root:
```env
# Database configuration (PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/subscription_db?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/subscription_db?schema=public"

# Cryptographic secrets (min 16 chars for AUTH_SECRET)
AUTH_SECRET="2a107efc859ea4a2a9af028076930e265835e2bb5211c6218c37d5881be59945"
CRON_SECRET="ddb2f745b9709b4418e2681b6dbaf5afa016f8d5d6bae41c6c698e24fb31e2fa"

# Email SMTP Settings (optional for local testing; email service falls back safely)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="billing@brightloop.com"
SMTP_PASS="mock-password"
SMTP_FROM_EMAIL="billing@brightloop.com"
SMTP_FROM_NAME="Brightloop Software Billing"

# Application URL
APP_URL="http://localhost:3000"
```

### 3. Installation & Database Migration
```bash
# Install dependencies
pnpm install

# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Seed database with realistic Indian enterprise demo data
npx tsx prisma/seed.ts
```

### 4. Start the Application
```bash
# Start development server
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧪 Automated Testing Suite (164/164 Passing)

The application includes 15 automated test suites covering financial math, security policies, billing idempotency, and workflow integration:

```bash
# Run all unit and integration test suites
npm test -- --run
```

```text
 ✓ test/customer-portal.test.ts (12 tests)
 ✓ test/reporting.test.ts (9 tests)
 ✓ test/discount.test.ts (12 tests)
 ✓ tests/integration/full_workflow.test.ts (6 tests)
 ✓ test/invoice.test.ts (11 tests)
 ✓ test/catalog.test.ts (15 tests)
 ✓ test/email.test.ts (12 tests)
 ✓ test/seed_and_overdue.test.ts (12 tests)
 ✓ test/payment.test.ts (12 tests)
 ✓ test/auth.test.ts (11 tests)
 ✓ tests/security/security.test.ts (24 tests)
 ✓ test/billing.test.ts (10 tests)
 ✓ test/lib.test.ts (8 tests)
 ✓ tests/integration/duplicate_and_retry.test.ts (3 tests)
 ✓ test/quotation_subscription.test.ts (7 tests)

 Test Files  15 passed (15)
      Tests  164 passed (164)
   Duration  6.63s
```

---

## ⏰ API & Cron Endpoints

| Method | Endpoint | Description | Authentication |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/cron/billing` | Triggers recurring invoice generation for subscriptions due for renewal | `Bearer <CRON_SECRET>` |
| `POST` | `/api/cron/auto-close` | Closes subscriptions that have reached their contract end date | `Bearer <CRON_SECRET>` |
| `GET` | `/api/taxes` | Fetches active regional tax rules with pagination & search | Cookie Session |
| `GET` | `/api/discounts` | Fetches applicable coupons with usage stats and scopes | Cookie Session |
| `POST` | `/api/auth/logout` | Clears authentication cookies and terminates user session | Public |

---

## 📄 License
Built for the **Odoo Hackathon 2026** by Team Brightloop.
All rights reserved.
