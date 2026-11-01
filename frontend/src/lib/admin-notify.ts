export type NotifyKind = 'success' | 'error' | 'info';

export interface NotifyMessage {
  id: number;
  kind: NotifyKind;
  message: string;
  duration?: number;
}

type Listener = () => void;

let current: NotifyMessage | null = null;
let counter = 0;
const listeners = new Set<Listener>();

// แจ้งเตือน listener ทั้งหมดเมื่อข้อความแจ้งเตือนเปลี่ยนแปลง
function emit(): void {
  listeners.forEach((l) => l());
}

// สร้างข้อความแจ้งเตือนใหม่และส่งต่อไปยังผู้รับฟัง
function push(kind: NotifyKind, message: string, duration?: number): number {
  counter += 1;
  current = { id: counter, kind, message, duration };
  emit();
  return counter;
}

// อ็อบเจกต์สำหรับเรียกแสดงหรือปิดการแจ้งเตือนฝั่งแอดมินและพนักงาน
export const notify = {
  success: (message: string, duration?: number): number => push('success', message, duration),
  error: (message: string, duration?: number): number => push('error', message, duration),
  info: (message: string, duration?: number): number => push('info', message, duration),
  dismiss: (): void => {
    current = null;
    emit();
  },
};

// ลงทะเบียนฟังก์ชันเพื่อรับการอัปเดตเมื่อมีข้อความแจ้งเตือนใหม่
export function subscribeNotify(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ดึงข้อมูลข้อความแจ้งเตือนปัจจุบัน
export function getNotifySnapshot(): NotifyMessage | null {
  return current;
}
