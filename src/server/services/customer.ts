import { db } from "@/server/db";
import { CustomerProfileInput } from "@/schemas/catalog";
import { AppError } from "@/lib/errors";

export class CustomerService {
  /**
   * Lists customer profiles with search and pagination
   */
  static async listCustomers(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }) {
    const page = Math.max(1, params?.page || 1);
    const pageSize = Math.max(1, Math.min(100, params?.pageSize || 10));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
        { city: { contains: params.search, mode: "insensitive" } },
        { taxIdentifier: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [total, customers] = await Promise.all([
      db.customerProfile.count({ where }),
      db.customerProfile.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              subscriptions: true,
              invoices: true,
              quotations: true,
            },
          },
        },
      }),
    ]);

    return {
      data: customers,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Retrieves single customer by ID with related business data
   */
  static async getCustomerById(id: string) {
    const customer = await db.customerProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        },
        subscriptions: {
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            plan: true,
          },
        },
        invoices: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        quotations: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            subscriptions: true,
            invoices: true,
            quotations: true,
            payments: true,
          },
        },
      },
    });

    if (!customer) {
      throw AppError.notFound(`Customer profile "${id}" not found`);
    }

    return customer;
  }

  /**
   * Creates customer profile.
   * Keeps business profile in customer_profiles and links optional user record.
   */
  static async createCustomer(input: CustomerProfileInput) {
    // Check if customer with this email already exists
    const existing = await db.customerProfile.findFirst({
      where: { email: input.email },
    });

    if (existing) {
      throw AppError.conflict(`Customer with email "${input.email}" already exists`);
    }

    return db.customerProfile.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        addressLine1: input.addressLine1 || null,
        addressLine2: input.addressLine2 || null,
        city: input.city || null,
        state: input.state || null,
        postalCode: input.postalCode || null,
        country: input.country || "US",
        taxIdentifier: input.taxIdentifier || null,
        userId: input.userId || null,
      },
      include: {
        user: {
          select: { id: true, email: true, role: true },
        },
      },
    });
  }

  /**
   * Updates customer profile
   */
  static async updateCustomer(id: string, input: Partial<CustomerProfileInput>) {
    await this.getCustomerById(id);

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.addressLine1 !== undefined) updateData.addressLine1 = input.addressLine1;
    if (input.addressLine2 !== undefined) updateData.addressLine2 = input.addressLine2;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.state !== undefined) updateData.state = input.state;
    if (input.postalCode !== undefined) updateData.postalCode = input.postalCode;
    if (input.country !== undefined) updateData.country = input.country;
    if (input.taxIdentifier !== undefined) updateData.taxIdentifier = input.taxIdentifier;
    if (input.userId !== undefined) updateData.userId = input.userId;

    return db.customerProfile.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, email: true, role: true },
        },
      },
    });
  }
}

