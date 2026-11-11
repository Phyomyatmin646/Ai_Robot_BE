import { todoRepository, TodoRepository } from './todo.repository.js';
import { ITodo } from './todo.model.js';
import { NotFoundError } from '../../shared/errors.js';
import { CreateTodoRequest, UpdateTodoRequest, TodoFilter, TodoStatus } from '@ai-robot/shared-types';
import mongoose from 'mongoose';

export class TodoService {
  constructor(private readonly repo: TodoRepository = todoRepository) {}

  async create(userId: string, data: CreateTodoRequest, createdBy: 'user' | 'ai' = 'user'): Promise<ITodo> {
    return this.repo.create({
      userId: new mongoose.Types.ObjectId(userId) as unknown as mongoose.Types.ObjectId,
      title: data.title,
      description: data.description,
      priority: data.priority,
      category: data.category || 'General',
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      tags: data.tags || [],
      createdBy,
    });
  }

  async getById(id: string, userId: string): Promise<ITodo> {
    const todo = await this.repo.findById(id);
    if (!todo || todo.userId.toString() !== userId) {
      throw new NotFoundError('Todo item');
    }
    return todo;
  }

  async list(userId: string, filter: TodoFilter) {
    return this.repo.findWithFilters(userId, filter);
  }

  async update(id: string, userId: string, data: UpdateTodoRequest): Promise<ITodo> {
    await this.getById(id, userId);

    const updateObj: Record<string, unknown> = { ...data };
    if (data.dueDate) updateObj.dueDate = new Date(data.dueDate);
    if (data.status === TodoStatus.COMPLETED) updateObj.completedAt = new Date();

    const updated = await this.repo.updateById(id, { $set: updateObj });
    return updated!;
  }

  async complete(id: string, userId: string): Promise<ITodo> {
    const updated = await this.repo.markCompleted(id, userId);
    if (!updated) throw new NotFoundError('Todo item');
    return updated;
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.getById(id, userId);
    await this.repo.deleteById(id);
  }
}

export const todoService = new TodoService();

