import { prisma } from '../utils/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { AuditLogService } from './audit.service';

export class OrganizationService {
  static async createOrganization(userId: string, data: { name: string; slug: string; domain?: string }) {
    // Validate slug uniqueness
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: data.slug }
    });

    if (existingOrg) {
      throw new BadRequestError('Organization slug is already taken');
    }

    // Atomic transaction for Organization creation
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch default plan
      const defaultPlan = await tx.subscriptionPlan.findFirst({
        where: { isDefault: true, isActive: true }
      });
      if (!defaultPlan) {
        throw new BadRequestError('Platform configuration error: No default subscription plan exists.');
      }

      // 2. Create Organization
      const org = await tx.organization.create({
        data: {
          name: data.name,
          slug: data.slug,
          domain: data.domain,
          status: 'active'
        }
      });

      // 2. Create Default Roles (Admin, Member)
      const adminRole = await tx.role.create({
        data: {
          organizationId: org.id,
          name: 'Admin',
          description: 'Organization Administrator',
          isSystem: true
        }
      });

      const memberRole = await tx.role.create({
        data: {
          organizationId: org.id,
          name: 'Member',
          description: 'Standard Member',
          isSystem: true
        }
      });

      // (We could assign permissions to these roles here if we had permission seeds)
      // e.g., create permissions for 'manage:organization', 'view:users', etc.

      // 3. Create Membership for creator
      const membership = await tx.organizationMembership.create({
        data: {
          organizationId: org.id,
          userId: userId,
          status: 'active'
        }
      });

      // 4. Assign Admin Role to creator's membership
      await tx.membershipRole.create({
        data: {
          membershipId: membership.id,
          roleId: adminRole.id
        }
      });

      // 5. Create Initial Subscription (Basic Plan)
      const now = new Date();
      const endDate = new Date(now);
      endDate.setMonth(now.getMonth() + (defaultPlan.interval === 'year' ? 12 : 1));

      await tx.subscription.create({
        data: {
          organizationId: org.id,
          planId: defaultPlan.id,
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: endDate,
        }
      });

      // 6. Audit Log
      await AuditLogService.log({
        organizationId: org.id,
        userId: userId,
        action: 'organization.create',
        status: 'success',
      }, tx);

      return org;
    });

    return result;
  }

  static async getOrganization(organizationId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId }
    });
    if (!org) throw new NotFoundError('Organization not found');
    return org;
  }

  static async updateSettings(organizationId: string, data: any) {
    return prisma.$transaction(async (tx) => {
      const settings = await tx.organizationSetting.upsert({
        where: { organizationId },
        update: {
          branding: data.branding,
          localization: data.localization
        },
        create: {
          organizationId,
          branding: data.branding,
          localization: data.localization
        }
      });

      await AuditLogService.log({
        organizationId,
        action: 'organization.settings_updated',
        status: 'success',
      }, tx);

      return settings;
    });
  }
}
