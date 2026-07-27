import { Injectable } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { PrismaBaseRepository } from '../../common/providers/prisma-base.repository.js';
import { PrismaService } from '../../common/providers/prisma.service.js';

@Injectable()
export class ProviderRepository extends PrismaBaseRepository<Provider> {
  protected readonly model: any;

  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
    this.model = prisma.provider;
  }

  async findActive(): Promise<Provider | null> {
    return this.prisma.provider.findFirst({
      where: { active: true },
      orderBy: { priority: 'desc' },
    });
  }

  async findAllEnabled(): Promise<Provider[]> {
    return this.prisma.provider.findMany({
      where: { active: true },
      orderBy: { priority: 'desc' },
    });
  }

  async setActive(id: string): Promise<void> {
    // Deactivate all providers first
    await this.prisma.provider.updateMany({
      where: { active: true },
      data: { active: false },
    });
    // Activate the selected one
    await this.prisma.provider.update({
      where: { id },
      data: { active: true },
    });
  }

  async recordUsage(id: string): Promise<void> {
    await this.prisma.provider.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  async recordError(id: string, errorMessage: string): Promise<void> {
    await this.prisma.provider.update({
      where: { id },
      data: {
        lastErrorAt: new Date(),
        lastError: errorMessage,
      },
    });
  }
}
