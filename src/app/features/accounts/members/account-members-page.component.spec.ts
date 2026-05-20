import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AccountsApiService } from '../../../core/accounts/accounts-api.service';
import { AccountStore } from '../../../core/state/account.store';
import { AccountMemberResponseDto, AccountResponseDto } from '../../../shared/models';
import { AccountMembersPageComponent } from './account-members-page.component';

describe('AccountMembersPageComponent', () => {
  const account: AccountResponseDto = {
    id: 1,
    name: 'Casa',
    description: null,
    status: 'ACTIVE',
    currentUserRole: 'ACCOUNT_ADMIN',
    createdAt: '',
    updatedAt: ''
  };

  const member: AccountMemberResponseDto = {
    participantId: 10,
    email: 'member@example.com',
    displayName: 'Member User',
    role: 'ACCOUNT_MEMBER',
    status: 'ACTIVE',
    joinedAt: '2026-01-01T00:00:00Z'
  };

  function configure(options: {
    role?: 'ACCOUNT_ADMIN' | 'ACCOUNT_MEMBER';
    archived?: boolean;
    members?: AccountMemberResponseDto[];
    changeRoleFails?: boolean;
  } = {}): { fixture: ComponentFixture<AccountMembersPageComponent>; api: jasmine.SpyObj<AccountsApiService> } {
    const selectedAccount = {
      ...account,
      currentUserRole: options.role ?? 'ACCOUNT_ADMIN',
      status: options.archived ? 'ARCHIVED' : 'ACTIVE'
    } as AccountResponseDto;
    const api = jasmine.createSpyObj<AccountsApiService>('AccountsApiService', [
      'listMembers',
      'addMember',
      'changeMemberRole',
      'removeMember'
    ]);

    api.listMembers.and.returnValue(of(options.members ?? [member]));
    api.addMember.and.returnValue(of(member));
    api.changeMemberRole.and.returnValue(
      options.changeRoleFails
        ? throwError(() => ({ error: { code: 'ACCOUNT_LAST_ADMIN_REQUIRED' } }))
        : of({ ...member, role: 'ACCOUNT_ADMIN' })
    );
    api.removeMember.and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      imports: [AccountMembersPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'accountId' ? '1' : null)
              }
            }
          }
        },
        {
          provide: AccountStore,
          useValue: {
            selectedAccountId: signal(1),
            selectedAccount: signal(selectedAccount),
            selectedAccountArchived: signal(Boolean(options.archived))
          }
        },
        { provide: AccountsApiService, useValue: api }
      ]
    });

    const fixture = TestBed.createComponent(AccountMembersPageComponent);
    fixture.detectChanges();
    return { fixture, api };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('lists members on load', () => {
    const { fixture, api } = configure();

    expect(api.listMembers).toHaveBeenCalledWith(1);
    expect(fixture.nativeElement.textContent).toContain('member@example.com');
    expect(fixture.nativeElement.textContent).toContain('ACCOUNT_MEMBER');
  });

  it('validates required and valid email before adding a member', () => {
    const { fixture } = configure();
    const component = fixture.componentInstance;

    component.addMemberForm.patchValue({ email: '' });
    expect(component.addMemberForm.controls.email.hasError('required')).toBeTrue();

    component.addMemberForm.patchValue({ email: 'invalid-email' });
    expect(component.addMemberForm.controls.email.hasError('email')).toBeTrue();
  });

  it('adds a member and refreshes the list', () => {
    const { fixture, api } = configure();
    const component = fixture.componentInstance;

    component.addMemberForm.setValue({ email: 'new@example.com', role: 'ACCOUNT_MEMBER' });
    component.addMember();

    expect(api.addMember).toHaveBeenCalledWith(1, { email: 'new@example.com', role: 'ACCOUNT_MEMBER' });
    expect(api.listMembers).toHaveBeenCalledTimes(2);
  });

  it('hides write actions for account members', () => {
    const { fixture } = configure({ role: 'ACCOUNT_MEMBER' });
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Solo lectura');
    expect(text).not.toContain('Agregar miembro');
    expect(text).not.toContain('Remover');
  });

  it('blocks write actions when account is archived', () => {
    const { fixture } = configure({ archived: true });
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('La cuenta esta archivada');
    expect(text).not.toContain('Agregar miembro');
    expect(text).not.toContain('Remover');
  });

  it('changes an active member role', () => {
    const { fixture, api } = configure();
    const select = { value: 'ACCOUNT_ADMIN' } as HTMLSelectElement;

    fixture.componentInstance.changeRole(member, { target: select } as unknown as Event);

    expect(api.changeMemberRole).toHaveBeenCalledWith(1, 10, { role: 'ACCOUNT_ADMIN' });
  });

  it('removes an active member after confirmation', () => {
    const { fixture, api } = configure();
    spyOn(globalThis, 'confirm').and.returnValue(true);

    fixture.componentInstance.removeMember(member);

    expect(api.removeMember).toHaveBeenCalledWith(1, 10);
    expect(api.listMembers).toHaveBeenCalledTimes(2);
  });

  it('shows a clear last-admin error', () => {
    const admin = { ...member, role: 'ACCOUNT_ADMIN' as const };
    const { fixture } = configure({ members: [admin], changeRoleFails: true });
    const select = { value: 'ACCOUNT_MEMBER' } as HTMLSelectElement;
    spyOn(globalThis, 'confirm').and.returnValue(true);

    fixture.componentInstance.changeRole(admin, { target: select } as unknown as Event);

    expect(fixture.componentInstance.errorMessage()).toBe('La cuenta debe conservar al menos un administrador activo.');
  });
});
