import { Service, inject, signal } from '@angular/core';
import { UserSettingsService } from '../../core/settings/user-settings.service';

export type SettingsTabId = 'account' | 'voice' | 'notifications' | 'chat' | 'appearance';

@Service()
export class SettingsUiService {
  private readonly userSettings = inject(UserSettingsService);
  private readonly openSignal = signal(false);

  readonly open = this.openSignal.asReadonly();
  readonly activeTab = signal<SettingsTabId>('account');

  openDialog(tab?: SettingsTabId): void {
    if (tab) {
      this.activeTab.set(tab);
    }
    this.openSignal.set(true);
    void this.userSettings.load();
  }

  close(): void {
    this.openSignal.set(false);
  }
}
