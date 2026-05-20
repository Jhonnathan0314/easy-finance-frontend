import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, take } from 'rxjs';

import { AccountStore } from '../../core/state/account.store';
import { AccountResponseDto } from '../../shared/models';

@Component({
  selector: 'ef-accounts-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: './accounts-page.component.scss',
  template: `
    <section class="page-shell">
      <div class="page-header">
        <div>
          <h1 class="page-title">Cuentas</h1>
          <p class="page-subtitle">Selecciona o crea la cuenta de trabajo.</p>
        </div>
        <button class="button" type="button" (click)="toggleCreateForm()">
          {{ showCreateForm() ? 'Cerrar' : 'Crear cuenta' }}
        </button>
      </div>

      @if (accountStore.error(); as error) {
        <div class="panel error-panel" role="alert">
          <strong>{{ error.code }}</strong>
          <span>{{ error.message }}</span>
        </div>
      }

      @if (showCreateForm()) {
        <form class="panel form-grid account-form" [formGroup]="form" (ngSubmit)="submit()">
          <label class="field">
            <span>Nombre</span>
            <input type="text" formControlName="name" autocomplete="off">
            @if (form.controls.name.touched && form.controls.name.hasError('required')) {
              <small>El nombre es requerido.</small>
            }
            @if (form.controls.name.touched && form.controls.name.hasError('maxlength')) {
              <small>Maximo 120 caracteres.</small>
            }
          </label>

          <label class="field">
            <span>Descripcion</span>
            <textarea rows="3" formControlName="description"></textarea>
            @if (form.controls.description.touched && form.controls.description.hasError('maxlength')) {
              <small>Maximo 500 caracteres.</small>
            }
          </label>

          <button class="button" type="submit" [disabled]="form.invalid || submitting()">
            {{ submitting() ? 'Creando...' : 'Crear y seleccionar' }}
          </button>
        </form>
      }

      @if (accountStore.isLoading() && !accountStore.accounts().length) {
        <div class="panel">Cargando cuentas...</div>
      } @else if (!accountStore.accounts().length) {
        <div class="panel empty-state">
          <h2>Aun no tienes cuentas</h2>
          <p>Crea tu primera cuenta para comenzar a organizar tus finanzas.</p>
          <button class="button" type="button" (click)="openCreateForm()">Crear cuenta</button>
        </div>
      } @else {
        <div class="accounts-grid">
          @for (account of accountStore.accounts(); track account.id) {
            <article class="account-card" [class.selected]="accountStore.selectedAccountId() === account.id">
              <div class="account-card__header">
                <h2>{{ account.name }}</h2>
                <span class="status" [class.archived]="account.status === 'ARCHIVED'">{{ account.status }}</span>
              </div>
              <p>{{ account.description || 'Sin descripcion.' }}</p>
              <div class="meta">
                <span>{{ account.currentUserRole }}</span>
                <span>ID {{ account.id }}</span>
              </div>
              <div class="actions">
                <button type="button" (click)="selectAccount(account)">Seleccionar</button>
                <a [routerLink]="['/app/accounts', account.id, 'settings', 'members']">Ver detalles</a>
                <a [routerLink]="['/app/accounts', account.id, 'dashboard']">Abrir</a>
              </div>
            </article>
          }
        </div>
      }
    </section>
  `
})
export class AccountsPageComponent implements OnInit {
  protected readonly accountStore = inject(AccountStore);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);

  readonly showCreateForm = signal(false);
  readonly submitting = signal(false);
  readonly selectedAccount = computed(() => this.accountStore.selectedAccount());
  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]]
  });

  ngOnInit(): void {
    this.accountStore.loadAccounts().pipe(take(1)).subscribe({ error: () => undefined });
  }

  toggleCreateForm(): void {
    this.showCreateForm.update((value) => !value);
  }

  openCreateForm(): void {
    this.showCreateForm.set(true);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const raw = this.form.getRawValue();
    this.accountStore
      .createAccount({ name: raw.name, description: raw.description || null })
      .pipe(
        take(1),
        finalize(() => this.submitting.set(false))
      )
      .subscribe({
        next: (account) => {
          this.form.reset();
          this.showCreateForm.set(false);
          void this.router.navigate(['/app/accounts', account.id, 'dashboard']);
        },
        error: () => undefined
      });
  }

  selectAccount(account: AccountResponseDto): void {
    this.accountStore.selectAccount(account);
    void this.router.navigate(['/app/accounts', account.id, 'dashboard']);
  }
}
