"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/guards";
import { ProductService } from "@/server/services/product";
import { PlanService } from "@/server/services/plan";
import { TaxService } from "@/server/services/tax";
import { CustomerService } from "@/server/services/customer";
import {
  productSchema,
  productVariantSchema,
  planSchema,
  planUpdateSchema,
  taxRuleSchema,
  customerProfileSchema,
} from "@/schemas/catalog";

// ==========================================
// Product Server Actions
// ==========================================

export async function createProductAction(formData: unknown) {
  try {
    await requireRole(["ADMIN"]);
    const validated = productSchema.parse(formData);
    const product = await ProductService.createProduct(validated);
    revalidatePath("/admin/products");
    return { success: true, data: product };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create product" };
  }
}

export async function updateProductAction(id: string, formData: unknown) {
  try {
    await requireRole(["ADMIN"]);
    const validated = productSchema.partial().parse(formData);
    const product = await ProductService.updateProduct(id, validated);
    revalidatePath("/admin/products");
    return { success: true, data: product };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update product" };
  }
}

export async function toggleProductArchiveAction(id: string, isActive?: boolean) {
  try {
    await requireRole(["ADMIN"]);
    const product = await ProductService.toggleProductArchive(id, isActive);
    revalidatePath("/admin/products");
    return { success: true, data: product };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to toggle product status" };
  }
}

export async function createVariantAction(formData: unknown) {
  try {
    await requireRole(["ADMIN"]);
    const validated = productVariantSchema.parse(formData);
    const variant = await ProductService.createVariant(validated);
    revalidatePath("/admin/products");
    return { success: true, data: variant };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create variant" };
  }
}

export async function toggleVariantArchiveAction(variantId: string, isActive?: boolean) {
  try {
    await requireRole(["ADMIN"]);
    const variant = await ProductService.toggleVariantArchive(variantId, isActive);
    revalidatePath("/admin/products");
    return { success: true, data: variant };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to toggle variant status" };
  }
}

// ==========================================
// Plan Server Actions
// ==========================================

export async function createPlanAction(formData: unknown) {
  try {
    await requireRole(["ADMIN"]);
    const validated = planSchema.parse(formData);
    const plan = await PlanService.createPlan(validated);
    revalidatePath("/admin/plans");
    return { success: true, data: plan };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create subscription plan" };
  }
}

export async function updatePlanAction(id: string, formData: unknown) {
  try {
    await requireRole(["ADMIN"]);
    const validated = planUpdateSchema.parse(formData);
    const plan = await PlanService.updatePlan(id, validated);
    revalidatePath("/admin/plans");
    return { success: true, data: plan };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update subscription plan" };
  }
}

export async function togglePlanArchiveAction(id: string, isActive?: boolean) {
  try {
    await requireRole(["ADMIN"]);
    const plan = await PlanService.togglePlanArchive(id, isActive);
    revalidatePath("/admin/plans");
    return { success: true, data: plan };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to toggle plan status" };
  }
}

// ==========================================
// Tax Rule Server Actions
// ==========================================

export async function createTaxRuleAction(formData: unknown) {
  try {
    await requireRole(["ADMIN"]);
    const validated = taxRuleSchema.parse(formData);
    const rule = await TaxService.createTaxRule(validated);
    revalidatePath("/admin/taxes");
    return { success: true, data: rule };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create tax rule" };
  }
}

export async function updateTaxRuleAction(id: string, formData: unknown) {
  try {
    await requireRole(["ADMIN"]);
    const validated = taxRuleSchema.partial().parse(formData);
    const rule = await TaxService.updateTaxRule(id, validated);
    revalidatePath("/admin/taxes");
    return { success: true, data: rule };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update tax rule" };
  }
}

export async function toggleTaxRuleArchiveAction(id: string, isActive?: boolean) {
  try {
    await requireRole(["ADMIN"]);
    const rule = await TaxService.toggleTaxRuleArchive(id, isActive);
    revalidatePath("/admin/taxes");
    return { success: true, data: rule };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to toggle tax rule status" };
  }
}

// ==========================================
// Customer Profile Server Actions
// ==========================================

export async function createCustomerAction(formData: unknown) {
  try {
    // Both Admin and Staff can manage customers
    await requireRole(["ADMIN", "STAFF"]);
    const validated = customerProfileSchema.parse(formData);
    const customer = await CustomerService.createCustomer(validated);
    revalidatePath("/admin/customers");
    revalidatePath("/staff/customers");
    return { success: true, data: customer };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create customer" };
  }
}

export async function updateCustomerAction(id: string, formData: unknown) {
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const validated = customerProfileSchema.partial().parse(formData);
    const customer = await CustomerService.updateCustomer(id, validated);
    revalidatePath("/admin/customers");
    revalidatePath("/staff/customers");
    return { success: true, data: customer };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update customer" };
  }
}
