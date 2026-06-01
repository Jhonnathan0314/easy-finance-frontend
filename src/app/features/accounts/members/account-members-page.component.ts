import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, take } from 'rxjs';

import { AccountsApiService } from '../../../core/accounts/accounts-api.service';
import { AccountStore } from '../../../core/state/account.store';
import { AccountMemberResponseDto, AccountRole, ApiErrorResponse } from '../../../shared/models';
import { enumLabel } from '../../../shared/ui/enum-labels';

@Component({
  selector: 'ef-account-members-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: './account-members-page.component.scss',
  template: `
    <section class="page-shell">
      <div class="page-header">
        <div>
          <h1 class="page-title">{{ accountStore.selectedAccount()?.name ?? 'Cuenta' }}</h1>
          <p class="page-subtitle">Gestiona los miembros y permisos de la cuenta {{ accountId() }}.</p>
        </div>
        <div class="header-actions">
          <a class="secondary-action" routerLink="/app/accounts">Volver a cuentas</a>
          <button class="button" type="button" (click)="goToDashboard()">Ir al dashboard</button>
        </div>
      </div>

      @if (accountStore.selectedAccount(); as account) {
        <section class="panel detail-grid">
          <div>
            <span>Descripcion</span>
            <strong>{{ account.description || 'Sin descripcion' }}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong class="badge" [class.archived]="account.status === 'ARCHIVED'">{{ enumLabel(account.status) }}</strong>
          </div>
          <div>
            <span>Rol actual</span>
            <strong class="badge role">{{ enumLabel(account.currentUserRole) }}</strong>
          </div>
        </section>

        @if (canWrite()) {
          <section class="panel account-edit-panel">
            <div class="section-header">
              <h2>Detalle de cuenta</h2>
              @if (!isEditingAccount()) {
                <button type="button" (click)="startEditAccount()">Editar cuenta</button>
              }
            </div>

            @if (isEditingAccount()) {
              <form class="form-grid account-edit-form" [formGroup]="editAccountForm" (ngSubmit)="saveAccountChanges()">
                <label class="field">
                  <span>Nombre</span>
                  <input type="text" formControlName="name" autocomplete="off">
                  @if (editAccountForm.controls.name.touched && editAccountForm.controls.name.hasError('required')) {
                    <small>El nombre es requerido.</small>
                  }
                  @if (editAccountForm.controls.name.touched && editAccountForm.controls.name.hasError('maxlength')) {
                    <small>Maximo 120 caracteres.</small>
                  }
                </label>

                <label class="field">
                  <span>Descripcion</span>
                  <textarea rows="3" formControlName="description"></textarea>
                </label>

                <div class="account-edit-actions">
                  <button type="button" (click)="cancelEditAccount()" [disabled]="isSavingAccount()">Cancelar</button>
                  <button type="submit" [disabled]="!canSaveAccountChanges()">
                    {{ isSavingAccount() ? 'Guardando...' : 'Guardar' }}
                  </button>
                </div>
              </form>
            }
          </section>
        }
      }

      @if (accountStore.selectedAccountArchived()) {
        <div class="panel warning-panel">La cuenta esta archivada; no se pueden modificar miembros.</div>
      } @else if (!canWrite()) {
        <div class="panel readonly-panel">Solo lectura. Necesitas rol administrador para modificar miembros.</div>
      }

      @if (errorMessage(); as error) {
        <div class="panel error-panel" role="alert">{{ error }}</div>
      }

      @if (successMessage(); as success) {
        <div class="panel success-panel" role="status">{{ success }}</div>
      }

      @if (canWrite()) {
        <form class="panel form-grid member-form" [formGroup]="addMemberForm" (ngSubmit)="addMember()">
          <h2>Agregar miembro</h2>
          <label class="field">
            <span>Email</span>
            <input type="email" formControlName="email" autocomplete="email" placeholder="usuario@email.com">
            @if (addMemberForm.controls.email.touched && addMemberForm.controls.email.hasError('required')) {
              <small>El email es requerido.</small>
            }
            @if (addMemberForm.controls.email.touched && addMemberForm.controls.email.hasError('email')) {
              <small>Ingresa un email valido.</small>
            }
          </label>
          <label class="field">
            <span>Rol inicial</span>
            <select formControlName="role">
              @for (role of roles; track role) {
                <option [value]="role">{{ enumLabel(role) }}</option>
              }
            </select>
          </label>
          <button class="button" type="submit" [disabled]="addMemberForm.invalid || isAdding()">
            {{ isAdding() ? 'Agregando...' : 'Agregar miembro' }}
          </button>
        </form>
      }

      <section class="panel">
        <div class="section-header">
          <h2>Miembros</h2>
          <button type="button" (click)="loadMembers()" [disabled]="isLoading()">Refrescar</button>
        </div>

        @if (isLoading()) {
          <p>Cargando miembros...</p>
        } @else if (!members().length) {
          <p>No hay miembros para mostrar.</p>
        } @else {
          <div class="members-list">
            @for (member of members(); track member.participantId) {
              <article class="member-row">
                <div class="member-main">
                  <strong>{{ member.displayName || member.email }}</strong>
                  <span>{{ member.email }}</span>
                  <small>Desde {{ formatDate(member.joinedAt) }}</small>
                </div>

                <div class="member-meta">
                  <span class="badge role">{{ enumLabel(member.role) }}</span>
                  <span class="badge" [class.inactive]="member.status === 'INACTIVE'">{{ enumLabel(member.status) }}</span>
                </div>

                @if (canWrite()) {
                  <div class="member-actions">
                    @if (member.status === 'ACTIVE') {
                      <label class="compact-field">
                        <span>Rol</span>
                        <select
                          [value]="pendingRole(member)"
                          [disabled]="isSavingMember(member.participantId)"
                          (change)="stageRoleChange(member, $event)"
                        >
                          @for (role of roles; track role) {
                            <option [value]="role" [selected]="role === pendingRole(member)">{{ enumLabel(role) }}</option>
                          }
                        </select>
                      </label>
                      @if (hasPendingRoleChange(member)) {
                        <button
                          type="button"
                          [disabled]="isSavingMember(member.participantId)"
                          (click)="saveRoleChange(member)"
                        >
                          Guardar
                        </button>
                      }
                      <button
                        type="button"
                        [disabled]="isSavingMember(member.participantId)"
                        (click)="removeMember(member)"
                      >
                        Remover
                      </button>
                    } @else {
                      <span class="muted">Sin acciones</span>
                    }
                  </div>
                }
              </article>
            }
          </div>
        }
      </section>
    </section>
  `
})
export class AccountMembersPageComponent implements OnInit {
  protected readonly accountStore = inject(AccountStore);
  protected readonly enumLabel = enumLabel;
  private readonly accountsApi = inject(AccountsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly roles: AccountRole[] = ['ACCOUNT_MEMBER', 'ACCOUNT_ADMIN'];
  readonly members = signal<AccountMemberResponseDto[]>([]);
  readonly isLoading = signal(false);
  readonly isAdding = signal(false);
  readonly savingParticipantId = signal<number | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly pendingRoleChanges = signal<Record<number, AccountRole>>({});
  readonly isEditingAccount = signal(false);
  readonly isSavingAccount = signal(false);
  readonly accountId = computed(() => Number(this.route.snapshot.paramMap.get('accountId')));
  readonly canWrite = computed(
    () => this.accountStore.selectedAccount()?.currentUserRole === 'ACCOUNT_ADMIN' && !this.accountStore.selectedAccountArchived()
  );

  readonly addMemberForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['ACCOUNT_MEMBER' as AccountRole, [Validators.required]]
  });
  readonly editAccountForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['']
  });

  ngOnInit(): void {
    this.loadMembers();
  }

  goToDashboard(): void {
    const account = this.accountStore.selectedAccount();

    if (account) {
      this.accountStore.selectAccount(account);
    }

    void this.router.navigate(['/app/accounts', this.accountId(), 'dashboard']);
  }

  loadMembers(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.accountsApi
      .listMembers(this.accountId())
      .pipe(
        take(1),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (members) => {
          this.pendingRoleChanges.set({});
          this.members.set(members);
        },
        error: (error: unknown) => {
          this.pendingRoleChanges.set({});
          this.members.set([]);
          this.errorMessage.set(this.friendlyError(this.errorCode(error)));
        }
      });
  }

  startEditAccount(): void {
    if (!this.canWrite()) {
      return;
    }

    const account = this.accountStore.selectedAccount();

    if (!account) {
      return;
    }

    this.editAccountForm.reset({
      name: account.name,
      description: account.description ?? ''
    });
    this.editAccountForm.markAsPristine();
    this.isEditingAccount.set(true);
  }

  cancelEditAccount(): void {
    this.isEditingAccount.set(false);
    this.editAccountForm.reset({ name: '', description: '' });
  }

  canSaveAccountChanges(): boolean {
    return this.canWrite() && this.isEditingAccount() && !this.isSavingAccount() && this.editAccountForm.valid && this.hasAccountChanges();
  }

  saveAccountChanges(): void {
    if (!this.canWrite() || !this.isEditingAccount()) {
      return;
    }

    if (this.editAccountForm.invalid || !this.hasAccountChanges()) {
      this.editAccountForm.markAllAsTouched();
      return;
    }

    const account = this.accountStore.selectedAccount();

    if (!account) {
      return;
    }

    const raw = this.editAccountForm.getRawValue();
    const name = raw.name.trim();
    const description = raw.description.trim();

    this.isSavingAccount.set(true);
    this.errorMessage.set(null);
    this.accountStore
      .updateAccount(account.id, {
        name,
        description: description ? description : null
      })
      .pipe(
        take(1),
        finalize(() => this.isSavingAccount.set(false))
      )
      .subscribe({
        next: () => {
          this.isEditingAccount.set(false);
          this.showSuccess('Cuenta actualizada correctamente.');
          this.editAccountForm.markAsPristine();
        },
        error: (error: unknown) => this.errorMessage.set(this.friendlyError(this.errorCode(error)))
      });
  }

  addMember(): void {
    if (!this.canWrite() || this.addMemberForm.invalid) {
      this.addMemberForm.markAllAsTouched();
      return;
    }

    this.isAdding.set(true);
    this.errorMessage.set(null);
    const raw = this.addMemberForm.getRawValue();

    this.accountsApi
      .addMember(this.accountId(), { email: raw.email.trim(), role: raw.role })
      .pipe(
        take(1),
        finalize(() => this.isAdding.set(false))
      )
      .subscribe({
        next: () => {
          this.addMemberForm.reset({ email: '', role: 'ACCOUNT_MEMBER' });
          this.showSuccess('Miembro agregado.');
          this.loadMembers();
        },
        error: (error: unknown) => this.errorMessage.set(this.friendlyError(this.errorCode(error)))
      });
  }

  stageRoleChange(member: AccountMemberResponseDto, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const nextRole = select.value as AccountRole;

    if (!this.canWrite() || member.status !== 'ACTIVE') {
      select.value = this.pendingRole(member);
      return;
    }

    this.pendingRoleChanges.update((changes) => {
      const nextChanges = { ...changes };

      if (nextRole === member.role) {
        delete nextChanges[member.participantId];
      } else {
        nextChanges[member.participantId] = nextRole;
      }

      return nextChanges;
    });
  }

  pendingRole(member: AccountMemberResponseDto): AccountRole {
    return this.pendingRoleChanges()[member.participantId] ?? member.role;
  }

  hasPendingRoleChange(member: AccountMemberResponseDto): boolean {
    return Boolean(this.pendingRoleChanges()[member.participantId]);
  }

  saveRoleChange(member: AccountMemberResponseDto): void {
    const nextRole = this.pendingRoleChanges()[member.participantId];

    if (!this.canWrite() || member.status !== 'ACTIVE' || !nextRole) {
      return;
    }

    if (
      member.role === 'ACCOUNT_ADMIN' &&
      nextRole === 'ACCOUNT_MEMBER' &&
      !globalThis.confirm('Cambiar este administrador a miembro?')
    ) {
      return;
    }

    this.savingParticipantId.set(member.participantId);
    this.errorMessage.set(null);
    this.accountsApi
      .changeMemberRole(this.accountId(), member.participantId, { role: nextRole })
      .pipe(
        take(1),
        finalize(() => this.savingParticipantId.set(null))
      )
      .subscribe({
        next: () => {
          this.pendingRoleChanges.update((changes) => {
            const nextChanges = { ...changes };
            delete nextChanges[member.participantId];
            return nextChanges;
          });
          this.showSuccess('Rol actualizado.');
          this.loadMembers();
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.friendlyError(this.errorCode(error)));
        }
      });
  }

  removeMember(member: AccountMemberResponseDto): void {
    if (
      !this.canWrite() ||
      member.status !== 'ACTIVE' ||
      !globalThis.confirm(`Remover a ${member.displayName || member.email} de la cuenta?`)
    ) {
      return;
    }

    this.savingParticipantId.set(member.participantId);
    this.errorMessage.set(null);
    this.accountsApi
      .removeMember(this.accountId(), member.participantId)
      .pipe(
        take(1),
        finalize(() => this.savingParticipantId.set(null))
      )
      .subscribe({
        next: () => {
          this.showSuccess('Miembro removido.');
          this.loadMembers();
        },
        error: (error: unknown) => this.errorMessage.set(this.friendlyError(this.errorCode(error)))
      });
  }

  isSavingMember(participantId: number): boolean {
    return this.savingParticipantId() === participantId;
  }

  formatDate(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });
  }

  friendlyError(code: string): string {
    const messages: Record<string, string> = {
      ACCOUNT_MEMBER_ALREADY_EXISTS: 'El usuario ya pertenece a la cuenta.',
      ACCOUNT_MEMBER_NOT_FOUND: 'No existe un usuario activo con ese correo o no puede agregarse.',
      ACCOUNT_LAST_ADMIN_REQUIRED: 'La cuenta debe conservar al menos un administrador activo.',
      ACCOUNT_NOT_ACTIVE: 'La cuenta no permite modificaciones.',
      ACCOUNT_WRITE_NOT_ALLOWED: 'La cuenta no permite modificaciones.',
      ACCOUNT_NOT_FOUND: 'Cuenta no encontrada o sin acceso.',
      VALIDATION_ERROR: 'Revisa los datos del formulario.',
      ACCOUNT_UPDATE_NOT_ALLOWED: 'No tienes permisos para editar esta cuenta.'
    };

    return messages[code] ?? 'No se pudo completar la operacion.';
  }

  private showSuccess(message: string): void {
    this.successMessage.set(message);
    globalThis.setTimeout(() => this.successMessage.set(null), 3000);
  }

  private errorCode(error: unknown): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const maybeHttpError = error as { error?: Partial<ApiErrorResponse> };

      if (maybeHttpError.error?.code) {
        return maybeHttpError.error.code;
      }
    }

    return 'UNKNOWN_ERROR';
  }

  private hasAccountChanges(): boolean {
    const account = this.accountStore.selectedAccount();

    if (!account) {
      return false;
    }

    const raw = this.editAccountForm.getRawValue();
    const name = raw.name.trim();
    const description = raw.description.trim();
    const currentDescription = account.description?.trim() ?? '';

    return name !== account.name.trim() || description !== currentDescription;
  }
}
