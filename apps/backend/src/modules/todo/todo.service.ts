import { todoRepository, TodoRepository } from './todo.repository.js';
import { ITodo } from './todo.model.js';
import { NotFoundError } from '../../shared/errors.js';
import { CreateTodoRequest, UpdateTodoRequest, TodoFilter, TodoStatus } from '@ai-robot/shared-types';
import mongoose from 'mongoose';
import { reminderService } from '../reminders/reminder.service.js';
import { logger } from '../../utils/logger.js';

export class TodoService {
  constructor(private readonly repo: TodoRepository = todoRepository) {}

  async create(userId: string, data: CreateTodoRequest, createdBy: 'user' | 'ai' = 'user'): Promise<ITodo> {
    const todo = await this.repo.create({
      userId: new mongoose.Types.ObjectId(userId) as unknown as mongoose.Types.ObjectId,
      title: data.title,
      description: data.description,
      priority: data.priority,
      category: data.category || 'General',
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      tags: data.tags || [],
      createdBy,
    });

    // If a due date is specified, automatically schedule an alarm reminder
    if (data.dueDate) {
      try {
        const reminder = await reminderService.create(userId, {
          title: `Task Due: ${data.title}`,
          description: data.description || `Your scheduled task "${data.title}" is due now!`,
          scheduledAt: data.dueDate,
          notifyVia: ['telegram', 'websocket', 'device'],
        });
        await this.repo.updateById(todo.id, {
          $set: { 'metadata.reminderId': reminder.id },
        });
      } catch (err) {
        logger.warn({ err, todoId: todo.id }, 'Could not automatically schedule reminder for todo');
      }
    }

    return todo;
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
    const existing = await this.getById(id, userId);

    const updateObj: Record<string, unknown> = { ...data };
    if (data.dueDate) updateObj.dueDate = new Date(data.dueDate);
    if (data.status === TodoStatus.COMPLETED) {
      updateObj.completedAt = new Date();
      // Remove scheduled reminder if completed
      const reminderId = existing.metadata?.reminderId as string | undefined;
      if (reminderId) {
        await reminderService.delete(reminderId, userId).catch(() => {});
      }
    }

    const updated = await this.repo.updateById(id, { $set: updateObj });
    return updated!;
  }

  async complete(id: string, userId: string): Promise<ITodo> {
    const todo = await this.getById(id, userId);
    const updated = await this.repo.markCompleted(id, userId);
    if (!updated) throw new NotFoundError('Todo item');

    // Cancel pending reminder once completed
    const reminderId = todo.metadata?.reminderId as string | undefined;
    if (reminderId) {
      await reminderService.delete(reminderId, userId).catch(() => {});
    }

    return updated;
  }

  async delete(id: string, userId: string): Promise<void> {
    const todo = await this.getById(id, userId);
    const reminderId = todo.metadata?.reminderId as string | undefined;
    if (reminderId) {
      await reminderService.delete(reminderId, userId).catch(() => {});
    }
    await this.repo.deleteById(id);
  }
}

export const todoService = new TodoService();

