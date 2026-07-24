import { IBaseRepository, FindManyOptions } from './interfaces/base-repository.interface.js';

export abstract class BaseService<T> {
  constructor(protected readonly repository: IBaseRepository<T>) {}

  async findById(id: string): Promise<T | null> {
    return this.repository.findById(id);
  }

  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.findAll(options);
  }

  async create(data: Partial<T>): Promise<T> {
    return this.repository.create(data);
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error(`Resource with id ${id} not found`);
    }
    return this.repository.update(id, data);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error(`Resource with id ${id} not found`);
    }
    return this.repository.delete(id);
  }

  async count(options?: FindManyOptions<T>): Promise<number> {
    return this.repository.count(options);
  }
}
