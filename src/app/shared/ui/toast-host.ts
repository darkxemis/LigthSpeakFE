import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/toast/toast.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LsIcon } from './icon';

@Component({
  selector: 'ls-toast-host',
  imports: [TranslatePipe, LsIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast-host.html',
})
export class LsToastHost {
  readonly toasts = inject(ToastService);
}
