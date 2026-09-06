import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  // 1. Get Acme Corp
  const org = await prisma.organization.findFirst({
    where: { name: 'Acme Corporation' }
  });

  if (!org) {
    console.error('Acme Corp not found');
    return;
  }

  // 2. Get Growth Plan
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { name: 'Growth' }
  });

  if (!plan) {
    console.error('Growth plan not found');
    return;
  }

  // 3. Upsert Subscription
  await prisma.subscription.deleteMany({
    where: { organizationId: org.id }
  });

  const subscription = await prisma.subscription.create({
    data: {
      organizationId: org.id,
      planId: plan.id,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    }
  });

  console.log('Subscription updated:', subscription.id);

  // 4. Get all modules in the plan
  const planEntitlements = await prisma.planEntitlement.findMany({
    where: { planId: plan.id, moduleId: { not: null } }
  });

  const moduleIds = planEntitlements.map(e => e.moduleId).filter(id => id !== null) as string[];

  console.log('Granting modules:', moduleIds);

  // 5. Update OrganizationModule
  await prisma.organizationModule.deleteMany({
    where: { organizationId: org.id }
  });

  for (const moduleId of moduleIds) {
    await prisma.organizationModule.create({
      data: {
        organizationId: org.id,
        moduleId: moduleId,
        isActive: true
      }
    });
  }

  console.log('Granted modules successfully.');
  await prisma.$disconnect();
}

main().catch(console.error);
