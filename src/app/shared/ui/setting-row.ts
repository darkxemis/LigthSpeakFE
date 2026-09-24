import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ls-setting-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './setting-row.html',
})
export class LsSettingRow {
  readonly label = input.required<string>();
  readonly description = input('');
  readonly disabled = input(false, { transform: booleanAttribute });
}
