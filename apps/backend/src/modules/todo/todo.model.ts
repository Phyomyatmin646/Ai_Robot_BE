import mongoose, { Schema, Document } from 'mongoose';
import { TodoStatus, TodoPriority } from '@ai-robot/shared-types';

export interface ITodo extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  category?: string;
  dueDate?: Date;
  completedAt?: Date;
  tags?: string[];
  createdBy: 'user' | 'ai' | 'system';
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const TodoSchema = new Schema<ITodo>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: Object.values(TodoStatus),
      default: TodoStatus.PENDING,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(TodoPriority),
      default: TodoPriority.MEDIUM,
      index: true,
    },
    category: { type: String, trim: true, default: 'General', index: true },
    dueDate: { type: Date, index: true },
    completedAt: { type: Date },
    tags: { type: [String], default: [] },
    createdBy: { type: String, enum: ['user', 'ai', 'system'], default: 'user' },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

TodoSchema.index({ userId: 1, status: 1, dueDate: 1 });
TodoSchema.index({ title: 'text', description: 'text' });

export const TodoModel = mongoose.model<ITodo>('Todo', TodoSchema);

