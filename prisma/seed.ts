import { PrismaClient, Role, ProductType, BillingInterval, QuotationStatus, SubscriptionStatus, InvoiceStatus, DiscountType, DiscountScope, PaymentMethod } from "@prisma/client";
import bcrypt from "bcryptjs";
import Decimal from "decimal.js";

const prisma = new PrismaClient();

export const DEMO_PASSWORD_ADMIN = "Admin@Brightloop2026!";
export const DEMO_PASSWORD_STAFF = "Staff@Brightloop2026!";
export const DEMO_PASSWORD_CUSTOMER = "Customer@Brightloop2026!";

/**
 * 1. Seed Users and Customer Profiles (Dev A coordination preserved)
 */
export async function seedUsers() {
  console.log("🌱 1. Seeding Users and Customer Profiles...");

  const adminHash = await bcrypt.hash(DEMO_PASSWORD_ADMIN, 10);
  const staffHash = await bcrypt.hash(DEMO_PASSWORD_STAFF, 10);
  const customerHash = await bcrypt.hash(DEMO_PASSWORD_CUSTOMER, 10);

  // 1. Admin Account
  const admin = await prisma.user.upsert({
    where: { email: "admin@brightloop.com" },
    update: { passwordHash: adminHash },
    create: {
      email: "admin@brightloop.com",
      name: "System Administrator",
      passwordHash: adminHash,
      role: Role.ADMIN,
    },
  });
  console.log(`  ✓ Admin: ${admin.email}`);

  // 2. Staff Accounts
  const staffMembers = [
    { email: "sarah.chen@brightloop.com", name: "Sarah Chen" },
    { email: "david.miller@brightloop.com", name: "David Miller" },
    { email: "elena.rostova@brightloop.com", name: "Elena Rostova" },
  ];

  for (const staff of staffMembers) {
    const s = await prisma.user.upsert({
      where: { email: staff.email },
      update: { passwordHash: staffHash },
      create: {
        email: staff.email,
        name: staff.name,
        passwordHash: staffHash,
        role: Role.STAFF,
      },
    });
    console.log(`  ✓ Staff: ${s.email}`);
  }

  // 3. Customer Accounts & Profiles
  const customers = [
    {
      email: "alex@acmecorp.com",
      name: "Alex Vance",
      companyName: "Acme Corporation",
      phone: "+1-512-555-0101",
      addressLine1: "123 Industrial Way",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
    },
    {
      email: "priya@techflow.io",
      name: "Priya Patel",
      companyName: "TechFlow Systems",
      phone: "+1-408-555-0142",
      addressLine1: "456 Silicon Ave",
      city: "San Jose",
      state: "CA",
      postalCode: "95112",
    },
    {
      email: "marcus@greenleaf.org",
      name: "Marcus Brody",
      companyName: "Greenleaf Retail",
      phone: "+1-206-555-0199",
      addressLine1: "789 Forest Blvd",
      city: "Seattle",
      state: "WA",
      postalCode: "98101",
    },
    {
      email: "chloe@designhub.co",
      name: "Chloe Martin",
      companyName: "DesignHub Studio",
      phone: "+1-212-555-0177",
      addressLine1: "321 Broadway",
      city: "New York",
      state: "NY",
      postalCode: "10001",
    },
    {
      email: "liam@nordiclogistics.com",
      name: "Liam O'Connor",
      companyName: "Nordic Logistics",
      phone: "+1-617-555-0128",
      addressLine1: "654 Harbor Dr",
      city: "Boston",
      state: "MA",
      postalCode: "02110",
    },
  ];

  const seededCustomers: Array<{ profileId: string; userId: string; email: string }> = [];

  for (const cust of customers) {
    const user = await prisma.user.upsert({
      where: { email: cust.email },
      update: { passwordHash: customerHash },
      create: {
        email: cust.email,
        name: cust.name,
        passwordHash: customerHash,
        role: Role.CUSTOMER,
      },
    });

    const profile = await prisma.customerProfile.upsert({
      where: { userId: user.id },
      update: {
        name: cust.companyName,
        phone: cust.phone,
        addressLine1: cust.addressLine1,
        city: cust.city,
        state: cust.state,
        postalCode: cust.postalCode,
      },
      create: {
        userId: user.id,
        name: cust.companyName,
        email: cust.email,
        phone: cust.phone,
        addressLine1: cust.addressLine1,
        city: cust.city,
        state: cust.state,
        postalCode: cust.postalCode,
        country: "US",
      },
    });

    seededCustomers.push({ profileId: profile.id, userId: user.id, email: user.email });
    console.log(`  ✓ Customer: ${user.email} (${cust.companyName})`);
  }

  return { adminId: admin.id, seededCustomers };
}

