import { FastifyRequest, FastifyReply } from 'fastify';
import { analyticsService, AnalyticsService } from './analytics.service.js';
import { successResponse } from '../../shared/response.js';

export class AnalyticsController {
  constructor(private readonly service: AnalyticsService = analyticsService) {}

  getStats = async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = await this.service.getUserDashboardStats(request.user!.userId);
    return reply.send(successResponse(stats));
  };
}

export const analyticsController = new AnalyticsController();

