import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'ls-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toggle.html',
})
export class LsToggle {
  readonly checked = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly label = input('');

  readonly changed = output<boolean>();

  toggle(): void {
    if (this.disabled()) {
      return;
    }
    this.changed.emit(!this.checked());
  }
}