/**
 * 2. Seed Tax Rules
 */
export async function seedTaxRules() {
  console.log("\n🌱 2. Seeding Tax Rules...");

  const taxes = [
    { name: "Standard US Sales Tax (10%)", rate: new Decimal("0.1000"), country: "US", isDefault: true },
    { name: "Reduced State Tax (5%)", rate: new Decimal("0.0500"), country: "US", state: "TX", isDefault: false },
    { name: "Zero-Rated Exempt (0%)", rate: new Decimal("0.0000"), country: "US", isDefault: false },
  ];

  const seededTaxes = [];
  for (const t of taxes) {
    const existing = await prisma.taxRule.findFirst({ where: { name: t.name } });
    if (existing) {
      seededTaxes.push(existing);
    } else {
      const created = await prisma.taxRule.create({ data: t });
      seededTaxes.push(created);
    }
    console.log(`  ✓ Tax: ${t.name}`);
  }

  return seededTaxes;
}

/**
 * 3. Seed Products and Variants
 */
export async function seedProducts() {
  console.log("\n🌱 3. Seeding Products & Variants...");

  // Product 1: Cloud Desk ERP
  let prodErp = await prisma.product.findFirst({ where: { name: "Cloud Desk ERP" } });
  if (!prodErp) {
    prodErp = await prisma.product.create({
      data: {
        name: "Cloud Desk ERP",
        type: ProductType.SOFTWARE,
        salesPrice: new Decimal("120.00"),
        costPrice: new Decimal("30.00"),
        notes: "Core SaaS subscription ERP platform",
        isActive: true,
      },
    });
  }

  // Variants for ERP (Odoo brand modifier +560.00)
  const variantStandard = await prisma.productVariant.upsert({
    where: { sku: "ERP-STD" },
    update: {},
    create: {
      productId: prodErp.id,
      name: "Standard Cloud Edition",
      sku: "ERP-STD",
      priceModifier: new Decimal("0.00"),
      attributeName: "Edition",
      attributeValue: "Standard",
      isActive: true,
    },
  });

  const variantOdoo = await prisma.productVariant.upsert({
    where: { sku: "ERP-ODOO" },
    update: {},
    create: {
      productId: prodErp.id,
      name: "Odoo Enterprise Custom Brand",
      sku: "ERP-ODOO",
      priceModifier: new Decimal("560.00"),
      attributeName: "Edition",
      attributeValue: "Odoo Enterprise",
      isActive: true,
    },
  });

  // Product 2: Priority 24/7 SLA Support
  let prodSupport = await prisma.product.findFirst({ where: { name: "Priority 24/7 Support" } });
  if (!prodSupport) {
    prodSupport = await prisma.product.create({
      data: {
        name: "Priority 24/7 Support",
        type: ProductType.SERVICE,
        salesPrice: new Decimal("80.00"),
        costPrice: new Decimal("20.00"),
        notes: "Dedicated Technical Support SLA add-on",
        isActive: true,
      },
    });
  }

  const variantSupportPhone = await prisma.productVariant.upsert({
    where: { sku: "SUP-PHONE" },
    update: {},
    create: {
      productId: prodSupport.id,
      name: "Dedicated Phone SLA",
      sku: "SUP-PHONE",
      priceModifier: new Decimal("50.00"),
      attributeName: "Channel",
      attributeValue: "Phone Hotline",
      isActive: true,
    },
  });

  // Product 3: IoT Edge Gateway
  let prodIot = await prisma.product.findFirst({ where: { name: "IoT Edge Gateway Hardware" } });
  if (!prodIot) {
    prodIot = await prisma.product.create({
      data: {
        name: "IoT Edge Gateway Hardware",
        type: ProductType.HARDWARE,
        salesPrice: new Decimal("350.00"),
        costPrice: new Decimal("180.00"),
        notes: "On-premise telemetry synchronizer appliance",
        isActive: true,
      },
    });
  }

  console.log(`  ✓ Product: ${prodErp.name} (Variants: ${variantStandard.name}, ${variantOdoo.name})`);
  console.log(`  ✓ Product: ${prodSupport.name}`);
  console.log(`  ✓ Product: ${prodIot.name}`);

  return {
    prodErp,
    variantStandard,
    variantOdoo,
    prodSupport,
    variantSupportPhone,
    prodIot,
  };
}

