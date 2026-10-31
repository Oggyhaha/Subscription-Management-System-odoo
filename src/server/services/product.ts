import { db } from "@/server/db";
import { ProductInput, ProductVariantInput } from "@/schemas/catalog";
import { toDecimal, addMoney } from "@/lib/money";
import { AppError } from "@/lib/errors";
import Decimal from "decimal.js";

export class ProductService {
  /**
   * Retrieves paginated products with optional search and active status filter
   */
  static async listProducts(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    isActive?: boolean;
  }) {
    const page = Math.max(1, params?.page || 1);
    const pageSize = Math.max(1, Math.min(100, params?.pageSize || 10));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }
    if (params?.search) {
      where.name = { contains: params.search, mode: "insensitive" };
    }

    const [total, products] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          variants: {
            where: { isActive: true },
          },
          _count: {
            select: { variants: true },
          },
        },
      }),
    ]);

    return {
      data: products,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Finds a product by ID with its variants
   */
  static async getProductById(id: string) {
    const product = await db.product.findUnique({
      where: { id },
      include: {
        variants: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!product) {
      throw AppError.notFound(`Product with ID "${id}" not found`);
    }

    return product;
  }

  /**
   * Creates a new product
   */
  static async createProduct(input: ProductInput) {
    const salesPrice = toDecimal(input.salesPrice);
    const costPrice = toDecimal(input.costPrice);

    return db.product.create({
      data: {
        name: input.name,
        type: input.type,
        salesPrice: salesPrice.toString(),
        costPrice: costPrice.toString(),
        notes: input.notes,
        isActive: input.isActive ?? true,
      },
      include: {
        variants: true,
      },
    });
  }

  /**
   * Updates an existing product
   */
  static async updateProduct(id: string, input: Partial<ProductInput>) {
    await this.getProductById(id);

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.salesPrice !== undefined) updateData.salesPrice = toDecimal(input.salesPrice).toString();
    if (input.costPrice !== undefined) updateData.costPrice = toDecimal(input.costPrice).toString();
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    return db.product.update({
      where: { id },
      data: updateData,
      include: {
        variants: true,
      },
    });
  }

  /**
   * Archives or toggles active status for a product
   */
  static async toggleProductArchive(id: string, isActive?: boolean) {
    const existing = await this.getProductById(id);
    const targetStatus = isActive !== undefined ? isActive : !existing.isActive;

    return db.product.update({
      where: { id },
      data: { isActive: targetStatus },
    });
  }

  // ==========================================
  // Variants Management
  // ==========================================

  /**
   * Creates a variant for a product
   */
  static async createVariant(input: ProductVariantInput) {
    await this.getProductById(input.productId);

    return db.productVariant.create({
      data: {
        productId: input.productId,
        name: input.name,
        sku: input.sku || null,
        priceModifier: toDecimal(input.priceModifier).toString(),
        attributeName: input.attributeName,
        attributeValue: input.attributeValue,
        isActive: input.isActive ?? true,
      },
    });
  }

  /**
   * Updates a product variant
   */
  static async updateVariant(variantId: string, input: Partial<ProductVariantInput>) {
    const existing = await db.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!existing) {
      throw AppError.notFound(`Product variant with ID "${variantId}" not found`);
    }

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.sku !== undefined) updateData.sku = input.sku;
    if (input.priceModifier !== undefined) {
      updateData.priceModifier = toDecimal(input.priceModifier).toString();
    }
    if (input.attributeName !== undefined) updateData.attributeName = input.attributeName;
    if (input.attributeValue !== undefined) updateData.attributeValue = input.attributeValue;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    return db.productVariant.update({
      where: { id: variantId },
      data: updateData,
    });
  }

  /**
   * Archives or deletes a variant
   */
  static async toggleVariantArchive(variantId: string, isActive?: boolean) {
    const existing = await db.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!existing) {
      throw AppError.notFound(`Product variant with ID "${variantId}" not found`);
    }

    const targetStatus = isActive !== undefined ? isActive : !existing.isActive;

    return db.productVariant.update({
      where: { id: variantId },
      data: { isActive: targetStatus },
    });
  }

  /**
   * Calculates effective unit price = base sales price + variant adjustment.
   * Example: Base 2,000 + Odoo variant adjustment 560 = 2,560.
   */
  static async getEffectiveUnitPrice(productId: string, variantId?: string | null): Promise<Decimal> {
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { salesPrice: true },
    });

    if (!product) {
      throw AppError.notFound(`Product "${productId}" not found for price calculation`);
    }

    const basePrice = toDecimal(product.salesPrice);

    if (!variantId) {
      return basePrice;
    }

    const variant = await db.productVariant.findUnique({
      where: { id: variantId },
      select: { priceModifier: true, productId: true },
    });

    if (!variant || variant.productId !== productId) {
      throw AppError.badRequest(`Variant "${variantId}" does not belong to product "${productId}"`);
    }

    const adjustment = toDecimal(variant.priceModifier);
    return addMoney(basePrice, adjustment);
  }

  /**
   * Pure price calculation without DB query (for testing and offline calculations)
   */
  static calculateEffectivePrice(basePrice: Decimal.Value, adjustment?: Decimal.Value | null): Decimal {
    const base = toDecimal(basePrice);
    const mod = adjustment ? toDecimal(adjustment) : new Decimal(0);
    return addMoney(base, mod);
  }
}

