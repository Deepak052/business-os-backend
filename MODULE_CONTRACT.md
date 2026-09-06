# Business OS Module Integration Contract

This document defines the strict architectural flow for adding future business modules (e.g., CRM, HRMS, Finance, Marketing, Projects) to the Platform Core.

## 1. Module Registration
Every module must register its existence and prerequisites in the Platform Core `ModuleRegistry`. This metadata determines entitlement, activation limits, and global visibility.

```json
{
  "id": "crm",
  "name": "Customer Relationship Management",
  "version": "1.0.0",
  "isGlobal": false,
  "isActive": true
}
```

## 2. Database Models
Module entities **must** be stored in the unified `schema.prisma`. Every tenant-scoped entity MUST include:
- `id String @id @default(uuid())`
- `organizationId String`
- Relation to `Organization` using `onDelete: Cascade` (or appropriate restriction).
- `createdAt` / `updatedAt` audit fields.

## 3. Repositories
Repositories must extend the `BaseRepository` to ensure tenant isolation:
```typescript
import { BaseRepository } from '../../repositories/base.repository';
import { prisma } from '../../utils/prisma';

export class DealRepository extends BaseRepository<typeof prisma.crmDeal> {
  constructor() { super(prisma.crmDeal); }
}
```

## 4. Authorization & Policies (Middlewares)
Every module API endpoint must be protected by the platform's standardized middleware stack in this exact order:
1. `requireAuth` (Validates user session)
2. `requireTenant` (Validates user's membership in `x-organization-id`)
3. `requireModuleAccess('crm')` (Validates subscription entitlement & org activation)
4. `requirePermission('crm:manage_deals')` (Validates specific RBAC role permission)
5. *(Optional)* `checkQuota('max_deals', 1)`
6. *(Optional)* `requireFeatureAccess('advanced_forecasting')`

## 5. Services & Controllers
- Controllers MUST be thin wrappers that handle HTTP I/O and call Services.
- Services MUST execute business logic, trigger cross-module boundaries (like sending Notifications via `NotificationService`), and append audit events to `AuditLogService`.
- Services MUST NEVER trust client-provided `organizationId` or `userId` when deriving context.

## 6. Routes
Module routes are mounted under the modular prefix (e.g., `/api/v1/crm/*`) and registered in the central `routes/index.ts`.
