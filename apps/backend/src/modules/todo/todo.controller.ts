import { FastifyRequest, FastifyReply } from 'fastify';
import { todoService, TodoService } from './todo.service.js';
import { successResponse, paginatedResponse } from '../../shared/response.js';
import { CreateTodoRequest, UpdateTodoRequest, TodoFilter } from '@ai-robot/shared-types';

export class TodoController {
  constructor(private readonly service: TodoService = todoService) {}

  create = async (request: FastifyRequest<{ Body: CreateTodoRequest }>, reply: FastifyReply) => {
    const todo = await this.service.create(request.user!.userId, request.body);
    return reply.status(201).send(successResponse(todo, 'Todo created successfully'));
  };

  list = async (request: FastifyRequest<{ Querystring: TodoFilter }>, reply: FastifyReply) => {
    const result = await this.service.list(request.user!.userId, request.query);
    return reply.send(paginatedResponse(result.data, result.pagination));
  };

  getById = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const todo = await this.service.getById(request.params.id, request.user!.userId);
    return reply.send(successResponse(todo));
  };

  update = async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateTodoRequest }>,
    reply: FastifyReply
  ) => {
    const todo = await this.service.update(request.params.id, request.user!.userId, request.body);
    return reply.send(successResponse(todo, 'Todo updated successfully'));
  };

  complete = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const todo = await this.service.complete(request.params.id, request.user!.userId);
    return reply.send(successResponse(todo, 'Todo marked as completed'));
  };

  delete = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await this.service.delete(request.params.id, request.user!.userId);
    return reply.send(successResponse(null, 'Todo deleted successfully'));
  };
}

export const todoController = new TodoController();

