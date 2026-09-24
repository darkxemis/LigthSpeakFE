import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ChatService } from './chat.service';
import { ServersService } from '../servers/servers.service';
import { VoiceService } from '../voice/voice.service';
import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LsIcon } from '../../shared/ui/icon';
import { LsAvatar } from '../../shared/ui/avatar';
import { parseApiError } from '../../core/api/api-error';
import { TranslateService } from '../../core/i18n/translate.service';
import { ToastService } from '../../core/toast/toast.service';
import type { MessageResult } from '../../shared/models/api.models';

@Component({
  selector: 'ls-chat',
  imports: [DatePipe, TranslatePipe, LsIcon, LsAvatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class ChatComponent {
  readonly chat = inject(ChatService);
  readonly servers = inject(ServersService);
  readonly voice = inject(VoiceService);
  readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly toasts = inject(ToastService);

  readonly channelId = input.required<string>();

  private readonly messageScroll = viewChild<ElementRef<HTMLDivElement>>('messageScroll');
  private prevMessageCount = 0;
  private wasNearBottom = true;

  readonly draft = signal('');
  readonly editingId = signal<string | null>(null);
  readonly editDraft = signal('');
  readonly showMembers = signal(true);
  readonly showVoice = signal(false);
  readonly sendError = signal<string | null>(null);
  readonly typingLocal = signal(false);

  readonly channel = computed(
    () => this.servers.channels().find((c) => c.id === this.channelId()) ?? null,
  );

  readonly isVoiceChannel = computed(() => this.channel()?.type === 1);

  readonly groupedMessages = computed(() => {
    const messages = this.chat.messages();
    return messages.map((message, index) => {
      const prev = messages[index - 1];
      const compact =
        prev !== undefined &&
        prev.authorId === message.authorId &&
        new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
      return { message, compact };
    });
  });

  readonly typingText = computed(() => {
    const users = this.chat.typingSummary().filter((u) => u.userId !== this.auth.profile()?.id);
    if (users.length === 0) return null;
    if (users.length > 1) return this.translate.translate('chat.typing.many');
    return this.translate.translate('chat.typing.one', { name: users[0].username });
  });

  constructor() {
    effect(() => {
      const id = this.channelId();
      if (!id) return;
      const channelType = this.channel()?.type;
      if (channelType === 1) {
        void this.chat.closeChannel();
        this.showVoice.set(true);
      } else {
        void this.voice.leave();
        this.showVoice.set(false);
        void this.chat.openChannel(id);
      }
      this.prevMessageCount = 0;
      this.wasNearBottom = true;
    });

    effect((onCleanup) => {
      const el = this.messageScroll()?.nativeElement;
      if (!el) return;

      const onScroll = (): void => {
        const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
        this.wasNearBottom = distance < 80;
      };
      el.addEventListener('scroll', onScroll, { passive: true });
      onCleanup(() => el.removeEventListener('scroll', onScroll));
    });

    effect(() => {
      const el = this.messageScroll()?.nativeElement;
      const count = this.chat.messages().length;
      if (!el) {
        this.prevMessageCount = count;
        return;
      }

      const grew = count > this.prevMessageCount;
      this.prevMessageCount = count;
      if (grew && this.wasNearBottom) {
        queueMicrotask(() => this.scrollToBottom());
      }
    });

    effect((onCleanup) => {
      const interval = setInterval(() => this.chat.pruneTyping(), 2000);
      onCleanup(() => clearInterval(interval));
    });
  }

  private scrollToBottom(): void {
    const el = this.messageScroll()?.nativeElement;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    this.wasNearBottom = true;
  }

  async send(): Promise<void> {
    const content = this.draft().trim();
    if (!content) return;
    this.sendError.set(null);
    try {
      await this.chat.send(content);
      this.draft.set('');
      this.typingLocal.set(false);
      this.scrollToBottom();
    } catch (err) {
      const apiError = parseApiError(err);
      if (apiError.tag === 'messages.rateLimited') {
        this.sendError.set(
          this.translate.translate('chat.rateLimited', {
            seconds: apiError.metadata['retryAfterSeconds'] ?? '10',
          }),
        );
      } else {
        this.sendError.set(this.translate.translate(`error.${apiError.tag}`));
      }
    }
  }

  onComposerInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.draft.set(value);
    if (!this.typingLocal()) {
      this.typingLocal.set(true);
      void this.chat.notifyTyping();
    }
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  startEdit(message: MessageResult): void {
    this.editingId.set(message.id);
    this.editDraft.set(message.content);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editDraft.set('');
  }

  async saveEdit(message: MessageResult): Promise<void> {
    const content = this.editDraft().trim();
    if (!content || content === message.content) {
      this.cancelEdit();
      return;
    }
    try {
      await this.chat.editMessage(message.id, content);
      this.cancelEdit();
    } catch (err) {
      this.toasts.error(this.translate.translate(`error.${parseApiError(err).tag}`));
    }
  }

  async removeMessage(message: MessageResult): Promise<void> {
    try {
      await this.chat.deleteMessage(message.id);
    } catch (err) {
      this.toasts.error(this.translate.translate(`error.${parseApiError(err).tag}`));
    }
  }

  canModerate(message: MessageResult): boolean {
    const profile = this.auth.profile();
    if (!profile) return false;
    if (message.authorId === profile.id) return true;
    const server = this.servers.selectedServer();
    if (!server) return false;
    if (server.ownerId === profile.id) return true;
    const member = this.servers.members().find((m) => m.userId === profile.id);
    return (member?.role ?? 0) >= 1 || profile.roles.includes('admin');
  }

  async toggleVoice(): Promise<void> {
    const profile = this.auth.profile();
    const channel = this.channel();
    if (!profile || !channel) return;

    if (this.voice.channelId() === channel.id) {
      await this.voice.leave();
      this.showVoice.set(false);
      return;
    }

    try {
      await this.voice.join(channel.id, profile.id);
      this.showVoice.set(true);
    } catch {
      this.toasts.error(this.translate.translate('voice.micDenied'));
    }
  }

  authorName(message: MessageResult): string {
    return `${message.authorFirstName} ${message.authorLastName}`.trim();
  }

  sameAuthor(a: MessageResult, b: MessageResult): boolean {
    return a.authorId === b.authorId;
  }

  channelIcon(): 'hash' | 'volume' {
    return this.isVoiceChannel() ? 'volume' : 'hash';
  }
}
