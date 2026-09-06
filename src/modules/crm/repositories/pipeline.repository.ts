import { BaseRepository } from '../../../repositories/base.repository';
import { prisma } from '../../../utils/prisma';

export class PipelineRepository extends BaseRepository<typeof prisma.crmPipeline> {
  constructor() {
    super(prisma.crmPipeline as any);
  }
}

export const pipelineRepository = new PipelineRepository();
