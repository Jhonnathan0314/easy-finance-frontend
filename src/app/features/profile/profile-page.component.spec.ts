import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { AuthenticatedUserDto } from '../../shared/models';
import { ProfilePageComponent } from './profile-page.component';

describe('ProfilePageComponent', () => {
  const user: AuthenticatedUserDto = {
    userId: 1,
    participantId: 2,
    email: 'demo@example.com',
    fullName: 'Demo User',
    globalRoles: ['USER']
  };

  function configure(options: {
    error?: { code: string; message: string } | null;
    isLoading?: boolean;
  } = {}): ComponentFixture<ProfilePageComponent> {
    const updateProfileSpy = jasmine.createSpy('updateProfile').and.returnValue(of({ ...user, fullName: 'Jane Smith' }));

    TestBed.configureTestingModule({
      imports: [ProfilePageComponent],
      providers: [
        {
          provide: AuthService,
          useValue: { updateProfile: updateProfileSpy }
        },
        {
          provide: AuthStore,
          useValue: {
            user: signal(user),
            authError: signal(options.error ?? null),
            isLoading: signal(options.isLoading ?? false)
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('prefills the form with the current full name', () => {
    const fixture = configure();

    expect(fixture.componentInstance.form.getRawValue().fullName).toBe('Demo User');
  });

  it('requires a non-blank full name', () => {
    const fixture = configure();
    fixture.componentInstance.form.setValue({ fullName: '' });

    expect(fixture.componentInstance.form.invalid).toBeTrue();
    expect(fixture.componentInstance.form.controls.fullName.hasError('required')).toBeTrue();
  });

  it('rejects a full name longer than 150 characters', () => {
    const fixture = configure();
    fixture.componentInstance.form.setValue({ fullName: 'a'.repeat(151) });

    expect(fixture.componentInstance.form.controls.fullName.hasError('maxlength')).toBeTrue();
  });

  it('submits the trimmed full name and shows a success message', () => {
    const fixture = configure();
    const authService = TestBed.inject(AuthService) as unknown as { updateProfile: jasmine.Spy };
    fixture.componentInstance.form.setValue({ fullName: '  Jane Smith  ' });

    fixture.componentInstance.submit();

    expect(authService.updateProfile).toHaveBeenCalledWith({ fullName: 'Jane Smith' });
    expect(fixture.componentInstance.successMessage()).toBe('Nombre actualizado correctamente.');
  });

  it('does not submit an invalid form', () => {
    const fixture = configure();
    const authService = TestBed.inject(AuthService) as unknown as { updateProfile: jasmine.Spy };
    fixture.componentInstance.form.setValue({ fullName: '' });

    fixture.componentInstance.submit();

    expect(authService.updateProfile).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.controls.fullName.touched).toBeTrue();
  });

  it('shows a friendly message for FULL_NAME_REQUIRED errors from the backend', () => {
    const fixture = configure({ error: { code: 'FULL_NAME_REQUIRED', message: 'Full name is required.' } });

    expect(fixture.nativeElement.textContent).toContain('El nombre es requerido.');
  });

  it('disables the submit button while saving', () => {
    const fixture = configure({ isLoading: true });
    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(button.disabled).toBeTrue();
    expect(button.textContent).toContain('Guardando...');
  });
});
