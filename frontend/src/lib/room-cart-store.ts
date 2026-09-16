'use client';

import { useSyncExternalStore } from 'react';
import { RoomCartState, loadRoomCart, saveRoomCart, clearRoomCart } from './room-cart';

// Global reactive store สำหรับตะกร้าห้องพัก (LocalStorage เป็นแหล่งความจริง ไม่ผูกกับ URL)
// ใช้ useSyncExternalStore เพื่อให้ทุกคอมโพเนนต์ที่ subscribe re-render พร้อมกันทันทีที่ตะกร้าเปลี่ยน แม้จะแก้จากคนละหน้า

type Listener = () => void;
let listeners: Listener[] = [];
let snapshot: RoomCartState | null | undefined;

function getSnapshot(): RoomCartState | null {
  if (snapshot === undefined) snapshot = loadRoomCart();
  return snapshot;
}

function getServerSnapshot(): RoomCartState | null {
  return null;
}

function subscribe(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

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

export function useRoomCart(): RoomCartState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
