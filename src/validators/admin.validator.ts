import { z } from 'zod';

export const updateUserStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean(),
  }),
});

export const updateOrganizationStatusSchema = z.object({
  body: z.object({
    status: z.enum(['active', 'suspended', 'archived']),
  }),
});

export const registerModuleSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    version: z.string().optional(),
    description: z.string().optional(),
    isGlobal: z.boolean().optional(),
    status: z.enum(['active', 'disabled', 'deprecated', 'archived']).optional(),
  }),
});

export const toggleModuleStatusSchema = z.object({
  body: z.object({
    status: z.enum(['active', 'disabled', 'deprecated', 'archived']),
  }),
});

export const createPlanSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    price: z.number().min(0, 'Price must be positive'),
    currency: z.string().default('USD'),
    interval: z.enum(['month', 'year']),
    trialDays: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
    entitlements: z.array(z.object({
      moduleId: z.string().optional(),
      featureKey: z.string().optional(),
      limitKey: z.string().optional(),
      limitValue: z.number().optional()
    })).optional(),
  }),
});

export const assignSubscriptionSchema = z.object({
  body: z.object({
    orgId: z.string().uuid('Invalid organization ID'),
    planId: z.string().uuid('Invalid plan ID'),
  }),
});

export const createFeatureFlagSchema = z.object({
  body: z.object({
    key: z.string().min(1, 'Key is required'),
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    isEnabled: z.boolean().optional(),
  }),
});

export const provisionOrganizationSchema = z.object({
  body: z.object({
    orgName: z.string().min(1, 'Organization Name is required'),
    slug: z.string().min(1, 'Slug is required'),
    domain: z.string().optional(),
    planId: z.string().uuid('Invalid Plan ID'),
    adminEmail: z.string().email('Invalid email'),
    adminFirstName: z.string().min(1, 'First Name is required'),
    adminLastName: z.string().optional(),
  }),
});

export const toggleFeatureFlagSchema = z.object({
  body: z.object({
    isEnabled: z.boolean(),
  }),
});

export const updatePlanSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    price: z.number().min(0).optional(),
    currency: z.string().optional(),
    interval: z.enum(['month', 'year']).optional(),
    trialDays: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updatePlanEntitlementsSchema = z.object({
  body: z.object({
    entitlements: z.array(z.object({
      moduleId: z.string().optional(),
      featureKey: z.string().optional(),
      limitKey: z.string().optional(),
      limitValue: z.number().optional()
    })),
  }),
});

export const updateModuleSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    version: z.string().optional(),
    description: z.string().optional(),
    isGlobal: z.boolean().optional(),
  }),
});

export const createPermissionSchema = z.object({
  body: z.object({
    action: z.string().min(1),
    resource: z.string().min(1),
    description: z.string().optional(),
    moduleId: z.string().optional(),
    isDelegatable: z.boolean().optional(),
  }),
});

export const updatePermissionSchema = z.object({
  body: z.object({
    action: z.string().optional(),
    resource: z.string().optional(),
    description: z.string().optional(),
    moduleId: z.string().optional(),
    isDelegatable: z.boolean().optional(),
  }),
});
