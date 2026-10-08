'use client';

import { useState, useEffect } from 'react';
import { Pencil, Save, X } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { notify } from '@/lib/admin-notify';
import { Panel } from '@/components/admin/ui';

interface CancellationPolicy {
  full_refund_hours: number;
  late_refund_percent: number;
  updated_at?: string | null;
}

interface CancellationPolicyResponse {
  success: boolean;
  data: CancellationPolicy;
}

interface CancellationPolicySaveResponse {
  success: boolean;
  message?: string;
  data?: CancellationPolicy;
}

interface PolicyForm {
  full_refund_hours: string;
  late_refund_percent: string;
}

const MAX_HOURS = 8760;
const MAX_PERCENT = 100;

const toForm = (policy: CancellationPolicy): PolicyForm => ({
  full_refund_hours: String(policy.full_refund_hours),
  late_refund_percent: String(policy.late_refund_percent),
});

const parseIntInRange = (raw: string, max: number): number | null => {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 0 && value <= max ? value : null;
};

const formatUpdatedAt = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function CancellationPolicyCard(): React.ReactElement {
  const [policy, setPolicy] = useState<CancellationPolicy | null>(null);
  const [form, setForm] = useState<PolicyForm>({ full_refund_hours: '', late_refund_percent: '' });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<CancellationPolicyResponse>('/settings/cancellation-policy')
      .then((res) => {
        if (!active) return;
        const data = res.data?.data;
        if (!data) {
          setLoadError(true);
          return;
        }
        setPolicy(data);
        setForm(toForm(data));
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const startEditing = (): void => {
    if (policy) setForm(toForm(policy));
    setFormError(null);
    setEditing(true);
  };

  const cancelEditing = (): void => {
    if (policy) setForm(toForm(policy));
    setFormError(null);
    setEditing(false);
  };

  const handleSave = async (): Promise<void> => {
    const hours = parseIntInRange(form.full_refund_hours, MAX_HOURS);
    const percent = parseIntInRange(form.late_refund_percent, MAX_PERCENT);
    if (hours === null || percent === null) {
      setFormError('กรุณากรอกจำนวนเต็ม: ชั่วโมงระหว่าง 0–8760 และเปอร์เซ็นต์ระหว่าง 0–100');
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      const res = await api.put<CancellationPolicySaveResponse>('/settings/cancellation-policy', {
        full_refund_hours: hours,
        late_refund_percent: percent,
      });
      const updated: CancellationPolicy = res.data?.data ?? {
        full_refund_hours: hours,
        late_refund_percent: percent,
        updated_at: policy?.updated_at ?? null,
      };
      setPolicy(updated);
      setForm(toForm(updated));
      setEditing(false);
      notify.success('บันทึกนโยบายการคืนเงินสำเร็จ');
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, 'บันทึกนโยบายการคืนเงินไม่สำเร็จ'));
    } finally {
      setSaving(false);
    }
  };

  const updatedAtText = formatUpdatedAt(policy?.updated_at);

  const editButton =
    !loading && !editing ? (
      <button
        type="button"
        onClick={startEditing}
        disabled={loadError}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-charcoal-700 bg-cream-100 hover:bg-cream-200 border border-cream-300/80 transition-all active:scale-95 disabled:opacity-50"
      >
        <Pencil size={13} aria-hidden="true" />
        <span>แก้ไข</span>
      </button>
    ) : null;

  return (
    <section className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/90 space-y-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-cream-200/80">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-forest-800" />
          <h2 className="text-base font-bold text-forest-900 font-display">
            นโยบายการคืนเงินค่าบริการเรือ
          </h2>
        </div>
        {editButton}
      </div>

      <p className="text-xs text-charcoal-500 leading-relaxed">
        ใช้กับการยกเลิกการจองเรือและบัตรเสริมที่ชำระแล้ว โดยอิงตามจำนวนชั่วโมงก่อนถึงรอบเวลา
      </p>

      {loading ? (
        <div className="space-y-2 pt-1">
          <div className="h-5 w-3/4 rounded-xl bg-cream-100 animate-pulse" />
          <div className="h-5 w-2/3 rounded-xl bg-cream-100 animate-pulse" />
        </div>
      ) : loadError ? (
        <p className="text-xs font-medium text-rose-600">โหลดนโยบายการคืนเงินไม่สำเร็จ กรุณาลองรีเฟรชหน้า</p>
      ) : editing ? (
        <div className="space-y-4 bg-cream-50/80 p-5 rounded-2xl border border-cream-200/90">
          <div>
            <label htmlFor="full_refund_hours" className="block text-xs sm:text-sm font-semibold text-charcoal-800 mb-1.5">
              ยกเลิกก่อนเข้าพักกี่ชั่วโมงจึงคืนเต็มจำนวน
            </label>
            <div className="flex items-center gap-2">
              <input
                id="full_refund_hours"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_HOURS}
                step={1}
                className="w-32 rounded-xl border border-cream-300 bg-white px-3 py-1.5 text-center text-xs sm:text-sm font-bold font-mono text-forest-950 focus:border-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-800/15"
                value={form.full_refund_hours}
                onChange={(e) => setForm({ ...form, full_refund_hours: e.target.value })}
              />
              <span className="text-xs sm:text-sm text-charcoal-600 font-medium">ชั่วโมง</span>
            </div>
          </div>

          <div>
            <label htmlFor="late_refund_percent" className="block text-xs sm:text-sm font-semibold text-charcoal-800 mb-1.5">
              คืนเงินกี่เปอร์เซ็นต์ หากยกเลิกหลังกำหนด
            </label>
            <div className="flex items-center gap-2">
              <input
                id="late_refund_percent"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_PERCENT}
                step={1}
                className="w-32 rounded-xl border border-cream-300 bg-white px-3 py-1.5 text-center text-xs sm:text-sm font-bold font-mono text-forest-950 focus:border-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-800/15"
                value={form.late_refund_percent}
                onChange={(e) => setForm({ ...form, late_refund_percent: e.target.value })}
              />
              <span className="text-xs sm:text-sm text-charcoal-600 font-medium">%</span>
            </div>
          </div>

          {formError && <p className="text-xs font-semibold text-rose-600">{formError}</p>}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-forest-800 hover:bg-forest-900 text-white shadow-xs transition-all active:scale-95 disabled:opacity-50"
            >
              <Save size={14} />
              <span>{saving ? 'กำลังบันทึก...' : 'บันทึกนโยบาย'}</span>
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-charcoal-600 hover:text-charcoal-900 bg-white hover:bg-cream-100 border border-cream-300 transition-colors"
            >
              <X size={14} />
              <span>ยกเลิก</span>
            </button>
          </div>
        </div>
      ) : policy ? (
        <div className="space-y-3 bg-cream-50/70 p-4.5 rounded-2xl border border-cream-200/90 text-xs sm:text-sm text-charcoal-700">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-forest-700" />
            <p>
              ยกเลิกก่อนเข้าพักอย่างน้อย{' '}
              <span className="font-bold text-forest-900 font-mono px-1.5 py-0.5 rounded-md bg-white border border-cream-200">{policy.full_refund_hours} ชั่วโมง</span>{' '}
              คืนเงิน <span className="font-bold text-forest-900">100% (เต็มจำนวน)</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
            <p>
              ยกเลิกหลังกำหนด คืนเงิน{' '}
              <span className="font-bold text-forest-900 font-mono px-1.5 py-0.5 rounded-md bg-white border border-cream-200">{policy.late_refund_percent}%</span>
            </p>
          </div>
          {updatedAtText && (
            <p className="text-[11px] text-charcoal-400 pt-1 font-mono border-t border-cream-200/60 mt-2">
              อัปเดตล่าสุด: {updatedAtText}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
