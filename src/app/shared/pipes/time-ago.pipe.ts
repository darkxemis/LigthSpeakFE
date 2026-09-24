import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '../../core/i18n/translate.service';

@Pipe({ name: 'lsTimeAgo', standalone: true, pure: false })
export class TimeAgoPipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(value: string | Date | null | undefined): string {
    this.translate.locale();
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';

    const locale = this.translate.locale() === 'es' ? 'es-ES' : 'en-US';
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.round(diffMs / 1000);

    if (diffSec < 45) {
      return this.translate.locale() === 'es' ? 'ahora' : 'now';
    }

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const minutes = Math.round(diffSec / 60);
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (hours < 24) return rtf.format(-hours, 'hour');
    const days = Math.round(hours / 24);
    if (days < 30) return rtf.format(-days, 'day');
    const months = Math.round(days / 30);
    if (months < 12) return rtf.format(-months, 'month');
    return rtf.format(-Math.round(months / 12), 'year');
  }
}
