import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, take } from 'rxjs';

import { AccountsApiService } from '../../../core/accounts/accounts-api.service';
import { AccountStore } from '../../../core/state/account.store';
import { AccountMemberResponseDto, AccountRole, ApiErrorResponse } from '../../../shared/models';

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
        <a class="secondary-action" [routerLink]="['/app/accounts', accountId(), 'dashboard']">Ir al dashboard</a>
      </div>

      @if (accountStore.selectedAccount(); as account) {
        <section class="panel detail-grid">
          <div>
            <span>Descripcion</span>
            <strong>{{ account.description || 'Sin descripcion' }}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong class="badge" [class.archived]="account.status === 'ARCHIVED'">{{ account.status }}</strong>
          </div>
          <div>
            <span>Rol actual</span>
            <strong class="badge role">{{ account.currentUserRole }}</strong>
          </div>
        </section>
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
                <option [value]="role">{{ role }}</option>
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
                  <span class="badge role">{{ member.role }}</span>
                  <span class="badge" [class.inactive]="member.status === 'INACTIVE'">{{ member.status }}</span>
                </div>

                @if (canWrite()) {
                  <div class="member-actions">
                    @if (member.status === 'ACTIVE') {
                      <label class="compact-field">
                        <span>Rol</span>
                        <select
                          [value]="member.role"
                          [disabled]="isSavingMember(member.participantId)"
                          (change)="changeRole(member, $event)"
                        >
                          @for (role of roles; track role) {
                            <option [value]="role">{{ role }}</option>
                          }
                        </select>
                      </label>
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
  private readonly accountsApi = inject(AccountsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly roles: AccountRole[] = ['ACCOUNT_MEMBER', 'ACCOUNT_ADMIN'];
  readonly members = signal<AccountMemberResponseDto[]>([]);
  readonly isLoading = signal(false);
  readonly isAdding = signal(false);
  readonly savingParticipantId = signal<number | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly accountId = computed(() => Number(this.route.snapshot.paramMap.get('accountId')));
  readonly canWrite = computed(
    () => this.accountStore.selectedAccount()?.currentUserRole === 'ACCOUNT_ADMIN' && !this.accountStore.selectedAccountArchived()
  );

  readonly addMemberForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['ACCOUNT_MEMBER' as AccountRole, [Validators.required]]
  });

  ngOnInit(): void {
    this.loadMembers();
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
        next: (members) => this.members.set(members),
        error: (error: unknown) => {
          this.members.set([]);
          this.errorMessage.set(this.friendlyError(this.errorCode(error)));
        }
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

  changeRole(member: AccountMemberResponseDto, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const nextRole = select.value as AccountRole;

    if (!this.canWrite() || member.status !== 'ACTIVE' || nextRole === member.role) {
      select.value = member.role;
      return;
    }

    if (
      member.role === 'ACCOUNT_ADMIN' &&
      nextRole === 'ACCOUNT_MEMBER' &&
      !globalThis.confirm('Cambiar este administrador a miembro?')
    ) {
      select.value = member.role;
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
          this.showSuccess('Rol actualizado.');
          this.loadMembers();
        },
        error: (error: unknown) => {
          select.value = member.role;
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
      VALIDATION_ERROR: 'Revisa los datos del formulario.'
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
}
