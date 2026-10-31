# Brightloop Subscription Management System

A unified recurring billing and subscription management platform built for the Odoo Hackathon.

## Tech Stack
- **Framework**: Next.js 15 (App Router, Server Actions)
- **Language**: TypeScript Strict Mode
- **Styling**: Tailwind CSS + shadcn/ui (Hallmark Design standard)
- **Database & ORM**: PostgreSQL + Prisma ORM
- **Financial Calculations**: `decimal.js` with `ROUND_HALF_UP` policy
- **Forms & Validation**: React Hook Form + Zod
- **Data Tables**: TanStack Table
- **Charts**: Recharts
- **Email**: Nodemailer SMTP
- **Testing**: Vitest

## Architecture & Directory Structure
- `prisma/`: Prisma schema, migrations, and seed scripts
- `src/server/`: Server-only business logic
  - `services/`: Core billing, subscription, invoicing, and payment services
  - `actions/`: Next.js Server Actions for UI mutation calls
  - `auth/`: Auth guards, RBAC helpers, password utilities
  - `db.ts`: Prisma Client singleton
- `src/lib/`: Shared utilities
  - `money.ts`: Precision Decimal financial calculation helpers
  - `dates.ts`: Calendar & billing recurrence arithmetic (leap year & month-end safe)
  - `env.ts`: Zod-validated environment variables
  - `logger.ts`: Redacted structured logging
  - `errors.ts`: Typed application error classes
  - `audit.ts`: Audit trail logging helper
- `src/components/`:
  - `ui/`: shadcn/ui atomic primitives
  - `shared/`: Reusable navigation, data tables, metrics, dialogs
- `src/schemas/`: Zod validation schemas for forms and actions

## Team Conventions
- **Dev A (Vandan)**: Backend, Database, Invoicing, Billing Engine, Auth, Financial Math
- **Dev B (Prince)**: UI, Dashboard, Data Tables, Forms, Customer Portal
- All currency calculations use `Decimal` (never IEEE floats).
- Idempotent recurring billing engine prevents duplicate invoices.

## Quick Start
1. Install dependencies: `npm install`
2. Set up environment: Copy `.env.example` to `.env`
3. Generate Prisma client: `npm run prisma:generate`
4. Run migrations: `npm run prisma:migrate`
5. Seed database: `npm run prisma:seed`
6. Run dev server: `npm run dev`
