import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { userUrls } from '../../core/api/api-urls';
import { AuthService } from '../../core/auth/auth.service';
import type { UserProfileResult } from '../../shared/models/api.models';

@Service()
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  async uploadAvatar(file: File): Promise<UserProfileResult> {
    const form = new FormData();
    form.append('file', file);
    const profile = await firstValueFrom(
      this.http.post<UserProfileResult>(userUrls.meProfileImage(), form),
    );
    this.auth.updateProfile(profile);
    return profile;
  }

  async removeAvatar(): Promise<UserProfileResult> {
    const profile = await firstValueFrom(
      this.http.delete<UserProfileResult>(userUrls.meProfileImage()),
    );
    this.auth.updateProfile(profile);
    return profile;
  }
}
