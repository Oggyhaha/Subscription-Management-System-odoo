import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import { toDecimal, roundMoney, addMoney, subtractMoney, multiplyMoney, formatMoney } from "@/lib/money";
import { addDays, isBefore } from "@/lib/dates";
import { TaxService } from "@/server/services/tax";
import { emailService, quotationDeliveryTemplate } from "@/server/services/email";
import { writeAuditLog } from "@/lib/audit";
import { env } from "@/lib/env";
import type {
  CreateQuotationTemplateInput,
  CreateQuotationInput,
  GenerateFromTemplateInput,
} from "@/schemas/quotation";
import type { QuotationStatus, Prisma } from "@prisma/client";
import Decimal from "decimal.js";

export class QuotationService {
  /**
   * Generates a race-safe unique quotation number: QT-YYYY-XXXXXX
   */
  static async generateQuotationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `QT-${year}-`;

    const latest = await db.quotation.findFirst({
      where: {
        quotationNumber: {
          startsWith: prefix,
        },
      },
      orderBy: { quotationNumber: "desc" },
      select: { quotationNumber: true },
    });

    let nextSeq = 1;
    if (latest?.quotationNumber) {
      const parts = latest.quotationNumber.split("-");
      const currentSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(currentSeq)) {
        nextSeq = currentSeq + 1;
      }
    }

    return `${prefix}${nextSeq.toString().padStart(6, "0")}`;
  }

  // -------------------------------------------------------------
  // TEMPLATES CRUD
  // -------------------------------------------------------------

  async listTemplates(onlyActive = false) {
    return db.quotationTemplate.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      include: {
        plan: true,
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getTemplateById(id: string) {
    const template = await db.quotationTemplate.findUnique({
      where: { id },
      include: {
        plan: true,
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!template) {
      throw AppError.notFound(`Quotation template with ID ${id}`);
    }

    return template;
  }

  async createTemplate(input: CreateQuotationTemplateInput) {
    return db.$transaction(async (tx) => {
      const template = await tx.quotationTemplate.create({
        data: {
          name: input.name,
          planId: input.planId || null,
          validityDays: input.validityDays,
          notes: input.notes || null,
          isActive: input.isActive,
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              productVariantId: item.productVariantId || null,
              quantity: item.quantity,
              unitPrice: toDecimal(item.unitPrice),
              discountPercent: toDecimal(item.discountPercent || 0).dividedBy(100),
            })),
          },
        },
        include: {
          plan: true,
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
        },
      });

      await writeAuditLog({
        action: "QUOTATION_TEMPLATE_CREATED",
        entityType: "QuotationTemplate",
        entityId: template.id,
        metadata: { name: template.name, itemsCount: template.items.length },
      });

      return template;
    });
  }

  async updateTemplate(id: string, input: Partial<CreateQuotationTemplateInput>) {
    await this.getTemplateById(id);

    return db.$transaction(async (tx) => {
      // If items provided, clear and recreate
      if (input.items) {
        await tx.quotationTemplateItem.deleteMany({
          where: { templateId: id },
        });
      }

      const updated = await tx.quotationTemplate.update({
        where: { id },
        data: {
          name: input.name,
          planId: input.planId !== undefined ? input.planId : undefined,
          validityDays: input.validityDays,
          notes: input.notes !== undefined ? input.notes : undefined,
          isActive: input.isActive,
          items: input.items
            ? {
                create: input.items.map((item) => ({
                  productId: item.productId,
                  productVariantId: item.productVariantId || null,
                  quantity: item.quantity,
                  unitPrice: toDecimal(item.unitPrice),
                  discountPercent: toDecimal(item.discountPercent || 0).dividedBy(100),
                })),
              }
            : undefined,
        },
        include: {
          plan: true,
          items: {
            include: { product: true, variant: true },
          },
        },
      });

      await writeAuditLog({
        action: "QUOTATION_TEMPLATE_UPDATED",
        entityType: "QuotationTemplate",
        entityId: id,
      });

      return updated;
    });
  }

  async deleteTemplate(id: string) {
    await this.getTemplateById(id);
    await db.quotationTemplate.delete({ where: { id } });

    await writeAuditLog({
      action: "QUOTATION_TEMPLATE_DELETED",
      entityType: "QuotationTemplate",
      entityId: id,
    });

    return { success: true };
  }

  // -------------------------------------------------------------
  // QUOTATIONS
  // -------------------------------------------------------------

  /**
   * Generates a quotation directly from a predefined QuotationTemplate
   */
  async generateFromTemplate(input: GenerateFromTemplateInput, createdById?: string) {
    const template = await this.getTemplateById(input.templateId);

    if (!template.isActive) {
      throw AppError.badRequest("Cannot generate quotation from an inactive template");
    }

    if (!template.planId) {
      throw AppError.badRequest("Selected template does not have an associated plan");
    }

    const customer = await db.customerProfile.findUnique({
      where: { id: input.customerId },
    });
    if (!customer) {
      throw AppError.notFound(`Customer with ID ${input.customerId}`);
    }

    const validityDays = input.customValidityDays || template.validityDays || 30;
    const validUntil = addDays(new Date(), validityDays);

    // Fetch tax rules for automatic tax calculation
    const defaultTaxRule = await db.taxRule.findFirst({
      where: { isDefault: true, isActive: true },
    });

    const quotationLines = template.items.map((item) => ({
      productId: item.productId,
      productVariantId: item.productVariantId,
      taxRuleId: defaultTaxRule?.id || null,
      description: item.product.name + (item.variant ? ` (${item.variant.name})` : ""),
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      taxAmount: 0,
      discountAmount: Number(
        multiplyMoney(
          multiplyMoney(item.unitPrice, item.quantity),
          item.discountPercent
        )
      ),
    }));

    return this.createQuotation(
      {
        customerId: input.customerId,
        planId: template.planId,
        templateId: template.id,
        validUntil,
        paymentTerms: "Net 30",
        notes: template.notes,
        items: quotationLines,
      },
      createdById
    );
  }

  /**
   * Creates a customized or scratch quotation with precise Decimal calculations
   */
  async createQuotation(input: CreateQuotationInput, createdById?: string) {
    const customer = await db.customerProfile.findUnique({
      where: { id: input.customerId },
    });
    if (!customer) {
      throw AppError.notFound(`Customer with ID ${input.customerId}`);
    }

    const plan = await db.plan.findUnique({
      where: { id: input.planId },
    });
    if (!plan) {
      throw AppError.notFound(`Plan with ID ${input.planId}`);
    }

    // Verify plan validity dates
    const now = new Date();
    if (plan.startDate && isBefore(now, plan.startDate)) {
      throw AppError.badRequest(`Plan ${plan.name} is not available until ${plan.startDate.toISOString()}`);
    }
    if (plan.endDate && isBefore(plan.endDate, now)) {
      throw AppError.badRequest(`Plan ${plan.name} ended on ${plan.endDate.toISOString()}`);
    }

    // Verify minimum quantity requirement
    const totalQty = input.items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQty < plan.minQuantity) {
      throw AppError.badRequest(
        `Total quantity (${totalQty}) is below the plan's minimum requirement of ${plan.minQuantity}`
      );
    }

    const quotationNumber = await QuotationService.generateQuotationNumber();

    // Calculate line totals and taxes using TaxService
    let subtotal = new Decimal(0);
    let taxTotal = new Decimal(0);
    let discountTotal = new Decimal(0);

    const calculatedItems = await Promise.all(
      input.items.map(async (item) => {
        const product = await db.product.findUnique({
          where: { id: item.productId },
        });
        if (!product) throw AppError.notFound(`Product with ID ${item.productId}`);

        let unitPrice = toDecimal(item.unitPrice);

        // If variant chosen, apply price modifier if not already factored
        if (item.productVariantId) {
          const variant = await db.productVariant.findUnique({
            where: { id: item.productVariantId },
          });
          if (variant && variant.priceModifier.greaterThan(0)) {
            // Variant price modifier added
            unitPrice = addMoney(unitPrice, variant.priceModifier);
          }
        }

        const qty = new Decimal(item.quantity);
        const lineBase = multiplyMoney(unitPrice, qty);
        const lineDiscount = roundMoney(item.discountAmount || 0);
        const lineAfterDiscount = subtractMoney(lineBase, lineDiscount);

        let lineTax = new Decimal(0);
        if (item.taxRuleId) {
          const taxRule = await db.taxRule.findUnique({ where: { id: item.taxRuleId } });
          if (taxRule) {
            const taxCalc = TaxService.calculateTax(lineAfterDiscount, { rate: taxRule.rate });
            lineTax = taxCalc.taxAmount;
          }
        }

        const lineTotal = addMoney(lineAfterDiscount, lineTax);

        subtotal = addMoney(subtotal, lineBase);
        discountTotal = addMoney(discountTotal, lineDiscount);
        taxTotal = addMoney(taxTotal, lineTax);

        return {
          productId: item.productId,
          productVariantId: item.productVariantId || null,
          taxRuleId: item.taxRuleId || null,
          description: item.description || product.name,
          quantity: item.quantity,
          unitPrice,
          taxAmount: lineTax,
          discountAmount: lineDiscount,
          lineTotal,
        };
      })
    );

    const totalAmount = addMoney(subtractMoney(subtotal, discountTotal), taxTotal);
    const validUntilDate = typeof input.validUntil === "string" ? new Date(input.validUntil) : input.validUntil;

    return db.$transaction(async (tx) => {
      const quotation = await tx.quotation.create({
        data: {
          quotationNumber,
          customerId: input.customerId,
          planId: input.planId,
          templateId: input.templateId || null,
          status: "DRAFT",
          issuedDate: new Date(),
          validUntil: validUntilDate,
          paymentTerms: input.paymentTerms || "Net 30",
          subtotal,
          taxTotal,
          discountTotal,
          totalAmount,
          notes: input.notes || null,
          createdById: createdById || null,
          items: {
            create: calculatedItems,
          },
        },
        include: {
          customer: true,
          plan: true,
          template: true,
          items: {
            include: {
              product: true,
              variant: true,
              taxRule: true,
            },
          },
        },
      });

      await writeAuditLog({
        userId: createdById,
        action: "QUOTATION_CREATED",
        entityType: "Quotation",
        entityId: quotation.id,
        metadata: {
          quotationNumber: quotation.quotationNumber,
          totalAmount: quotation.totalAmount.toString(),
          customer: customer.name,
        },
      });

      return quotation;
    });
  }

  async listQuotations(params?: {
    status?: QuotationStatus;
    customerId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    // Automatically update expired quotes first
    await this.checkAndExpireQuotations();

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.QuotationWhereInput = {
      status: params?.status,
      customerId: params?.customerId,
      ...(params?.search
        ? {
            OR: [
              { quotationNumber: { contains: params.search, mode: "insensitive" } },
              { customer: { name: { contains: params.search, mode: "insensitive" } } },
              { plan: { name: { contains: params.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.quotation.findMany({
        where,
        include: {
          customer: true,
          plan: true,
          template: true,
          subscription: { select: { id: true, subscriptionNumber: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.quotation.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getQuotationById(id: string) {
    await this.checkAndExpireQuotations();

    const quote = await db.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        plan: true,
        template: true,
        subscription: true,
        items: {
          include: {
            product: true,
            variant: true,
            taxRule: true,
          },
        },
      },
    });

    if (!quote) {
      throw AppError.notFound(`Quotation with ID ${id}`);
    }

    return quote;
  }

  /**
   * Checks for overdue active quotations and marks them EXPIRED
   */
  async checkAndExpireQuotations(): Promise<number> {
    const now = new Date();
    const expired = await db.quotation.updateMany({
      where: {
        status: { in: ["DRAFT", "SENT"] },
        validUntil: { lt: now },
      },
      data: {
        status: "EXPIRED",
      },
    });

    return expired.count;
  }

  /**
   * Cancels a quotation
   */
  async cancelQuotation(id: string, reason?: string, userId?: string) {
    const quote = await this.getQuotationById(id);

    if (quote.status === "CONFIRMED") {
      throw AppError.badRequest("Cannot cancel a quotation that has already been confirmed/accepted");
    }

    const updated = await db.quotation.update({
      where: { id },
      data: { status: "CANCELLED", notes: reason ? `${quote.notes || ""}\nCancelled: ${reason}`.trim() : quote.notes },
    });

    await writeAuditLog({
      userId,
      action: "QUOTATION_CANCELLED",
      entityType: "Quotation",
      entityId: id,
      metadata: { reason },
    });

    return updated;
  }

  /**
   * Sends quotation to customer via email (Non-blocking, logged to email_delivery_logs)
   */
  async sendQuotation(id: string, recipientEmail?: string, userId?: string) {
    const quote = await this.getQuotationById(id);

    if (quote.status === "EXPIRED" || quote.status === "CANCELLED") {
      throw AppError.badRequest(`Cannot send quotation with status ${quote.status}`);
    }

    const email = recipientEmail || quote.customer.email;
    const viewUrl = `${env.APP_URL}/customer/quotations/${quote.id}`;
    const formattedAmount = formatMoney(quote.totalAmount);

    const template = quotationDeliveryTemplate(
      quote.quotationNumber,
      formattedAmount,
      viewUrl,
      quote.customer.name
    );

    // Non-blocking dispatch
    const emailResult = await emailService.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      userId,
    });

    // Mark as SENT if was DRAFT
    if (quote.status === "DRAFT") {
      await db.quotation.update({
        where: { id },
        data: { status: "SENT" },
      });
    }

    await writeAuditLog({
      userId,
      action: "QUOTATION_SENT",
      entityType: "Quotation",
      entityId: id,
      metadata: { email, emailLogId: emailResult.logId, success: emailResult.success },
    });

    return { success: true, emailResult };
  }

  /**
   * acceptQuotation: Transactional & IDEMPOTENT workflow
   * Converts Quotation ➔ Subscription + subscription_items
   */
  async acceptQuotation(quotationId: string, userId?: string) {
    const quote = await this.getQuotationById(quotationId);

    // 1. Idempotency Check: if quotation already converted, return existing subscription
    if (quote.status === "CONFIRMED" && quote.subscription) {
      return {
        alreadyAccepted: true,
        subscription: quote.subscription,
        message: "Quotation was already accepted and converted into a subscription.",
      };
    }

    if (quote.status === "EXPIRED") {
      throw AppError.badRequest("Cannot accept an expired quotation. Please request a refreshed quote.");
    }

    if (quote.status === "CANCELLED") {
      throw AppError.badRequest("Cannot accept a cancelled quotation.");
    }

    // 2. Validate plan availability and min quantity
    const plan = quote.plan;
    const now = new Date();
    if (plan.startDate && isBefore(now, plan.startDate)) {
      throw AppError.badRequest(`Plan is not available until ${plan.startDate.toISOString()}`);
    }
    if (plan.endDate && isBefore(plan.endDate, now)) {
      throw AppError.badRequest(`Plan has already ended on ${plan.endDate.toISOString()}`);
    }

    const totalQty = quote.items.reduce((acc, item) => acc + item.quantity, 0);
    if (totalQty < plan.minQuantity) {
      throw AppError.badRequest(
        `Quantity (${totalQty}) does not satisfy plan minimum quantity (${plan.minQuantity})`
      );
    }

    // 3. Compute period dates and subscription number
    const startDate = new Date();
    const { addInterval } = await import("@/lib/dates");
    const currentPeriodEnd = addInterval(startDate, plan.billingInterval, 1);
    const nextBillingDate = currentPeriodEnd;

    // Generate unique subscription number
    const subYear = startDate.getFullYear();
    const subPrefix = `SUB-${subYear}-`;

    return db.$transaction(async (tx) => {
      // Find latest subscription sequence
      const latestSub = await tx.subscription.findFirst({
        where: { subscriptionNumber: { startsWith: subPrefix } },
        orderBy: { subscriptionNumber: "desc" },
        select: { subscriptionNumber: true },
      });

      let nextSubSeq = 1;
      if (latestSub?.subscriptionNumber) {
        const parts = latestSub.subscriptionNumber.split("-");
        const curr = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(curr)) nextSubSeq = curr + 1;
      }

      const subscriptionNumber = `${subPrefix}${nextSubSeq.toString().padStart(6, "0")}`;

      // Create subscription
      const subscription = await tx.subscription.create({
        data: {
          subscriptionNumber,
          customerId: quote.customerId,
          planId: quote.planId,
          quotationId: quote.id,
          status: "CONFIRMED", // Moves to CONFIRMED as specified
          startDate,
          currentPeriodStart: startDate,
          currentPeriodEnd,
          nextBillingDate,
          paymentTerms: quote.paymentTerms,
          billingInterval: plan.billingInterval,
          autoCloseAtEnd: plan.autoCloseAtEnd,
          allowEarlyClose: plan.allowEarlyClose,
          allowPause: plan.allowPause,
          allowRenewal: plan.allowRenewal,
          subtotal: quote.subtotal,
          taxTotal: quote.taxTotal,
          discountTotal: quote.discountTotal,
          totalAmount: quote.totalAmount,
          notes: quote.notes ? `Converted from ${quote.quotationNumber}\n${quote.notes}` : `Converted from ${quote.quotationNumber}`,
          items: {
            create: quote.items.map((qi) => ({
              productId: qi.productId,
              productVariantId: qi.productVariantId,
              taxRuleId: qi.taxRuleId,
              description: qi.description,
              quantity: qi.quantity,
              unitPrice: qi.unitPrice,
              taxAmount: qi.taxAmount,
              discountAmount: qi.discountAmount,
              lineTotal: qi.lineTotal,
            })),
          },
        },
        include: {
          items: true,
          customer: true,
          plan: true,
        },
      });

      // Update Quotation status to CONFIRMED
      await tx.quotation.update({
        where: { id: quote.id },
        data: { status: "CONFIRMED" },
      });

      await writeAuditLog({
        userId,
        action: "QUOTATION_ACCEPTED",
        entityType: "Quotation",
        entityId: quote.id,
        metadata: {
          quotationNumber: quote.quotationNumber,
          createdSubscriptionNumber: subscription.subscriptionNumber,
        },
      });

      return {
        alreadyAccepted: false,
        subscription,
        message: `Quotation accepted! Subscription ${subscription.subscriptionNumber} created.`,
      };
    });
  }
}

export const quotationService = new QuotationService();

