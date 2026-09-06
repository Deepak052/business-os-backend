import { prisma } from '../utils/prisma';

export function startInvitationSweeper() {
  console.log('[Jobs] Starting invitation expiration sweeper...');

  // Run immediately on start
  sweepInvitations();

  // Then run every hour
  setInterval(sweepInvitations, 60 * 60 * 1000);
}

async function sweepInvitations() {
  try {
    const result = await prisma.invitation.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lt: new Date() }
      },
      data: {
        status: 'expired'
      }
    });

    if (result.count > 0) {
      console.log(`[Jobs] Swept ${result.count} expired invitations`);
    }
  } catch (err) {
    console.error('[Jobs] Error sweeping invitations:', err);
  }
}
