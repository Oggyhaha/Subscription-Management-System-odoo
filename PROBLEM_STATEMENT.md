# Subscription Management System — Complete Product and Technical Specification

## 1. Project Overview

Build a complete, responsive, production-minded web application named **Subscription Management System** for a fictional subscription-based software company called Brightloop Software.

The platform must centralize product and plan management, customer subscriptions, quotations, recurring billing, invoice generation, discount rules, tax calculations, payment tracking, and financial reporting.

The application must replace manual spreadsheet tracking, manually prepared invoices, forgotten renewals, manual payment reconciliation, and manually generated revenue reports.

This is a functional business application, not merely a static dashboard or frontend prototype.

Implement real database persistence, working forms, validated business logic, role-based access control, connected workflows, and realistic reporting.

## 2. Recommended Technology Stack

Use the following stack unless the existing project already has an equivalent, working implementation.

### Frontend
- Next.js with App Router
- React
- TypeScript with strict type checking
- Tailwind CSS
- shadcn/ui for reusable components
- Recharts for financial charts
- React Hook Form and Zod for forms and validation
- TanStack Table for searchable, sortable, paginated data tables

### Backend
- Next.js Server Actions and Route Handlers
- Server-side service modules for business logic
- Prisma ORM
- PostgreSQL relational database
- Secure, session-based authentication
- Role-based authorization enforced on the server

Do not put billing calculations, privileged database operations, secrets, or authorization decisions exclusively in client-side code.

### Authentication
Implement secure authentication with:
- Unique email addresses
- Password minimum length greater than eight characters
- At least one uppercase letter
- At least one lowercase letter
- At least one special character
- Secure password hashing
- Login and logout
- Email-based password reset
- Expiring, single-use password-reset tokens
- Protected routes and server-side permission checks

Only administrators can create staff accounts.

Use a trusted authentication library or implement authentication with well-established security practices. Never store plaintext passwords.

### Email Service
Use **SMTP with Nodemailer** for sending emails.

Configure all SMTP settings through environment variables:
- SMTP_HOST
- SMTP_PORT
- SMTP_SECURE
- SMTP_USER
- SMTP_PASS
- SMTP_FROM_EMAIL
- SMTP_FROM_NAME
- APP_URL

Use a reusable server-side email service module with separate email templates for:
- Password reset
- Account invitation, if implemented
- Quotation delivery
- Invoice delivery
- Payment confirmation
- Renewal reminders

Requirements:
- Use HTML email templates with readable plain-text alternatives.
- Validate email addresses.
- Handle SMTP errors gracefully.
- Log delivery attempts and failures without exposing credentials, reset tokens, or sensitive information.
- Do not block or roll back an already-created invoice merely because email delivery failed.
- Provide an admin-visible retry mechanism for failed email notifications where appropriate.
- Do not expose SMTP credentials to the browser.
- Do not assume an email has been delivered simply because a message was submitted to the SMTP server.

For local development, support a test SMTP service or a development email sink.

### Database and Deployment
- PostgreSQL for persistent storage
- Prisma migrations and schema management
- Vercel for web application deployment
- A managed PostgreSQL provider with appropriate production connection settings
- A reliable scheduled job or background worker for recurring billing
- GitHub for source control

Keep secrets in environment variables. Provide an `.env.example` with placeholders, never real credentials.

## 3. User Roles and Permissions

Implement three roles.

### Administrator
Can:
- Access the complete administrative dashboard
- Create, edit, archive, and manage products and variants
- Create and manage subscription plans
- Configure taxes and discounts
- Create staff accounts
- View and manage customers
- Manage quotation templates
- View and manage all quotations and subscriptions
- Control authorized subscription lifecycle transitions
- Generate, confirm, cancel, send, and print invoices
- Record and review payments
- View financial reports
- Review important audit events

### Internal Staff
Can:
- Access operational dashboards
- View and manage customers within their permissions
- Create quotations from templates
- Manage subscriptions and permitted lifecycle actions
- View, prepare, and send invoices according to permissions
- Record payments against invoices
- View outstanding and overdue invoices

