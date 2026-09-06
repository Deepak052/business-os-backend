import { Response, NextFunction } from 'express';
import { MembershipService } from '../services/membership.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../utils/prisma';
import { NotFoundError, PlatformRoleForbiddenError, SelfPrivilegeEscalationError } from '../utils/errors';
import { RbacDelegationService } from '../services/rbac-delegation.service';

export class MembershipController {
  static async invite(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, roleId, departmentId, teamId } = req.body;
      const orgId = req.organizationId!;
      const inviterId = req.user!.id;

      // Validate Role Assignment Security
      const role = await prisma.role.findUnique({
        where: { id: roleId },
        include: { permissions: true }
      });
      
      if (!role) throw new NotFoundError('Role not found');
      if (role.organizationId === null) throw new PlatformRoleForbiddenError('Platform roles cannot be assigned by tenant admins');
      if (role.organizationId !== orgId) throw new NotFoundError('Role not found in this organization');

      const permissionIds = role.permissions.map(p => p.permissionId);
      if (permissionIds.length > 0) {
        await RbacDelegationService.validateDelegation(req, permissionIds);
      }

      const invitation = await MembershipService.inviteUser(orgId, inviterId, email, roleId, departmentId, teamId);
      return sendSuccess(res, invitation, 'Invitation sent successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async accept(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { token } = req.body;
      const membership = await MembershipService.acceptExistingUserInvitation(req.user!.id, token);
      return sendSuccess(res, membership, 'Invitation accepted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const members = await MembershipService.getMembers(req.organizationId!);
      return sendSuccess(res, members, 'Members retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async listInvitations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const invitations = await MembershipService.getInvitations(req.organizationId!);
      return sendSuccess(res, invitations, 'Invitations retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { roleId, departmentId, teamId } = req.body;
      const orgId = req.organizationId!;
      
      const membership = await prisma.organizationMembership.findUnique({ where: { id } });
      if (!membership || membership.organizationId !== orgId) {
        throw new NotFoundError('Membership not found');
      }

      if (roleId) {
        // Prevent Self-Escalation
        if (membership.userId === req.user!.id) {
          throw new SelfPrivilegeEscalationError('You cannot alter your own role assignments to escalate privileges.');
        }

        const role = await prisma.role.findUnique({ where: { id: roleId }, include: { permissions: true } });
        
        if (!role) throw new NotFoundError('Role not found');
        if (role.organizationId === null) throw new PlatformRoleForbiddenError('Platform roles cannot be assigned by tenant admins');
        if (role.organizationId !== orgId) throw new NotFoundError('Role not found in this organization');

        const permissionIds = role.permissions.map(p => p.permissionId);
        if (permissionIds.length > 0) {
          await RbacDelegationService.validateDelegation(req, permissionIds);
        }
      }

      const updatedMembership = await MembershipService.updateMembership(orgId, req.user!.id, id, { roleId, departmentId, teamId });
      return sendSuccess(res, updatedMembership, 'Membership updated');
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { status } = req.body; // 'active' | 'disabled'
      const membership = await MembershipService.updateMembershipStatus(req.organizationId!, req.user!.id, id, status);
      return sendSuccess(res, membership, `Membership status updated to ${status}`);
    } catch (error) {
      next(error);
    }
  }

  static async resendInvitation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const invitation = await MembershipService.resendInvitation(req.organizationId!, req.user!.id, id);
      return sendSuccess(res, invitation, 'Invitation resent');
    } catch (error) {
      next(error);
    }
  }

  static async revokeInvitation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const invitation = await MembershipService.revokeInvitation(req.organizationId!, req.user!.id, id);
      return sendSuccess(res, invitation, 'Invitation revoked');
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await MembershipService.removeMembership(req.organizationId!, req.user!.id, id);
      return sendSuccess(res, null, 'Membership removed');
    } catch (error) {
      next(error);
    }
  }
}
