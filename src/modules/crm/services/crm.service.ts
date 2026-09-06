import { companyRepository } from '../repositories/company.repository';
import { contactRepository } from '../repositories/contact.repository';
import { dealRepository } from '../repositories/deal.repository';
import { leadRepository } from '../repositories/lead.repository';
import { pipelineRepository } from '../repositories/pipeline.repository';
import { pipelineStageRepository } from '../repositories/pipeline-stage.repository';
import { AuditLogService } from '../../../services/audit.service';
import { NotFoundError } from '../../../utils/errors';

export class CrmService {
  // ---------------------------------------------------------
  // COMPANIES
  // ---------------------------------------------------------
  static async createCompany(organizationId: string, userId: string, data: any) {
    const { EntitlementService } = require('../../../services/entitlement.service');
    const { prisma } = require('../../../utils/prisma');
    
    const company = await prisma.$transaction(async (tx: any) => {
      await EntitlementService.checkQuota(organizationId, 'max_crm_companies', 1, tx);
      return tx.crmCompany.create({
        data: {
          ...data,
          organizationId,
          createdBy: userId,
          updatedBy: userId,
        }
      });
    });
    
    await AuditLogService.log({ organizationId, userId, action: 'crm.company.create', status: 'success' });
    return company;
  }

  static async getCompanies(organizationId: string, filters: any = {}) {
    return companyRepository.findAllByTenant(organizationId, filters);
  }

  static async getCompany(organizationId: string, id: string) {
    const company = await companyRepository.findByIdAndTenant(id, organizationId);
    if (!company) throw new NotFoundError('Company not found');
    return company;
  }

  static async updateCompany(organizationId: string, id: string, userId: string, data: any) {
    const company = await companyRepository.updateForTenant(id, organizationId, { ...data, updatedBy: userId });
    await AuditLogService.log({ organizationId, userId, action: 'crm.company.update', status: 'success' });
    return company;
  }

  static async deleteCompany(organizationId: string, id: string, userId: string) {
    await companyRepository.deleteForTenant(id, organizationId);
    await AuditLogService.log({ organizationId, userId, action: 'crm.company.delete', status: 'success' });
    return { success: true };
  }

  // ---------------------------------------------------------
  // CONTACTS
  // ---------------------------------------------------------
  static async createContact(organizationId: string, userId: string, data: any) {
    const { EntitlementService } = require('../../../services/entitlement.service');
    const { prisma } = require('../../../utils/prisma');
    
    const contact = await prisma.$transaction(async (tx: any) => {
      await EntitlementService.checkQuota(organizationId, 'max_crm_contacts', 1, tx);
      return tx.crmContact.create({
        data: {
          ...data,
          organizationId,
          createdBy: userId,
          updatedBy: userId,
        }
      });
    });

    await AuditLogService.log({ organizationId, userId, action: 'crm.contact.create', status: 'success' });
    return contact;
  }

  static async getContacts(organizationId: string, filters: any = {}) {
    return contactRepository.findAllByTenant(organizationId, filters);
  }

  static async getContact(organizationId: string, id: string) {
    const contact = await contactRepository.findByIdAndTenant(id, organizationId);
    if (!contact) throw new NotFoundError('Contact not found');
    return contact;
  }

  static async updateContact(organizationId: string, id: string, userId: string, data: any) {
    const contact = await contactRepository.updateForTenant(id, organizationId, { ...data, updatedBy: userId });
    await AuditLogService.log({ organizationId, userId, action: 'crm.contact.update', status: 'success' });
    return contact;
  }

  static async deleteContact(organizationId: string, id: string, userId: string) {
    await contactRepository.deleteForTenant(id, organizationId);
    await AuditLogService.log({ organizationId, userId, action: 'crm.contact.delete', status: 'success' });
    return { success: true };
  }

  // ---------------------------------------------------------
  // DEALS
  // ---------------------------------------------------------
  static async createDeal(organizationId: string, userId: string, data: any) {
    const { EntitlementService } = require('../../../services/entitlement.service');
    const { prisma } = require('../../../utils/prisma');
    
    const deal = await prisma.$transaction(async (tx: any) => {
      await EntitlementService.checkQuota(organizationId, 'max_crm_deals', 1, tx);
      return tx.crmDeal.create({
        data: {
          ...data,
          organizationId,
          createdBy: userId,
          updatedBy: userId,
        }
      });
    });

    await AuditLogService.log({ organizationId, userId, action: 'crm.deal.create', status: 'success' });
    return deal;
  }

  static async getDeals(organizationId: string, filters: any = {}) {
    return dealRepository.findAllByTenant(organizationId, filters);
  }

  static async getDeal(organizationId: string, id: string) {
    const deal = await dealRepository.findByIdAndTenant(id, organizationId);
    if (!deal) throw new NotFoundError('Deal not found');
    return deal;
  }

  static async updateDeal(organizationId: string, id: string, userId: string, data: any) {
    const deal = await dealRepository.updateForTenant(id, organizationId, { ...data, updatedBy: userId });
    await AuditLogService.log({ organizationId, userId, action: 'crm.deal.update', status: 'success' });
    return deal;
  }

