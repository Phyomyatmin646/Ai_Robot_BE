import mongoose, { Document, Model, FilterQuery, UpdateQuery, QueryOptions } from 'mongoose';
import { calculatePagination } from './response.js';
import type { PaginationMeta } from '@ai-robot/shared-types';

export interface FindAllOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
  populate?: string | string[];
}

export abstract class BaseRepository<T extends Document> {
  protected constructor(protected readonly model: Model<T>) {}

  async create(data: Partial<T>): Promise<T> {
    const entity = new this.model(data);
    return entity.save() as unknown as Promise<T>;
  }

  async findById(id: string | mongoose.Types.ObjectId, populate?: string | string[]): Promise<T | null> {
    let query = this.model.findById(id);
    if (populate) {
      if (Array.isArray(populate)) {
        for (const p of populate) query = query.populate(p);
      } else {
        query = query.populate(populate);
      }
    }
    return query.exec();
  }

  async findOne(filter: FilterQuery<T>, populate?: string | string[]): Promise<T | null> {
    let query = this.model.findOne(filter);
    if (populate) {
      if (Array.isArray(populate)) {
        for (const p of populate) query = query.populate(p);
      } else {
        query = query.populate(populate);
      }
    }
    return query.exec();
  }

  async find(filter: FilterQuery<T>, options: FindAllOptions = {}): Promise<T[]> {
    const { sort, limit, populate } = options;
    let query = this.model.find(filter);

    if (sort) query = query.sort(sort);
    if (limit) query = query.limit(limit);
    if (populate) {
      if (Array.isArray(populate)) {
        for (const p of populate) query = query.populate(p);
      } else {
        query = query.populate(populate);
      }
    }

    return query.exec();
  }

  async findPaginated(
    filter: FilterQuery<T>,
    options: FindAllOptions = {}
  ): Promise<{ data: T[]; pagination: PaginationMeta }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.model
        .find(filter)
        .sort(options.sort ?? { createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    const pagination = calculatePagination(total, page, limit);
    return { data, pagination };
  }

  async updateById(
    id: string | mongoose.Types.ObjectId,
    update: UpdateQuery<T>,
    options: QueryOptions<T> = { new: true }
  ): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, update, options).exec();
  }

  async updateOne(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<boolean> {
    const result = await this.model.updateOne(filter, update).exec();
    return result.modifiedCount > 0;
  }

  async deleteById(id: string | mongoose.Types.ObjectId): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id).exec();
    return !!result;
  }

  async softDeleteById(id: string | mongoose.Types.ObjectId): Promise<boolean> {
    const result = await this.model
      .findByIdAndUpdate(id, { $set: { deletedAt: new Date(), isDeleted: true } })
      .exec();
    return !!result;
  }

  async count(filter: FilterQuery<T> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  async exists(filter: FilterQuery<T>): Promise<boolean> {
    const count = await this.model.countDocuments(filter).limit(1).exec();
    return count > 0;
  }
}
