import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { parseApiError } from '../api/api-error';
import { AuthService } from './auth.service';

const AUTH_URL_PARTS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();

  const authReq =
    token && !req.headers.has('Authorization') && !req.url.includes('/auth/')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => parseApiError(error));
      }

      if (AUTH_URL_PARTS.some((part) => req.url.includes(part))) {
        return throwError(() => parseApiError(error));
      }

      // Backend 401 challenge has no JSON body — single-flight refresh then retry once.
      if (req.headers.get('X-Retried-After-Refresh') === 'true') {
        return throwError(() => parseApiError(error));
      }

      return auth.refresh$().pipe(
        switchMap((ok) => {
          if (!ok) {
            return throwError(() => parseApiError(error));
          }
          const newToken = auth.accessToken();
          const retried = req.clone({
            setHeaders: { Authorization: `Bearer ${newToken ?? ''}` },
            headers: req.headers.set('X-Retried-After-Refresh', 'true'),
          });
          return next(retried).pipe(
            catchError((retryError: unknown) => throwError(() => parseApiError(retryError))),
          );
        }),
      );
    }),
  );
};
