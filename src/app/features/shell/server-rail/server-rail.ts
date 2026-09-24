import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SlicePipe, UpperCasePipe } from '@angular/common';
import { ServersService } from '../../servers/servers.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LsIcon } from '../../../shared/ui/icon';
import { CreateServerDialog } from '../../servers/create-server-dialog/create-server-dialog';
import { JoinServerDialog } from '../../servers/join-server-dialog/join-server-dialog';

@Component({
  selector: 'ls-server-rail',
  imports: [RouterLink, TranslatePipe, SlicePipe, UpperCasePipe, LsIcon, CreateServerDialog, JoinServerDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './server-rail.html',
})
export class ServerRail {
  readonly servers = inject(ServersService);
  private readonly router = inject(Router);

  readonly createOpen = signal(false);
  readonly joinOpen = signal(false);

  async onCreated(serverId: string): Promise<void> {
    this.createOpen.set(false);
    await this.router.navigate(['/app/servers', serverId]);
  }

  async onJoined(serverId: string): Promise<void> {
    this.joinOpen.set(false);
    await this.router.navigate(['/app/servers', serverId]);
  }
}
