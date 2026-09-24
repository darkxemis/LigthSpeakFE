import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LsIcon } from './icon';

@Component({
  selector: 'ls-modal',
  imports: [LsIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal.html',
})
export class LsModal {
  readonly open = input(false, { transform: booleanAttribute });
  readonly title = input.required<string>();
  readonly subtitle = input('');

  readonly dismiss = output<void>();
  readonly backdropDismiss = output<void>();
}
