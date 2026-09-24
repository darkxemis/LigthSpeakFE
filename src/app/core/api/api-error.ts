import { HttpErrorResponse } from '@angular/common/http';
import type { ApiErrorBody } from '../../shared/models/api.models';

export class ApiError extends Error {
  readonly tag: string;
  readonly status: number;
  readonly metadata: Record<string, string>;
  readonly traceId?: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.tag = body.tag || 'server.internalError';
    this.metadata = body.metadata ?? {};
    this.traceId = body.traceId;
  }
}

interface HttpLikeError {
  status?: number;
  message?: string;
  error?: unknown;
  name?: string;
}

export function parseApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof HttpErrorResponse || isHttpLike(error)) {
    const status = error.status ?? -1;
    const body = (error.error ?? {}) as Partial<ApiErrorBody>;
    if (typeof body.tag === 'string' || typeof body.message === 'string') {
      return new ApiError(status, body as ApiErrorBody);
    }
    if (status === 0) {
      return new ApiError(0, {
        tag: 'server.offline',
        message: 'Cannot reach the server',
      });
    }
    return new ApiError(status, {
      tag: 'server.unexpected',
      message: error.message || 'Unexpected error',
    });
  }

  return new ApiError(-1, {
    tag: 'server.unknown',
    message: error instanceof Error ? error.message : 'Unknown error',
  });
}

/** Maps backend `tag` values + PascalCase validation metadata to i18n keys. */
export function errorTranslationKey(error: ApiError): string {
  if (error.tag === 'validation.failed') {
    const first = Object.values(error.metadata)[0];
    if (first) {
      return `error.validation.${first}`;
    }
    return 'error.validation.failed';
  }
  return `error.${error.tag}`;
}

function isHttpLike(error: unknown): error is HttpLikeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as HttpLikeError).status === 'number'
  );
}
