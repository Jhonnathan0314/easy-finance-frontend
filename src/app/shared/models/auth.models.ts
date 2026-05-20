import { GlobalRole } from './enums';

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthenticatedUserDto {
  userId: number;
  participantId: number;
  email: string;
  fullName: string;
  globalRoles: GlobalRole[];
}

export interface AuthTokenResponseDto {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthenticatedUserDto;
}

export type AuthenticatedUser = AuthenticatedUserDto;
export type AuthTokenResponse = AuthTokenResponseDto;
