import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const org = await prisma.organization.findFirst({ where: { name: 'Acme Corporation' } });
  if (!org) {
    console.error('Org not found');
    return;
  }
  const role = await prisma.role.findFirst({ where: { organizationId: org.id, name: 'Org Admin' } });
  if (!role) {
    console.error('Role not found');
    return;
  }

  const permissions = await prisma.permission.findMany();
  for (const p of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: p.id }
      },
      update: {},
      create: { roleId: role.id, permissionId: p.id }
    });
  }

  console.log(`Granted ${permissions.length} permissions to Org Admin`);
  await prisma.$disconnect();
}

main().catch(console.error);
