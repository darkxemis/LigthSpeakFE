import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from './translate.service';

@Pipe({ name: 't', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(key: string, params?: Record<string, string | number>): string {
    // Reactive dependency: re-evaluates when locale signal changes (impure pipe).
    this.translate.locale();
    return this.translate.translate(key, params);
  }
}
