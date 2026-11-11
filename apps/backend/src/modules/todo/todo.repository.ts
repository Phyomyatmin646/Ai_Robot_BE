import { BaseRepository } from '../../shared/base.repository.js';
import { ITodo, TodoModel } from './todo.model.js';
import mongoose from 'mongoose';
import { TodoFilter, TodoStatus } from '@ai-robot/shared-types';

export class TodoRepository extends BaseRepository<ITodo> {
  constructor() {
    super(TodoModel);
  }

  async findWithFilters(userId: string, filter: TodoFilter) {
    const query: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(userId),
    };

    if (filter.status) query.status = filter.status;
    if (filter.priority) query.priority = filter.priority;
    if (filter.category) query.category = filter.category;

    if (filter.search) {
      query.$text = { $search: filter.search };
    }

    if (filter.dueBefore || filter.dueAfter) {
      query.dueDate = {};
      if (filter.dueBefore) (query.dueDate as Record<string, unknown>).$lte = new Date(filter.dueBefore);
      if (filter.dueAfter) (query.dueDate as Record<string, unknown>).$gte = new Date(filter.dueAfter);
    }

    const sortOption: Record<string, 1 | -1> = {};
    if (filter.sortBy) {
      sortOption[filter.sortBy] = filter.sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOption.createdAt = -1;
    }

    return this.findPaginated(query, {
      page: filter.page || 1,
      limit: filter.limit || 20,
      sort: sortOption,
    });
  }

  async markCompleted(id: string, userId: string): Promise<ITodo | null> {
    return this.model.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), userId: new mongoose.Types.ObjectId(userId) },
      { $set: { status: TodoStatus.COMPLETED, completedAt: new Date() } },
      { new: true }
    ).exec();
  }
}

export const todoRepository = new TodoRepository();