/**
 * 4. Seed Plans and Plan Products
 */
export async function seedPlans(products: Awaited<ReturnType<typeof seedProducts>>) {
  console.log("\n🌱 4. Seeding Subscription Plans...");

  // Plan 1: Starter Monthly
  const planStarter = await prisma.plan.upsert({
    where: { code: "STARTER-M" },
    update: {},
    create: {
      code: "STARTER-M",
      name: "Starter Monthly",
      description: "Ideal for small businesses initiating cloud operations",
      price: new Decimal("120.00"),
      billingInterval: BillingInterval.MONTHLY,
      minQuantity: 1,
      allowPause: true,
      allowRenewal: true,
      allowEarlyClose: true,
      isActive: true,
    },
  });

  // Link ERP product to Starter plan
  await prisma.planProduct.upsert({
    where: { planId_productId: { planId: planStarter.id, productId: products.prodErp.id } },
    update: {},
    create: {
      planId: planStarter.id,
      productId: products.prodErp.id,
      quantity: 1,
      isOptional: false,
    },
  });

  // Plan 2: Enterprise Pro Monthly
  const planEnterprise = await prisma.plan.upsert({
    where: { code: "ENTERPRISE-M" },
    update: {},
    create: {
      code: "ENTERPRISE-M",
      name: "Enterprise Pro Monthly",
      description: "Full suite ERP with dedicated 24/7 technical assistance",
      price: new Decimal("680.00"),
      billingInterval: BillingInterval.MONTHLY,
      minQuantity: 1,
      allowPause: true,
      allowRenewal: true,
      allowEarlyClose: true,
      isActive: true,
    },
  });

  await prisma.planProduct.upsert({
    where: { planId_productId: { planId: planEnterprise.id, productId: products.prodErp.id } },
    update: {},
    create: {
      planId: planEnterprise.id,
      productId: products.prodErp.id,
      quantity: 1,
      isOptional: false,
    },
  });

  // Plan 3: Annual Growth Plan
  const planAnnual = await prisma.plan.upsert({
    where: { code: "GROWTH-Y" },
    update: {},
    create: {
      code: "GROWTH-Y",
      name: "Annual Growth Plan",
      description: "Yearly commitment discounted SaaS plan",
      price: new Decimal("1200.00"),
      billingInterval: BillingInterval.YEARLY,
      minQuantity: 1,
      allowPause: false,
      allowRenewal: true,
      allowEarlyClose: true,
      isActive: true,
    },
  });

  console.log(`  ✓ Plan: ${planStarter.name} ($120.00/mo)`);
  console.log(`  ✓ Plan: ${planEnterprise.name} ($680.00/mo)`);
  console.log(`  ✓ Plan: ${planAnnual.name} ($1,200.00/yr)`);

  return { planStarter, planEnterprise, planAnnual };
}

