import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, from, Observable } from 'rxjs';
import { parseApiError } from '../api/api-error';
import { authUrls, SPA_HEADERS, userUrls } from '../api/api-urls';
import type { AuthResponse, LoginRequest, RegisterRequest, UserProfileResult } from '../../shared/models/api.models';
import { tokenStore } from './token-store';

@Service()
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly accessTokenSignal = signal<string | null>(null);
  private readonly profileSignal = signal<UserProfileResult | null>(null);
  private refreshInFlight: Promise<boolean> | null = null;

  readonly accessToken = this.accessTokenSignal.asReadonly();
  readonly profile = this.profileSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.accessTokenSignal() !== null);
  readonly displayName = computed(() => {
    const p = this.profileSignal();
    return p ? `${p.firstName} ${p.lastName}`.trim() : '';
  });
  readonly initials = computed(() => {
    const p = this.profileSignal();
    if (!p) return '?';
    return `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase() || p.email[0].toUpperCase();
  });
  readonly isOwnerRole = computed(() => this.profileSignal()?.roles.includes('admin') ?? false);

  async bootstrap(): Promise<void> {
    if (!tokenStore.getRefreshToken()) {
      return;
    }
    await this.refresh();
    if (this.isAuthenticated()) {
      await this.loadProfile();
    }
  }

  login(credentials: LoginRequest): Promise<AuthResponse> {
    return firstValueFrom(
      this.http.post<AuthResponse>(authUrls.login(), credentials, {
        headers: new HttpHeaders(SPA_HEADERS),
      }),
    ).then((res) => this.applyAuth(res));
  }

  register(payload: RegisterRequest): Promise<{ userId: string }> {
    return firstValueFrom(
      this.http.post<{ userId: string }>(authUrls.register(), payload),
    );
  }

  logout(): Promise<void> {
    const call$ = tokenStore.getRefreshToken()
      ? this.http.post<void>(authUrls.logout(), null, {
          headers: new HttpHeaders({ 'X-Refresh-Token': tokenStore.getRefreshToken()! }),
        })
      : from(Promise.resolve());

    return firstValueFrom(call$).catch(() => undefined).then(() => {
      this.clearSession();
      void this.router.navigate(['/login']);
    });
  }

  refresh(): Promise<boolean> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.doRefresh().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  refresh$(): Observable<boolean> {
    return from(this.refresh());
  }

  loadProfile(): Promise<UserProfileResult> {
    return firstValueFrom(this.http.get<UserProfileResult>(userUrls.me())).then((profile) => {
      this.profileSignal.set(profile);
      return profile;
    });
  }

  updateProfile(profile: UserProfileResult): void {
    this.profileSignal.set(profile);
  }

  private doRefresh(): Promise<boolean> {
    const refreshToken = tokenStore.getRefreshToken();
    if (!refreshToken) {
      this.clearSession();
      return Promise.resolve(false);
    }

    return firstValueFrom(
      this.http.post<AuthResponse>(
        authUrls.refresh(),
        null,
        {
          headers: new HttpHeaders({
            ...SPA_HEADERS,
            'X-Refresh-Token': refreshToken,
          }),
        },
      ),
    )
      .then((res) => {
        this.applyAuth(res);
        return true;
      })
      .catch((err: unknown) => {
        const apiError = parseApiError(err);
        if (apiError.status === 401 || apiError.tag.includes('invalidRefreshToken')) {
          this.clearSession();
          return false;
        }
        throw err;
      });
  }

  private applyAuth(res: AuthResponse): AuthResponse {
    this.accessTokenSignal.set(res.accessToken);
    tokenStore.setRefreshToken(res.refreshToken);
    return res;
  }

  private clearSession(): void {
    this.accessTokenSignal.set(null);
    this.profileSignal.set(null);
    tokenStore.clearRefreshToken();
  }
}
