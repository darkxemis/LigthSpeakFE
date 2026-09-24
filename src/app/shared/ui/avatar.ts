import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { InitialsPipe } from '../pipes/initials.pipe';

@Component({
  selector: 'ls-avatar',
  imports: [InitialsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './avatar.html',
})
export class LsAvatar {
  readonly src = input<string | null | undefined>(null);
  readonly name = input<string>('');
  readonly size = input<'xs' | 'sm' | 'md' | 'lg' | 'xl'>('md');

  readonly sizeClass = computed(() => {
    switch (this.size()) {
      case 'xs':
        return 'h-6 w-6 rounded-md text-[10px]';
      case 'sm':
        return 'h-8 w-8 rounded-lg text-xs';
      case 'lg':
        return 'h-12 w-12 rounded-xl text-base';
      case 'xl':
        return 'h-20 w-20 rounded-2xl text-2xl';
      default:
        return 'h-10 w-10 rounded-lg text-sm';
    }
  });
}
