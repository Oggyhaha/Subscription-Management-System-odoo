import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD_ADMIN = "Admin@Brightloop2026!";
const DEMO_PASSWORD_STAFF = "Staff@Brightloop2026!";
const DEMO_PASSWORD_CUSTOMER = "Customer@Brightloop2026!";

export async function seedUsers() {
  console.log("🌱 Seeding Users and Customer Profiles...");

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
      role: "ADMIN",
    },
  });
  console.log(`  ✓ Admin: ${admin.email}`);

  // 2. Staff Accounts (3 staff members)
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
        role: "STAFF",
      },
    });
    console.log(`  ✓ Staff: ${s.email}`);
  }

  // 3. Customer Accounts & Profiles (5 customers)
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

  for (const cust of customers) {
    const user = await prisma.user.upsert({
      where: { email: cust.email },
      update: { passwordHash: customerHash },
      create: {
        email: cust.email,
        name: cust.name,
        passwordHash: customerHash,
        role: "CUSTOMER",
      },
    });

    await prisma.customerProfile.upsert({
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
    console.log(`  ✓ Customer: ${user.email} (${cust.companyName})`);
  }

  console.log("\n✅ Users and Customer Profiles seeded successfully.");
}

async function main() {
  try {
    await seedUsers();
  } catch (e) {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

