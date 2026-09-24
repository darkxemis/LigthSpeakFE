import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LsAvatar } from '../../../shared/ui/avatar';
import { LsIcon } from '../../../shared/ui/icon';

@Component({
  selector: 'ls-user-bar',
  imports: [RouterLink, TranslatePipe, LsAvatar, LsIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-bar.html',
})
export class UserBar {
  readonly auth = inject(AuthService);
  readonly logout = output<void>();
}