/**
 * 5. Seed Discount Rules (Active, Expired, Exhausted)
 */
export async function seedDiscounts() {
  console.log("\n🌱 5. Seeding Discount Rules...");

  const now = new Date();
  const pastDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const futureDate = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

  // 1. Active: WELCOME10 (10% off entire subscription)
  const discountWelcome = await prisma.discountRule.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: {
      code: "WELCOME10",
      name: "Welcome 10% Onboarding Offer",
      type: DiscountType.PERCENTAGE,
      scope: DiscountScope.ENTIRE_SUBSCRIPTION,
      value: new Decimal("10.00"),
      minPurchaseAmount: new Decimal("50.00"),
      startDate: pastDate,
      endDate: futureDate,
      maxUsageCount: 100,
      currentUsageCount: 8,
      isActive: true,
    },
  });

  // 2. Active: ENTERPRISE50 ($50 fixed off)
  const discountEnterprise = await prisma.discountRule.upsert({
    where: { code: "ENTERPRISE50" },
    update: {},
    create: {
      code: "ENTERPRISE50",
      name: "Enterprise Upgrade $50 Fixed Voucher",
      type: DiscountType.FIXED_AMOUNT,
      scope: DiscountScope.ENTIRE_SUBSCRIPTION,
      value: new Decimal("50.00"),
      minPurchaseAmount: new Decimal("200.00"),
      startDate: pastDate,
      endDate: futureDate,
      maxUsageCount: 50,
      currentUsageCount: 12,
      isActive: true,
    },
  });

  // 3. Expired: BLACKFRIDAY25
  const discountExpired = await prisma.discountRule.upsert({
    where: { code: "BLACKFRIDAY25" },
    update: {},
    create: {
      code: "BLACKFRIDAY25",
      name: "Black Friday 2025 Seasonal Promotion",
      type: DiscountType.PERCENTAGE,
      scope: DiscountScope.ENTIRE_SUBSCRIPTION,
      value: new Decimal("25.00"),
      startDate: new Date("2025-11-20"),
      endDate: new Date("2025-11-30"),
      maxUsageCount: 200,
      currentUsageCount: 45,
      isActive: false,
    },
  });

  // 4. Exhausted: EARLYBIRD100
  const discountExhausted = await prisma.discountRule.upsert({
    where: { code: "EARLYBIRD100" },
    update: {},
    create: {
      code: "EARLYBIRD100",
      name: "Early Bird VIP Voucher ($100 off)",
      type: DiscountType.FIXED_AMOUNT,
      scope: DiscountScope.ENTIRE_SUBSCRIPTION,
      value: new Decimal("100.00"),
      startDate: pastDate,
      endDate: futureDate,
      maxUsageCount: 5,
      currentUsageCount: 5, // Exhausted
      isActive: true,
    },
  });

  console.log(`  ✓ Discount: ${discountWelcome.code} (Active 10%)`);
  console.log(`  ✓ Discount: ${discountEnterprise.code} (Active $50 fixed)`);
  console.log(`  ✓ Discount: ${discountExpired.code} (Expired)`);
  console.log(`  ✓ Discount: ${discountExhausted.code} (Exhausted 5/5)`);

  return { discountWelcome, discountEnterprise, discountExpired, discountExhausted };
}

/**
 * 6. Seed Quotations & Subscriptions (Active, Paused, Closed)
 */
