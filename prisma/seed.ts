import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, Role, ServiceLevel } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding demo data...");

  const passwordHash = await bcrypt.hash("Password123!", 10);

  const org = await prisma.organization.upsert({
    where: { slug: "swiftline" },
    update: { isActive: true },
    create: {
      name: "SwiftLine Couriers",
      slug: "swiftline",
      contactEmail: "hello@swiftline.example",
    },
  });

  const [dhakaZone, ctgZone] = await Promise.all([
    prisma.zone.upsert({
      where: { organizationId_code: { organizationId: org.id, code: "DHK" } },
      update: { name: "Dhaka Metro", city: "Dhaka" },
      create: { organizationId: org.id, name: "Dhaka Metro", code: "DHK", city: "Dhaka" },
    }),
    prisma.zone.upsert({
      where: { organizationId_code: { organizationId: org.id, code: "CTG" } },
      update: { name: "Chattogram Metro", city: "Chattogram" },
      create: { organizationId: org.id, name: "Chattogram Metro", code: "CTG", city: "Chattogram" },
    }),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: "admin@swiftline.example" },
    update: { organizationId: org.id, role: Role.ADMIN },
    create: {
      organizationId: org.id,
      name: "Admin User",
      email: "admin@swiftline.example",
      password: passwordHash,
      role: Role.ADMIN,
    },
  });

  const opsManager = await prisma.user.upsert({
    where: { email: "ops@swiftline.example" },
    update: { organizationId: org.id, role: Role.OPS_MANAGER },
    create: {
      organizationId: org.id,
      name: "Ops Manager",
      email: "ops@swiftline.example",
      password: passwordHash,
      role: Role.OPS_MANAGER,
    },
  });

  const hubManagerDhk = await prisma.user.upsert({
    where: { email: "hub.dhaka@swiftline.example" },
    update: { organizationId: org.id, role: Role.HUB_MANAGER },
    create: {
      organizationId: org.id,
      name: "Dhaka Hub Manager",
      email: "hub.dhaka@swiftline.example",
      password: passwordHash,
      role: Role.HUB_MANAGER,
    },
  });

  const courierUser = await prisma.user.upsert({
    where: { email: "courier1@swiftline.example" },
    update: { organizationId: org.id, role: Role.COURIER },
    create: {
      organizationId: org.id,
      name: "Rafiq the Courier",
      email: "courier1@swiftline.example",
      password: passwordHash,
      role: Role.COURIER,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@swiftline.example" },
    update: { organizationId: org.id, role: Role.CUSTOMER },
    create: {
      organizationId: org.id,
      name: "Demo Customer",
      email: "customer@swiftline.example",
      password: passwordHash,
      role: Role.CUSTOMER,
    },
  });

  const dhakaHub = await prisma.hub.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "DHK-01" } },
    update: { zoneId: dhakaZone.id, managerId: hubManagerDhk.id, isActive: true },
    create: {
      organizationId: org.id,
      name: "Dhaka Central Hub",
      code: "DHK-01",
      zoneId: dhakaZone.id,
      address: "Motijheel, Dhaka",
      managerId: hubManagerDhk.id,
    },
  });

  await prisma.hub.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "CTG-01" } },
    update: { zoneId: ctgZone.id, isActive: true },
    create: {
      organizationId: org.id,
      name: "Chattogram Hub",
      code: "CTG-01",
      zoneId: ctgZone.id,
      address: "Agrabad, Chattogram",
    },
  });

  await prisma.courierProfile.upsert({
    where: { userId: courierUser.id },
    update: { organizationId: org.id, homeHubId: dhakaHub.id, currentZoneId: dhakaZone.id, isAvailable: true },
    create: {
      userId: courierUser.id,
      organizationId: org.id,
      homeHubId: dhakaHub.id,
      currentZoneId: dhakaZone.id,
      vehicleType: "BIKE",
      capacityKg: 25,
      isAvailable: true,
    },
  });

  await prisma.pricingRule.create({
    data: {
      organizationId: org.id,
      serviceLevel: ServiceLevel.STANDARD,
      fromZoneId: null,
      toZoneId: null,
      baseFee: 60,
      perKgFee: 15,
      baseWeightKg: 1,
    },
  });

  console.log("Seed complete.");
  console.log("Demo login (all roles): password = Password123!");
  console.table([
    { role: "ADMIN", email: admin.email },
    { role: "OPS_MANAGER", email: opsManager.email },
    { role: "HUB_MANAGER", email: hubManagerDhk.email },
    { role: "COURIER", email: courierUser.email },
    { role: "CUSTOMER", email: customer.email },
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
