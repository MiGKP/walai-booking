import { useConfirmStore } from '@/hooks/useConfirmStore';

interface ToastConfirmOptions {
  title: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  danger?: boolean;
}

export function toastConfirm(options: ToastConfirmOptions) {
  // Call the global zustand modal instead of a react-hot-toast
  useConfirmStore.getState().openConfirm({
    title: options.title,
    confirmText: options.confirmText,
    cancelText: options.cancelText,
    danger: options.danger,
    onConfirm: options.onConfirm
  });
}
