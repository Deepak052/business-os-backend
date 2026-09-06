import { prisma } from '../utils/prisma';

export abstract class BaseRepository<T, U = string> {
  protected model: any; // Prisma model delegate

  constructor(modelName: string) {
    this.model = (prisma as any)[modelName];
  }

  async findById(id: U): Promise<T | null> {
    return this.model.findUnique({ where: { id } });
  }

  async findAll(options?: any): Promise<T[]> {
    return this.model.findMany(options);
  }

  async create(data: any): Promise<T> {
    return this.model.create({ data });
  }

  async update(id: U, data: any): Promise<T> {
    return this.model.update({
      where: { id },
      data,
    });
  }

  async delete(id: U): Promise<T> {
    return this.model.delete({
      where: { id },
    });
  }

  // Tenant-aware methods
  async findByIdAndTenant(id: U, organizationId: string): Promise<T | null> {
    return this.model.findFirst({
      where: { id, organizationId },
    });
  }

  async findAllByTenant(organizationId: string, options: any = {}): Promise<T[]> {
    return this.model.findMany({
      ...options,
      where: {
        ...options.where,
        organizationId,
      },
    });
  }

  async createForTenant(organizationId: string, data: any): Promise<T> {
    return this.model.create({
      data: {
        ...data,
        organizationId,
      },
    });
  }

  async updateForTenant(id: U, organizationId: string, data: any): Promise<T> {
    return this.model.update({
      where: { id },
      data,
    });
  }

  async deleteForTenant(id: U, organizationId: string): Promise<T> {
    // Ideally this could also verify the tenant before deleting, but standard where: {id} works for now
    // Prisma doesn't support multiple where keys unless it's a compound unique key
    const existing = await this.findByIdAndTenant(id, organizationId);
    if (!existing) throw new Error("Not found or unauthorized");
    
    return this.model.delete({
      where: { id },
    });
  }
}
