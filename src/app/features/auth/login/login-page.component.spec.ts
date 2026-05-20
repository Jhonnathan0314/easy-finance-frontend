import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { LoginPageComponent } from './login-page.component';

describe('LoginPageComponent', () => {
  let fixture: ComponentFixture<LoginPageComponent>;
  let component: LoginPageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            login: jasmine.createSpy('login').and.returnValue(of(null))
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

    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
  });

  it('requires a valid email and password', () => {
    component.form.setValue({ email: 'not-an-email', password: '' });

    expect(component.form.valid).toBeFalse();
    expect(component.form.controls.email.hasError('email')).toBeTrue();
    expect(component.form.controls.password.hasError('required')).toBeTrue();
  });
});
