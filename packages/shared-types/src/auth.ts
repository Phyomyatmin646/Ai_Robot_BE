/** JWT token payload stored in access tokens */
export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  deviceId?: string;
  iat?: number;
  exp?: number;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  DEVICE = 'device',
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  language?: string;
  timezone?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

