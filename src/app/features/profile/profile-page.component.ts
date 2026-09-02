import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'ef-profile-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  styleUrl: './profile-page.component.scss',
  template: `
    <section class="page-shell">
      <div class="page-header">
        <div>
          <h1 class="page-title">Mi perfil</h1>
          <p class="page-subtitle">Actualiza tu nombre. Se usara en toda la aplicacion, incluyendo las cuentas donde participas.</p>
        </div>
      </div>

      @if (successMessage(); as message) {
        <div class="panel success-panel">{{ message }}</div>
      }

      @if (errorMessage(); as message) {
        <div class="panel error-panel" role="alert">{{ message }}</div>
      }

      <form class="panel form-grid" [formGroup]="form" (ngSubmit)="submit()">
        <label class="field">
          <span>Nombre completo</span>
          <input type="text" autocomplete="name" formControlName="fullName">
          @if (form.controls.fullName.touched && form.controls.fullName.hasError('required')) {
            <small>El nombre es requerido.</small>
          }
          @if (form.controls.fullName.touched && form.controls.fullName.hasError('maxlength')) {
            <small>El nombre no puede superar los 150 caracteres.</small>
          }
        </label>

        <div class="form-actions">
          <button class="button" type="submit" [disabled]="form.invalid || authStore.isLoading()">
            {{ authStore.isLoading() ? 'Guardando...' : 'Guardar cambios' }}
          </button>
        </div>
      </form>
    </section>
  `
})
export class ProfilePageComponent {
  protected readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = computed(() => friendlyProfileError(this.authStore.authError()?.code, this.authStore.authError()?.message));

  readonly form = this.fb.group({
    fullName: [this.authStore.user()?.fullName ?? '', [Validators.required, Validators.maxLength(150)]]
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.successMessage.set(null);
    const raw = this.form.getRawValue();

    this.authService
      .updateProfile({ fullName: raw.fullName.trim() })
      .pipe(take(1))
      .subscribe({
        next: () => this.successMessage.set('Nombre actualizado correctamente.'),
        error: () => undefined
      });
  }
}

function friendlyProfileError(code: string | undefined, fallback: string | undefined): string | null {
  if (!code) {
    return null;
  }

  const messages: Record<string, string> = {
    FULL_NAME_REQUIRED: 'El nombre es requerido.',
    VALIDATION_ERROR: 'Revisa los datos del formulario.'
  };

  return messages[code] ?? fallback ?? 'No fue posible actualizar el perfil.';
}
