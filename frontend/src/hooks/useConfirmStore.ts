import { create } from 'zustand';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  openConfirm: (options: ConfirmOptions) => void;
  closeConfirm: () => void;
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  isOpen: false,
  title: '',
  description: '',
  confirmText: 'ยืนยัน',
  cancelText: 'ยกเลิก',
  danger: true,
  onConfirm: () => {},
  
  openConfirm: (options) => set({ 
    isOpen: true, 
    ...options,
    confirmText: options.confirmText || 'ยืนยัน',
    cancelText: options.cancelText || 'ยกเลิก',
    danger: options.danger ?? true,
    description: options.description || 'การกระทำนี้ไม่สามารถย้อนกลับได้ คุณแน่ใจหรือไม่?'
  }),
  
  closeConfirm: () => set({ isOpen: false }),
}));
