import { HttpClient } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { parseApiError } from '../../core/api/api-error';
import { channelUrls, serverUrls } from '../../core/api/api-urls';
import type {
  ChannelResult,
  ServerMemberResult,
  ServerResult,
} from '../../shared/models/api.models';

@Service()
export class ServersService {
  private readonly http = inject(HttpClient);

  private readonly serversSignal = signal<ServerResult[]>([]);
  private readonly selectedServerIdSignal = signal<string | null>(null);
  private readonly channelsSignal = signal<ChannelResult[]>([]);
  private readonly membersSignal = signal<ServerMemberResult[]>([]);
  private readonly loadingSignal = signal(false);

  readonly servers = this.serversSignal.asReadonly();
  readonly selectedServerId = this.selectedServerIdSignal.asReadonly();
  readonly channels = this.channelsSignal.asReadonly();
  readonly members = this.membersSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  readonly selectedServer = computed(() =>
    this.serversSignal().find((s) => s.id === this.selectedServerIdSignal()) ?? null,
  );

  readonly textChannels = computed(() =>
    this.channelsSignal().filter((c) => c.type === 0),
  );

  readonly voiceChannels = computed(() =>
    this.channelsSignal().filter((c) => c.type === 1),
  );

  async loadServers(): Promise<ServerResult[]> {
    this.loadingSignal.set(true);
    try {
      const servers = await firstValueFrom(this.http.get<ServerResult[]>(serverUrls.root()));
      this.serversSignal.set(servers);
      return servers;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async createServer(name: string): Promise<ServerResult> {
    const server = await firstValueFrom(
      this.http.post<ServerResult>(serverUrls.root(), { name }),
    );
    this.serversSignal.update((list) => [...list, server]);
    return server;
  }

  async joinServer(code: string): Promise<ServerResult> {
    const server = await firstValueFrom(
      this.http.post<ServerResult>(serverUrls.join(), { code }),
    );
    this.serversSignal.update((list) =>
      list.some((s) => s.id === server.id) ? list.map((s) => (s.id === server.id ? server : s)) : [...list, server],
    );
    return server;
  }

  async loadServer(serverId: string): Promise<ServerResult> {
    const server = await firstValueFrom(this.http.get<ServerResult>(serverUrls.byId(serverId)));
    this.serversSignal.update((list) => {
      const index = list.findIndex((s) => s.id === server.id);
      if (index === -1) return [...list, server];
      const next = [...list];
      next[index] = server;
      return next;
    });
    this.selectedServerIdSignal.set(serverId);
    return server;
  }

  selectServer(serverId: string | null): void {
    this.selectedServerIdSignal.set(serverId);
  }

  async loadChannels(serverId: string): Promise<ChannelResult[]> {
    const channels = await firstValueFrom(
      this.http.get<ChannelResult[]>(channelUrls.byServer(serverId)),
    );
    this.channelsSignal.set(channels);
    return channels;
  }

  async loadMembers(serverId: string): Promise<ServerMemberResult[]> {
    const members = await firstValueFrom(
      this.http.get<ServerMemberResult[]>(serverUrls.members(serverId)),
    );
    this.membersSignal.set(members);
    return members;
  }

  async createChannel(serverId: string, name: string, type: 0 | 1): Promise<ChannelResult> {
    const channel = await firstValueFrom(
      this.http.post<ChannelResult>(channelUrls.byServer(serverId), { name, type }),
    );
    this.channelsSignal.update((list) =>
      [...list, channel].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt)),
    );
    return channel;
  }

  async deleteChannel(serverId: string, channelId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(channelUrls.byServerChannel(serverId, channelId)),
    );
    this.channelsSignal.update((list) => list.filter((c) => c.id !== channelId));
  }

  async renameServer(serverId: string, name: string): Promise<ServerResult> {
    const server = await firstValueFrom(
      this.http.patch<ServerResult>(serverUrls.byId(serverId), { name }),
    );
    this.replaceServer(server);
    return server;
  }

  async regenerateInvite(serverId: string): Promise<ServerResult> {
    const server = await firstValueFrom(
      this.http.post<ServerResult>(serverUrls.invite(serverId), {}),
    );
    this.replaceServer(server);
    return server;
  }

  async uploadIcon(serverId: string, file: File): Promise<ServerResult> {
    const form = new FormData();
    form.append('file', file);
    const server = await firstValueFrom(
      this.http.put<ServerResult>(serverUrls.icon(serverId), form),
    );
    this.replaceServer(server);
    return server;
  }

  async deleteIcon(serverId: string): Promise<ServerResult> {
    const server = await firstValueFrom(
      this.http.delete<ServerResult>(serverUrls.icon(serverId)),
    );
    this.replaceServer(server);
    return server;
  }

  async leaveServer(serverId: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(serverUrls.leave(serverId)));
    this.serversSignal.update((list) => list.filter((s) => s.id !== serverId));
    if (this.selectedServerIdSignal() === serverId) {
      this.resetSelection();
    }
  }

  async deleteServer(serverId: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(serverUrls.byId(serverId)));
    this.serversSignal.update((list) => list.filter((s) => s.id !== serverId));
    if (this.selectedServerIdSignal() === serverId) {
      this.resetSelection();
    }
  }

  async kickMember(serverId: string, userId: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(serverUrls.member(serverId, userId)));
    this.membersSignal.update((list) => list.filter((m) => m.userId !== userId));
  }

  async loadVoiceParticipants(
    serverId: string,
  ): Promise<{
    channelId: string;
    participants: {
      userId: string;
      username: string;
      profileImageUrl: string | null;
      isMuted: boolean;
      isSpeaking: boolean;
      isDeafened: boolean;
    }[];
  }[]> {
    return firstValueFrom(
      this.http.get<
        {
          channelId: string;
          participants: {
            userId: string;
            username: string;
            profileImageUrl: string | null;
            isMuted: boolean;
            isSpeaking: boolean;
            isDeafened: boolean;
          }[];
        }[]
      >(serverUrls.voiceParticipants(serverId)),
    );
  }

  async updateMemberRole(serverId: string, userId: string, role: 0 | 1 | 2): Promise<void> {
    await firstValueFrom(this.http.put<void>(serverUrls.memberRole(serverId, userId), { role }));
    await this.loadMembers(serverId);
  }

  resetSelection(): void {
    this.selectedServerIdSignal.set(null);
    this.channelsSignal.set([]);
    this.membersSignal.set([]);
  }

  clear(): void {
    this.resetSelection();
    this.serversSignal.set([]);
  }

  private replaceServer(server: ServerResult): void {
    this.serversSignal.update((list) => list.map((s) => (s.id === server.id ? server : s)));
  }
}

export function toApiError(err: unknown): never {
  throw parseApiError(err);
}
