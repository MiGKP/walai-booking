'use client';

import { useState, useEffect } from 'react';
import { Pencil, Save, X, Bed, Anchor, CreditCard } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { notify } from '@/lib/admin-notify';

export interface CancellationPolicy {
  full_refund_hours: number;
  late_refund_percent: number;
  room_full_refund_days?: number;
  room_late_refund_percent?: number;
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
  room_full_refund_days: string;
  room_late_refund_percent: string;
}

const MAX_HOURS = 8760;
const MAX_DAYS = 365;
const MAX_PERCENT = 100;

// แปลงข้อมูลนโยบายการคืนเงินเป็นค่าสตริงสำหรับฟอร์มแก้ไข
const toForm = (policy: CancellationPolicy): PolicyForm => ({
  full_refund_hours: String(policy.full_refund_hours ?? 48),
  late_refund_percent: String(policy.late_refund_percent ?? 0),
  room_full_refund_days: String(policy.room_full_refund_days ?? 3),
  room_late_refund_percent: String(policy.room_late_refund_percent ?? 0),
});

// แปลงและตรวจสอบค่าจำนวนเต็มให้อยู่ในช่วงที่กำหนด
const parseIntInRange = (raw: string, max: number): number | null => {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 0 && value <= max ? value : null;
};

// แปลงและตรวจสอบค่าทศนิยมให้อยู่ในช่วงที่กำหนด
const parseFloatInRange = (raw: string, max: number): number | null => {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 0 && value <= max ? value : null;
};

// จัดรูปแบบวันเวลาที่อัปเดตล่าสุดเป็นภาษาไทย
const formatUpdatedAt = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

interface CancellationPolicyCardProps {
  scope?: 'all' | 'room' | 'boat';
}

