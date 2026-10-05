'use client';

import { useState, useEffect } from 'react';
import { Pencil, Save, X } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { notify } from '@/lib/admin-notify';

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

  return (
    <div className="card overflow-hidden mt-6">
      <div className="px-5 py-4 bg-white">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-forest-800">นโยบายการคืนเงินค่าบริการเรือ</h2>
            <p className="text-xs text-charcoal-500 mt-0.5">ใช้กับการยกเลิกการจองเรือและกายัค</p>
          </div>
          {!loading && !editing && (
            <button
              type="button"
              onClick={startEditing}
              disabled={loadError}
              className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Pencil size={14} /> แก้ไข
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-5 w-3/4 rounded bg-cream-200 animate-pulse" />
            <div className="h-5 w-2/3 rounded bg-cream-200 animate-pulse" />
          </div>
        ) : loadError ? (
          <p className="text-sm text-red-600">โหลดนโยบายการคืนเงินไม่สำเร็จ กรุณาลองรีเฟรชหน้า</p>
        ) : editing ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="full_refund_hours" className="block text-sm font-medium text-charcoal-700 mb-1">
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
                  className="input-field text-sm py-1.5 w-32"
                  value={form.full_refund_hours}
                  onChange={(e) => setForm({ ...form, full_refund_hours: e.target.value })}
                />
                <span className="text-xs text-charcoal-500">ชั่วโมง</span>
              </div>
            </div>

            <div>
              <label htmlFor="late_refund_percent" className="block text-sm font-medium text-charcoal-700 mb-1">
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
                  className="input-field text-sm py-1.5 w-32"
                  value={form.late_refund_percent}
                  onChange={(e) => setForm({ ...form, late_refund_percent: e.target.value })}
                />
                <span className="text-xs text-charcoal-500">%</span>
              </div>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save size={14} /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="btn-secondary text-sm py-1.5 px-4 flex items-center gap-1.5"
              >
                <X size={14} /> ยกเลิก
              </button>
            </div>
          </div>
        ) : policy ? (
          <div className="space-y-2 text-sm text-charcoal-700">
            <p>
              ยกเลิกก่อนเข้าพักอย่างน้อย{' '}
              <span className="font-semibold text-forest-800">{policy.full_refund_hours} ชั่วโมง</span>{' '}
              คืนเงิน <span className="font-semibold text-forest-800">100%</span>
            </p>
            <p>
              ยกเลิกหลังกำหนด คืนเงิน{' '}
              <span className="font-semibold text-forest-800">{policy.late_refund_percent}%</span>
            </p>
            {updatedAtText && <p className="text-xs text-charcoal-500 pt-1">อัปเดตล่าสุด {updatedAtText}</p>}
          </div>
        ) : null}
      </div>
    </div>
  );
}