  static async deleteDeal(organizationId: string, id: string, userId: string) {
    await dealRepository.deleteForTenant(id, organizationId);
    await AuditLogService.log({ organizationId, userId, action: 'crm.deal.delete', status: 'success' });
    return { success: true };
  }

  // ---------------------------------------------------------
  // LEADS
  // ---------------------------------------------------------
  static async createLead(organizationId: string, userId: string, data: any) {
    const { EntitlementService } = require('../../../services/entitlement.service');
    const { prisma } = require('../../../utils/prisma');
    
    const lead = await prisma.$transaction(async (tx: any) => {
      await EntitlementService.checkQuota(organizationId, 'max_crm_leads', 1, tx);
      return tx.crmLead.create({
        data: {
          ...data,
          organizationId,
          createdBy: userId,
          updatedBy: userId,
        }
      });
    });

    await AuditLogService.log({ organizationId, userId, action: 'crm.lead.create', status: 'success' });
    return lead;
  }

  static async getLeads(organizationId: string, filters: any = {}) {
    return leadRepository.findAllByTenant(organizationId, filters);
  }

  static async getLead(organizationId: string, id: string) {
    const lead = await leadRepository.findByIdAndTenant(id, organizationId);
    if (!lead) throw new NotFoundError('Lead not found');
    return lead;
  }

  static async updateLead(organizationId: string, id: string, userId: string, data: any) {
    const lead = await leadRepository.updateForTenant(id, organizationId, { ...data, updatedBy: userId });
    await AuditLogService.log({ organizationId, userId, action: 'crm.lead.update', status: 'success' });
    return lead;
  }

  static async deleteLead(organizationId: string, id: string, userId: string) {
    await leadRepository.deleteForTenant(id, organizationId);
    await AuditLogService.log({ organizationId, userId, action: 'crm.lead.delete', status: 'success' });
    return { success: true };
  }

  // ---------------------------------------------------------
  // PIPELINES
  // ---------------------------------------------------------
  static async createPipeline(organizationId: string, userId: string, data: any) {
    const pipeline = await pipelineRepository.createForTenant(organizationId, {
      ...data,
      createdBy: userId,
      updatedBy: userId,
    });
    await AuditLogService.log({ organizationId, userId, action: 'crm.pipeline.create', status: 'success' });
    return pipeline;
  }

  static async getPipelines(organizationId: string, filters: any = {}) {
    return pipelineRepository.findAllByTenant(organizationId, filters);
  }

  static async getPipeline(organizationId: string, id: string) {
    const pipeline = await pipelineRepository.findByIdAndTenant(id, organizationId);
    if (!pipeline) throw new NotFoundError('Pipeline not found');
    return pipeline;
  }

  static async updatePipeline(organizationId: string, id: string, userId: string, data: any) {
    const pipeline = await pipelineRepository.updateForTenant(id, organizationId, { ...data, updatedBy: userId });
    await AuditLogService.log({ organizationId, userId, action: 'crm.pipeline.update', status: 'success' });
    return pipeline;
  }

  static async deletePipeline(organizationId: string, id: string, userId: string) {
    await pipelineRepository.deleteForTenant(id, organizationId);
    await AuditLogService.log({ organizationId, userId, action: 'crm.pipeline.delete', status: 'success' });
    return { success: true };
  }

  // ---------------------------------------------------------
  // PIPELINE STAGES
  // ---------------------------------------------------------
  static async createStage(organizationId: string, pipelineId: string, userId: string, data: any) {
    const stage = await pipelineStageRepository.createForTenant(organizationId, {
      ...data,
      pipelineId
    });
    await AuditLogService.log({ organizationId, userId, action: 'crm.stage.create', status: 'success' });
    return stage;
  }

  static async getStages(organizationId: string, pipelineId: string) {
    return pipelineStageRepository.findAllByTenant(organizationId, { pipelineId });
  }

  static async getStage(organizationId: string, pipelineId: string, stageId: string) {
    const stage = await pipelineStageRepository.findByIdAndTenant(stageId, organizationId) as any;
    if (!stage || stage.pipelineId !== pipelineId) throw new NotFoundError('Stage not found');
    return stage;
  }

  static async updateStage(organizationId: string, pipelineId: string, stageId: string, userId: string, data: any) {
    const stage = await pipelineStageRepository.updateForTenant(stageId, organizationId, data);
    await AuditLogService.log({ organizationId, userId, action: 'crm.stage.update', status: 'success' });
    return stage;
  }

  static async deleteStage(organizationId: string, pipelineId: string, stageId: string, userId: string) {
    const stage = await pipelineStageRepository.findByIdAndTenant(stageId, organizationId) as any;
    if (!stage || stage.pipelineId !== pipelineId) throw new NotFoundError('Stage not found');
    await pipelineStageRepository.deleteForTenant(stageId, organizationId);
    await AuditLogService.log({ organizationId, userId, action: 'crm.stage.delete', status: 'success' });
    return { success: true };
  }
}
