export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export function successResponse<T>(data: T, meta?: ApiMeta): ApiResponse<T> {
  return {
    data,
    error: null,
    meta,
  };
}

export function errorResponse(code: string, message: string, details?: Record<string, unknown>): ApiResponse<null> {
  return {
    data: null,
    error: {
      code,
      message,
      details,
    },
  };
}
