import { Router } from 'express';
import { CrmController } from '../controllers/crm.controller';
import { requireAuth } from '../../../middlewares/auth.middleware';
import { requireTenant } from '../../../middlewares/tenant.middleware';
import { requireModuleAccess } from '../../../middlewares/module.middleware';
import { requireActiveSubscriptionForWrites } from '../../../middlewares/entitlement.middleware';
import { requirePermission } from '../../../middlewares/rbac.middleware';

const router = Router();

// Module Integration Contract:
// 1. Auth 
// 2. Tenant
// 3. Module Entitlement
// 4. Feature/RBAC Permissions
// 5. Subscription Enforcements
router.use(requireAuth);
router.use(requireTenant);
router.use(requireModuleAccess('crm_module')); // This key matches our seed script registration
router.use(requireActiveSubscriptionForWrites);

// Companies
router.post('/companies', requirePermission('crm:manage_companies'), CrmController.createCompany);
router.get('/companies', requirePermission('crm:view_companies'), CrmController.listCompanies);
router.get('/companies/:id', requirePermission('crm:view_companies'), CrmController.getCompany);
router.patch('/companies/:id', requirePermission('crm:manage_companies'), CrmController.updateCompany);
router.delete('/companies/:id', requirePermission('crm:manage_companies'), CrmController.deleteCompany);

// Contacts
router.post('/contacts', requirePermission('crm:manage_contacts'), CrmController.createContact);
router.get('/contacts', requirePermission('crm:view_contacts'), CrmController.listContacts);
router.get('/contacts/:id', requirePermission('crm:view_contacts'), CrmController.getContact);
router.patch('/contacts/:id', requirePermission('crm:manage_contacts'), CrmController.updateContact);
router.delete('/contacts/:id', requirePermission('crm:manage_contacts'), CrmController.deleteContact);

// Deals
router.post('/deals', requirePermission('crm:manage_deals'), CrmController.createDeal);
router.get('/deals', requirePermission('crm:view_deals'), CrmController.listDeals);
router.get('/deals/:id', requirePermission('crm:view_deals'), CrmController.getDeal);
router.patch('/deals/:id', requirePermission('crm:manage_deals'), CrmController.updateDeal);
router.delete('/deals/:id', requirePermission('crm:manage_deals'), CrmController.deleteDeal);

// Leads
router.post('/leads', requirePermission('crm:manage_leads'), CrmController.createLead);
router.get('/leads', requirePermission('crm:view_leads'), CrmController.listLeads);
router.get('/leads/:id', requirePermission('crm:view_leads'), CrmController.getLead);
router.patch('/leads/:id', requirePermission('crm:manage_leads'), CrmController.updateLead);
router.delete('/leads/:id', requirePermission('crm:manage_leads'), CrmController.deleteLead);

// Pipelines
router.post('/pipelines', requirePermission('crm:manage_pipelines'), CrmController.createPipeline);
router.get('/pipelines', requirePermission('crm:view_pipelines'), CrmController.listPipelines);
router.get('/pipelines/:id', requirePermission('crm:view_pipelines'), CrmController.getPipeline);
router.patch('/pipelines/:id', requirePermission('crm:manage_pipelines'), CrmController.updatePipeline);
router.delete('/pipelines/:id', requirePermission('crm:manage_pipelines'), CrmController.deletePipeline);

// Pipeline Stages
router.post('/pipelines/:pipelineId/stages', requirePermission('crm:manage_pipelines'), CrmController.createStage);
router.get('/pipelines/:pipelineId/stages', requirePermission('crm:view_pipelines'), CrmController.listStages);
router.get('/pipelines/:pipelineId/stages/:stageId', requirePermission('crm:view_pipelines'), CrmController.getStage);
router.patch('/pipelines/:pipelineId/stages/:stageId', requirePermission('crm:manage_pipelines'), CrmController.updateStage);
router.delete('/pipelines/:pipelineId/stages/:stageId', requirePermission('crm:manage_pipelines'), CrmController.deleteStage);

export default router;
