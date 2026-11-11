import { FastifyRequest, FastifyReply } from 'fastify';
import { authService, AuthService } from './auth.service.js';
import { successResponse } from '../../shared/response.js';
import { RegisterRequest, LoginRequest, RefreshTokenRequest, ChangePasswordRequest } from '@ai-robot/shared-types';

export class AuthController {
  constructor(private readonly service: AuthService = authService) {}

  register = async (request: FastifyRequest<{ Body: RegisterRequest }>, reply: FastifyReply) => {
    const signFn = request.server.jwt.sign.bind(request.server.jwt);
    const result = await this.service.register(request.body, signFn);
    return reply.status(201).send(successResponse(result, 'User registered successfully'));
  };

  login = async (request: FastifyRequest<{ Body: LoginRequest }>, reply: FastifyReply) => {
    const signFn = request.server.jwt.sign.bind(request.server.jwt);
    const result = await this.service.login(request.body, signFn);
    return reply.send(successResponse(result, 'Login successful'));
  };

  refreshToken = async (request: FastifyRequest<{ Body: RefreshTokenRequest }>, reply: FastifyReply) => {
    const signFn = request.server.jwt.sign.bind(request.server.jwt);
    const tokens = await this.service.refreshToken(request.body.refreshToken, signFn);
    return reply.send(successResponse(tokens, 'Token refreshed successfully'));
  };

  logout = async (request: FastifyRequest, reply: FastifyReply) => {
    await this.service.logout(request.user!.userId);
    return reply.send(successResponse(null, 'Logged out successfully'));
  };

  changePassword = async (request: FastifyRequest<{ Body: ChangePasswordRequest }>, reply: FastifyReply) => {
    const { currentPassword, newPassword } = request.body;
    await this.service.changePassword(request.user!.userId, currentPassword, newPassword);
    return reply.send(successResponse(null, 'Password changed successfully'));
  };
}

export const authController = new AuthController();

