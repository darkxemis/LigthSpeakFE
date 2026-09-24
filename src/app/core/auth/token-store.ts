const REFRESH_KEY = 'lightspeak.refreshToken';
const LOCALE_KEY = 'lightspeak.locale';

export const tokenStore = {
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  setRefreshToken(token: string): void {
    localStorage.setItem(REFRESH_KEY, token);
  },
  clearRefreshToken(): void {
    localStorage.removeItem(REFRESH_KEY);
  },
  getLocale(): string | null {
    return localStorage.getItem(LOCALE_KEY);
  },
  setLocale(locale: string): void {
    localStorage.setItem(LOCALE_KEY, locale);
  },
};