Staff must not create other staff accounts or change administrator-only configuration unless explicitly authorized.

### Customer
Can:
- Register and log in
- Reset their password
- View their own profile
- View their own subscriptions
- View their own invoices and payment history
- Download or print their invoices
- Request or perform permitted subscription actions, such as pausing or renewing when allowed

Customers must never access another customer's data by modifying a URL, query parameter, request body, or record ID.

Enforce ownership checks in every server-side query and mutation.

## 4. Core Functional Modules

### 4.1 Product Management

Product fields:
- Product ID
- Product name
- Product type
- Sales price
- Cost price
- Notes or description
- Active/archive status
- Created and updated timestamps

Support product variants.

Variant fields:
- Variant ID
- Parent product ID
- Variant name or attribute values
- Price adjustment
- Active status

Calculate the effective unit price from the base price and applicable variant adjustments.

Example: If the base price is 2,000 and the selected Odoo variant adds 560, the effective price is 2,560 before applicable taxes and discounts.

Use the currency configured for the business. Do not assume all customers use the same currency unless the application explicitly supports only one.

### 4.2 Subscription Plan Management

Each plan should include:
- Plan ID
- Name and description
- Billing interval: daily, weekly, monthly, yearly
- Price
- Minimum quantity
- Availability start date
- Availability end date
- Automatic closure at expiry setting
- Pause permission
- Early closure permission
- Renewal permission
- Active/archive status

Validate the plan's availability and quantity rules when creating or confirming a subscription.

Calculate billing dates correctly, including month-end and leap-year cases.

### 4.3 Customer Management

Customer records should include:
- Customer ID
- Name
- Email
- Contact information where needed
- Billing address
- Tax information if applicable
- Account status
- Created timestamp

A customer email must be unique for the applicable account identity.

Keep user authentication information separate from business-specific customer profile information where appropriate.

### 4.4 Quotation Templates and Quotations

Quotation templates must support:
- Template name
- Default plan and product lines
- Default quantities
- Default terms
- Configurable validity duration
- Active status

Quotation records must include:
- Unique quotation number
- Customer
- Quotation date
- Expiry date
- Product lines
- Quantities
- Unit prices
- Applicable taxes and discounts
- Subtotal and total
- Status

Quotation statuses:
- Draft
- Sent
- Accepted
- Expired
- Cancelled

Use the exact lifecycle names required by the business specification for subscriptions. Quotation-specific statuses may be added where needed.

Allow staff to generate a quotation from an existing template rather than manually rebuilding every offer.

When an authorized user accepts or confirms a quotation, create the corresponding subscription through a validated, transactional workflow.

### 4.5 Subscription Management

Each subscription must have:
- Unique subscription number
- Customer ID
- Plan ID
- Start date
- Expiry date
- Billing interval
- Next billing date
- Payment terms
- Subscription line items
- Quantities
- Unit prices
- Applicable tax and discount references
- Current status
- Created and updated timestamps

Required lifecycle:
Draft → Quotation → Confirmed → Active → Closed.

Support pause, renewal, early closure, and automatic closure according to the configured plan rules.

Validate all state transitions on the server.

Maintain a clear history of important lifecycle changes.

Do not automatically reactivate expired, paused, or closed subscriptions without an explicitly permitted action.

### 4.6 Tax Calculation

Create configurable tax rules with:
- Tax name
- Rate
- Applicability
- Active status
- Effective dates when necessary

Calculate taxes using server-side decimal arithmetic.

Clearly define whether a tax is inclusive or exclusive of the displayed unit price.

Preserve the applied tax rate and calculated tax amount on invoice line-item snapshots so historical invoices remain accurate after tax rules change.

Do not hardcode a tax rate without an explicit business configuration.

### 4.7 Discount Management

Only administrators may create or change discount rules.

Support:
- Fixed-amount discounts
- Percentage discounts
- Minimum purchase amount
- Minimum quantity
- Start and end dates
- Maximum usage count
- Product-specific discounts
- Subscription-wide discounts
- Active/expired/exhausted status

Apply eligible discounts automatically during invoice calculation.

