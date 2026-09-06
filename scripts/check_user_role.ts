import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({
    where: { email: 'admin@acme.com' },
    include: {
      memberships: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true }
              }
            }
          }
        }
      }
    }
  });

  if (user) {
    console.log(`User: ${user.email}`);
    user.memberships.forEach(ur => {
      console.log(`Role: ${ur.role.name}`);
      console.log(`Permissions (${ur.role.permissions.length}):`);
      console.log(ur.role.permissions.map(p => p.permission.name).join(', '));
    });
  }
  await prisma.$disconnect();
}

main();
