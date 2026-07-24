export interface IBaseRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(options?: FindManyOptions<T>): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  count(options?: FindManyOptions<T>): Promise<number>;
}

export interface FindManyOptions<T> {
  where?: Partial<T>;
  orderBy?: Record<keyof T, 'asc' | 'desc'>;
  skip?: number;
  take?: number;
}
