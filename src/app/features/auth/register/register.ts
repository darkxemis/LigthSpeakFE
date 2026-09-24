import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { email, form, FormField, minLength, required } from '@angular/forms/signals';
import { AuthService } from '../../../core/auth/auth.service';
import { TranslateService } from '../../../core/i18n/translate.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ToastService } from '../../../core/toast/toast.service';
import { errorTranslationKey, parseApiError } from '../../../core/api/api-error';
import { LsIcon } from '../../../shared/ui/icon';

@Component({
  selector: 'ls-register',
  imports: [FormField, RouterLink, TranslatePipe, LsIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly toasts = inject(ToastService);

  readonly model = signal({ firstName: '', lastName: '', email: '', password: '' });
  readonly showPassword = signal(false);
  readonly pending = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly registerForm = form(this.model, (field) => {
    required(field.firstName, { message: 'validation.firstNameRequired' });
    required(field.lastName, { message: 'validation.lastNameRequired' });
    required(field.email, { message: 'validation.required' });
    email(field.email, { message: 'validation.email' });
    required(field.password, { message: 'validation.required' });
    minLength(field.password, 8, { message: 'validation.passwordPolicy' });
  });

  async onSubmit(): Promise<void> {
    if (this.registerForm().invalid() || this.pending()) return;
    this.pending.set(true);
    this.serverError.set(null);
    try {
      await this.auth.register(this.model());
      this.toasts.success(this.translate.translate('auth.registerSuccess'));
      await this.router.navigate(['/login']);
    } catch (err) {
      const apiError = parseApiError(err);
      if (apiError.tag === 'validation.failed') {
        const first = Object.values(apiError.metadata)[0];
        this.serverError.set(
          first
            ? this.translate.translate(`error.validation.${first}`)
            : this.translate.translate('error.validation.failed'),
        );
      } else {
        this.serverError.set(this.translate.translate(errorTranslationKey(apiError)));
      }
    } finally {
      this.pending.set(false);
    }
  }
}
