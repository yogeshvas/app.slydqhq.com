/**
 * Shared API contract types. Mirror these with the Express backend's response
 * envelope so the whole stack speaks the same shape.
 */

/** Standard success envelope: `{ success: true, data, message? }`. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

/** Standard error envelope returned by the backend. */
export interface ApiErrorBody {
  success: false;
  message: string;
  /** Field-level validation errors, keyed by field name. */
  errors?: Record<string, string[]>;
}

/** Normalised error thrown by the API client (see `lib/api-client.ts`). */
export interface ApiError {
  status: number;
  message: string;
  errors?: Record<string, string[]>;
}

/** Cursor/offset paginated payload. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
