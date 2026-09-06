import { BaseRepository } from '../../../repositories/base.repository';
import { prisma } from '../../../utils/prisma';

export class LeadRepository extends BaseRepository<typeof prisma.crmLead> {
  constructor() {
    super(prisma.crmLead as any);
  }
}

export const leadRepository = new LeadRepository();
