import { prisma } from '../utils/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';

export class FileStorageService {
  static async uploadFile(data: {
    organizationId: string;
    userId: string;
    folderId?: string;
    file: {
      name: string;
      originalName: string;
      mimeType: string;
      size: number;
      buffer: Buffer;
    };
  }) {
    // 1. Quota Check (Mocked for now, would sum file sizes for org)
    const MAX_ORG_SIZE = 10 * 1024 * 1024 * 1024; // 10GB
    
    // 2. Validate Folder
    if (data.folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: data.folderId, organizationId: data.organizationId }
      });
      if (!folder) throw new NotFoundError('Folder not found or unauthorized');
    }

    // 3. Adapter Layer: Save to Local / S3
    // Assuming local storage for MVP
    const path = `/uploads/${data.organizationId}/${Date.now()}-${data.file.originalName}`;
    // require('fs').writeFileSync(path, data.file.buffer);

    // 4. Save Metadata
    return prisma.file.create({
      data: {
        organizationId: data.organizationId,
        uploadedById: data.userId,
        folderId: data.folderId,
        name: data.file.name,
        originalName: data.file.originalName,
        mimeType: data.file.mimeType,
        size: data.file.size,
        path: path,
      }
    });
  }

  static async getFile(fileId: string, organizationId: string) {
    const file = await prisma.file.findFirst({
      where: { id: fileId, organizationId }
    });
    if (!file) throw new NotFoundError('File not found');
    return file;
  }

  static async deleteFile(fileId: string, organizationId: string) {
    const file = await this.getFile(fileId, organizationId);
    // Remove from physical storage here
    await prisma.file.delete({ where: { id: file.id } });
    return true;
  }
}
