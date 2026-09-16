'use client';

import { useCallback } from 'react';
import { RoomCartItem } from '@/lib/room-cart';
import { setRoomCart } from '@/lib/room-cart-store';

interface UseCartSyncOptions {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}

/**
 * แหล่งความจริงของตะกร้าคือ LocalStorage เท่านั้น (ไม่ผูกกับ URL) เพื่อไม่ให้ query string
 * เละเวลาเลือกห้อง (เช่น room_ids=51_0-1) — คอมโพเนนต์ที่ subscribe ผ่าน useRoomCart() จะ re-render
 * ให้เองทันทีที่ commit/clearAll ถูกเรียก
 */
export function useCartSync({ checkIn, checkOut, adults, children }: UseCartSyncOptions) {
  const commit = useCallback(
    (items: RoomCartItem[]) => {
      setRoomCart(items.length > 0 ? { check_in: checkIn, check_out: checkOut, adults, children, items } : null);
    },
    [checkIn, checkOut, adults, children]
  );

  const clearAll = useCallback(() => setRoomCart(null), []);

  return { commit, clearAll };
}
