import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LsIcon } from '../../shared/ui/icon';
import { LsAvatar } from '../../shared/ui/avatar';
import { LsToastHost } from '../../shared/ui/toast-host';
import { ProfileService } from './profile.service';
import { TranslateService } from '../../core/i18n/translate.service';
import { ToastService } from '../../core/toast/toast.service';
import { parseApiError } from '../../core/api/api-error';

@Component({
  selector: 'ls-profile-settings',
  imports: [RouterLink, DatePipe, TranslatePipe, LsIcon, LsAvatar, LsToastHost],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-settings.html',
  styleUrl: './profile-settings.css',
})
export class ProfileSettingsComponent {
  readonly auth = inject(AuthService);
  readonly translate = inject(TranslateService);
  private readonly profileService = inject(ProfileService);
  private readonly toasts = inject(ToastService);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.profileService.uploadAvatar(file);
      this.toasts.success(this.translate.translate('profile.saved'));
    } catch (err) {
      this.error.set(this.translate.translate(`error.${parseApiError(err).tag}`));
    } finally {
      this.busy.set(false);
      input.value = '';
    }
  }

  async removeAvatar(): Promise<void> {
    this.busy.set(true);
    try {
      await this.profileService.removeAvatar();
    } catch (err) {
      this.error.set(this.translate.translate(`error.${parseApiError(err).tag}`));
    } finally {
      this.busy.set(false);
    }
  }

  setLocale(locale: 'es' | 'en'): void {
    this.translate.setLocale(locale);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }
}
