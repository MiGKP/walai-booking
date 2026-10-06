// ระบบแจ้งเตือนฝั่งแอดมิน/พนักงาน — แสดงเป็นแบนเนอร์คงที่ด้านบนหน้า (ไม่ใช่ toast ลอย)
// API เข้ากันได้กับ react-hot-toast (success / error / dismiss) เพื่อสลับ import ได้ง่าย

export type NotifyKind = 'success' | 'error' | 'info';

export interface NotifyMessage {
  id: number;
  kind: NotifyKind;
  message: string;
}

type Listener = () => void;

let current: NotifyMessage | null = null;
let counter = 0;
let timeoutId: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((l) => l());
}

function push(kind: NotifyKind, message: string): number {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  counter += 1;
  current = { id: counter, kind, message };
  emit();

  // ตั้งเวลาลบอัตโนมัติ 30 วินาทีตามที่ผู้ใช้ต้องการ
  timeoutId = setTimeout(() => {
    notify.dismiss();
  }, 30000);

  return counter;
}

export const notify = {
  success: (message: string): number => push('success', message),
  error: (message: string): number => push('error', message),
  info: (message: string): number => push('info', message),
  dismiss: (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    current = null;
    emit();
  },
};

export function subscribeNotify(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getNotifySnapshot(): NotifyMessage | null {
  return current;
}
