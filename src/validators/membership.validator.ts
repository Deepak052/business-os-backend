import { z } from 'zod';

export const inviteUserSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    roleId: z.string().uuid('Invalid role ID'),
    departmentId: z.string().uuid('Invalid department ID').optional(),
    teamId: z.string().uuid('Invalid team ID').optional(),
  }),
});

export const acceptInviteSchema = z.object({
  body: z.object({
    token: z.string(),
  }),
});
