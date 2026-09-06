import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const plans = await prisma.subscriptionPlan.findMany({
    include: {
      entitlements: {
        include: {
          module: true
        }
      }
    }
  });

  console.log(JSON.stringify(plans.map(p => ({
    name: p.name,
    modules: p.entitlements.map(e => e.module ? e.module.name : e.moduleId)
  })), null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
