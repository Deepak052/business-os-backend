import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { env } from '../config/env';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../utils/errors';
import crypto from 'crypto';
import { MembershipService } from './membership.service';
import { AuditLogService } from './audit.service';

export class AuthService {
  static async register(data: any) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new BadRequestError('Email is already registered');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
      },
    });

    // We do not login automatically if verification is required, 
    // but for simplicity here we return the user.
    return { id: user.id, email: user.email };
  }

  static async registerInvited(data: { token: string, firstName: string, lastName: string, password: string }) {
    return prisma.$transaction(async (tx) => {
      // 1. Validate Invitation
      const hashedToken = crypto.createHash('sha256').update(data.token).digest('hex');
      const invitation = await tx.invitation.findUnique({ where: { token: hashedToken } });
      
      if (!invitation) throw new NotFoundError('Invalid invitation');
      if (invitation.status === 'pending' && invitation.expiresAt < new Date()) {
        await tx.invitation.update({ where: { id: invitation.id }, data: { status: 'expired' } });
        throw new BadRequestError('INVITATION_EXPIRED');
      }
      if (invitation.status === 'revoked') throw new BadRequestError('INVITATION_REVOKED');
      if (invitation.status === 'accepted') throw new BadRequestError('INVITATION_ALREADY_USED');
      if (invitation.status !== 'pending') throw new BadRequestError('INVALID_INVITATION');

      // 2. Validate/Create User
      let user = await tx.user.findUnique({ where: { email: invitation.email } });
      
      if (!user) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(data.password, salt);
        user = await tx.user.create({
          data: {
            email: invitation.email,
            firstName: data.firstName,
            lastName: data.lastName,
            passwordHash,
            isVerified: true, // Invited users are implicitly verified
          }
        });
      }

      // 3. Create Membership
      const existingMembership = await tx.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } }
      });
      if (existingMembership && existingMembership.status !== 'removed') {
        throw new BadRequestError('User is already an active member of this organization');
      }

      let membership;
      if (existingMembership) {
        membership = await tx.organizationMembership.update({
          where: { id: existingMembership.id },
          data: { status: 'active', departmentId: invitation.departmentId, teamId: invitation.teamId, disabledAt: null, removedAt: null }
        });
      } else {
        membership = await tx.organizationMembership.create({
          data: {
            organizationId: invitation.organizationId,
            userId: user.id,
            departmentId: invitation.departmentId,
            teamId: invitation.teamId,
            status: 'active',
          }
        });
      }

      // 4. Assign Role
      await tx.membershipRole.deleteMany({ where: { membershipId: membership.id } });
      await tx.membershipRole.create({
        data: { membershipId: membership.id, roleId: invitation.roleId }
      });

      // 5. Mark ACCEPTED
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted', acceptedAt: new Date() }
      });

      // 6. Audit Log
      await AuditLogService.log({
        organizationId: invitation.organizationId,
        userId: user.id,
        action: 'member.joined',
        status: 'success',
        reason: 'Accepted invitation via registration',
      }, tx);

      return { id: user.id, email: user.email };
    });
  }

  static async login(data: any, deviceInfo?: string, ipAddress?: string) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid credentials or account inactive');
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);

    if (!isMatch) {
      // Audit log failed login here
      await AuditLogService.log({
        userId: user.id,
        action: 'login',
        status: 'failure',
        reason: 'Invalid password',
        ipAddress,
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    // Create session (stateful) and audit log
    const tokenStr = crypto.randomBytes(32).toString('hex');
    const session = await prisma.$transaction(async (tx) => {
      const sess = await tx.session.create({
        data: {
          userId: user.id,
          token: tokenStr,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          deviceInfo,
          ipAddress,
        },
      });

      await AuditLogService.log({
        userId: user.id,
        action: 'login',
        status: 'success',
        ipAddress,
      }, tx);

      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      return sess;
    });

    // Generate JWT containing session ID and user ID
    const token = jwt.sign(
      { id: user.id, sessionId: session.id },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return { token, user: { id: user.id, email: user.email } };
  }

  static async logout(sessionId: string) {
    await prisma.$transaction(async (tx) => {
      const session = await tx.session.update({
        where: { id: sessionId },
        data: { isRevoked: true },
      });

      await AuditLogService.log({
        userId: session.userId,
        action: 'SESSION_REVOKED',
        status: 'success',
      }, tx);
    });
  }
}
