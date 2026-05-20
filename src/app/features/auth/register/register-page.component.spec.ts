import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { RegisterPageComponent } from './register-page.component';

describe('RegisterPageComponent', () => {
  let fixture: ComponentFixture<RegisterPageComponent>;
  let component: RegisterPageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            register: jasmine.createSpy('register').and.returnValue(of(null))
          }
        },
        {
          provide: AuthStore,
          useValue: {
            authError: signal(null)
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterPageComponent);
    component = fixture.componentInstance;
  });

  it('marks the form invalid when passwords do not match', () => {
    component.form.setValue({
      fullName: 'Demo User',
      email: 'demo@example.com',
      password: 'Password123!',
      confirmPassword: 'Different123!'
    });

    expect(component.form.valid).toBeFalse();
    expect(component.form.hasError('passwordMismatch')).toBeTrue();
  });
});
