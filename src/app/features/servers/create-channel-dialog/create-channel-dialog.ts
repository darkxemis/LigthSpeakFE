import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { ServersService } from '../servers.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LsModal } from '../../../shared/ui/modal';
import { LsIcon } from '../../../shared/ui/icon';
import type { ChannelType } from '../../../shared/models/api.models';

@Component({
  selector: 'ls-create-channel-dialog',
  imports: [LsModal, FormField, TranslatePipe, LsIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './create-channel-dialog.html',
})
export class CreateChannelDialog {
  private readonly servers = inject(ServersService);

  readonly open = input(false);
  readonly serverId = input.required<string>();
  readonly dismiss = output<void>();
  readonly created = output<string>();

  readonly pending = signal(false);
  readonly type = signal<ChannelType>(0);
  readonly model = signal({ name: '' });

  readonly channelForm = form(this.model, (field) => {
    required(field.name, { message: 'validation.required' });
  });

  async onSubmit(): Promise<void> {
    if (this.channelForm().invalid() || this.pending() || !this.serverId()) return;
    this.pending.set(true);
    try {
      const channel = await this.servers.createChannel(
        this.serverId(),
        this.model().name.trim().toLowerCase().replace(/\s+/g, '-'),
        this.type(),
      );
      this.model.set({ name: '' });
      this.created.emit(channel.id);
    } finally {
      this.pending.set(false);
    }
  }
}
