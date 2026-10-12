export const BOOKING_FILTERS = ['all', 'has_slip', 'pending', 'approved', 'checked_out', 'cancelled', 'rejected'] as const;
export type BookingListFilter = typeof BOOKING_FILTERS[number];
export const BOOKING_SORTS = ['newest', 'oldest', 'service_asc', 'price_desc'] as const;
export type BookingListSort = typeof BOOKING_SORTS[number];

export function readBookingFilter(value: string | null): BookingListFilter {
  return BOOKING_FILTERS.find(filter => filter === value) ?? 'all';
}

export function readBookingSort(value: string | null): BookingListSort {
  return BOOKING_SORTS.find(sort => sort === value) ?? 'newest';
}

export function readBookingPageSize(value: string | null): number {
  const limit = Number(value);
  return [10, 25, 50].includes(limit) ? limit : 10;
}

/** Sort/filter before pagination on the API, never just the currently visible rows. */
export function bookingListOrderParams(filter: BookingListFilter, sort: BookingListSort, service: 'room' | 'boat'): Record<string, string | undefined> {
  return {
    filter: filter === 'cancelled' || filter === 'rejected' ? 'all' : filter,
    status: filter === 'cancelled' || filter === 'rejected' ? filter : undefined,
    sort: sort === 'service_asc' ? (service === 'room' ? 'check_in' : 'booking_date') : sort === 'price_desc' ? 'total_price' : 'created_at',
    sort_dir: sort === 'oldest' || sort === 'service_asc' ? 'asc' : 'desc',
  };
}
