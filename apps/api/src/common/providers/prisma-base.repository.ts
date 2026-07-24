import { Injectable } from '@nestjs/common';
import { IBaseRepository, FindManyOptions } from '../interfaces/base-repository.interface.js';
import { PrismaService } from './prisma.service.js';

@Injectable()
export abstract class PrismaBaseRepository<T> implements IBaseRepository<T> {
  protected abstract readonly model: any;

  constructor(protected readonly prisma: PrismaService) {}

  async findById(id: string): Promise<T | null> {
    return this.model.findUnique({ where: { id } }) as Promise<T | null>;
  }

  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    const { where, orderBy, skip, take } = options || {};
    return this.model.findMany({
      where,
      orderBy,
      skip,
      take,
    }) as Promise<T[]>;
  }

  async create(data: Partial<T>): Promise<T> {
    return this.model.create({ data }) as Promise<T>;
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    return this.model.update({
      where: { id },
      data,
    }) as Promise<T>;
  }

  async delete(id: string): Promise<void> {
    await this.model.delete({ where: { id } });
  }

  async count(options?: FindManyOptions<T>): Promise<number> {
    const { where } = options || {};
    return this.model.count({ where });
  }
}
