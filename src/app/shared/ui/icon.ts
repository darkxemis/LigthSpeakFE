import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type LsIconName =
  | 'hash'
  | 'volume'
  | 'plus'
  | 'settings'
  | 'mic'
  | 'mic-off'
  | 'headphones'
  | 'headphones-off'
  | 'logout'
  | 'users'
  | 'copy'
  | 'trash'
  | 'edit'
  | 'send'
  | 'x'
  | 'globe'
  | 'user'
  | 'chevron-down'
  | 'chevron-right'
  | 'spark'
  | 'crown'
  | 'shield'
  | 'mail'
  | 'lock'
  | 'eye'
  | 'eye-off'
  | 'inbox'
  | 'alert'
  | 'check'
  | 'menu'
  | 'image'
  | 'refresh'
  | 'arrow-down'
  | 'server'
  | 'bell'
  | 'external';

const PATHS: Record<LsIconName, string> = {
  hash: 'M9 4.5 7.5 19.5M16.5 4.5 15 19.5M4.5 9H20M4 15H19.5',
  volume: 'M11 5 6.5 9H3v6h3.5L11 19V5Zm4.5 3.5a5 5 0 0 1 0 7M18 6a8 8 0 0 1 0 12',
  plus: 'M12 5v14M5 12h14',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5a8 8 0 0 0-.14-1.46l2.03-1.58-2-3.46-2.39.96a8 8 0 0 0-2.53-1.46L14.5 2h-4l-.47 2.94a8 8 0 0 0-2.53 1.46l-2.39-.96-2 3.46 2.03 1.58A8 8 0 0 0 4 12c0 .5.05.98.14 1.46L2.11 15.04l2 3.46 2.39-.96a8 8 0 0 0 2.53 1.46L10.5 22h4l.47-2.94a8 8 0 0 0 2.53-1.46l2.39.96 2-3.46-2.03-1.58c.09-.48.14-.97.14-1.46Z',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm6-3a6 6 0 0 1-12 0M12 18v3M9 21h6',
  'mic-off':
    'M9 9v3a3 3 0 0 0 5.1 2.1M15 10.5V6a3 3 0 0 0-5.9-.7M12 18v3M9 21h6M4 4l16 16M18 12a6 6 0 0 1-9.3 5',
  headphones: 'M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1v-5Zm16 0h-3v6h2a1 1 0 0 0 1-1v-5Z',
  'headphones-off':
    'M4 14v-2a8 8 0 0 1 11.3-7.3M20 11.5V13a6 6 0 0 1-.7 2.8M4 14h3v6H5a1 1 0 0 1-1-1v-5Zm16 0h-3v6h2a1 1 0 0 0 1-1v-5ZM4 4l16 16',
  logout: 'M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3M16 17l5-5-5-5M21 12H9',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  copy: 'M8 8h12v12H8V8Zm-4 8V4h12',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
  x: 'M18 6 6 18M6 6l12 12',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  user: 'M20 21a8 8 0 1 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-right': 'm9 6 6 6-6 6',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 11 .9 2.6L22.5 17.5l-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14Z',
  crown: 'M4 18h16l1-9-5 3-4-6-4 6-5-3 1 9Z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
  mail: 'M4 6h16v12H4V6Zm0 0 8 7 8-7',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6V11Z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  'eye-off':
    'M3 3l18 18M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2M6.7 6.8C4 8.5 2 12 2 12s3.5 7 10 7c2 0 3.7-.7 5.1-1.6M9.9 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17.5 17.5 0 0 1-2.8 3.6',
  inbox: 'M4 4h16v12H4V4Zm0 8h5l1.5 3h3L15 12h5M4 16v4h16v-4',
  alert: 'M12 9v4M12 17h.01M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z',
  check: 'm5 13 4 4L19 7',
  menu: 'M4 6h16M4 12h16M4 18h16',
  image: 'M4 5h16v14H4V5Zm3 10 3.5-3.5 2.5 2.5 3-3L19 15M9 9.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  'arrow-down': 'M12 5v14m0 0-5-5m5 5 5-5',
  server:
    'M4 4h16v6H4V4Zm0 10h16v6H4v-6Zm4-7h.01M8 17h.01',
  bell: 'M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7Zm4 11a2 2 0 0 0 4 0',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
};

@Component({
  selector: 'ls-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon.html',
  styleUrl: './icon.css',
})
export class LsIcon {
  readonly name = input.required<LsIconName>();
  readonly size = input<number | string>(18);
  readonly strokeWidth = input<number | string>(1.75);

  path(): string {
    return PATHS[this.name()] ?? PATHS.spark;
  }
}
