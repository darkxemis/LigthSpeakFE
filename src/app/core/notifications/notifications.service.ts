import { Service, inject } from '@angular/core';
import { ChatHubService } from '../realtime/chat-hub.service';
import { AuthService } from '../auth/auth.service';
import { ToneService } from '../audio/tone.service';
import { UserSettingsService } from '../settings/user-settings.service';
import type { MessageResult } from '../../shared/models/api.models';

const MESSAGE_NOTES = [880, 1174.66];
const MESSAGE_NOTE_DURATION = 0.09;
const MESSAGE_PEAK_GAIN = 1;

@Service()
export class NotificationsService {
  private readonly hub = inject(ChatHubService);
  private readonly auth = inject(AuthService);
  private readonly tone = inject(ToneService);
  private readonly settings = inject(UserSettingsService);

  constructor() {
    this.hub.messages$.subscribe((message) => this.onMessage(message));
  }

  private onMessage(message: MessageResult): void {
    const isOwn = message.authorId === this.auth.profile()?.id;
    const appHidden = document.hidden || !document.hasFocus();
    if (isOwn || !appHidden) {
      return;
    }

    const settings = this.settings.settings();

    if (settings.messageSoundEnabled) {
      this.tone.play(MESSAGE_NOTES, MESSAGE_NOTE_DURATION, MESSAGE_PEAK_GAIN * (settings.outputVolume / 100));
    }

    if (settings.desktopNotificationsEnabled) {
      this.showDesktopNotification(message);
    }
  }

  private showDesktopNotification(message: MessageResult): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return;
    }

    try {
      const title = `${message.authorFirstName} ${message.authorLastName}`.trim();
      const notification = new Notification(title, {
        body: message.content,
        icon: message.authorProfileImageUrl ?? undefined,
        tag: message.channelId,
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch {
      // Some platforms throw when the notification service is not ready yet.
    }
  }
}
