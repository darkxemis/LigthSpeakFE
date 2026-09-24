import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { form, FormField, minLength, required } from '@angular/forms/signals';
import { ServersService } from '../servers.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LsModal } from '../../../shared/ui/modal';
import { parseApiError } from '../../../core/api/api-error';
import { TranslateService } from '../../../core/i18n/translate.service';

@Component({
  selector: 'ls-create-server-dialog',
  imports: [LsModal, FormField, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './create-server-dialog.html',
})
export class CreateServerDialog {
  private readonly servers = inject(ServersService);
  private readonly translate = inject(TranslateService);

  readonly open = input(false);
  readonly dismiss = output<void>();
  readonly created = output<string>();

  readonly pending = signal(false);
  readonly error = signal<string | null>(null);
  readonly model = signal({ name: '' });

  readonly createForm = form(this.model, (field) => {
    required(field.name, { message: 'validation.required' });
    minLength(field.name, 2, { message: 'validation.minLength' });
  });

  async onSubmit(): Promise<void> {
    if (this.createForm().invalid() || this.pending()) return;
    this.pending.set(true);
    this.error.set(null);
    try {
      const server = await this.servers.createServer(this.model().name.trim());
      this.model.set({ name: '' });
      this.created.emit(server.id);
    } catch (err) {
      const apiError = parseApiError(err);
      this.error.set(this.translate.translate(`error.${apiError.tag}`));
    } finally {
      this.pending.set(false);
    }
  }
}
