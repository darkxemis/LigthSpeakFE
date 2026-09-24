import { environment } from '../../../environments/environment';

export const API_BASE = `${environment.apiBaseUrl}/api/v1`;

export const authUrls = {
  register: () => `${API_BASE}/auth/register`,
  login: () => `${API_BASE}/auth/login`,
  refresh: () => `${API_BASE}/auth/refresh`,
  logout: () => `${API_BASE}/auth/logout`,
} as const;

export const userUrls = {
  me: () => `${API_BASE}/users/me`,
  meProfileImage: () => `${API_BASE}/users/me/profile-image`,
  meSettings: () => `${API_BASE}/users/me/settings`,
} as const;

export const serverUrls = {
  root: () => `${API_BASE}/servers`,
  byId: (serverId: string) => `${API_BASE}/servers/${serverId}`,
  join: () => `${API_BASE}/servers/join`,
  leave: (serverId: string) => `${API_BASE}/servers/${serverId}/leave`,
  icon: (serverId: string) => `${API_BASE}/servers/${serverId}/icon`,
  invite: (serverId: string) => `${API_BASE}/servers/${serverId}/invite`,
  members: (serverId: string) => `${API_BASE}/servers/${serverId}/members`,
  member: (serverId: string, userId: string) =>
    `${API_BASE}/servers/${serverId}/members/${userId}`,
  memberRole: (serverId: string, userId: string) =>
    `${API_BASE}/servers/${serverId}/members/${userId}/role`,
  voiceParticipants: (serverId: string) =>
    `${API_BASE}/servers/${serverId}/voice/participants`,
} as const;

export const channelUrls = {
  byServer: (serverId: string) => `${API_BASE}/servers/${serverId}/channels`,
  byServerChannel: (serverId: string, channelId: string) =>
    `${API_BASE}/servers/${serverId}/channels/${channelId}`,
} as const;

export const messageUrls = {
  byChannel: (channelId: string) =>
    `${API_BASE}/channels/${channelId}/messages`,
  byChannelMessage: (channelId: string, messageId: string) =>
    `${API_BASE}/channels/${channelId}/messages/${messageId}`,
} as const;

export const hubUrls = {
  chat: () => `${environment.apiBaseUrl}/hubs/chat`,
  voice: () => `${environment.apiBaseUrl}/hubs/voice`,
} as const;

/** Backend rejects unknown origins; SPA mode skips auth cookies. */
export const SPA_HEADERS = {
  'X-Skip-Cookies': 'true',
} as const;