Validate all conditions server-side.

Prevent discounts from exceeding their usage limit under concurrent requests. Use transactions or another reliable concurrency-control strategy.

Avoid negative invoice totals. Define and test the discount allocation and rounding rules.

A discount must not apply after its expiry or after its permitted usage count has been reached.

### 4.8 Invoice Management

Generate invoices from subscription billing cycles.

Each invoice should contain:
- Unique invoice number
- Customer and billing details
- Subscription reference
- Billing period
- Invoice date
- Due date
- Invoice line items
- Quantity and unit price
- Tax amounts
- Discount amounts
- Subtotal
- Total
- Amount paid
- Balance due
- Status

Required invoice lifecycle:
Draft → Confirmed → Paid.

Support cancellation and sending or printing invoices as specified.

The invoice generation process must:
1. Identify the subscription billing period.
2. Validate that the subscription is eligible for billing.
3. Load the applicable product lines and quantities.
4. Calculate prices, discounts, taxes, and totals.
5. Create immutable invoice line-item snapshots.
6. Record the billing cycle.
7. Update the next billing date.
8. Send the invoice email through the SMTP/Nodemailer service when requested or configured.

Prevent duplicate invoices for the same subscription and billing period.

Use database transactions and unique billing-cycle identifiers to ensure duplicate-safe processing.

Do not send an invoice notification before the invoice transaction has successfully committed.

Do not lose the invoice if SMTP delivery fails. Record the email failure separately and allow a retry.

### 4.9 Recurring Billing Scheduler

Create a scheduled billing service that processes subscriptions whose next billing dates are due.

The scheduled process must:
- Select eligible subscriptions
- Exclude paused, closed, and ineligible subscriptions
- Check expiry and billing rules
- Create the correct invoice
- Record successful and failed processing attempts
- Update the next billing date exactly once
- Avoid duplicate invoices
- Support safe retries
- Log processing results
- Provide a controlled manual billing-run action for administrators or authorized staff

Use a protected scheduled endpoint or background worker. Secure scheduled-job authentication and do not rely on dashboard page visits to trigger billing.

Use a unique billing-cycle key or equivalent database constraint for idempotency.

Consider failures between invoice creation, billing-cycle recording, and email delivery. Use database transactions for financial data and a durable notification queue or outbox pattern if needed for reliable email delivery.

Never mark an invoice paid merely because it was generated or emailed.

### 4.10 Payment Management

Support recording payments received through different methods.

Payment fields:
- Payment ID
- Invoice ID
- Amount
- Payment method
- Payment date
- Transaction/reference ID, when available
- Notes
- Created by
- Created timestamp

For the hackathon, manual payment recording and invoice reconciliation are sufficient unless live payment gateway integration is explicitly required.

Validate that:
- The invoice exists and is eligible for payment
- The payment amount is positive
- The payment does not exceed the outstanding balance unless the system explicitly supports overpayments
- Duplicate payment references are handled appropriately
- The remaining balance is calculated correctly

Allow partial payments.

Mark an invoice as Paid only when its outstanding balance has been settled according to the configured rounding policy.

Use database transactions to record payments and update the corresponding invoice balance consistently.

Keep payment records auditable. Do not silently delete financial history.

### 4.11 Financial Dashboard and Reporting

Create a dashboard displaying:
- Total active subscriptions
- New subscriptions over a selected period
- Revenue collected
- Total outstanding balances
- Number and amount of overdue invoices
- Upcoming renewals
- Recent payments
- Subscription status breakdown
- Revenue trends over time

Add date-range and status filters.

Distinguish the following metrics:
- Invoiced amount
- Collected payments
- Outstanding invoice balance
- Overdue balance
- Recurring revenue, if implemented with a clearly documented calculation

Do not count invoice totals as collected cash.

Calculate figures from the database using appropriate aggregation queries. Avoid hardcoded charts and mock totals in the completed application.

### 4.12 Customer Portal

Create a customer-facing portal with:
- Overview of current subscriptions
- Plan and billing information
- Renewal and expiry dates
- Invoice history
- Payment history
- Invoice download or print
- Permitted pause or renewal actions

