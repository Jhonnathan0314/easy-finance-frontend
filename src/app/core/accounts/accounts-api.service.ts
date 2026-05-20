import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AccountMemberResponseDto,
  AccountResponseDto,
  AddAccountMemberRequest,
  ChangeAccountMemberRoleRequest,
  CreateAccountRequest,
  PageResponseDto,
  UpdateAccountRequest
} from '../../shared/models';
import { ApiClient } from '../http/api-client';

@Injectable({ providedIn: 'root' })
export class AccountsApiService {
  private readonly api = inject(ApiClient);

  listAccounts(page = 0, size = 20): Observable<PageResponseDto<AccountResponseDto>> {
    return this.api.get<PageResponseDto<AccountResponseDto>>('/accounts', { page, size });
  }

  createAccount(request: CreateAccountRequest): Observable<AccountResponseDto> {
    return this.api.post<AccountResponseDto, CreateAccountRequest>('/accounts', request);
  }

  getAccount(accountId: number): Observable<AccountResponseDto> {
    return this.api.get<AccountResponseDto>(`/accounts/${accountId}`);
  }

  updateAccount(accountId: number, request: UpdateAccountRequest): Observable<AccountResponseDto> {
    return this.api.put<AccountResponseDto, UpdateAccountRequest>(`/accounts/${accountId}`, request);
  }

  archiveAccount(accountId: number): Observable<AccountResponseDto> {
    return this.api.patch<AccountResponseDto, Record<string, never>>(`/accounts/${accountId}/archive`, {});
  }

  listMembers(accountId: number): Observable<AccountMemberResponseDto[]> {
    return this.api.get<AccountMemberResponseDto[]>(`/accounts/${accountId}/members`);
  }

  addMember(accountId: number, request: AddAccountMemberRequest): Observable<AccountMemberResponseDto> {
    return this.api.post<AccountMemberResponseDto, AddAccountMemberRequest>(`/accounts/${accountId}/members`, request);
  }

  changeMemberRole(
    accountId: number,
    participantId: number,
    request: ChangeAccountMemberRoleRequest
  ): Observable<AccountMemberResponseDto> {
    return this.api.patch<AccountMemberResponseDto, ChangeAccountMemberRoleRequest>(
      `/accounts/${accountId}/members/${participantId}/role`,
      request
    );
  }

  removeMember(accountId: number, participantId: number): Observable<void> {
    return this.api.delete<void>(`/accounts/${accountId}/members/${participantId}`);
  }
}
