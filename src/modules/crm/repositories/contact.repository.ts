import { BaseRepository } from '../../../repositories/base.repository';
import { prisma } from '../../../utils/prisma';

export class ContactRepository extends BaseRepository<typeof prisma.crmContact> {
  constructor() {
    super(prisma.crmContact as any);
  }
}

export const contactRepository = new ContactRepository();