// การ์ดแสดงและแก้ไขนโยบายการยกเลิกและคืนเงินสำหรับห้องพักและเรือ
export default function CancellationPolicyCard({
  scope = 'all',
}: CancellationPolicyCardProps): React.ReactElement {
  const [policy, setPolicy] = useState<CancellationPolicy | null>(null);
  const [form, setForm] = useState<PolicyForm>({
    full_refund_hours: '48',
    late_refund_percent: '0',
    room_full_refund_days: '3',
    room_late_refund_percent: '0',
  });
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

  // เปิดโหมดแก้ไขนโยบายและรีเซ็ตค่าตามข้อมูลล่าสุด
  const startEditing = (): void => {
    if (policy) setForm(toForm(policy));
    setFormError(null);
    setEditing(true);
  };

  // ยกเลิกการแก้ไขและคืนค่าเดิมของฟอร์ม
  const cancelEditing = (): void => {
    if (policy) setForm(toForm(policy));
    setFormError(null);
    setEditing(false);
  };

  // ตรวจสอบความถูกต้องและบันทึกนโยบายการคืนเงินไปยังเซิร์ฟเวอร์
  const handleSave = async (): Promise<void> => {
    const hours = parseIntInRange(form.full_refund_hours, MAX_HOURS);
    const latePercent = parseFloatInRange(form.late_refund_percent, MAX_PERCENT);
    const roomDays = parseIntInRange(form.room_full_refund_days, MAX_DAYS);
    const roomLatePercent = parseFloatInRange(form.room_late_refund_percent, MAX_PERCENT);

    if (hours === null || latePercent === null || roomDays === null || roomLatePercent === null) {
      setFormError('กรุณากรอกข้อมูลให้ถูกต้อง: ตัวเลขต้องไม่ติดลบ และเปอร์เซ็นต์อยู่ระหว่าง 0–100');
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      const res = await api.put<CancellationPolicySaveResponse>('/settings/cancellation-policy', {
        full_refund_hours: hours,
        late_refund_percent: latePercent,
        room_full_refund_days: roomDays,
        room_late_refund_percent: roomLatePercent,
      });
      const updated: CancellationPolicy = res.data?.data ?? {
        full_refund_hours: hours,
        late_refund_percent: latePercent,
        room_full_refund_days: roomDays,
        room_late_refund_percent: roomLatePercent,
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

  const showRoom = scope === 'all' || scope === 'room';
  const showBoat = scope === 'all' || scope === 'boat';

  const title =
    scope === 'room'
      ? 'นโยบายการคืนเงินห้องพัก'
      : scope === 'boat'
        ? 'นโยบายการคืนเงินค่าบริการเรือและบัตรเสริม'
        : 'นโยบายการยกเลิกและการคืนเงิน';

  const subtitle =
    scope === 'room'
      ? 'ใช้กับการยกเลิกห้องพักที่ชำระแล้ว โดยอิงตามจำนวนวันก่อนถึงวันเข้าพัก'
      : scope === 'boat'
        ? 'ใช้กับการยกเลิกการจองเรือและบัตรเสริมที่ชำระแล้ว โดยอิงตามจำนวนชั่วโมงก่อนถึงรอบเวลา'
        : 'กำหนดเงื่อนไขการคืนเงินเมื่อลูกค้ายกเลิกการจองที่ชำระเงินแล้ว ทั้งห้องพักและบริการเรือ';

  const editButton =
    !loading && !editing ? (
      <button
        type="button"
        onClick={startEditing}
        disabled={loadError}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-cream-300/80 bg-cream-100 px-3 py-1.5 text-xs font-semibold text-charcoal-700 transition-all hover:bg-cream-200 active:scale-95 disabled:opacity-50"
      >
        <Pencil size={13} aria-hidden="true" />
        <span>แก้ไข</span>
      </button>
    ) : null;

  return (
    <section className="space-y-6 rounded-3xl border border-cream-200/90 bg-white p-6 shadow-panel sm:p-7">
      <div className="flex items-center justify-between gap-3 border-b border-cream-200/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-forest-200/80 bg-forest-50 text-forest-800">
            <CreditCard size={18} />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-forest-900 sm:text-lg">{title}</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-charcoal-500">{subtitle}</p>
          </div>
        </div>
        {editButton}
      </div>

      {loading ? (
        <div className="space-y-3 pt-1">
          <div className="h-20 animate-pulse rounded-2xl bg-cream-100" />
          {scope === 'all' && <div className="h-20 animate-pulse rounded-2xl bg-cream-100" />}
        </div>
      ) : loadError ? (
        <p className="text-xs font-medium text-rose-600">โหลดนโยบายการคืนเงินไม่สำเร็จ กรุณาลองรีเฟรชหน้า</p>
      ) : editing ? (
        <div className="space-y-5 rounded-2xl border border-cream-200/90 bg-cream-50/80 p-5">
          {showRoom && (
            <div className="space-y-3 border-b border-cream-200/80 pb-4 last:border-b-0 last:pb-0">
              <div className="flex items-center gap-2 text-xs font-bold text-forest-900 sm:text-sm">
                <Bed size={16} className="text-forest-700" />
                <span>นโยบายห้องพัก (Room Cancellation)</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="room_full_refund_days" className="mb-1.5 block text-xs font-semibold text-charcoal-800">
                    ยกเลิกก่อนวันเข้าพักกี่วัน จึงคืนเต็มจำนวน
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="room_full_refund_days"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_DAYS}
                      step={1}
                      className="w-28 rounded-xl border border-cream-300 bg-white px-3 py-1.5 text-center font-mono text-xs font-bold text-forest-950 focus:border-forest-700 focus:outline-hidden focus:ring-2 focus:ring-forest-800/15 sm:text-sm"
                      value={form.room_full_refund_days}
                      onChange={(e) => setForm({ ...form, room_full_refund_days: e.target.value })}
                    />
                    <span className="text-xs font-medium text-charcoal-600 sm:text-sm">วัน</span>
                  </div>
                </div>

                <div>
                  <label htmlFor="room_late_refund_percent" className="mb-1.5 block text-xs font-semibold text-charcoal-800">
                    คืนเงินกี่เปอร์เซ็นต์ หากยกเลิกหลังกำหนด
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="room_late_refund_percent"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_PERCENT}
                      step={1}
                      className="w-28 rounded-xl border border-cream-300 bg-white px-3 py-1.5 text-center font-mono text-xs font-bold text-forest-950 focus:border-forest-700 focus:outline-hidden focus:ring-2 focus:ring-forest-800/15 sm:text-sm"
                      value={form.room_late_refund_percent}
                      onChange={(e) => setForm({ ...form, room_late_refund_percent: e.target.value })}
                    />
                    <span className="text-xs font-medium text-charcoal-600 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showBoat && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2 text-xs font-bold text-forest-900 sm:text-sm">
                <Anchor size={16} className="text-forest-700" />
                <span>นโยบายบริการเรือและบัตรเสริม (Boat & Add-ons)</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="full_refund_hours" className="mb-1.5 block text-xs font-semibold text-charcoal-800">
                    ยกเลิกก่อนถึงรอบเวลากี่ชั่วโมง จึงคืนเต็มจำนวน
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="full_refund_hours"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_HOURS}
                      step={1}
                      className="w-28 rounded-xl border border-cream-300 bg-white px-3 py-1.5 text-center font-mono text-xs font-bold text-forest-950 focus:border-forest-700 focus:outline-hidden focus:ring-2 focus:ring-forest-800/15 sm:text-sm"
                      value={form.full_refund_hours}
                      onChange={(e) => setForm({ ...form, full_refund_hours: e.target.value })}
                    />
                    <span className="text-xs font-medium text-charcoal-600 sm:text-sm">ชั่วโมง</span>
                  </div>
                </div>

                <div>
                  <label htmlFor="late_refund_percent" className="mb-1.5 block text-xs font-semibold text-charcoal-800">
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
                      className="w-28 rounded-xl border border-cream-300 bg-white px-3 py-1.5 text-center font-mono text-xs font-bold text-forest-950 focus:border-forest-700 focus:outline-hidden focus:ring-2 focus:ring-forest-800/15 sm:text-sm"
                      value={form.late_refund_percent}
                      onChange={(e) => setForm({ ...form, late_refund_percent: e.target.value })}
                    />
                    <span className="text-xs font-medium text-charcoal-600 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {formError && <p className="text-xs font-semibold text-rose-600">{formError}</p>}

          <div className="flex items-center gap-2 border-t border-cream-200/60 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-forest-800 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-forest-900 active:scale-95 disabled:opacity-50 sm:text-sm"
            >
              <Save size={14} />
              <span>{saving ? 'กำลังบันทึก...' : 'บันทึกนโยบาย'}</span>
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={saving}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-cream-300 bg-white px-4 py-2 text-xs font-semibold text-charcoal-600 transition-colors hover:bg-cream-100 hover:text-charcoal-900 sm:text-sm"
            >
              <X size={14} />
              <span>ยกเลิก</span>
            </button>
          </div>
        </div>
      ) : policy ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {showRoom && (
              <div className="space-y-3 rounded-2xl border border-cream-200/90 bg-cream-50/70 p-4.5 text-xs text-charcoal-700 sm:text-sm">
                <div className="flex items-center gap-2 border-b border-cream-200/60 pb-2 font-bold text-forest-900">
                  <Bed size={16} className="text-forest-700" />
                  <span>นโยบายห้องพัก</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-forest-700" />
                  <p>
                    ยกเลิกก่อนวันเข้าพักอย่างน้อย{' '}
                    <span className="rounded-md border border-cream-200 bg-white px-1.5 py-0.5 font-mono font-bold text-forest-900">
                      {policy.room_full_refund_days ?? 3} วัน
                    </span>{' '}
                    คืนเงิน <span className="font-bold text-forest-900">100% (เต็มจำนวน)</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-bamboo-600" />
                  <p>
                    ยกเลิกหลังกำหนด คืนเงิน{' '}
                    <span className="rounded-md border border-cream-200 bg-white px-1.5 py-0.5 font-mono font-bold text-forest-900">
                      {policy.room_late_refund_percent ?? 0}%
                    </span>
                  </p>
                </div>
              </div>
            )}

            {showBoat && (
              <div className="space-y-3 rounded-2xl border border-cream-200/90 bg-cream-50/70 p-4.5 text-xs text-charcoal-700 sm:text-sm">
                <div className="flex items-center gap-2 border-b border-cream-200/60 pb-2 font-bold text-forest-900">
                  <Anchor size={16} className="text-forest-700" />
                  <span>นโยบายบริการเรือและบัตรเสริม</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-forest-700" />
                  <p>
                    ยกเลิกก่อนถึงรอบเวลาอย่างน้อย{' '}
                    <span className="rounded-md border border-cream-200 bg-white px-1.5 py-0.5 font-mono font-bold text-forest-900">
                      {policy.full_refund_hours} ชั่วโมง
                    </span>{' '}
                    คืนเงิน <span className="font-bold text-forest-900">100% (เต็มจำนวน)</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-bamboo-600" />
                  <p>
                    ยกเลิกหลังกำหนด คืนเงิน{' '}
                    <span className="rounded-md border border-cream-200 bg-white px-1.5 py-0.5 font-mono font-bold text-forest-900">
                      {policy.late_refund_percent}%
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {updatedAtText && (
            <p className="pt-1 font-mono text-[11px] text-charcoal-400">อัปเดตล่าสุด: {updatedAtText}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
