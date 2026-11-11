import { FastifyRequest, FastifyReply } from 'fastify';
import { deviceService, DeviceService } from './device.service.js';
import { successResponse } from '../../shared/response.js';
import { DeviceRegistrationRequest, DeviceConfig } from '@ai-robot/shared-types';

export class DeviceController {
  constructor(private readonly service: DeviceService = deviceService) {}

  register = async (
    request: FastifyRequest<{ Body: DeviceRegistrationRequest }>,
    reply: FastifyReply
  ) => {
    const result = await this.service.register(request.user!.userId, request.body);
    return reply.status(201).send(
      successResponse(result, 'Device registered successfully. Save the apiKey securely; it will not be shown again.')
    );
  };

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const devices = await this.service.getUserDevices(request.user!.userId);
    return reply.send(successResponse(devices));
  };

  getById = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const device = await this.service.getById(request.params.id, request.user!.userId);
    return reply.send(successResponse(device));
  };

  updateConfig = async (
    request: FastifyRequest<{ Params: { id: string }; Body: Partial<DeviceConfig> }>,
    reply: FastifyReply
  ) => {
    const device = await this.service.updateConfig(
      request.params.id,
      request.user!.userId,
      request.body
    );
    return reply.send(successResponse(device, 'Device configuration updated'));
  };

  delete = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await this.service.delete(request.params.id, request.user!.userId);
    return reply.send(successResponse(null, 'Device removed successfully'));
  };
}

export const deviceController = new DeviceController();