All queries must be scoped to the authenticated customer.

Validate requested actions against the subscription's current state and plan configuration.

## 5. Recommended Database Schema

Use PostgreSQL with Prisma.

Implement normalized relational tables for:

1. users
2. customer_profiles
3. products
4. product_variants
5. plans
6. plan_products
7. tax_rules
8. quotation_templates
9. quotation_template_items
10. quotations
11. quotation_items
12. subscriptions
13. subscription_items
14. discount_rules
15. discount_redemptions
16. invoices
17. invoice_items
18. payments
19. billing_cycles
20. email_delivery_logs
21. audit_logs

Add foreign keys, unique constraints, indexes, and appropriate delete/update rules.

Important constraints:
- Unique user email
- Unique product/variant identifiers where applicable
- Unique quotation number
- Unique subscription number
- Unique invoice number
- Unique subscription billing-cycle identifier
- Valid positive quantities and monetary values
- Referential integrity between customers, subscriptions, invoices, and payments

Use decimal-safe money types and explicit rounding rules.

Preserve historical invoice and payment data.

Create Prisma migrations and seed realistic development data.

Use database transactions for workflows that update multiple related financial records.

## 6. Application Architecture

Organize the application into clear modules:

- Authentication and authorization
- Users and customer profiles
- Products and variants
- Plans and pricing
- Quotations and templates
- Subscriptions and lifecycle
- Taxes and discounts
- Invoice generation
- Recurring billing scheduler
- Payments and reconciliation
- Email delivery
- Financial reporting
- Audit logging

Keep the UI layer separate from domain/business logic.

Use reusable server-side services such as:
- ProductService
- PlanService
- QuotationService
- SubscriptionService
- PricingService
- TaxService
- DiscountService
- InvoiceService
- BillingService
- PaymentService
- EmailService
- ReportingService

Use typed inputs and outputs, Zod validation, consistent error handling, and structured logs.

Protect all privileged mutations with server-side authentication and authorization.

## 7. Required Pages

### Public and Authentication
- Login
- Registration
- Forgot password
- Reset password

### Admin
- Dashboard
- Products
- Product variants
- Subscription plans
- Customers
- Staff management
- Quotation templates
- Quotations
- Subscriptions
- Tax configuration
- Discount management
- Invoices
- Payments
- Reports
- Audit logs
- Settings

### Staff
- Operations dashboard
- Customers
- Quotations
- Subscriptions
- Invoices
- Payments
- Outstanding and overdue invoices

### Customer
- Customer dashboard
- My subscriptions
- Subscription details
- My invoices
- Invoice details
- Payment history
- Account settings

Use role-specific navigation and prevent unauthorized access to pages and operations.

## 8. UI and UX Requirements

Build a clean, professional SaaS application appropriate for a subscription billing platform.

Use:
- A responsive sidebar and top navigation
- Clear page titles and breadcrumbs
- KPI cards
- Revenue charts
- Searchable, sortable, paginated tables
- Filters for status, dates, customer, and payment state
- Well-designed detail pages
- Validated forms
- Confirmation dialogs for destructive or financial actions
- Loading, empty, success, and error states
- Status badges
- Toast notifications
- Responsive layouts for desktop and mobile

Keep the interface consistent and accessible.

Do not prioritize decorative animations over functional workflows and readability.

If a design reference or existing design system is provided, follow it without breaking application functionality.

## 9. Security Requirements

Implement:
- Secure password hashing
- Protected sessions
- Server-side RBAC
- Customer ownership checks
- Input validation
- Rate limiting for authentication and password reset
- CSRF protections where applicable
- Secure password-reset tokens
- Environment-variable-based secrets
- Safe error messages
- Audit logs for important financial and administrative changes
- Protection against unauthorized object access
- Database constraints and transaction-safe financial operations

Do not expose credentials, SMTP settings, reset tokens, or sensitive server errors.

Never trust a role, customer ID, amount, tax rate, discount amount, invoice status, or payment status supplied by the browser without validating it on the server.

## 10. Performance and Reliability

