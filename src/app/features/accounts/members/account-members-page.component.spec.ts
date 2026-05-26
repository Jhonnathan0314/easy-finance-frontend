import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
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
  } = {}): {
    fixture: ComponentFixture<AccountMembersPageComponent>;
    api: jasmine.SpyObj<AccountsApiService>;
    accountStore: { selectAccount: jasmine.Spy };
    router: Router;
  } {
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
    const accountStore = {
      selectedAccountId: signal(1),
      selectedAccount: signal(selectedAccount),
      selectedAccountArchived: signal(Boolean(options.archived)),
      selectAccount: jasmine.createSpy('selectAccount')
    };

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
          useValue: accountStore
        },
        { provide: AccountsApiService, useValue: api }
      ]
    });

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(AccountMembersPageComponent);
    fixture.detectChanges();
    return { fixture, api, accountStore, router };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('lists members on load', () => {
    const { fixture, api } = configure();

    expect(api.listMembers).toHaveBeenCalledWith(1);
    expect(fixture.nativeElement.textContent).toContain('member@example.com');
    expect(fixture.nativeElement.textContent).toContain('ACCOUNT_MEMBER');
  });

  it('shows clear navigation actions in account detail', () => {
    const { fixture } = configure();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Volver a cuentas');
    expect(text).toContain('Ir al dashboard');
  });

  it('selects the account before navigating to dashboard from detail', () => {
    const { fixture, accountStore, router } = configure();

    fixture.componentInstance.goToDashboard();

    expect(accountStore.selectAccount).toHaveBeenCalledWith(jasmine.objectContaining({ id: 1 }));
    expect(router.navigate).toHaveBeenCalledWith(['/app/accounts', 1, 'dashboard']);
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

    fixture.componentInstance.stageRoleChange(member, { target: select } as unknown as Event);
    fixture.componentInstance.saveRoleChange(member);

    expect(api.changeMemberRole).toHaveBeenCalledWith(1, 10, { role: 'ACCOUNT_ADMIN' });
  });

  it('shows the real current admin role in the member select', () => {
    const admin = { ...member, role: 'ACCOUNT_ADMIN' as const };
    const { fixture } = configure({ members: [admin] });
    const selects = fixture.nativeElement.querySelectorAll('select') as NodeListOf<HTMLSelectElement>;
    const memberRoleSelect = selects[1];

    expect(memberRoleSelect.value).toBe('ACCOUNT_ADMIN');
  });

  it('shows the real current member role in the member select', () => {
    const { fixture } = configure();
    const selects = fixture.nativeElement.querySelectorAll('select') as NodeListOf<HTMLSelectElement>;
    const memberRoleSelect = selects[1];

    expect(memberRoleSelect.value).toBe('ACCOUNT_MEMBER');
  });

  it('stages role changes without calling the backend immediately', () => {
    const { fixture, api } = configure();
    const select = { value: 'ACCOUNT_ADMIN' } as HTMLSelectElement;

    fixture.componentInstance.stageRoleChange(member, { target: select } as unknown as Event);

    expect(fixture.componentInstance.hasPendingRoleChange(member)).toBeTrue();
    expect(api.changeMemberRole).not.toHaveBeenCalled();
  });

  it('shows the save action only when a role change is pending', () => {
    const { fixture } = configure();

    expect(fixture.nativeElement.textContent).not.toContain('Guardar');

    fixture.componentInstance.stageRoleChange(member, { target: { value: 'ACCOUNT_ADMIN' } } as unknown as Event);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Guardar');
  });

  it('removes the pending role change when returning to the original role', () => {
    const { fixture } = configure();

    fixture.componentInstance.stageRoleChange(member, { target: { value: 'ACCOUNT_ADMIN' } } as unknown as Event);
    expect(fixture.componentInstance.hasPendingRoleChange(member)).toBeTrue();

    fixture.componentInstance.stageRoleChange(member, { target: { value: 'ACCOUNT_MEMBER' } } as unknown as Event);

    expect(fixture.componentInstance.hasPendingRoleChange(member)).toBeFalse();
  });

  it('clears pending role changes after saving', () => {
    const { fixture } = configure();

    fixture.componentInstance.stageRoleChange(member, { target: { value: 'ACCOUNT_ADMIN' } } as unknown as Event);
    fixture.componentInstance.saveRoleChange(member);

    expect(fixture.componentInstance.hasPendingRoleChange(member)).toBeFalse();
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

    fixture.componentInstance.stageRoleChange(admin, { target: select } as unknown as Event);
    fixture.componentInstance.saveRoleChange(admin);

    expect(fixture.componentInstance.errorMessage()).toBe('La cuenta debe conservar al menos un administrador activo.');
  });
});
