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

  async findById(id: string): Promise<Provider | null> {
    return this.prisma.provider.findUnique({ where: { id } });
  }

  async findAllEnabled(): Promise<Provider[]> {
    return this.prisma.provider.findMany({
      where: { active: true },
      orderBy: { priority: 'desc' },
    });
  }

  /**
   * Get all enabled providers, ordered by priority.
   * Used for credential pool rotation.
   */
  async findAllForPool(): Promise<Provider[]> {
    return this.prisma.provider.findMany({
      where: { active: true },
      orderBy: [
        { priority: 'desc' },
        { lastErrorAt: 'asc' }, // Prefer providers with fewer/recent errors
      ],
    });
  }

  /**
   * Get providers that are NOT in cooldown.
   * A provider is available if cooldownUntil is null or in the past.
   */
  async findAvailable(): Promise<Provider[]> {
    const now = new Date();
    return this.prisma.provider.findMany({
      where: {
        active: true,
        OR: [{ cooldownUntil: null }, { cooldownUntil: { lt: now } }],
      },
      orderBy: [{ priority: 'desc' }, { lastErrorAt: 'asc' }],
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
      data: {
        lastUsedAt: new Date(),
        cooldownUntil: null, // Clear cooldown on success
      },
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

  /**
   * Set cooldown for a provider. After cooldown, provider can be retried.
   */
  async setCooldown(id: string, seconds: number): Promise<void> {
    const cooldownUntil = new Date(Date.now() + seconds * 1000);
    await this.prisma.provider.update({
      where: { id },
      data: {
        cooldownUntil,
        lastErrorAt: new Date(),
      },
    });
  }

  /**
   * Clear cooldown for a provider (make it available immediately).
   */
  async clearCooldown(id: string): Promise<void> {
    await this.prisma.provider.update({
      where: { id },
      data: { cooldownUntil: null },
    });
  }
}
