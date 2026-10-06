export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function positiveQueryInteger(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error('Query value must be a positive integer');
  }
  return Number(value);
}

/** Opt in to pagination so existing customer/calendar callers retain their arrays. */
export function parsePagination(query: Record<string, unknown>): Pagination | null {
  if (query.page === undefined && query.limit === undefined) return null;
  const page = query.page === undefined ? 1 : positiveQueryInteger(query.page);
  const limit = Math.min(query.limit === undefined ? 10 : positiveQueryInteger(query.limit), 100);
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(offset)) throw new Error('Pagination offset is too large');
  return { page, limit, offset };
}

export function paginationMeta(pagination: Pagination, total: number): PaginationMeta {
  return { page: pagination.page, limit: pagination.limit, total, totalPages: Math.ceil(total / pagination.limit) };
}
