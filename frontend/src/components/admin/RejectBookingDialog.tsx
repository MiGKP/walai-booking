'use client';

import { useState } from 'react';
import { Modal } from '@/components/admin/ui';

interface RejectBookingDialogProps {
  title: string;
  description: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}

export default function RejectBookingDialog({ title, description, busy, onClose, onSubmit }: RejectBookingDialogProps): React.ReactElement {
  const [reason, setReason] = useState('');
  return (
    <Modal open title={title} onClose={() => { if (!busy) onClose(); }}>
      <form onSubmit={(event) => { event.preventDefault(); if (reason.trim() && !busy) void onSubmit(reason.trim()); }} className="space-y-4">
        <p className="text-sm text-charcoal-600">{description}</p>
        <div>
          <label htmlFor="checkin-reject-reason" className="mb-2 block text-sm font-semibold text-charcoal">เหตุผลที่ปฏิเสธ <span className="text-red-600">*</span></label>
          <textarea id="checkin-reject-reason" required maxLength={500} rows={4} value={reason} disabled={busy}
            onChange={(event) => setReason(event.target.value)} className="input-field w-full" placeholder="ระบุเหตุผลเพื่อแจ้งให้ลูกค้าทราบ" />
          <p className="mt-1 text-xs text-charcoal-400">ลูกค้าจะเห็นเหตุผลนี้ในหน้าการจองและอีเมลแจ้งผล ({reason.length}/500)</p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">กลับ</button>
          <button type="submit" disabled={busy || !reason.trim()} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
            {busy ? 'กำลังบันทึก...' : 'ยืนยันปฏิเสธการจอง'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
