"use server";

import { revalidatePath } from "next/cache";
import { quotationService } from "@/server/services/quotation";
import { requireUser } from "@/server/auth/guards";
import {
  createQuotationTemplateSchema,
  createQuotationSchema,
  generateFromTemplateSchema,
  sendQuotationSchema,
  type CreateQuotationTemplateInput,
  type CreateQuotationInput,
  type GenerateFromTemplateInput,
  type SendQuotationInput,
} from "@/schemas/quotation";

export interface ActionResult<T = unknown> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
}

// -------------------------------------------------------------
// TEMPLATES
// -------------------------------------------------------------

export async function createQuotationTemplateAction(input: CreateQuotationTemplateInput): Promise<ActionResult> {
  try {
    await requireUser();
    const validated = createQuotationTemplateSchema.parse(input);
    const template = await quotationService.createTemplate(validated);

    revalidatePath("/admin/quotation-templates");
    revalidatePath("/staff/quotation-templates");

    return {
      success: true,
      message: `Template "${template.name}" created successfully.`,
      data: template,
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create template" };
  }
}

export async function updateQuotationTemplateAction(
  id: string,
  input: Partial<CreateQuotationTemplateInput>
): Promise<ActionResult> {
  try {
    await requireUser();
    const updated = await quotationService.updateTemplate(id, input);

    revalidatePath("/admin/quotation-templates");
    revalidatePath("/staff/quotation-templates");

    return {
      success: true,
      message: "Template updated successfully.",
      data: updated,
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update template" };
  }
}

export async function deleteQuotationTemplateAction(id: string): Promise<ActionResult> {
  try {
    await requireUser();
    await quotationService.deleteTemplate(id);

    revalidatePath("/admin/quotation-templates");
    revalidatePath("/staff/quotation-templates");

    return { success: true, message: "Template deleted successfully." };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete template" };
  }
}

// -------------------------------------------------------------
// QUOTATIONS
// -------------------------------------------------------------

export async function generateQuotationFromTemplateAction(
  input: GenerateFromTemplateInput
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const validated = generateFromTemplateSchema.parse(input);
    const quote = await quotationService.generateFromTemplate(validated, user.id);

    revalidatePath("/admin/quotations");
    revalidatePath("/staff/quotations");

    return {
      success: true,
      message: `Quotation ${quote.quotationNumber} generated from template.`,
      data: quote,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate quotation from template",
    };
  }
}

export async function createQuotationAction(input: CreateQuotationInput): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const validated = createQuotationSchema.parse(input);
    const quote = await quotationService.createQuotation(validated, user.id);

    revalidatePath("/admin/quotations");
    revalidatePath("/staff/quotations");

    return {
      success: true,
      message: `Quotation ${quote.quotationNumber} created successfully.`,
      data: quote,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create quotation",
    };
  }
}

export async function cancelQuotationAction(id: string, reason?: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const cancelled = await quotationService.cancelQuotation(id, reason, user.id);

    revalidatePath("/admin/quotations");
    revalidatePath("/staff/quotations");

    return {
      success: true,
      message: `Quotation ${cancelled.quotationNumber} cancelled.`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to cancel quotation",
    };
  }
}

export async function sendQuotationAction(input: SendQuotationInput): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const validated = sendQuotationSchema.parse(input);
    const result = await quotationService.sendQuotation(
      validated.quotationId,
      validated.recipientEmail,
      user.id
    );

    revalidatePath("/admin/quotations");
    revalidatePath("/staff/quotations");

    return {
      success: true,
      message: "Quotation email dispatched to customer.",
      data: result,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send quotation",
    };
  }
}

export async function acceptQuotationAction(quotationId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const res = await quotationService.acceptQuotation(quotationId, user.id);

    revalidatePath("/admin/quotations");
    revalidatePath("/staff/quotations");
    revalidatePath("/admin/subscriptions");
    revalidatePath("/staff/subscriptions");

    return {
      success: true,
      message: res.message,
      data: res.subscription,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to accept quotation",
    };
  }
}

