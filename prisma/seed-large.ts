import { PrismaClient, Role, ProductType, BillingInterval, QuotationStatus, SubscriptionStatus, InvoiceStatus, DiscountType, DiscountScope, PaymentMethod } from "@prisma/client";
import bcrypt from "bcryptjs";
import Decimal from "decimal.js";

const prisma = new PrismaClient();

const BATCH_SIZE = 500;
const TOTAL_SUBSCRIPTIONS = 5000;
const INVOICES_PER_SUB = 3; // Yields ~15,000 invoices

/**
 * High-Throughput Batch Generation Script for Enterprise Scale Benchmarking
 * Generates 5,000+ Subscriptions and 15,000+ Invoices & Payments in memory-safe batches.
 */
async function main() {
  console.log("===============================================================");
  console.log("🚀 Brightloop Software — Enterprise Scale Large Data Generator");
  console.log(`   Target: ${TOTAL_SUBSCRIPTIONS} Subscriptions | ~${TOTAL_SUBSCRIPTIONS * INVOICES_PER_SUB} Invoices`);
  console.log("===============================================================\n");

  const startTime = Date.now();

  try {
    // 1. Ensure Baseline Customers & Plans exist
    console.log("📦 Phase 1: Preparing Base Dimension Entities...");
    const customerProfiles = await prisma.customerProfile.findMany({
      select: { id: true, userId: true },
      take: 20,
    });

    if (customerProfiles.length === 0) {
      console.log("  ⚠️ Base customers not found. Creating 10 benchmark customers...");
      const dummyHash = await bcrypt.hash("DemoCustomer123!", 8);
      for (let i = 1; i <= 10; i++) {
        const u = await prisma.user.create({
          data: {
            email: `bench.cust.${i}@benchmark.corp`,
            name: `Benchmark Customer ${i}`,
            passwordHash: dummyHash,
            role: Role.CUSTOMER,
          },
        });
        const cp = await prisma.customerProfile.create({
          data: {
            userId: u.id,
            name: `Benchmark Corp ${i}`,
            email: u.email,
            country: "US",
          },
        });
        customerProfiles.push({ id: cp.id, userId: u.id });
      }
    }

    const plans = await prisma.plan.findMany({ select: { id: true, price: true, billingInterval: true } });
    if (plans.length === 0) {
      throw new Error("No plans found. Please run baseline seed first: npx tsx prisma/seed.ts");
    }

    console.log(`  ✓ Available Customers: ${customerProfiles.length}`);
    console.log(`  ✓ Available Plans: ${plans.length}`);

    // 2. Batch Generation of Subscriptions
    console.log(`\n📦 Phase 2: Generating ${TOTAL_SUBSCRIPTIONS} Subscriptions in batches of ${BATCH_SIZE}...`);
    const statusDistribution: SubscriptionStatus[] = [
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.PAUSED,
      SubscriptionStatus.CLOSED,
      SubscriptionStatus.CONFIRMED,
      SubscriptionStatus.QUOTATION,
    ];

    const baseDate = new Date("2026-01-01T00:00:00Z");
    const subIds: string[] = [];

    for (let batchStart = 0; batchStart < TOTAL_SUBSCRIPTIONS; batchStart += BATCH_SIZE) {
      const currentBatchCount = Math.min(BATCH_SIZE, TOTAL_SUBSCRIPTIONS - batchStart);
      const subBatchData = [];

      for (let i = 0; i < currentBatchCount; i++) {
        const index = batchStart + i + 1;
        const cust = customerProfiles[index % customerProfiles.length];
        const plan = plans[index % plans.length];
        const status = statusDistribution[index % statusDistribution.length];

        const subNum = `SUB-BENCH-${index.toString().padStart(6, "0")}`;
        const subDate = new Date(baseDate.getTime() + (index % 180) * 24 * 60 * 60 * 1000);
        const nextBilling = status === SubscriptionStatus.ACTIVE 
          ? new Date(subDate.getTime() + 30 * 24 * 60 * 60 * 1000)
          : null;

        const subtotal = new Decimal(plan.price);
        const taxTotal = subtotal.times("0.10");
        const totalAmount = subtotal.plus(taxTotal);

        subBatchData.push({
          subscriptionNumber: subNum,
          customerId: cust.id,
          planId: plan.id,
          status,
          startDate: subDate,
          currentPeriodStart: subDate,
          currentPeriodEnd: new Date(subDate.getTime() + 30 * 24 * 60 * 60 * 1000),
          nextBillingDate: nextBilling,
          billingInterval: plan.billingInterval,
          subtotal: subtotal.toDecimalPlaces(2),
          taxTotal: taxTotal.toDecimalPlaces(2),
          discountTotal: new Decimal("0.00"),
          totalAmount: totalAmount.toDecimalPlaces(2),
          createdAt: subDate,
          updatedAt: subDate,
        });
      }

      await prisma.subscription.createMany({
        data: subBatchData,
        skipDuplicates: true,
      });

      console.log(`  ✓ Subscriptions seeded: ${Math.min(batchStart + BATCH_SIZE, TOTAL_SUBSCRIPTIONS)} / ${TOTAL_SUBSCRIPTIONS}`);
    }

    // Retrieve generated subscription IDs for linking invoices
    const allBenchmarkSubs = await prisma.subscription.findMany({
      where: { subscriptionNumber: { startsWith: "SUB-BENCH-" } },
      select: { id: true, customerId: true, totalAmount: true, startDate: true },
      take: 10000,
    });

    console.log(`\n📦 Phase 3: Generating Invoices and Payments for ${allBenchmarkSubs.length} Subscriptions...`);

    let totalInvoicesCreated = 0;
    let totalPaymentsCreated = 0;

    const invoiceBatchData: any[] = [];
    const paymentBatchData: any[] = [];

    let invoiceCounter = 1;
    let paymentCounter = 1;

    for (const sub of allBenchmarkSubs) {
      for (let month = 1; month <= INVOICES_PER_SUB; month++) {
        const invNum = `INV-BENCH-${invoiceCounter.toString().padStart(7, "0")}`;
        const issueDate = new Date(sub.startDate.getTime() + (month - 1) * 30 * 24 * 60 * 60 * 1000);
        const dueDate = new Date(issueDate.getTime() + 15 * 24 * 60 * 60 * 1000);

        // State distribution: 70% Paid, 15% Partially Paid, 10% Overdue, 5% Draft
        let status: InvoiceStatus = InvoiceStatus.PAID;
        let amountPaid = new Decimal(sub.totalAmount);
        let amountDue = new Decimal("0.00");
        let paidDate: Date | null = new Date(dueDate.getTime() - 2 * 24 * 60 * 60 * 1000);

        if (month === INVOICES_PER_SUB) {
          const mod = invoiceCounter % 10;
          if (mod === 0) {
            status = InvoiceStatus.DRAFT;
            amountPaid = new Decimal("0.00");
            amountDue = new Decimal(sub.totalAmount);
            paidDate = null;
          } else if (mod === 1 || mod === 2) {
            // Partially paid
            status = InvoiceStatus.CONFIRMED;
            amountPaid = new Decimal(sub.totalAmount).times("0.40").toDecimalPlaces(2);
            amountDue = new Decimal(sub.totalAmount).minus(amountPaid);
            paidDate = null;
          } else if (mod === 3) {
            // Overdue
            status = InvoiceStatus.CONFIRMED;
            amountPaid = new Decimal("0.00");
            amountDue = new Decimal(sub.totalAmount);
            paidDate = null;
          }
        }

        const subtotal = new Decimal(sub.totalAmount).dividedBy("1.10").toDecimalPlaces(2);
        const taxTotal = new Decimal(sub.totalAmount).minus(subtotal);

        invoiceBatchData.push({
          invoiceNumber: invNum,
          subscriptionId: sub.id,
          customerId: sub.customerId,
          status,
          issueDate,
          dueDate,
          paidDate,
          subtotal,
          taxTotal,
          discountTotal: new Decimal("0.00"),
          totalAmount: new Decimal(sub.totalAmount),
          amountPaid,
          amountDue,
          cycleKey: `CYC-BENCH-${sub.id}-${month}`,
          createdAt: issueDate,
          updatedAt: issueDate,
        });

        invoiceCounter++;

        // Flush Invoices Batch
        if (invoiceBatchData.length >= BATCH_SIZE) {
          await prisma.invoice.createMany({
            data: invoiceBatchData,
            skipDuplicates: true,
          });
          totalInvoicesCreated += invoiceBatchData.length;
          console.log(`  ✓ Invoices seeded: ${totalInvoicesCreated}`);
          invoiceBatchData.length = 0;
        }
      }
    }

    if (invoiceBatchData.length > 0) {
      await prisma.invoice.createMany({
        data: invoiceBatchData,
        skipDuplicates: true,
      });
      totalInvoicesCreated += invoiceBatchData.length;
      console.log(`  ✓ Invoices seeded: ${totalInvoicesCreated}`);
      invoiceBatchData.length = 0;
    }

    // 4. Batch Payments for Paid and Partially Paid Invoices
    console.log(`\n📦 Phase 4: Linking Payments to Invoices...`);
    const paidInvoices = await prisma.invoice.findMany({
      where: {
        invoiceNumber: { startsWith: "INV-BENCH-" },
        amountPaid: { gt: 0 },
      },
      select: { id: true, customerId: true, amountPaid: true, paidDate: true, issueDate: true },
      take: 12000,
    });

    const paymentMethods: PaymentMethod[] = [
      PaymentMethod.BANK_TRANSFER,
      PaymentMethod.CREDIT_CARD,
      PaymentMethod.ACH,
      PaymentMethod.CASH,
      PaymentMethod.CHECK,
    ];

    for (const inv of paidInvoices) {
      const payNum = `PAY-BENCH-${paymentCounter.toString().padStart(7, "0")}`;
      const method = paymentMethods[paymentCounter % paymentMethods.length];

      paymentBatchData.push({
        paymentNumber: payNum,
        invoiceId: inv.id,
        customerId: inv.customerId,
        paymentMethod: method,
        amount: new Decimal(inv.amountPaid),
        paymentDate: inv.paidDate || inv.issueDate,
        referenceNote: `BENCH-TX-${paymentCounter}`,
        createdAt: inv.paidDate || inv.issueDate,
        updatedAt: inv.paidDate || inv.issueDate,
      });

      paymentCounter++;

      if (paymentBatchData.length >= BATCH_SIZE) {
        await prisma.payment.createMany({
          data: paymentBatchData,
          skipDuplicates: true,
        });
        totalPaymentsCreated += paymentBatchData.length;
        console.log(`  ✓ Payments recorded: ${totalPaymentsCreated}`);
        paymentBatchData.length = 0;
      }
    }

    if (paymentBatchData.length > 0) {
      await prisma.payment.createMany({
        data: paymentBatchData,
        skipDuplicates: true,
      });
      totalPaymentsCreated += paymentBatchData.length;
      console.log(`  ✓ Payments recorded: ${totalPaymentsCreated}`);
      paymentBatchData.length = 0;
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n===============================================================");
    console.log(`🎉 Enterprise Benchmark Data Ingestion Complete in ${durationSec}s!`);
    console.log(`   - Subscriptions: ${allBenchmarkSubs.length}`);
    console.log(`   - Invoices:      ${totalInvoicesCreated}`);
    console.log(`   - Payments:      ${totalPaymentsCreated}`);
    console.log("===============================================================\n");
  } catch (err) {
    console.error("❌ Large seed generation error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

