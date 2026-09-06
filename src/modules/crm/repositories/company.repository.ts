import { BaseRepository } from '../../../repositories/base.repository';
import { prisma } from '../../../utils/prisma';

export class CompanyRepository extends BaseRepository<typeof prisma.crmCompany> {
  constructor() {
    // We pass the delegate to the BaseRepository
    super(prisma.crmCompany as any);
  }

  // Add custom CRM company specific methods here if needed, 
  // BaseRepository already handles findByIdAndTenant, createForTenant, etc.
}

export const companyRepository = new CompanyRepository();
