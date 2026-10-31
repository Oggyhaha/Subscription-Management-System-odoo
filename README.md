# Brightloop Subscription Management System

A unified recurring billing and subscription management platform built for the Odoo Hackathon.

## Tech Stack
- **Framework**: Next.js 15 (App Router, Server Actions)
- **Language**: TypeScript Strict Mode
- **Styling**: Tailwind CSS + shadcn/ui (Hallmark Design standard)
- **Database & ORM**: PostgreSQL + Prisma ORM (21 normalized tables)
- **Financial Calculations**: `decimal.js` with explicit `ROUND_HALF_UP` policy (Banker-safe 2 decimal places)
- **Forms & Validation**: React Hook Form + Zod
- **Data Tables**: TanStack Table v8
- **Charts**: Recharts
- **Email Delivery**: Nodemailer SMTP
- **Testing**: Vitest

---

## Architecture & Project Structure
- `prisma/`: Prisma schema (`schema.prisma`) with 21 relational models and SQL migrations
- `src/server/`: Server-only business logic and security boundary
  - `services/`: Core billing, subscription lifecycle, invoicing, email, and payment services
  - `actions/`: Next.js Server Actions invoked by client UI
  - `auth/`: Authentication guards, session handling, password policy, crypto, RBAC (`ADMIN`, `STAFF`, `CUSTOMER`)
  - `db.ts`: Prisma Client singleton
  - `errors.ts`: Typed application error classes
- `src/lib/`: Shared utilities
  - `money.ts`: Precision Decimal financial helpers (`toDecimal`, `roundMoney`, `addMoney`, `formatMoney`)
  - `dates.ts`: Calendar arithmetic (`addInterval` handling leap years & month-end boundaries)
  - `env.ts`: Zod-validated environment variables
  - `logger.ts`: Structured JSON logger with automated credential/secret redaction
  - `audit.ts`: Immutable audit trail logger
  - `utils.ts`: Tailwind `cn` class merge helper
- `src/components/`:
  - `ui/`: shadcn/ui atomic components
  - `shared/`: Reusable navigation, data tables, metrics cards, modal dialogs
  - `auth/`: High-finish Hallmark auth forms
- `src/schemas/`: Zod validation schemas for forms, auth, subscriptions, products, and invoices

---

## Demo Accounts & Passwords (Development Only)
> [!IMPORTANT]
> These credentials are strictly for hackathon testing and local evaluation. Never use demo passwords in production.

| Role | Email | Password | Access / Notes |
|---|---|---|---|
| **Admin** | `admin@brightloop.com` | `Admin@Brightloop2026!` | Full system control, staff management (`/admin`) |
| **Staff** | `sarah.chen@brightloop.com` | `Staff@Brightloop2026!` | Sales & day-to-day operations (`/staff`) |
| **Staff** | `david.miller@brightloop.com` | `Staff@Brightloop2026!` | Billing & quotes operations (`/staff`) |
| **Staff** | `elena.rostova@brightloop.com` | `Staff@Brightloop2026!` | Payments & account management (`/staff`) |
| **Customer** | `alex@acmecorp.com` | `Customer@Brightloop2026!` | Acme Corporation portal (`/customer`) |
| **Customer** | `priya@techflow.io` | `Customer@Brightloop2026!` | TechFlow Systems portal (`/customer`) |
| **Customer** | `marcus@greenleaf.org` | `Customer@Brightloop2026!` | Greenleaf Retail portal (`/customer`) |
| **Customer** | `chloe@designhub.co` | `Customer@Brightloop2026!` | DesignHub Studio portal (`/customer`) |
| **Customer** | `liam@nordiclogistics.com` | `Customer@Brightloop2026!` | Nordic Logistics portal (`/customer`) |

---

## Getting Started (For Team Members / Dev B)

### 1. Prerequisites
- Node.js v20+ or v24+
- `pnpm` (recommended) or `npm`
- PostgreSQL instance running locally or via Docker / cloud (e.g., Supabase / Neon)

### 2. Setup Steps
```bash
# 1. Clone or pull the repository
git pull origin main

# 2. Install dependencies
pnpm install

# 3. Configure environment variables
# Copy .env.example to .env and configure your PostgreSQL database credentials
cp .env.example .env

# 4. Generate Prisma Client
pnpm prisma:generate

# 5. Run Database Migrations
pnpm prisma:migrate

# 6. Seed Demo Users & Customers
npx tsx prisma/seed.ts

# 7. Run Unit Tests (Verify everything passes)
pnpm test

# 8. Start Development Server
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## Team Collaboration & Git Rules (Zero Conflict Policy)
- **Roles**:
  - Kartik (Dev A): Backend, Foundation, Security, Billing Engine, Invoicing
  - Vandan (Dev B): UI, Hallmark Design System, Feature Views, Customer Portal
- **Branches**: 
  - Kartik (Dev A): `dev-a/hour-N`
  - Vandan (Dev B): `dev-b/hour-N`
- **Ownership**: Only edit files assigned to your role in each hour. Cross-file requests must be marked with `// TODO(dev-x):`.
- **Hourly Commits**:
  1. Commit your hour's work: `git commit -m "hour-N: <dev> - <short summary>"`
  2. Pull and rebase with `main`: `git pull --rebase origin main`
  3. Merge your branch into `main` and push to GitHub.
- **Never commit `.env` or local `.agents` folders**.
