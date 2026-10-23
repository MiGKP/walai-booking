'use client';

import { useSyncExternalStore } from 'react';
import { RoomCartState, loadRoomCart, saveRoomCart, clearRoomCart } from './room-cart';

type Listener = () => void;
let listeners: Listener[] = [];
let snapshot: RoomCartState | null | undefined;

// ดึงข้อมูลสถานะปัจจุบันของตะกร้าห้องพักฝั่งไคลเอนต์
function getSnapshot(): RoomCartState | null {
  if (snapshot === undefined) snapshot = loadRoomCart();
  return snapshot;
}

// คืนค่าสถานะตะกร้าว่างสำหรับการเรนเดอร์ฝั่งเซิร์ฟเวอร์
function getServerSnapshot(): RoomCartState | null {
  return null;
}

// ลงทะเบียน listener เพื่อรับการแจ้งเตือนเมื่อข้อมูลตะกร้าห้องพักเปลี่ยน
function subscribe(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

// อัปเดตหรือล้างข้อมูลตะกร้าห้องพักพร้อมแจ้งเตือนทุกคอมโพเนนต์ที่ใช้งานอยู่
export function setRoomCart(next: RoomCartState | null): void {
  if (next && next.items.length > 0) {
    saveRoomCart(next);
    snapshot = next;
  } else {
    clearRoomCart();
    snapshot = null;
  }
  listeners.forEach((l) => l());
}

// Hook สำหรับอ่านและติดตามการเปลี่ยนแปลงของตะกร้าห้องพักแบบเรียลไทม์
export function useRoomCart(): RoomCartState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
