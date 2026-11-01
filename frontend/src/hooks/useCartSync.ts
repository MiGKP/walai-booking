'use client';

import { useCallback } from 'react';
import { RoomCartItem } from '@/lib/room-cart';
import { setRoomCart } from '@/lib/room-cart-store';

interface UseCartSyncOptions {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  childAges?: number[];
}

// ซิงค์รายการห้องพักและข้อมูลผู้เข้าพักลงในตะกร้าห้องพัก (localStorage)
export function useCartSync({ checkIn, checkOut, adults, children, childAges }: UseCartSyncOptions) {
  // บันทึกรายการห้องที่เลือกลงในตะกร้า
  const commit = useCallback(
    (items: RoomCartItem[]) => {
      setRoomCart(
        items.length > 0
          ? { check_in: checkIn, check_out: checkOut, adults, children, child_ages: childAges, items }
          : null
      );
    },
    [checkIn, checkOut, adults, children, childAges]
  );

  // ล้างข้อมูลทั้งหมดในตะกร้าห้องพัก
  const clearAll = useCallback(() => setRoomCart(null), []);

  return { commit, clearAll };
}
