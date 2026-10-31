import { db } from "@/server/db";
import { TaxRuleInput } from "@/schemas/catalog";
import { toDecimal, roundMoney, addMoney, subtractMoney, MoneyInput } from "@/lib/money";
import { AppError } from "@/lib/errors";
import Decimal from "decimal.js";

export interface TaxCalculationResult {
  taxableAmount: Decimal;
  taxRate: Decimal;
  taxAmount: Decimal;
  totalWithTax: Decimal;
  isInclusive: boolean;
}

export class TaxService {
  /**
   * Pure function to calculate tax using Decimal with Banker-safe ROUND_HALF_UP.
   * Supports both tax-exclusive and tax-inclusive calculations.
   * No hardcoded tax rates!
   *
   * Rate convention: 0.10 represents 10%. If a value > 1 is passed (e.g., 10), it is normalized to 0.10.
   */
  static calculateTax(
    amount: MoneyInput,
    rule: {
      rate: MoneyInput;
      isInclusive?: boolean;
    }
  ): TaxCalculationResult {
    const rawAmount = toDecimal(amount);
    let rawRate = toDecimal(rule.rate);

    // If rate entered as percentage > 1 (e.g. 10 for 10%), normalize to 0.10
    if (rawRate.greaterThan(1)) {
      rawRate = rawRate.dividedBy(100);
    }

    const isInclusive = !!rule.isInclusive;

    if (rawRate.isZero() || rawRate.isNegative()) {
      return {
        taxableAmount: roundMoney(rawAmount),
        taxRate: new Decimal(0),
        taxAmount: new Decimal(0),
        totalWithTax: roundMoney(rawAmount),
        isInclusive,
      };
    }

    if (isInclusive) {
      // Amount is already gross (includes tax).
      // net = amount / (1 + rate)
      // tax = amount - net
      const onePlusRate = new Decimal(1).plus(rawRate);
      const netAmount = rawAmount.dividedBy(onePlusRate);
      const taxAmount = roundMoney(rawAmount.minus(netAmount));
      const taxableAmount = subtractMoney(rawAmount, taxAmount);

      return {
        taxableAmount,
        taxRate: rawRate,
        taxAmount,
        totalWithTax: roundMoney(rawAmount),
        isInclusive: true,
      };
    } else {
      // Amount is net (excludes tax).
      // tax = amount * rate
      // total = amount + tax
      const taxAmount = roundMoney(rawAmount.times(rawRate));
      const totalWithTax = addMoney(rawAmount, taxAmount);

      return {
        taxableAmount: roundMoney(rawAmount),
        taxRate: rawRate,
        taxAmount,
        totalWithTax,
        isInclusive: false,
      };
    }
  }

  // ==========================================
  // Database Tax Rules Operations
  // ==========================================

  /**
   * Lists all tax rules with pagination and search
   */
  static async listTaxRules(params?: {
    page?: number;
    pageSize?: number;
    isActive?: boolean;
    search?: string;
  }) {
    const page = Math.max(1, params?.page || 1);
    const pageSize = Math.max(1, Math.min(100, params?.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }
    if (params?.search) {
      where.name = { contains: params.search, mode: "insensitive" };
    }

    const [total, rules] = await Promise.all([
      db.taxRule.count({ where }),
      db.taxRule.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      }),
    ]);

    return {
      data: rules,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Retrieves default active tax rule if configured
   */
  static async getDefaultTaxRule() {
    return db.taxRule.findFirst({
      where: {
        isDefault: true,
        isActive: true,
      },
    });
  }

  /**
   * Retrieves tax rule by ID
   */
  static async getTaxRuleById(id: string) {
    const rule = await db.taxRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw AppError.notFound(`Tax rule "${id}" not found`);
    }

    return rule;
  }

  /**
   * Creates a new tax rule
   */
  static async createTaxRule(input: TaxRuleInput) {
    let rate = toDecimal(input.rate);
    if (rate.greaterThan(1)) {
      rate = rate.dividedBy(100);
    }

    return db.$transaction(async (tx) => {
      // If setting this rule as default, unset other defaults
      if (input.isDefault) {
        await tx.taxRule.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.taxRule.create({
        data: {
          name: input.name,
          rate: rate.toString(),
          country: input.country || null,
          state: input.state || null,
          isDefault: input.isDefault ?? false,
          isActive: input.isActive ?? true,
        },
      });
    });
  }

  /**
   * Updates an existing tax rule
   */
  static async updateTaxRule(id: string, input: Partial<TaxRuleInput>) {
    await this.getTaxRuleById(id);

    return db.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.taxRule.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.rate !== undefined) {
        let rate = toDecimal(input.rate);
        if (rate.greaterThan(1)) rate = rate.dividedBy(100);
        updateData.rate = rate.toString();
      }
      if (input.country !== undefined) updateData.country = input.country;
      if (input.state !== undefined) updateData.state = input.state;
      if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      return tx.taxRule.update({
        where: { id },
        data: updateData,
      });
    });
  }

  /**
   * Toggles active state of a tax rule
   */
  static async toggleTaxRuleArchive(id: string, isActive?: boolean) {
    const existing = await this.getTaxRuleById(id);
    const targetStatus = isActive !== undefined ? isActive : !existing.isActive;

    return db.taxRule.update({
      where: { id },
      data: { isActive: targetStatus },
    });
  }
}

