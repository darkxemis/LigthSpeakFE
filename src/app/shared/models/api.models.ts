export type ChannelType = 0 | 1;
export type ServerRole = 0 | 1 | 2;

export const ChannelTypeText = 0 as const;
export const ChannelTypeVoice = 1 as const;

export interface AuthResponse {
  userId: string;
  email: string;
  fullName: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}

export interface UserProfileResult {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  createdAt: string;
  updatedAt: string | null;
  profileImageUrl: string | null;
}

export interface ServerResult {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  inviteCode: string;
  createdAt: string;
}

export interface ServerMemberResult {
  userId: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  role: ServerRole;
  joinedAt: string;
}

export interface ChannelResult {
  id: string;
  serverId: string;
  name: string;
  type: ChannelType;
  position: number;
  createdAt: string;
}

export interface MessageResult {
  id: string;
  channelId: string;
  authorId: string;
  authorFirstName: string;
  authorLastName: string;
  authorProfileImageUrl: string | null;
  content: string;
  createdAt: string;
  editedAt: string | null;
}

export interface MessagePageResult {
  messages: MessageResult[];
  hasMore: boolean;
}

export interface ApiErrorBody {
  tag: string;
  message: string;
  traceId?: string;
  metadata?: Record<string, string>;
  detail?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export const ROLE_LABEL: Record<ServerRole, string> = {
  0: 'member',
  1: 'admin',
  2: 'owner',
};

export type AccentColor = 'cyan' | 'lime' | 'violet' | 'rose';

export const ACCENT_COLORS: readonly AccentColor[] = ['cyan', 'lime', 'violet', 'rose'] as const;

export interface UserSettingsResult {
  userId: string;
  noiseSuppressionEnabled: boolean;
  echoCancellationEnabled: boolean;
  autoGainControlEnabled: boolean;
  sfxEnabled: boolean;
  outputVolume: number;
  startMuted: boolean;
  pushToTalkEnabled: boolean;
  pushToTalkKey: string;
  desktopNotificationsEnabled: boolean;
  messageSoundEnabled: boolean;
  enterToSendEnabled: boolean;
  showTimestampsEnabled: boolean;
  compactMessagesEnabled: boolean;
  reducedMotionEnabled: boolean;
  accentColor: AccentColor;
}

export type UserSettingsPatch = Partial<UserSettingsResult>;

/** Mirrors the backend `UserSettings.CreateDefault` values. */
export const DEFAULT_USER_SETTINGS: UserSettingsResult = {
  userId: '',
  noiseSuppressionEnabled: true,
  echoCancellationEnabled: true,
  autoGainControlEnabled: true,
  sfxEnabled: true,
  outputVolume: 100,
  startMuted: false,
  pushToTalkEnabled: false,
  pushToTalkKey: 'Space',
  desktopNotificationsEnabled: false,
  messageSoundEnabled: true,
  enterToSendEnabled: true,
  showTimestampsEnabled: true,
  compactMessagesEnabled: false,
  reducedMotionEnabled: false,
  accentColor: 'cyan',
};

export function fullNameOf(member: {
  firstName: string;
  lastName: string;
}): string {
  return `${member.firstName} ${member.lastName}`.trim();
}
