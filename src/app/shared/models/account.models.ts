import { AccountParticipantStatus, AccountRole, AccountStatus } from './enums';

export interface CreateAccountRequest {
  name: string;
  description?: string | null;
}

export interface UpdateAccountRequest {
  name: string;
  description?: string | null;
}

export interface AccountResponse {
  id: number;
  name: string;
  description?: string | null;
  status: AccountStatus;
  currentUserRole: AccountRole;
  createdAt: string;
  updatedAt: string;
}

export type AccountResponseDto = AccountResponse;

export interface AddAccountMemberRequest {
  email: string;
  role: AccountRole;
}

export interface ChangeAccountMemberRoleRequest {
  role: AccountRole;
}

export interface AccountMemberResponse {
  participantId: number;
  email: string;
  displayName: string;
  role: AccountRole;
  status: AccountParticipantStatus;
  joinedAt: string;
}

export type AccountMemberResponseDto = AccountMemberResponse;
