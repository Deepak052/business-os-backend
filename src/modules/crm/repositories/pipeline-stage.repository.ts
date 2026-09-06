import { BaseRepository } from '../../../repositories/base.repository';
import { prisma } from '../../../utils/prisma';

export class PipelineStageRepository extends BaseRepository<typeof prisma.crmPipelineStage> {
  constructor() {
    super(prisma.crmPipelineStage as any);
  }
}

export const pipelineStageRepository = new PipelineStageRepository();
