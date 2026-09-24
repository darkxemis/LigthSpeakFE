import { DOCUMENT } from '@angular/common';
import { Service, computed, inject, signal } from '@angular/core';
import { tokenStore } from '../auth/token-store';
import en from '../../../assets/i18n/en.json';
import es from '../../../assets/i18n/es.json';

export type Locale = 'en' | 'es';

export const LOCALES: readonly Locale[] = ['es', 'en'] as const;

const DICTIONARIES: Record<Locale, Record<string, string>> = {
  en: en as Record<string, string>,
  es: es as Record<string, string>,
};

@Service()
export class TranslateService {
  private readonly document = inject(DOCUMENT);

  private readonly localeSignal = signal<Locale>(resolveInitialLocale());
  readonly locale = this.localeSignal.asReadonly();
  readonly localeLabel = computed(() => (this.localeSignal() === 'es' ? 'Español' : 'English'));

  constructor() {
    this.applyDocumentLang(this.localeSignal());
  }

  setLocale(locale: Locale): void {
    tokenStore.setLocale(locale);
    if (this.localeSignal() === locale) return;
    this.localeSignal.set(locale);
    this.applyDocumentLang(locale);
  }

  toggleLocale(): void {
    this.setLocale(this.localeSignal() === 'es' ? 'en' : 'es');
  }

  translate(key: string, params?: Record<string, string | number>): string {
    const dict = DICTIONARIES[this.localeSignal()];
    let text = dict[key] ?? DICTIONARIES['en'][key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  }

  private applyDocumentLang(locale: Locale): void {
    this.document.documentElement.lang = locale;
  }
}

function resolveInitialLocale(): Locale {
  const stored = tokenStore.getLocale();
  if (stored === 'en' || stored === 'es') return stored;
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'es';
  return nav.toLowerCase().startsWith('es') ? 'es' : 'en';
}
