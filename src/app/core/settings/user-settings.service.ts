import { Service, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { userUrls } from '../api/api-urls';
import { parseApiError } from '../api/api-error';
import { TranslateService } from '../i18n/translate.service';
import { ToastService } from '../toast/toast.service';
import {
  DEFAULT_USER_SETTINGS,
  UserSettingsPatch,
  UserSettingsResult,
} from '../../shared/models/api.models';

/** Coalesces rapid changes (e.g. dragging a slider) into a single PATCH. */
const FLUSH_DEBOUNCE_MS = 150;

@Service()
export class UserSettingsService {
  private readonly http = inject(HttpClient);
  private readonly toasts = inject(ToastService);
  private readonly translate = inject(TranslateService);

  private readonly settingsSignal = signal<UserSettingsResult>({ ...DEFAULT_USER_SETTINGS });
  private readonly loadedSignal = signal(false);

  readonly settings = this.settingsSignal.asReadonly();
  readonly loaded = this.loadedSignal.asReadonly();

  private pending: UserSettingsPatch = {};
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor() {
    effect(() => {
      const settings = this.settingsSignal();
      const root = document.documentElement;
      root.classList.toggle('reduced-motion', settings.reducedMotionEnabled);
      root.dataset['accent'] = settings.accentColor;
    });
  }

  async load(force = false): Promise<void> {
    if (this.loadedSignal() && !force) {
      return;
    }
    try {
      const settings = await firstValueFrom(
        this.http.get<UserSettingsResult>(userUrls.meSettings()),
      );
      this.settingsSignal.set({ ...settings });
      this.loadedSignal.set(true);
    } catch {
      // Keep local defaults so the UI stays usable; the next load will sync.
    }
  }

  /** Applies the change locally and persists only the touched fields (PATCH). */
  patch(partial: UserSettingsPatch): void {
    this.settingsSignal.update((current) => ({ ...current, ...partial }));
    this.pending = { ...this.pending, ...partial };
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => this.flush(), FLUSH_DEBOUNCE_MS);
  }

  reset(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.pending = {};
    this.queue = Promise.resolve();
    this.settingsSignal.set({ ...DEFAULT_USER_SETTINGS });
    this.loadedSignal.set(false);
  }

  private flush(): void {
    this.flushTimer = null;
    const body = this.pending;
    this.pending = {};
    if (Object.keys(body).length === 0) {
      return;
    }
    this.queue = this.queue.then(() => this.send(body));
  }

  private async send(body: UserSettingsPatch): Promise<void> {
    try {
      const saved = await firstValueFrom(
        this.http.patch<UserSettingsResult>(userUrls.meSettings(), body),
      );
      this.settingsSignal.update((current) => ({
        ...current,
        ...saved,
        ...this.pending,
      }));
      this.loadedSignal.set(true);
    } catch (err) {
      this.toasts.error(this.translate.translate(`error.${parseApiError(err).tag}`));
    }
  }
}
