import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, take } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { ApiErrorResponse } from '../../../shared/models';

@Component({
  selector: 'ef-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: '../auth-page.scss',
  template: `
    <main class="auth-page">
      <section class="auth-card">
        <div>
          <p class="eyebrow">Easy Finance</p>
          <h1>Iniciar sesion</h1>
        </div>

        <form class="form-grid" [formGroup]="form" (ngSubmit)="submit()">
          <label class="field">
            <span>Email</span>
            <input type="email" autocomplete="email" formControlName="email">
            @if (form.controls.email.touched && form.controls.email.hasError('required')) {
              <small>El email es requerido.</small>
            }
            @if (form.controls.email.touched && form.controls.email.hasError('email')) {
              <small>Ingresa un email valido.</small>
            }
          </label>

          <label class="field">
            <span>Password</span>
            <input type="password" autocomplete="current-password" formControlName="password">
            @if (form.controls.password.touched && form.controls.password.hasError('required')) {
              <small>La contrasena es requerida.</small>
            }
          </label>

          @if (errorMessage(); as message) {
            <p class="form-error" role="alert">{{ message }}</p>
          }

          <button class="button" type="submit" [disabled]="form.invalid || submitting()">
            {{ submitting() ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>

        <a routerLink="/register">Crear una cuenta</a>
      </section>
    </main>
  `
})
export class LoginPageComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly errorMessage = computed(() => friendlyAuthError(this.authStore.authError()));
  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.authService
      .login(this.form.getRawValue())
      .pipe(
        take(1),
        finalize(() => this.submitting.set(false))
      )
      .subscribe({
        next: () => void this.router.navigate(['/app/accounts']),
        error: () => undefined
      });
  }
}

function friendlyAuthError(error: ApiErrorResponse | null): string | null {
  if (!error) {
    return null;
  }

  const messages: Record<string, string> = {
    INVALID_CREDENTIALS: 'Email o contrasena incorrectos.',
    INVALID_TOKEN: 'La sesion no es valida. Inicia sesion nuevamente.',
    TOKEN_EXPIRED: 'La sesion expiro. Inicia sesion nuevamente.',
    USER_BLOCKED: 'Tu usuario esta bloqueado. Contacta al administrador.',
    USER_NOT_ACTIVE: 'Tu usuario no esta activo.',
    PARTICIPANT_NOT_ACTIVE: 'Tu participante no esta activo.'
  };

  return messages[error.code] ?? error.message ?? 'No fue posible iniciar sesion.';
}
