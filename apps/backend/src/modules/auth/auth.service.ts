import { userRepository, UserRepository } from '../users/user.repository.js';
import { hashPassword, comparePassword, hashToken, generateRandomToken } from '../../utils/crypto.js';
import {
  ConflictError,
  UnauthorizedError,
  BadRequestError,
} from '../../shared/errors.js';
import {
  RegisterRequest,
  LoginRequest,
  AuthTokens,
  UserRole,
  TokenPayload,
} from '@ai-robot/shared-types';
import { config } from '../../config/index.js';
import { settingsRepository } from '../settings/settings.repository.js';

export class AuthService {
  constructor(private readonly userRepo: UserRepository = userRepository) {}

  async register(
    data: RegisterRequest,
    signTokenFn: (payload: TokenPayload, options?: { expiresIn?: string }) => string
  ): Promise<{ user: unknown; tokens: AuthTokens }> {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw new ConflictError('A user with this email address already exists');
    }

    const passwordHash = await hashPassword(data.password);
    const user = await this.userRepo.create({
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      role: UserRole.USER,
      isActive: true,
      language: data.language || config.DEFAULT_LANGUAGE,
      timezone: data.timezone || config.DEFAULT_TIMEZONE,
    });

    // Create default settings for the user
    await settingsRepository.createUserSettings(user.id, {
      language: user.language,
      timezone: user.timezone,
      notifications: {
        telegramEnabled: false,
        emailEnabled: true,
        reminderNotifications: true,
        todoNotifications: true,
        deviceAlerts: true,
        dailySummary: true,
        quietHoursEnabled: false,
      },
      ai: {
        fastModel: config.FAST_MODEL,
        thinkingModel: config.THINKING_MODEL,
        voiceModel: config.VOICE_MODEL,
        personality: 'Friendly, helpful, and concise AI robot assistant.',
        responseLanguage: user.language,
        ragEnabled: true,
        mcpEnabled: true,
        thinkingLevel: 'fast',
        temperature: 0.7,
        maxResponseTokens: 800,
      },
    });

    const tokens = await this.generateTokenPair(user.id, user.email, user.role, signTokenFn);
    return { user, tokens };
  }

  async login(
    data: LoginRequest,
    signTokenFn: (payload: TokenPayload, options?: { expiresIn?: string }) => string
  ): Promise<{ user: unknown; tokens: AuthTokens }> {
    const user = await this.userRepo.findByEmail(data.email, true);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account has been deactivated. Please contact support.');
    }

    const isMatch = await comparePassword(data.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    await this.userRepo.updateLastLogin(user.id);
    const tokens = await this.generateTokenPair(user.id, user.email, user.role, signTokenFn);
    return { user, tokens };
  }

  async refreshToken(
    rawRefreshToken: string,
    signTokenFn: (payload: TokenPayload, options?: { expiresIn?: string }) => string
  ): Promise<AuthTokens> {
    const tokenHash = hashToken(rawRefreshToken);
    const user = await this.userRepo.findOne({ refreshTokenHash: tokenHash }, '+refreshTokenHash');

    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    return this.generateTokenPair(user.id, user.email, user.role, signTokenFn);
  }

  async logout(userId: string): Promise<void> {
    await this.userRepo.updateRefreshToken(userId, null);
  }

  async changePassword(userId: string, currentPass: string, newPass: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new UnauthorizedError('User not found');

    const fullUser = await this.userRepo.findByEmail(user.email, true);
    if (!fullUser) throw new UnauthorizedError('User not found');

    const isMatch = await comparePassword(currentPass, fullUser.passwordHash);
    if (!isMatch) {
      throw new BadRequestError('Current password is incorrect');
    }

    const newHash = await hashPassword(newPass);
    await this.userRepo.updateById(userId, {
      $set: { passwordHash: newHash },
      $unset: { refreshTokenHash: 1 },
    });
  }

  private async generateTokenPair(
    userId: string,
    email: string,
    role: UserRole,
    signTokenFn: (payload: TokenPayload, options?: { expiresIn?: string }) => string
  ): Promise<AuthTokens> {
    const payload: TokenPayload = { userId, email, role };
    const accessToken = signTokenFn(payload, { expiresIn: config.JWT_ACCESS_EXPIRY });

    // Generate random refresh token & store hash
    const rawRefreshToken = generateRandomToken(48);
    const hashedRefresh = hashToken(rawRefreshToken);
    await this.userRepo.updateRefreshToken(userId, hashedRefresh);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 15 * 60, // 15 mins in seconds
    };
  }
}

export const authService = new AuthService();
