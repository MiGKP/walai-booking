import { useConfirmStore } from '@/hooks/useConfirmStore';

interface ToastConfirmOptions {
  title: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  danger?: boolean;
}

// เปิดหน้าต่างยืนยันการทำงานผ่าน Global Confirm Modal
export function toastConfirm(options: ToastConfirmOptions) {
  useConfirmStore.getState().openConfirm({
    title: options.title,
    confirmText: options.confirmText,
    cancelText: options.cancelText,
    danger: options.danger,
    onConfirm: options.onConfirm,
  });
}
