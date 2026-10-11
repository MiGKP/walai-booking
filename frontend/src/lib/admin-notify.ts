// ระบบแจ้งเตือนฝั่งแอดมิน/พนักงาน — แสดงเป็น Floating Toast ลอยอยู่เหนือทุกอย่าง
// API เข้ากันได้กับ react-hot-toast (success / error / info / dismiss) เพื่อสลับ import ได้ง่าย

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

function emit(): void {
  listeners.forEach((l) => l());
}

function push(kind: NotifyKind, message: string, duration?: number): number {
  counter += 1;
  current = { id: counter, kind, message, duration };
  emit();
  return counter;
}

export const notify = {
  success: (message: string, duration?: number): number => push('success', message, duration),
  error: (message: string, duration?: number): number => push('error', message, duration),
  info: (message: string, duration?: number): number => push('info', message, duration),
  dismiss: (): void => {
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
