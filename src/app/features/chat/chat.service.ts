import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { messageUrls } from '../../core/api/api-urls';
import { ChatHubService } from '../../core/realtime/chat-hub.service';
import type { MessageResult } from '../../shared/models/api.models';

@Service()
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly hub = inject(ChatHubService);

  private readonly channelIdSignal = signal<string | null>(null);
  private readonly messagesSignal = signal<MessageResult[]>([]);
  private readonly hasMoreSignal = signal(false);
  private readonly loadingSignal = signal(false);
  private readonly typingUsersSignal = signal<{ userId: string; username: string; at: number }[]>([]);
  private readonly connectedSignal = this.hub.connected;

  readonly channelId = this.channelIdSignal.asReadonly();
  readonly messages = this.messagesSignal.asReadonly();
  readonly hasMore = this.hasMoreSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly typingUsers = this.typingUsersSignal.asReadonly();
  readonly hubConnected = this.connectedSignal.asReadonly();

  readonly typingSummary = computed(() => this.typingUsersSignal().filter((u) => Date.now() - u.at < 4000));

  async openChannel(channelId: string): Promise<void> {
    if (this.channelIdSignal() === channelId) {
      await this.hub.joinChannel(channelId);
      return;
    }

    this.channelIdSignal.set(channelId);
    this.messagesSignal.set([]);
    this.hasMoreSignal.set(false);
    this.typingUsersSignal.set([]);
    this.loadingSignal.set(true);

    try {
      const [page] = await Promise.all([
        this.fetchPage(channelId, undefined),
        this.hub.joinChannel(channelId),
      ]);
      this.messagesSignal.set(page.messages);
      this.hasMoreSignal.set(page.hasMore);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async closeChannel(): Promise<void> {
    await this.hub.leaveChannel();
    this.channelIdSignal.set(null);
    this.messagesSignal.set([]);
    this.typingUsersSignal.set([]);
    this.hasMoreSignal.set(false);
  }

  async loadOlder(): Promise<void> {
    const channelId = this.channelIdSignal();
    const current = this.messagesSignal();
    if (!channelId || !current.length || !this.hasMoreSignal() || this.loadingSignal()) {
      return;
    }

    this.loadingSignal.set(true);
    try {
      const page = await this.fetchPage(channelId, current[0].id);
      this.messagesSignal.update((list) => [...page.messages.filter((m) => !list.some((x) => x.id === m.id)), ...list]);
      this.hasMoreSignal.set(page.hasMore);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async send(content: string): Promise<void> {
    const channelId = this.channelIdSignal();
    if (!channelId || !content.trim()) return;
    await this.hub.sendMessage(channelId, content.trim());
  }

  async notifyTyping(): Promise<void> {
    const channelId = this.channelIdSignal();
    if (!channelId) return;
    await this.hub.sendTyping(channelId);
  }

  async editMessage(messageId: string, content: string): Promise<MessageResult> {
    const channelId = this.channelIdSignal();
    if (!channelId) throw new Error('No active channel');
    const updated = await firstValueFrom(
      this.http.put<MessageResult>(messageUrls.byChannelMessage(channelId, messageId), { content }),
    );
    this.messagesSignal.update((list) => list.map((m) => (m.id === updated.id ? updated : m)));
    return updated;
  }

  async deleteMessage(messageId: string): Promise<void> {
    const channelId = this.channelIdSignal();
    if (!channelId) return;
    await firstValueFrom(
      this.http.delete<void>(messageUrls.byChannelMessage(channelId, messageId)),
    );
    this.messagesSignal.update((list) => list.filter((m) => m.id !== messageId));
  }

  /** Wire hub streams once at app start. */
  listenToHub(): void {
    void this.hub.start();

    this.hub.messages$.subscribe((message) => {
      if (message.channelId !== this.channelIdSignal()) return;
      this.messagesSignal.update((list) => {
        if (list.some((m) => m.id === message.id)) {
          return list.map((m) => (m.id === message.id ? message : m));
        }
        return [...list, message];
      });
    });

    this.hub.typing$.subscribe(({ userId, username }) => {
      if (userId === undefined) return;
      this.typingUsersSignal.update((list) => [
        ...list.filter((u) => u.userId !== userId),
        { userId, username, at: Date.now() },
      ]);
    });
  }

  /** Keep typing list fresh without a timer loop. */
  pruneTyping(): void {
    this.typingUsersSignal.update((list) => list.filter((u) => Date.now() - u.at < 4000));
  }

  private async fetchPage(channelId: string, beforeId?: string): Promise<{ messages: MessageResult[]; hasMore: boolean }> {
    let params = new HttpParams().set('take', '50');
    if (beforeId) {
      params = params.set('beforeId', beforeId);
    }
    return firstValueFrom(
      this.http.get<{ messages: MessageResult[]; hasMore: boolean }>(
        messageUrls.byChannel(channelId),
        { params },
      ),
    );
  }
}
