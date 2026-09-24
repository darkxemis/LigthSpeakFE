import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { email, form, FormField, minLength, required } from '@angular/forms/signals';
import { AuthService } from '../../../core/auth/auth.service';
import { TranslateService } from '../../../core/i18n/translate.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ApiError, errorTranslationKey, parseApiError } from '../../../core/api/api-error';
import { LsIcon } from '../../../shared/ui/icon';

@Component({
  selector: 'ls-login',
  imports: [FormField, RouterLink, TranslatePipe, LsIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly model = signal({ email: '', password: '' });
  readonly showPassword = signal(false);
  readonly pending = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly loginForm = form(this.model, (field) => {
    required(field.email, { message: 'validation.required' });
    email(field.email, { message: 'validation.email' });
    required(field.password, { message: 'validation.required' });
    minLength(field.password, 8, { message: 'validation.minLength' });
  });

  async onSubmit(): Promise<void> {
    if (this.loginForm().invalid() || this.pending()) return;
    this.pending.set(true);
    this.serverError.set(null);
    try {
      await this.auth.login(this.model());
      await this.auth.loadProfile();
      await this.router.navigate(['/app']);
    } catch (err) {
      this.serverError.set(this.errorMessage(parseApiError(err)));
    } finally {
      this.pending.set(false);
    }
  }

  private errorMessage(error: ApiError): string {
    if (error.tag === 'validation.failed') {
      const first = Object.values(error.metadata)[0];
      return first
        ? this.translate.translate(`error.validation.${first}`)
        : this.translate.translate('error.validation.failed');
    }
    return this.translate.translate(errorTranslationKey(error));
  }
}
