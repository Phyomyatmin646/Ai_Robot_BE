import { FastifyRequest, FastifyReply } from 'fastify';
import { rfidService, RfidService } from './rfid.service.js';
import { successResponse, paginatedResponse } from '../../shared/response.js';
import { BadRequestError } from '../../shared/errors.js';

export class RfidController {
  constructor(private readonly service: RfidService = rfidService) {}

  listHistory = async (
    request: FastifyRequest<{
      Querystring: {
        page?: number;
        limit?: number;
        deviceId?: string;
        category?: string;
        fromDate?: string;
        toDate?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { page, limit, deviceId, category, fromDate, toDate } = request.query;
    const result = await this.service.listHistory({
      userId: request.user!.userId,
      deviceId,
      category,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
    return reply.send(paginatedResponse(result.data, result.pagination));
  };

  getHistoryById = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const log = await this.service.getHistoryById(request.params.id, request.user!.userId);
    return reply.send(successResponse(log));
  };

  simulateScan = async (
    request: FastifyRequest<{
      Body: {
        deviceId: string;
        cardUid?: string;
        cardData: Record<string, unknown> | string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { deviceId, cardData, cardUid } = request.body || {};
    if (!deviceId) {
      throw new BadRequestError('deviceId is required');
    }
    if (!cardData) {
      throw new BadRequestError('cardData is required');
    }

    const result = await this.service.handleRfidScan(deviceId, request.user!.userId, {
      cardUid,
      cardData,
    });

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error,
      });
    }

    return reply.status(200).send(successResponse(result.data, 'RFID educational scan processed'));
  };
}

export const rfidController = new RfidController();
