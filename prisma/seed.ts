import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create a Super Admin Platform User
  const adminPassword = await bcrypt.hash(env.SUPERADMIN_PASSWORD, 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: env.SUPERADMIN_EMAIL },
    update: {},
    create: {
      email: env.SUPERADMIN_EMAIL,
      passwordHash: adminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      isActive: true,
      isVerified: true,
    }
  });

  console.log(`Created Super Admin: ${superAdmin.email}`);

  // 2. Create Global Platform Roles (if supported, e.g. organizationId = null)
  const platformAdminRole = await prisma.role.create({
    data: {
      name: 'Platform Administrator',
      description: 'Global system administrator',
      isSystem: true,
      organizationId: null
    }
  });

  // 3. Create a Test Organization
  const testOrg = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      domain: 'acme.com',
      status: 'active',
    }
  });

  console.log(`Created Organization: ${testOrg.name}`);

  // 4. Create Organization Roles
  const orgAdminRole = await prisma.role.create({
    data: {
      name: 'Org Admin',
      description: 'Organization Administrator',
      isSystem: true,
      organizationId: testOrg.id
    }
  });

  // 5. Create Permissions
  const viewMembersPerm = await prisma.permission.upsert({
    where: { action_resource: { action: 'view:members', resource: 'member' } },
    update: {},
    create: { action: 'view:members', resource: 'member' }
  });
  
  const manageMembersPerm = await prisma.permission.upsert({
    where: { action_resource: { action: 'manage:members', resource: 'member' } },
    update: {},
    create: { action: 'manage:members', resource: 'member' }
  });

  const manageOrgSettingsPerm = await prisma.permission.upsert({
    where: { action_resource: { action: 'manage:organization_settings', resource: 'organization' } },
    update: {},
    create: { action: 'manage:organization_settings', resource: 'organization' }
  });

  // Dynamic seeding of HRMS and CRM permissions
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

  const appPerms = [];
  for (const p of perms) {
    const [module, resource] = p.split(':');
    let perm = await prisma.permission.findFirst({ where: { action: p } });
    if (!perm) {
      perm = await prisma.permission.create({
        data: { action: p, resource: module, description: `Allow ${p}` }
      });
    }
    appPerms.push(perm);
  }

  // 6. Assign Permissions to Role
  await prisma.rolePermission.createMany({
    data: [
      { roleId: orgAdminRole.id, permissionId: viewMembersPerm.id },
      { roleId: orgAdminRole.id, permissionId: manageMembersPerm.id },
      { roleId: orgAdminRole.id, permissionId: manageOrgSettingsPerm.id },
      ...appPerms.map(p => ({ roleId: orgAdminRole.id, permissionId: p.id }))
    ],
    skipDuplicates: true
  });

  // 7. Create Organization Admin User and Membership
  const orgAdminPassword = await bcrypt.hash(env.SUPERADMIN_PASSWORD, 10);
  const orgAdminUser = await prisma.user.upsert({
    where: { email: 'admin@acme.com' },
    update: {},
    create: {
      email: 'admin@acme.com',
      passwordHash: orgAdminPassword,
      firstName: 'Acme',
      lastName: 'Admin',
      isActive: true,
      isVerified: true,
    }
  });

  const membership = await prisma.organizationMembership.create({
    data: {
      organizationId: testOrg.id,
      userId: orgAdminUser.id,
      status: 'active'
    }
  });

  await prisma.membershipRole.create({
    data: {
      membershipId: membership.id,
      roleId: orgAdminRole.id
    }
  });

  // 8. Create Organization B
  const orgB = await prisma.organization.upsert({
    where: { slug: 'beta-corp' },
    update: {},
    create: {
      name: 'Beta Corporation',
      slug: 'beta-corp',
      domain: 'beta.com',
      status: 'active',
    }
  });

  const userB = await prisma.user.upsert({
    where: { email: 'admin@beta.com' },
    update: {},
    create: {
      email: 'admin@beta.com',
      passwordHash: orgAdminPassword,
      firstName: 'Beta',
      lastName: 'Admin',
      isActive: true,
    }
  });

  await prisma.organizationMembership.create({
    data: {
      organizationId: orgB.id,
      userId: userB.id,
      status: 'active'
    }
  });

  // 9. Register Modules
  const crmModule = await prisma.module.upsert({
    where: { id: 'crm' },
    update: {},
    create: {
      id: 'crm',
      name: 'CRM',
      description: 'Customer Relationship Management',
      version: '1.0.0',
      isGlobal: false
    }
  });

  const hrmsModule = await prisma.module.upsert({
    where: { id: 'hrms' },
    update: {},
    create: {
      id: 'hrms',
      name: 'HRMS',
      description: 'Human Resources Management System',
      version: '1.0.0',
      isGlobal: false
    }
  });

  // 10. Create Subscription Plans
  const basicPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Basic',
      description: 'Core dashboard and limited usage.',
      price: 0.0,
      isDefault: true,
      entitlements: {
        create: [
          { limitKey: 'max_users', limitValue: 5 }
        ]
      }
    }
  });

  const growthPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Growth',
      description: 'Unlock CRM & HRMS for growing teams.',
      price: 49.0,
      isDefault: false,
      entitlements: {
        create: [
          { limitKey: 'max_users', limitValue: 20 },
          { moduleId: crmModule.id },
          { moduleId: hrmsModule.id }
        ]
      }
    }
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
