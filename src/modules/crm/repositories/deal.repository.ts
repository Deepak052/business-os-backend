import { BaseRepository } from '../../../repositories/base.repository';
import { prisma } from '../../../utils/prisma';

export class DealRepository extends BaseRepository<typeof prisma.crmDeal> {
  constructor() {
    super(prisma.crmDeal as any);
  }
}

export const dealRepository = new DealRepository();
