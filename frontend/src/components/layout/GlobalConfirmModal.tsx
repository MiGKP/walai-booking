'use client';

import { useState } from 'react';
import { useConfirmStore } from '@/hooks/useConfirmStore';

export default function GlobalConfirmModal() {
  const { isOpen, title, description, confirmText, cancelText, danger, onConfirm, closeConfirm } = useConfirmStore();
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      closeConfirm();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal-900/40 backdrop-blur-[2px] transition-opacity">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 m-4">
        <h3 className={`text-lg font-bold ${danger ? 'text-rose-700' : 'text-charcoal-900'}`}>
          {title}
        </h3>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-charcoal-500">
            {description}
          </p>
        )}
        <div className="mt-7 flex justify-end gap-3">
          <button
            onClick={closeConfirm}
            disabled={loading}
            className="rounded-full bg-stone-100 px-5 py-2.5 text-sm font-semibold text-stone-600 transition-colors hover:bg-stone-200 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-forest-700 hover:bg-forest-800'
            }`}
          >
            {loading ? 'กำลังดำเนินการ...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