export async function seedQuotationsAndSubscriptions(
  customers: Awaited<ReturnType<typeof seedUsers>>["seededCustomers"],
  plans: Awaited<ReturnType<typeof seedPlans>>,
  products: Awaited<ReturnType<typeof seedProducts>>,
  taxRules: Awaited<ReturnType<typeof seedTaxRules>>
) {
  console.log("\n🌱 6. Seeding Quotations & Subscriptions...");

  const standardTax = taxRules.find((t) => t.isDefault) || taxRules[0];
  const now = new Date();

  // Quotation 1: Draft Offer for Chloe
  const qDraft = await prisma.quotation.upsert({
    where: { quotationNumber: "QT-2026-0001" },
    update: {},
    create: {
      quotationNumber: "QT-2026-0001",
      customerId: customers[3].profileId,
      planId: plans.planStarter.id,
      status: QuotationStatus.DRAFT,
      validUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      subtotal: new Decimal("120.00"),
      taxTotal: new Decimal("12.00"),
      discountTotal: new Decimal("0.00"),
      totalAmount: new Decimal("132.00"),
      items: {
        create: [
          {
            productId: products.prodErp.id,
            productVariantId: products.variantStandard.id,
            taxRuleId: standardTax.id,
            description: "Starter Cloud Desk ERP",
            quantity: 1,
            unitPrice: new Decimal("120.00"),
            taxAmount: new Decimal("12.00"),
            discountAmount: new Decimal("0.00"),
            lineTotal: new Decimal("132.00"),
          },
        ],
      },
    },
  });

  // Quotation 2: Confirmed Offer for Alex
  const qConfirmed = await prisma.quotation.upsert({
    where: { quotationNumber: "QT-2026-0002" },
    update: {},
    create: {
      quotationNumber: "QT-2026-0002",
      customerId: customers[0].profileId,
      planId: plans.planEnterprise.id,
      status: QuotationStatus.CONFIRMED,
      validUntil: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      subtotal: new Decimal("680.00"),
      taxTotal: new Decimal("68.00"),
      discountTotal: new Decimal("0.00"),
      totalAmount: new Decimal("748.00"),
      items: {
        create: [
          {
            productId: products.prodErp.id,
            productVariantId: products.variantOdoo.id,
            taxRuleId: standardTax.id,
            description: "Enterprise Odoo ERP Cloud",
            quantity: 1,
            unitPrice: new Decimal("680.00"),
            taxAmount: new Decimal("68.00"),
            discountAmount: new Decimal("0.00"),
            lineTotal: new Decimal("748.00"),
          },
        ],
      },
    },
  });

  // Subscription 1: Active Subscription (Alex - Enterprise Plan)
  const subActive1 = await prisma.subscription.upsert({
    where: { subscriptionNumber: "SUB-2026-0001" },
    update: {},
    create: {
      subscriptionNumber: "SUB-2026-0001",
      customerId: customers[0].profileId,
      planId: plans.planEnterprise.id,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date("2026-01-01"),
      currentPeriodStart: new Date("2026-10-01"),
      currentPeriodEnd: new Date("2026-10-31"),
      nextBillingDate: new Date("2026-11-01"),
      billingInterval: BillingInterval.MONTHLY,
      subtotal: new Decimal("680.00"),
      taxTotal: new Decimal("68.00"),
      discountTotal: new Decimal("0.00"),
      totalAmount: new Decimal("748.00"),
      items: {
        create: [
          {
            productId: products.prodErp.id,
            productVariantId: products.variantOdoo.id,
            taxRuleId: standardTax.id,
            description: "Enterprise Odoo ERP Cloud License",
            quantity: 1,
            unitPrice: new Decimal("680.00"),
            taxAmount: new Decimal("68.00"),
            discountAmount: new Decimal("0.00"),
            lineTotal: new Decimal("748.00"),
          },
        ],
      },
    },
  });

  // Subscription 2: Active Yearly Subscription (Priya - Annual Growth Plan)
  const subActive2 = await prisma.subscription.upsert({
    where: { subscriptionNumber: "SUB-2026-0002" },
    update: {},
    create: {
      subscriptionNumber: "SUB-2026-0002",
      customerId: customers[1].profileId,
      planId: plans.planAnnual.id,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date("2026-02-15"),
      currentPeriodStart: new Date("2026-02-15"),
      currentPeriodEnd: new Date("2027-02-14"),
      nextBillingDate: new Date("2027-02-15"),
      billingInterval: BillingInterval.YEARLY,
      subtotal: new Decimal("1200.00"),
      taxTotal: new Decimal("120.00"),
      discountTotal: new Decimal("0.00"),
      totalAmount: new Decimal("1320.00"),
      items: {
        create: [
          {
            productId: products.prodErp.id,
            productVariantId: products.variantStandard.id,
            taxRuleId: standardTax.id,
            description: "Annual SaaS Cloud Subscription",
            quantity: 1,
            unitPrice: new Decimal("1200.00"),
            taxAmount: new Decimal("120.00"),
            discountAmount: new Decimal("0.00"),
            lineTotal: new Decimal("1320.00"),
          },
        ],
      },
    },
  });

  // Subscription 3: Paused Subscription (Marcus - Greenleaf Retail)
  const subPaused = await prisma.subscription.upsert({
    where: { subscriptionNumber: "SUB-2026-0003" },
    update: {},
    create: {
      subscriptionNumber: "SUB-2026-0003",
      customerId: customers[2].profileId,
      planId: plans.planStarter.id,
      status: SubscriptionStatus.PAUSED,
      startDate: new Date("2026-03-01"),
      currentPeriodStart: new Date("2026-09-01"),
      currentPeriodEnd: new Date("2026-09-30"),
      nextBillingDate: null, // Paused
      billingInterval: BillingInterval.MONTHLY,
      subtotal: new Decimal("120.00"),
      taxTotal: new Decimal("12.00"),
      discountTotal: new Decimal("0.00"),
      totalAmount: new Decimal("132.00"),
      notes: "Paused upon customer seasonal request",
      items: {
        create: [
          {
            productId: products.prodErp.id,
            productVariantId: products.variantStandard.id,
            taxRuleId: standardTax.id,
            description: "Starter Cloud Desk ERP",
            quantity: 1,
            unitPrice: new Decimal("120.00"),
            taxAmount: new Decimal("12.00"),
            discountAmount: new Decimal("0.00"),
            lineTotal: new Decimal("132.00"),
          },
        ],
      },
    },
  });

  console.log(`  ✓ Quotations: ${qDraft.quotationNumber} (DRAFT), ${qConfirmed.quotationNumber} (CONFIRMED)`);
  console.log(`  ✓ Subscriptions: ${subActive1.subscriptionNumber} (ACTIVE), ${subActive2.subscriptionNumber} (ACTIVE YEARLY), ${subPaused.subscriptionNumber} (PAUSED)`);

  return { subActive1, subActive2, subPaused };
}