The problem statement expects pages to respond in under two seconds with thousands of subscriptions.

Implement:
- Database indexes for commonly filtered fields
- Server-side pagination
- Efficient filtering and aggregation
- Avoidance of N+1 queries
- Optimized dashboard queries
- Appropriate database connection pooling
- Safe scheduled billing execution
- Structured error logs
- Retry handling for transient email and scheduled-job failures

Test realistic data volumes and measure response times. Do not claim the performance target is met without testing.

## 11. Testing Requirements

Create automated tests for:
- Password validation
- Role-based access
- Customer data isolation
- Product variant pricing
- Billing interval calculations
- Tax calculation and rounding
- Discount eligibility and limits
- Quotation-to-subscription conversion
- Invoice generation
- Duplicate billing prevention
- Partial and full payments
- Overdue invoice calculations
- Email failure handling
- Subscription lifecycle transitions

Add integration tests for the core workflow:

Product → Plan → Quotation → Subscription → Invoice → Payment → Dashboard.

Test recurring billing retries and verify that processing the same billing cycle twice does not create duplicate invoices.

## 12. Implementation Order

Build in the following order:

Phase 1: Project setup, database, authentication, roles, seed data.

Phase 2: Products, variants, plans, customers, and quotation templates.

Phase 3: Quotations, subscription creation, and lifecycle management.

Phase 4: Tax calculations, discounts, invoice generation, and invoice management.

Phase 5: Payments, outstanding balances, and overdue tracking.

Phase 6: Recurring billing scheduler and duplicate prevention.

Phase 7: SMTP/Nodemailer integration and email templates.

Phase 8: Admin dashboard, reports, and customer portal.

Phase 9: Testing, security checks, performance optimization, and deployment.

Prioritize a complete, working end-to-end flow over partially implemented modules.

## 13. Seed Data and Demonstration

Create realistic sample data for:
- One administrator
- A few staff users
- Multiple customers
- Several products and variants
- Monthly and yearly plans
- Active and paused subscriptions
- Draft and confirmed quotations
- Draft, confirmed, partially paid, paid, and overdue invoices
- Multiple payment methods
- Active, expired, and exhausted discount rules

Use clearly documented development-only demo credentials. Never seed predictable production passwords or expose real secrets.

Create a reliable demo flow:

1. Create a product and plan.
2. Create a quotation for a customer.
3. Convert it into a subscription.
4. Trigger a test billing cycle.
5. Generate an invoice with applicable taxes and discounts.
6. Record a partial or full payment.
7. Show the updated balance.
8. Display the change in the dashboard.
9. Log in as the customer and verify access is limited to their own records.

## 14. Deployment and Delivery

Prepare the project for deployment using Vercel and a managed PostgreSQL database.

Deliver:
- Complete source code
- Prisma schema and migrations
- Seed script
- `.env.example`
- SMTP/Nodemailer configuration instructions
- Scheduled billing setup instructions
- README with local development and deployment steps
- Test instructions
- Documented demo flow

Do not hardcode secrets or rely on local-only storage for production data.

Verify production database connectivity, migrations, authentication, email configuration, and scheduled billing before declaring the project complete.

## 15. Final Acceptance Criteria

The application is considered ready when:

1. All three roles work with correct permissions.
2. Administrators can manage products, variants, plans, taxes, and discounts.
3. Staff can create quotations and manage permitted subscriptions.
4. Quotations can be converted into subscriptions correctly.
5. Recurring billing generates correct invoices.
6. Duplicate billing runs do not create duplicate invoices.
7. Payments update balances correctly.
8. Overdue invoices are identifiable.
9. Dashboard figures reflect actual database records.
10. Customers can only view and manage their own records.
11. SMTP/Nodemailer sends configured emails and handles failures safely.
12. Core business workflows have automated tests.
13. The application is responsive and deployable.
14. Performance is measured against the under-two-second target using realistic data.

Implement these requirements systematically. Inspect any existing repository before changing it, preserve working functionality, avoid unnecessary dependencies, and clearly report incomplete features instead of presenting mock functionality as complete.