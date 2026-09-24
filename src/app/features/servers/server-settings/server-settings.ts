import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { form, FormField, minLength, required } from '@angular/forms/signals';
import { SlicePipe, UpperCasePipe } from '@angular/common';
import { ServersService } from '../servers.service';
import { AuthService } from '../../../core/auth/auth.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../core/i18n/translate.service';
import { LsIcon } from '../../../shared/ui/icon';
import { LsAvatar } from '../../../shared/ui/avatar';
import { LsToastHost } from '../../../shared/ui/toast-host';
import { parseApiError } from '../../../core/api/api-error';
import { ROLE_LABEL, ServerRole } from '../../../shared/models/api.models';

@Component({
  selector: 'ls-server-settings',
  imports: [
    SlicePipe,
    UpperCasePipe,
    FormField,
    TranslatePipe,
    LsIcon,
    LsAvatar,
    LsToastHost,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './server-settings.html',
  styleUrl: './server-settings.css',
})
export class ServerSettingsComponent {
  readonly servers = inject(ServersService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly pending = signal(false);
  readonly copied = signal(false);
  readonly busyMemberId = signal<string | null>(null);
  readonly confirmAction = signal<'delete' | 'leave' | 'kick' | null>(null);
  readonly kickTarget = signal<string | null>(null);

  readonly model = signal({ name: '' });

  readonly renameForm = form(this.model, (field) => {
    required(field.name, { message: 'validation.required' });
    minLength(field.name, 2, { message: 'validation.minLength' });
  });

  private readonly paramMap = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  readonly serverId = computed(() => this.paramMap().get('serverId') ?? '');

  readonly server = computed(
    () => this.servers.servers().find((s) => s.id === this.serverId()) ?? null,
  );

  readonly isOwner = computed(() => this.server()?.ownerId === this.auth.profile()?.id);

  readonly canManage = computed(
    () =>
      this.isOwner() ||
      (this.auth.profile()?.roles.includes('admin') ?? false),
  );

  constructor() {
    effect(() => {
      const serverId = this.serverId();
      if (!serverId) return;
      void this.load(serverId);
    });
  }

  private async load(serverId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.servers.selectServer(serverId);
      await Promise.all([
        this.servers.loadServer(serverId),
        this.servers.loadChannels(serverId),
        this.servers.loadMembers(serverId),
      ]);
      const server = this.servers.servers().find((s) => s.id === serverId);
      this.model.set({ name: server?.name ?? '' });
    } catch (err) {
      this.error.set(this.translate.translate(`error.${parseApiError(err).tag}`));
    } finally {
      this.loading.set(false);
    }
  }

  roleLabel(role: ServerRole): string {
    return this.translate.translate(`common.${ROLE_LABEL[role]}`);
  }

  memberName(m: { firstName: string; lastName: string }): string {
    return `${m.firstName} ${m.lastName}`.trim();
  }

  async rename(): Promise<void> {
    if (this.renameForm().invalid() || this.pending()) return;
    this.pending.set(true);
    this.error.set(null);
    try {
      await this.servers.renameServer(this.serverId(), this.model().name.trim());
    } catch (err) {
      this.error.set(this.translate.translate(`error.${parseApiError(err).tag}`));
    } finally {
      this.pending.set(false);
    }
  }

  async regenerateInvite(): Promise<void> {
    this.pending.set(true);
    try {
      await this.servers.regenerateInvite(this.serverId());
    } finally {
      this.pending.set(false);
    }
  }

  async copyInvite(): Promise<void> {
    const code = this.server()?.inviteCode;
    if (!code) return;
    await navigator.clipboard.writeText(code);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1800);
  }

  async onIconSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await this.servers.uploadIcon(this.serverId(), file);
    } catch (err) {
      this.error.set(this.translate.translate(`error.${parseApiError(err).tag}`));
    } finally {
      input.value = '';
    }
  }

  async removeIcon(): Promise<void> {
    await this.servers.deleteIcon(this.serverId()).catch(() => undefined);
  }

  async changeRole(memberId: string, role: ServerRole): Promise<void> {
    this.busyMemberId.set(memberId);
    try {
      await this.servers.updateMemberRole(this.serverId(), memberId, role);
    } finally {
      this.busyMemberId.set(null);
    }
  }

  async kick(memberId: string): Promise<void> {
    this.busyMemberId.set(memberId);
    try {
      await this.servers.kickMember(this.serverId(), memberId);
      this.kickTarget.set(null);
    } catch (err) {
      this.error.set(this.translate.translate(`error.${parseApiError(err).tag}`));
    } finally {
      this.busyMemberId.set(null);
    }
  }

  async confirmLeave(): Promise<void> {
    await this.servers.leaveServer(this.serverId());
    this.confirmAction.set(null);
    await this.router.navigate(['/app']);
  }

  async confirmDelete(): Promise<void> {
    await this.servers.deleteServer(this.serverId());
    this.confirmAction.set(null);
    await this.router.navigate(['/app']);
  }

  backToServer(): void {
    const serverId = this.serverId();
    const firstText = this.servers.textChannels()[0];
    if (firstText) {
      void this.router.navigate(['/app/servers', serverId, 'channels', firstText.id]);
    } else {
      void this.router.navigate(['/app']);
    }
  }
}