/**
 * 7. Seed Invoices & Payments (All states: Draft, Confirmed, Partially Paid, Paid, Overdue)
 */
export async function seedInvoicesAndPayments(
  customers: Awaited<ReturnType<typeof seedUsers>>["seededCustomers"],
  subs: Awaited<ReturnType<typeof seedQuotationsAndSubscriptions>>,
  products: Awaited<ReturnType<typeof seedProducts>>,
  taxRules: Awaited<ReturnType<typeof seedTaxRules>>
) {
  console.log("\n🌱 7. Seeding Invoices & Payments (Draft, Confirmed, Partial, Paid, Overdue)...");

  const standardTax = taxRules.find((t) => t.isDefault) || taxRules[0];
  const now = new Date();

  // Invoice 1: PAID Invoice (Priya - Annual Subscription $1,320.00 paid via Bank Transfer)
  const invPaid = await prisma.invoice.upsert({
    where: { invoiceNumber: "INV-2026-0001" },
    update: {},
    create: {
      invoiceNumber: "INV-2026-0001",
      customerId: customers[1].profileId,
      subscriptionId: subs.subActive2.id,
      status: InvoiceStatus.PAID,
      issueDate: new Date("2026-02-15"),
      dueDate: new Date("2026-03-15"),
      paidDate: new Date("2026-02-18"),
      subtotal: new Decimal("1200.00"),
      taxTotal: new Decimal("120.00"),
      discountTotal: new Decimal("0.00"),
      totalAmount: new Decimal("1320.00"),
      amountPaid: new Decimal("1320.00"),
      amountDue: new Decimal("0.00"),
      cycleKey: `CYC-GROWTH-${subs.subActive2.id}-2026-02`,
      items: {
        create: [
          {
            productId: products.prodErp.id,
            productVariantId: products.variantStandard.id,
            taxRuleId: standardTax.id,
            description: "Annual SaaS Cloud Subscription 2026",
            quantity: 1,
            unitPrice: new Decimal("1200.00"),
            taxAmount: new Decimal("120.00"),
            discountAmount: new Decimal("0.00"),
            lineTotal: new Decimal("1320.00"),
          },
        ],
      },
    },
  });

  // Payment for Invoice 1
  await prisma.payment.upsert({
    where: { paymentNumber: "PAY-2026-0001" },
    update: {},
    create: {
      paymentNumber: "PAY-2026-0001",
      invoiceId: invPaid.id,
      customerId: customers[1].profileId,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amount: new Decimal("1320.00"),
      paymentDate: new Date("2026-02-18"),
      referenceNote: "WIRE-REF-99210-ANNUAL-SETTLED",
    },
  });

  // Invoice 2: PARTIALLY PAID Invoice (Alex - Total $748.00, Paid $300.00, Due $448.00)
  const invPartial = await prisma.invoice.upsert({
    where: { invoiceNumber: "INV-2026-0002" },
    update: {},
    create: {
      invoiceNumber: "INV-2026-0002",
      customerId: customers[0].profileId,
      subscriptionId: subs.subActive1.id,
      status: InvoiceStatus.CONFIRMED,
      issueDate: new Date("2026-10-01"),
      dueDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // Current (not overdue)
      subtotal: new Decimal("680.00"),
      taxTotal: new Decimal("68.00"),
      discountTotal: new Decimal("0.00"),
      totalAmount: new Decimal("748.00"),
      amountPaid: new Decimal("300.00"),
      amountDue: new Decimal("448.00"),
      cycleKey: `CYC-ENT-${subs.subActive1.id}-2026-10`,
      items: {
        create: [
          {
            productId: products.prodErp.id,
            productVariantId: products.variantOdoo.id,
            taxRuleId: standardTax.id,
            description: "Enterprise Odoo ERP Cloud License (October 2026)",
            quantity: 1,
            unitPrice: new Decimal("680.00"),
            taxAmount: new Decimal("68.00"),
            discountAmount: new Decimal("0.00"),
            lineTotal: new Decimal("748.00"),
          },
        ],
      },
    },
  });

  // Partial Payment for Invoice 2
  await prisma.payment.upsert({
    where: { paymentNumber: "PAY-2026-0002" },
    update: {},
    create: {
      paymentNumber: "PAY-2026-0002",
      invoiceId: invPartial.id,
      customerId: customers[0].profileId,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      amount: new Decimal("300.00"),
      paymentDate: new Date("2026-10-05"),
      referenceNote: "STRIPE-CH-7749-PARTIAL",
    },
  });

  // Invoice 3: OVERDUE Invoice (Liam - Total $440.00, Due $440.00, Due date 20 days ago)
  const overdueDueDate = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
  const invOverdue = await prisma.invoice.upsert({
    where: { invoiceNumber: "INV-2026-0003" },
    update: {},
    create: {
      invoiceNumber: "INV-2026-0003",
      customerId: customers[4].profileId,
      status: InvoiceStatus.CONFIRMED,
      issueDate: new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000),
      dueDate: overdueDueDate,
      subtotal: new Decimal("400.00"),
      taxTotal: new Decimal("40.00"),
      discountTotal: new Decimal("0.00"),
      totalAmount: new Decimal("440.00"),
      amountPaid: new Decimal("0.00"),
      amountDue: new Decimal("440.00"),
      notes: "Urgent collections follow-up required",
      items: {
        create: [
          {
            productId: products.prodSupport.id,
            productVariantId: products.variantSupportPhone.id,
            taxRuleId: standardTax.id,
            description: "Custom Technical Deployment Services",
            quantity: 1,
            unitPrice: new Decimal("400.00"),
            taxAmount: new Decimal("40.00"),
            discountAmount: new Decimal("0.00"),
            lineTotal: new Decimal("440.00"),
          },
        ],
      },
    },
  });

  // Invoice 4: DRAFT Invoice (Marcus - Unconfirmed draft $132.00)
  const invDraft = await prisma.invoice.upsert({
    where: { invoiceNumber: "INV-2026-0004" },
    update: {},
    create: {
      invoiceNumber: "INV-2026-0004",
      customerId: customers[2].profileId,
      status: InvoiceStatus.DRAFT,
      issueDate: now,
      dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      subtotal: new Decimal("120.00"),
      taxTotal: new Decimal("12.00"),
      discountTotal: new Decimal("0.00"),
      totalAmount: new Decimal("132.00"),
      amountPaid: new Decimal("0.00"),
      amountDue: new Decimal("132.00"),
      items: {
        create: [
          {
            productId: products.prodErp.id,
            productVariantId: products.variantStandard.id,
            taxRuleId: standardTax.id,
            description: "Draft monthly recurring charge",
            quantity: 1,
            unitPrice: new Decimal("120.00"),
            taxAmount: new Decimal("12.00"),
            discountAmount: new Decimal("0.00"),
            lineTotal: new Decimal("132.00"),
          },
        ],
      },
    },
  });

  // Invoice 5: CONFIRMED UNPAID Invoice (Chloe - Current, $132.00)
  const invConfirmed = await prisma.invoice.upsert({
    where: { invoiceNumber: "INV-2026-0005" },
    update: {},
    create: {
      invoiceNumber: "INV-2026-0005",
      customerId: customers[3].profileId,
      status: InvoiceStatus.CONFIRMED,
      issueDate: now,
      dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      subtotal: new Decimal("120.00"),
      taxTotal: new Decimal("12.00"),
      discountTotal: new Decimal("0.00"),
      totalAmount: new Decimal("132.00"),
      amountPaid: new Decimal("0.00"),
      amountDue: new Decimal("132.00"),
      items: {
        create: [
          {
            productId: products.prodErp.id,
            productVariantId: products.variantStandard.id,
            taxRuleId: standardTax.id,
            description: "Standard Monthly ERP Seat",
            quantity: 1,
            unitPrice: new Decimal("120.00"),
            taxAmount: new Decimal("12.00"),
            discountAmount: new Decimal("0.00"),
            lineTotal: new Decimal("132.00"),
          },
        ],
      },
    },
  });

  console.log(`  ✓ Invoices:`);
  console.log(`    - ${invPaid.invoiceNumber}: PAID ($1,320.00 via Bank Transfer)`);
  console.log(`    - ${invPartial.invoiceNumber}: PARTIALLY PAID ($300.00 of $748.00, Due $448.00)`);
  console.log(`    - ${invOverdue.invoiceNumber}: OVERDUE ($440.00, Due 20 days ago)`);
  console.log(`    - ${invConfirmed.invoiceNumber}: CONFIRMED UNPAID ($132.00, Due in 14 days)`);
  console.log(`    - ${invDraft.invoiceNumber}: DRAFT ($132.00)`);
}

/**
 * Main Orchestrator
 */
async function main() {
  console.log("=================================================");
  console.log("🚀 Brightloop Software — Production Seed Script");
  console.log("=================================================");

  try {
    const { seededCustomers } = await seedUsers();
    const taxRules = await seedTaxRules();
    const products = await seedProducts();
    const plans = await seedPlans(products);
    await seedDiscounts();
    const subs = await seedQuotationsAndSubscriptions(seededCustomers, plans, products, taxRules);
    await seedInvoicesAndPayments(seededCustomers, subs, products, taxRules);

    console.log("\n=================================================");
    console.log("✅ Seed completed successfully with 100% Decimal precision!");
    console.log("=================================================\n");
  } catch (error) {
    console.error("❌ Seed execution failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
