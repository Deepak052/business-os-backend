import { z } from 'zod';

export const createOrganizationSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
    domain: z.string().optional(),
  }),
});

export const updateSettingsSchema = z.object({
  body: z.object({
    branding: z.object({
      logoUrl: z.string().url('Must be a valid URL').optional().nullable(),
      primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color').optional().nullable(),
      secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color').optional().nullable(),
      theme: z.enum(['light', 'dark', 'system']).optional().nullable(),
      displayName: z.string().optional().nullable(),
    }).optional(),
    localization: z.any().optional(),
  }),
});

export const createTeamSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
  }),
});

export const createDepartmentSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
  }),
});
