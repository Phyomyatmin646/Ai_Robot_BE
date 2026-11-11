import { FastifyRequest, FastifyReply } from 'fastify';
import { settingsService, SettingsService } from './settings.service.js';
import { successResponse } from '../../shared/response.js';
import { IUserSettings, IDeviceSettings } from './settings.model.js';

export class SettingsController {
  constructor(private readonly service: SettingsService = settingsService) {}

  getUserSettings = async (request: FastifyRequest, reply: FastifyReply) => {
    const settings = await this.service.getUserSettings(request.user!.userId);
    return reply.send(successResponse(settings));
  };

  updateUserSettings = async (
    request: FastifyRequest<{ Body: Partial<IUserSettings> }>,
    reply: FastifyReply
  ) => {
    const settings = await this.service.updateUserSettings(request.user!.userId, request.body);
    return reply.send(successResponse(settings, 'User settings updated'));
  };

  getDeviceSettings = async (
    request: FastifyRequest<{ Params: { deviceId: string } }>,
    reply: FastifyReply
  ) => {
    const settings = await this.service.getDeviceSettings(request.params.deviceId);
    return reply.send(successResponse(settings));
  };

  updateDeviceSettings = async (
    request: FastifyRequest<{ Params: { deviceId: string }; Body: Partial<IDeviceSettings> }>,
    reply: FastifyReply
  ) => {
    const settings = await this.service.updateDeviceSettings(request.params.deviceId, request.body);
    return reply.send(successResponse(settings, 'Device settings updated and synchronized with robot'));
  };
}

export const settingsController = new SettingsController();
