import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { AuditLogService } from './audit.service';

export class MembershipService {
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  static async inviteUser(organizationId: string, inviterId: string, email: string, roleId: string, departmentId?: string, teamId?: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Quota Check (EntitlementService.checkQuota already counts active memberships + pending invitations)
      const { EntitlementService } = require('./entitlement.service');
      await EntitlementService.checkQuota(organizationId, 'max_users', 1, tx);

      // Check if user is already an active/disabled member
      const existingUser = await tx.user.findUnique({ where: { email } });
      if (existingUser) {
        const existingMembership = await tx.organizationMembership.findUnique({
          where: {
            organizationId_userId: {
              organizationId,
              userId: existingUser.id,
            },
          },
        });

        if (existingMembership && existingMembership.status !== 'removed') {
          throw new BadRequestError('User is already a member of this organization');
        }
      }

      // Check duplicate pending invite
      const duplicateInvite = await tx.invitation.findFirst({
        where: { organizationId, email, status: 'pending' }
      });
      if (duplicateInvite) {
        throw new BadRequestError('A pending invitation already exists for this email');
      }

      // Verify role
      const role = await tx.role.findFirst({
        where: { id: roleId, OR: [{ organizationId }, { organizationId: null, isSystem: true }] }
      });
      if (!role) throw new BadRequestError('Invalid role specified');

      // Verify dept/team
      if (departmentId) {
        const dept = await tx.department.findFirst({ where: { id: departmentId, organizationId } });
        if (!dept) throw new BadRequestError('Invalid department specified');
      }
      if (teamId) {
        const team = await tx.team.findFirst({ where: { id: teamId, organizationId } });
        if (!team) throw new BadRequestError('Invalid team specified');
      }

      // Generate & Hash Token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = this.hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invitation = await tx.invitation.create({
        data: {
          organizationId,
          email,
          roleId,
          departmentId,
          teamId,
          token: hashedToken,
          expiresAt,
          status: 'pending',
        },
      });

      await AuditLogService.log({
        organizationId,
        userId: inviterId,
        action: 'member.invite',
        status: 'success',
        reason: `Invited ${email}`,
      }, tx);

      // Return raw token for email delivery
      return { ...invitation, rawToken };
    });
  }

  static async validateInvitation(rawToken: string) {
    const hashedToken = this.hashToken(rawToken);
    const invitation = await prisma.invitation.findUnique({
      where: { token: hashedToken },
    });

    if (!invitation) throw new NotFoundError('Invalid invitation');
    
    // Lazy expiration
    if (invitation.status === 'pending' && invitation.expiresAt < new Date()) {
      await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'expired' } });
      throw new BadRequestError('INVITATION_EXPIRED');
    }

    if (invitation.status === 'revoked') throw new BadRequestError('INVITATION_REVOKED');
    if (invitation.status === 'accepted') throw new BadRequestError('INVITATION_ALREADY_USED');
    if (invitation.status !== 'pending') throw new BadRequestError('INVALID_INVITATION');

    return invitation;
  }

  static async acceptExistingUserInvitation(userId: string, rawToken: string) {
    const invitation = await this.validateInvitation(rawToken);

    // Verify email matches
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.email !== invitation.email) {
      throw new BadRequestError('This invitation belongs to a different email address');
    }

    return prisma.$transaction(async (tx) => {
      // Create/Re-activate membership
      const existingMembership = await tx.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: invitation.organizationId, userId } }
      });

      let membership;
      if (existingMembership) {
        if (existingMembership.status !== 'removed') throw new BadRequestError('User is already a member');
        membership = await tx.organizationMembership.update({
          where: { id: existingMembership.id },
          data: { status: 'active', departmentId: invitation.departmentId, teamId: invitation.teamId, disabledAt: null, removedAt: null }
        });
      } else {
        membership = await tx.organizationMembership.create({
          data: {
            organizationId: invitation.organizationId,
            userId: userId,
            departmentId: invitation.departmentId,
            teamId: invitation.teamId,
            status: 'active',
          },
        });
      }

      await tx.membershipRole.deleteMany({ where: { membershipId: membership.id } });
      await tx.membershipRole.create({
        data: { membershipId: membership.id, roleId: invitation.roleId },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      });

      await AuditLogService.log({
        organizationId: invitation.organizationId,
        userId: userId,
        action: 'member.joined',
        status: 'success',
      }, tx);

      return membership;
    });
  }

  static async resendInvitation(organizationId: string, inviterId: string, invitationId: string) {
    return prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({ where: { id: invitationId } });
      if (!invitation || invitation.organizationId !== organizationId) throw new NotFoundError('Invitation not found');
      if (invitation.status !== 'pending') throw new BadRequestError('Only pending invitations can be resent');

      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = this.hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const updated = await tx.invitation.update({
        where: { id: invitationId },
        data: { token: hashedToken, expiresAt }
      });

      await AuditLogService.log({
        organizationId,
        userId: inviterId,
        action: 'invitation.resend',
        status: 'success',
        targetId: invitationId,
        targetType: 'invitation'
      }, tx);

      return { ...updated, rawToken };
    });
  }

  static async revokeInvitation(organizationId: string, inviterId: string, invitationId: string) {
    return prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({ where: { id: invitationId } });
      if (!invitation || invitation.organizationId !== organizationId) throw new NotFoundError('Invitation not found');
      if (invitation.status !== 'pending') throw new BadRequestError('Only pending invitations can be revoked');

      const updated = await tx.invitation.update({
        where: { id: invitationId },
        data: { status: 'revoked', revokedAt: new Date() }
      });

      await AuditLogService.log({
        organizationId,
        userId: inviterId,
        action: 'invitation.revoke',
        status: 'success',
        targetId: invitationId,
        targetType: 'invitation'
      }, tx);

      return updated;
    });
  }

  static async getMembers(organizationId: string) {
    return prisma.organizationMembership.findMany({
      where: { organizationId, status: { not: 'removed' } },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        roles: { include: { role: true } },
        department: true,
        team: true
      },
    });
  }
  
  static async getInvitations(organizationId: string) {
    return prisma.invitation.findMany({
      where: { organizationId },
      include: { role: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async updateMembership(
    organizationId: string, 
    inviterId: string, 
    membershipId: string, 
    data: { roleId?: string, departmentId?: string | null, teamId?: string | null }
  ) {
    const membership = await prisma.organizationMembership.findUnique({ where: { id: membershipId }, include: { roles: true } });
    if (!membership || membership.organizationId !== organizationId) throw new NotFoundError('Membership not found');
    if (membership.status === 'removed') throw new BadRequestError('Cannot modify a removed membership');

    return prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
      if (data.teamId !== undefined) updateData.teamId = data.teamId;

      const mem = await tx.organizationMembership.update({
        where: { id: membershipId },
        data: updateData
      });

      if (data.roleId) {
        await tx.membershipRole.deleteMany({ where: { membershipId } });
        await tx.membershipRole.create({
          data: { membershipId, roleId: data.roleId }
        });

        await AuditLogService.log({
          organizationId,
          userId: inviterId,
          action: 'role.assigned',
          status: 'success',
          targetId: data.roleId,
          targetType: 'role',
          reason: `Assigned role to membership ${membershipId}`
        }, tx);
      }

      await AuditLogService.log({
        organizationId,
        userId: inviterId,
        action: 'membership.update',
        status: 'success',
        targetId: membershipId,
        targetType: 'membership'
      }, tx);

      return mem;
    });
  }

  static async updateMembershipStatus(organizationId: string, inviterId: string, membershipId: string, status: 'active' | 'disabled') {
    return prisma.$transaction(async (tx) => {
      const membership = await tx.organizationMembership.findUnique({ where: { id: membershipId } });
      if (!membership || membership.organizationId !== organizationId) throw new NotFoundError('Membership not found');
      if (membership.status === 'removed') throw new BadRequestError('Cannot modify a removed membership');

      const updated = await tx.organizationMembership.update({
        where: { id: membershipId },
        data: { status, disabledAt: status === 'disabled' ? new Date() : null }
      });

      await AuditLogService.log({
        organizationId,
        userId: inviterId,
        action: `membership.${status}`,
        status: 'success',
        targetId: membershipId,
        targetType: 'membership'
      }, tx);

      return updated;
    });
  }

  static async removeMembership(organizationId: string, inviterId: string, membershipId: string) {
    const membership = await prisma.organizationMembership.findUnique({ where: { id: membershipId } });
    if (!membership || membership.organizationId !== organizationId) throw new NotFoundError('Membership not found');
    if (membership.status === 'removed') return; // Idempotent

    await prisma.$transaction(async (tx) => {
      // Logical remove, preserve global identity and history
      await tx.organizationMembership.update({ 
        where: { id: membershipId }, 
        data: { status: 'removed', removedAt: new Date() } 
      });

      await AuditLogService.log({
        organizationId,
        userId: inviterId,
        action: 'membership.removed',
        status: 'success',
        targetId: membershipId,
        targetType: 'membership'
      }, tx);
    });
  }
}
