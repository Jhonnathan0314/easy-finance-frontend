import { Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, take } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { ApiErrorResponse } from '../../../shared/models';

@Component({
  selector: 'ef-register-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: '../auth-page.scss',
  template: `
    <main class="auth-page">
      <section class="auth-card">
        <div>
          <p class="eyebrow">Easy Finance</p>
          <h1>Crear cuenta</h1>
        </div>

        <form class="form-grid" [formGroup]="form" (ngSubmit)="submit()">
          <label class="field">
            <span>Nombre completo</span>
            <input type="text" autocomplete="name" formControlName="fullName">
            @if (form.controls.fullName.touched && form.controls.fullName.hasError('required')) {
              <small>El nombre es requerido.</small>
            }
          </label>

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
            <input type="password" autocomplete="new-password" formControlName="password">
            @if (form.controls.password.touched && form.controls.password.hasError('required')) {
              <small>La contrasena es requerida.</small>
            }
            @if (form.controls.password.touched && form.controls.password.hasError('minlength')) {
              <small>Usa al menos 8 caracteres.</small>
            }
          </label>

          <label class="field">
            <span>Confirmar password</span>
            <input type="password" autocomplete="new-password" formControlName="confirmPassword">
            @if (form.controls.confirmPassword.touched && form.controls.confirmPassword.hasError('required')) {
              <small>Confirma la contrasena.</small>
            }
            @if (form.controls.confirmPassword.touched && form.hasError('passwordMismatch')) {
              <small>Las contrasenas no coinciden.</small>
            }
          </label>

          @if (errorMessage(); as message) {
            <p class="form-error" role="alert">{{ message }}</p>
          }

          <button class="button" type="submit" [disabled]="form.invalid || submitting()">
            {{ submitting() ? 'Creando cuenta...' : 'Registrarme' }}
          </button>
        </form>

        <a routerLink="/login">Ya tengo cuenta</a>
      </section>
    </main>
  `
})
export class RegisterPageComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly errorMessage = computed(() => friendlyRegisterError(this.authStore.authError()));
  readonly form = this.fb.group(
    {
      fullName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: passwordMatchValidator }
  );

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const { confirmPassword: _confirmPassword, ...request } = this.form.getRawValue();
    this.authService
      .register(request)
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

export function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  return password && confirmPassword && password !== confirmPassword ? { passwordMismatch: true } : null;
}

function friendlyRegisterError(error: ApiErrorResponse | null): string | null {
  if (!error) {
    return null;
  }

  const messages: Record<string, string> = {
    EMAIL_ALREADY_REGISTERED: 'Ese email ya esta registrado.',
    VALIDATION_ERROR: 'Revisa los datos del formulario.',
    USER_BLOCKED: 'Tu usuario esta bloqueado. Contacta al administrador.',
    USER_NOT_ACTIVE: 'Tu usuario no esta activo.',
    PARTICIPANT_NOT_ACTIVE: 'Tu participante no esta activo.'
  };

  return messages[error.code] ?? error.message ?? 'No fue posible crear la cuenta.';
}
