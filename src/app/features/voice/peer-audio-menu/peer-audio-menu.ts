import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LsIcon } from '../../../shared/ui/icon';
import { VoiceService } from '../voice.service';

const MENU_WIDTH = 176; // w-44
const EDGE_GAP = 8;

@Component({
  selector: 'ls-peer-audio-menu',
  imports: [TranslatePipe, LsIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './peer-audio-menu.html',
})
export class PeerAudioMenu {
  readonly userId = input.required<string>();
  readonly size = input<number | string>(14);

  readonly voice = inject(VoiceService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = signal(false);
  readonly popoverTop = signal(0);
  readonly popoverLeft = signal(0);

  private readonly popover = viewChild<ElementRef<HTMLDivElement>>('popover');

  constructor() {
    document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
    document.addEventListener('keydown', this.onDocumentKeydown);
    document.addEventListener('scroll', this.close, true);
    window.addEventListener('resize', this.close);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
      document.removeEventListener('keydown', this.onDocumentKeydown);
      document.removeEventListener('scroll', this.close, true);
      window.removeEventListener('resize', this.close);
    });

    effect(() => {
      if (!this.open()) return;
      const el = this.popover()?.nativeElement;
      if (!el) return;
      const menuRect = el.getBoundingClientRect();
      const hostRect = this.host.nativeElement.getBoundingClientRect();
      if (menuRect.bottom > window.innerHeight - EDGE_GAP) {
        this.popoverTop.set(Math.max(EDGE_GAP, hostRect.top - menuRect.height - 4));
      }
    });
  }

  readonly close = (): void => {
    this.open.set(false);
  };

  toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    const rect = this.host.nativeElement.getBoundingClientRect();
    const left = Math.min(
      Math.max(EDGE_GAP, rect.right - MENU_WIDTH),
      Math.max(EDGE_GAP, window.innerWidth - MENU_WIDTH - EDGE_GAP),
    );
    this.popoverLeft.set(left);
    this.popoverTop.set(rect.bottom + 4);
    this.open.set(true);
  }

  onVolumeInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.voice.setPeerVolume(this.userId(), value);
  }

  private readonly onDocumentPointerDown = (event: Event): void => {
    if (!this.open()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('ls-peer-audio-menu') === this.host.nativeElement) return;
    this.close();
  };

  private readonly onDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.close();
    }
  };
}
