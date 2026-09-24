import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { ServersService } from '../servers.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LsModal } from '../../../shared/ui/modal';
import { parseApiError } from '../../../core/api/api-error';
import { TranslateService } from '../../../core/i18n/translate.service';

@Component({
  selector: 'ls-join-server-dialog',
  imports: [LsModal, FormField, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './join-server-dialog.html',
})
export class JoinServerDialog {
  private readonly servers = inject(ServersService);
  private readonly translate = inject(TranslateService);

  readonly open = input(false);
  readonly dismiss = output<void>();
  readonly joined = output<string>();

  readonly pending = signal(false);
  readonly error = signal<string | null>(null);
  readonly model = signal({ code: '' });

  readonly joinForm = form(this.model, (field) => {
    required(field.code, { message: 'validation.required' });
  });

  async onSubmit(): Promise<void> {
    if (this.joinForm().invalid() || this.pending()) return;
    this.pending.set(true);
    this.error.set(null);
    try {
      const server = await this.servers.joinServer(this.model().code.trim().toLowerCase());
      this.model.set({ code: '' });
      this.joined.emit(server.id);
    } catch (err) {
      const apiError = parseApiError(err);
      this.error.set(this.translate.translate(`error.${apiError.tag}`));
    } finally {
      this.pending.set(false);
    }
  }
}
