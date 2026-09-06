const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding HRMS module and permissions...');
  
  // Create or find HRMS Module
  let hrmsModule = await prisma.module.findFirst({ where: { name: 'hrms' } });
  if (!hrmsModule) {
    hrmsModule = await prisma.module.create({
      data: {
        name: 'hrms',
        description: 'Human Resource Management System (HRMS)',
        isGlobal: true,
        status: 'active'
      }
    });
    console.log('Created HRMS module.');
  }

  const permissions = [
    { action: 'hrms:employee:view', resource: 'hrms_employee' },
    { action: 'hrms:employee:manage', resource: 'hrms_employee' },
    { action: 'hrms:attendance:view', resource: 'hrms_attendance' },
    { action: 'hrms:attendance:manage', resource: 'hrms_attendance' },
    { action: 'hrms:leave:view', resource: 'hrms_leave' },
    { action: 'hrms:leave:manage', resource: 'hrms_leave' },
    { action: 'hrms:payroll:view', resource: 'hrms_payroll' },
    { action: 'hrms:payroll:manage', resource: 'hrms_payroll' },
    { action: 'hrms:performance:view', resource: 'hrms_performance' },
    { action: 'hrms:performance:manage', resource: 'hrms_performance' },
  ];

  let count = 0;
  for (const perm of permissions) {
    const exists = await prisma.permission.findFirst({
      where: { action: perm.action }
    });
    if (!exists) {
      await prisma.permission.create({
        data: {
          ...perm,
          moduleId: hrmsModule.id,
          isDelegatable: true
        }
      });
      count++;
    }
  }

  console.log(`Seeded ${count} HRMS permissions.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
