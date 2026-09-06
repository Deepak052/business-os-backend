import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../middlewares/auth.middleware';
import { sendSuccess } from '../../../utils/response';
import { CrmService } from '../services/crm.service';

export class CrmController {
  // ---------------------------------------------------------
  // COMPANIES
  // ---------------------------------------------------------
  static async createCompany(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const company = await CrmService.createCompany(req.organizationId!, req.user!.id, req.body);
      return sendSuccess(res, company, 'Company created', 201);
    } catch (error) { next(error); }
  }

  static async listCompanies(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companies = await CrmService.getCompanies(req.organizationId!, req.query);
      return sendSuccess(res, companies, 'Companies retrieved');
    } catch (error) { next(error); }
  }

  static async getCompany(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const company = await CrmService.getCompany(req.organizationId!, req.params.id as string);
      return sendSuccess(res, company, 'Company retrieved');
    } catch (error) { next(error); }
  }

  static async updateCompany(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const company = await CrmService.updateCompany(req.organizationId!, req.params.id as string, req.user!.id, req.body);
      return sendSuccess(res, company, 'Company updated');
    } catch (error) { next(error); }
  }

  static async deleteCompany(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await CrmService.deleteCompany(req.organizationId!, req.params.id as string, req.user!.id);
      return sendSuccess(res, null, 'Company deleted');
    } catch (error) { next(error); }
  }

  // ---------------------------------------------------------
  // CONTACTS
  // ---------------------------------------------------------
  static async createContact(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const contact = await CrmService.createContact(req.organizationId!, req.user!.id, req.body);
      return sendSuccess(res, contact, 'Contact created', 201);
    } catch (error) { next(error); }
  }

  static async listContacts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const contacts = await CrmService.getContacts(req.organizationId!, req.query);
      return sendSuccess(res, contacts, 'Contacts retrieved');
    } catch (error) { next(error); }
  }

  static async getContact(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const contact = await CrmService.getContact(req.organizationId!, req.params.id as string);
      return sendSuccess(res, contact, 'Contact retrieved');
    } catch (error) { next(error); }
  }

  static async updateContact(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const contact = await CrmService.updateContact(req.organizationId!, req.params.id as string, req.user!.id, req.body);
      return sendSuccess(res, contact, 'Contact updated');
    } catch (error) { next(error); }
  }

  static async deleteContact(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await CrmService.deleteContact(req.organizationId!, req.params.id as string, req.user!.id);
      return sendSuccess(res, null, 'Contact deleted');
    } catch (error) { next(error); }
  }

  // ---------------------------------------------------------
  // DEALS
  // ---------------------------------------------------------
  static async createDeal(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const deal = await CrmService.createDeal(req.organizationId!, req.user!.id, req.body);
      return sendSuccess(res, deal, 'Deal created', 201);
    } catch (error) { next(error); }
  }

  static async listDeals(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const deals = await CrmService.getDeals(req.organizationId!, req.query);
      return sendSuccess(res, deals, 'Deals retrieved');
    } catch (error) { next(error); }
  }

  static async getDeal(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const deal = await CrmService.getDeal(req.organizationId!, req.params.id as string);
      return sendSuccess(res, deal, 'Deal retrieved');
    } catch (error) { next(error); }
  }

  static async updateDeal(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const deal = await CrmService.updateDeal(req.organizationId!, req.params.id as string, req.user!.id, req.body);
      return sendSuccess(res, deal, 'Deal updated');
    } catch (error) { next(error); }
  }

  static async deleteDeal(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await CrmService.deleteDeal(req.organizationId!, req.params.id as string, req.user!.id);
      return sendSuccess(res, null, 'Deal deleted');
    } catch (error) { next(error); }
  }

  // ---------------------------------------------------------
  // LEADS
  // ---------------------------------------------------------
  static async createLead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const lead = await CrmService.createLead(req.organizationId!, req.user!.id, req.body);
      return sendSuccess(res, lead, 'Lead created', 201);
    } catch (error) { next(error); }
  }

  static async listLeads(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const leads = await CrmService.getLeads(req.organizationId!, req.query);
      return sendSuccess(res, leads, 'Leads retrieved');
    } catch (error) { next(error); }
  }

  static async getLead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const lead = await CrmService.getLead(req.organizationId!, req.params.id as string);
      return sendSuccess(res, lead, 'Lead retrieved');
    } catch (error) { next(error); }
  }

  static async updateLead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const lead = await CrmService.updateLead(req.organizationId!, req.params.id as string, req.user!.id, req.body);
      return sendSuccess(res, lead, 'Lead updated');
    } catch (error) { next(error); }
  }

  static async deleteLead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await CrmService.deleteLead(req.organizationId!, req.params.id as string, req.user!.id);
      return sendSuccess(res, null, 'Lead deleted');
    } catch (error) { next(error); }
  }

  // ---------------------------------------------------------
  // PIPELINES
  // ---------------------------------------------------------
  static async createPipeline(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipeline = await CrmService.createPipeline(req.organizationId!, req.user!.id, req.body);
      return sendSuccess(res, pipeline, 'Pipeline created', 201);
    } catch (error) { next(error); }
  }

  static async listPipelines(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipelines = await CrmService.getPipelines(req.organizationId!, req.query);
      return sendSuccess(res, pipelines, 'Pipelines retrieved');
    } catch (error) { next(error); }
  }

  static async getPipeline(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipeline = await CrmService.getPipeline(req.organizationId!, req.params.id as string);
      return sendSuccess(res, pipeline, 'Pipeline retrieved');
    } catch (error) { next(error); }
  }

  static async updatePipeline(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipeline = await CrmService.updatePipeline(req.organizationId!, req.params.id as string, req.user!.id, req.body);
      return sendSuccess(res, pipeline, 'Pipeline updated');
    } catch (error) { next(error); }
  }

  static async deletePipeline(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await CrmService.deletePipeline(req.organizationId!, req.params.id as string, req.user!.id);
      return sendSuccess(res, null, 'Pipeline deleted');
    } catch (error) { next(error); }
  }

  // ---------------------------------------------------------
  // STAGES
  // ---------------------------------------------------------
  static async createStage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipelineId = req.params.pipelineId as string;
      const stage = await CrmService.createStage(req.organizationId!, pipelineId, req.user!.id, req.body);
      return sendSuccess(res, stage, 'Stage created', 201);
    } catch (error) { next(error); }
  }

  static async listStages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipelineId = req.params.pipelineId as string;
      const stages = await CrmService.getStages(req.organizationId!, pipelineId);
      return sendSuccess(res, stages, 'Stages retrieved');
    } catch (error) { next(error); }
  }

  static async getStage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipelineId = req.params.pipelineId as string;
      const stageId = req.params.stageId as string;
      const stage = await CrmService.getStage(req.organizationId!, pipelineId, stageId);
      return sendSuccess(res, stage, 'Stage retrieved');
    } catch (error) { next(error); }
  }

  static async updateStage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipelineId = req.params.pipelineId as string;
      const stageId = req.params.stageId as string;
      const stage = await CrmService.updateStage(req.organizationId!, pipelineId, stageId, req.user!.id, req.body);
      return sendSuccess(res, stage, 'Stage updated');
    } catch (error) { next(error); }
  }

  static async deleteStage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipelineId = req.params.pipelineId as string;
      const stageId = req.params.stageId as string;
      await CrmService.deleteStage(req.organizationId!, pipelineId, stageId, req.user!.id);
      return sendSuccess(res, null, 'Stage deleted');
    } catch (error) { next(error); }
  }
}
