import { prisma } from '../utils/prisma';
import { NotFoundError } from '../utils/errors';

export class JobService {
  static async createImportJob(data: {
    organizationId: string;
    userId: string;
    moduleKey: string;
    entityType: string;
    fileId?: string;
    mappings?: any;
  }) {
    return prisma.importJob.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId,
        moduleKey: data.moduleKey,
        entityType: data.entityType,
        fileId: data.fileId,
        mappings: data.mappings,
        status: 'pending'
      }
    });
  }

  static async getImportJob(jobId: string, organizationId: string) {
    const job = await prisma.importJob.findFirst({
      where: { id: jobId, organizationId }
    });
    if (!job) throw new NotFoundError('Import job not found');
    return job;
  }

  static async updateImportProgress(jobId: string, processed: number, failed: number, errors?: any) {
    return prisma.importJob.update({
      where: { id: jobId },
      data: {
        processedRows: processed,
        failedRows: failed,
        errors,
        status: failed > 0 ? 'failed' : 'processing'
      }
    });
  }

  static async createExportJob(data: {
    organizationId: string;
    userId: string;
    moduleKey: string;
    entityType: string;
    filters?: any;
  }) {
    return prisma.exportJob.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId,
        moduleKey: data.moduleKey,
        entityType: data.entityType,
        filters: data.filters,
        status: 'pending'
      }
    });
  }
}
