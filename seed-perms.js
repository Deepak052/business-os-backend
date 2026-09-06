const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  const perms = [
    'hrms:employee:view', 'hrms:employee:manage',
    'hrms:attendance:view', 'hrms:attendance:manage',
    'hrms:leave:view', 'hrms:leave:manage',
    'hrms:payroll:view', 'hrms:payroll:manage',
    'hrms:performance:view', 'hrms:performance:manage',
    'crm:manage_companies', 'crm:view_companies',
    'crm:manage_contacts', 'crm:view_contacts',
    'crm:manage_deals', 'crm:view_deals',
    'crm:manage_leads', 'crm:view_leads',
    'crm:manage_pipelines', 'crm:view_pipelines'
  ];

  const createdPerms = [];
  for (const p of perms) {
    const [module, resource, ...actionParts] = p.split(':');
    let perm = await prisma.permission.findFirst({ where: { action: p } });
    if (!perm) {
      perm = await prisma.permission.create({
        data: { action: p, resource: module, description: `Allow ${p}` }
      });
    }
    createdPerms.push(perm);
  }

  const orgAdmins = await prisma.role.findMany({ where: { name: 'org_admin' } });
  
  for (const role of orgAdmins) {
    for (const perm of createdPerms) {
      const existing = await prisma.rolePermission.findFirst({
        where: { roleId: role.id, permissionId: perm.id }
      });
      if (!existing) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: perm.id }
        });
      }
    }
  }
  console.log('Permissions seeded!');
}
seed().catch(console.error);
