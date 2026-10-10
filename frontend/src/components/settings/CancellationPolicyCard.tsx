'use client';

import { useState, useEffect } from 'react';
import { Pencil, Save, X, Bed, Anchor, Clock, Calendar, CreditCard } from 'lucide-react';
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

const toForm = (policy: CancellationPolicy): PolicyForm => ({
  full_refund_hours: String(policy.full_refund_hours ?? 48),
  late_refund_percent: String(policy.late_refund_percent ?? 0),
  room_full_refund_days: String(policy.room_full_refund_days ?? 3),
  room_late_refund_percent: String(policy.room_late_refund_percent ?? 0),
});

const parseIntInRange = (raw: string, max: number): number | null => {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 0 && value <= max ? value : null;
};

const parseFloatInRange = (raw: string, max: number): number | null => {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 0 && value <= max ? value : null;
};

const formatUpdatedAt = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

interface CancellationPolicyCardProps {
  scope?: 'all' | 'room' | 'boat';
}

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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-charcoal-700 bg-cream-100 hover:bg-cream-200 border border-cream-300/80 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
      >
        <Pencil size={13} aria-hidden="true" />
        <span>แก้ไข</span>
      </button>
    ) : null;

  return (
    <section className="bg-white rounded-3xl p-6 sm:p-7 shadow-panel border border-cream-200/90 space-y-6">
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-cream-200/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-forest-50 text-forest-800 border border-forest-200/80 flex items-center justify-center shrink-0">
            <CreditCard size={18} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-forest-900 font-display">
              {title}
            </h2>
            <p className="text-xs text-charcoal-500 mt-0.5 leading-relaxed">
              {subtitle}
            </p>
          </div>
        </div>
        {editButton}
      </div>

      {loading ? (
        <div className="space-y-3 pt-1">
          <div className="h-20 rounded-2xl bg-cream-100 animate-pulse" />
          {scope === 'all' && <div className="h-20 rounded-2xl bg-cream-100 animate-pulse" />}
        </div>
      ) : loadError ? (
        <p className="text-xs font-medium text-rose-600">โหลดนโยบายการคืนเงินไม่สำเร็จ กรุณาลองรีเฟรชหน้า</p>
      ) : editing ? (
        <div className="space-y-5 bg-cream-50/80 p-5 rounded-2xl border border-cream-200/90">
          {/* Section ห้องพัก */}
          {showRoom && (
            <div className="space-y-3 pb-4 border-b border-cream-200/80 last:border-b-0 last:pb-0">
              <div className="flex items-center gap-2 text-forest-900 font-bold text-xs sm:text-sm">
                <Bed size={16} className="text-forest-700" />
                <span>นโยบายห้องพัก (Room Cancellation)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="room_full_refund_days" className="block text-xs font-semibold text-charcoal-800 mb-1.5">
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
                      className="w-28 rounded-xl border border-cream-300 bg-white px-3 py-1.5 text-center text-xs sm:text-sm font-bold font-mono text-forest-950 focus:border-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-800/15"
                      value={form.room_full_refund_days}
                      onChange={(e) => setForm({ ...form, room_full_refund_days: e.target.value })}
                    />
                    <span className="text-xs sm:text-sm text-charcoal-600 font-medium">วัน</span>
                  </div>
                </div>

                <div>
                  <label htmlFor="room_late_refund_percent" className="block text-xs font-semibold text-charcoal-800 mb-1.5">
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
                      className="w-28 rounded-xl border border-cream-300 bg-white px-3 py-1.5 text-center text-xs sm:text-sm font-bold font-mono text-forest-950 focus:border-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-800/15"
                      value={form.room_late_refund_percent}
                      onChange={(e) => setForm({ ...form, room_late_refund_percent: e.target.value })}
                    />
                    <span className="text-xs sm:text-sm text-charcoal-600 font-medium">%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section เรือและบัตรเสริม */}
          {showBoat && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2 text-forest-900 font-bold text-xs sm:text-sm">
                <Anchor size={16} className="text-forest-700" />
                <span>นโยบายบริการเรือและบัตรเสริม (Boat & Add-ons)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="full_refund_hours" className="block text-xs font-semibold text-charcoal-800 mb-1.5">
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
                      className="w-28 rounded-xl border border-cream-300 bg-white px-3 py-1.5 text-center text-xs sm:text-sm font-bold font-mono text-forest-950 focus:border-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-800/15"
                      value={form.full_refund_hours}
                      onChange={(e) => setForm({ ...form, full_refund_hours: e.target.value })}
                    />
                    <span className="text-xs sm:text-sm text-charcoal-600 font-medium">ชั่วโมง</span>
                  </div>
                </div>

                <div>
                  <label htmlFor="late_refund_percent" className="block text-xs font-semibold text-charcoal-800 mb-1.5">
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
                      className="w-28 rounded-xl border border-cream-300 bg-white px-3 py-1.5 text-center text-xs sm:text-sm font-bold font-mono text-forest-950 focus:border-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-800/15"
                      value={form.late_refund_percent}
                      onChange={(e) => setForm({ ...form, late_refund_percent: e.target.value })}
                    />
                    <span className="text-xs sm:text-sm text-charcoal-600 font-medium">%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {formError && <p className="text-xs font-semibold text-rose-600">{formError}</p>}

          <div className="flex items-center gap-2 pt-2 border-t border-cream-200/60">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-forest-800 hover:bg-forest-900 text-white shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Save size={14} />
              <span>{saving ? 'กำลังบันทึก...' : 'บันทึกนโยบาย'}</span>
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-charcoal-600 hover:text-charcoal-900 bg-white hover:bg-cream-100 border border-cream-300 transition-colors cursor-pointer"
            >
              <X size={14} />
              <span>ยกเลิก</span>
            </button>
          </div>
        </div>
      ) : policy ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Box แสดงผลห้องพัก */}
            {showRoom && (
              <div className="bg-cream-50/70 p-4.5 rounded-2xl border border-cream-200/90 text-xs sm:text-sm text-charcoal-700 space-y-3">
                <div className="flex items-center gap-2 font-bold text-forest-900 border-b border-cream-200/60 pb-2">
                  <Bed size={16} className="text-forest-700" />
                  <span>นโยบายห้องพัก</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-forest-700 shrink-0" />
                  <p>
                    ยกเลิกก่อนวันเข้าพักอย่างน้อย{' '}
                    <span className="font-bold text-forest-900 font-mono px-1.5 py-0.5 rounded-md bg-white border border-cream-200">
                      {policy.room_full_refund_days ?? 3} วัน
                    </span>{' '}
                    คืนเงิน <span className="font-bold text-forest-900">100% (เต็มจำนวน)</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-bamboo-600 shrink-0" />
                  <p>
                    ยกเลิกหลังกำหนด คืนเงิน{' '}
                    <span className="font-bold text-forest-900 font-mono px-1.5 py-0.5 rounded-md bg-white border border-cream-200">
                      {policy.room_late_refund_percent ?? 0}%
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Box แสดงผลเรือ */}
            {showBoat && (
              <div className="bg-cream-50/70 p-4.5 rounded-2xl border border-cream-200/90 text-xs sm:text-sm text-charcoal-700 space-y-3">
                <div className="flex items-center gap-2 font-bold text-forest-900 border-b border-cream-200/60 pb-2">
                  <Anchor size={16} className="text-forest-700" />
                  <span>นโยบายบริการเรือและบัตรเสริม</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-forest-700 shrink-0" />
                  <p>
                    ยกเลิกก่อนถึงรอบเวลาอย่างน้อย{' '}
                    <span className="font-bold text-forest-900 font-mono px-1.5 py-0.5 rounded-md bg-white border border-cream-200">
                      {policy.full_refund_hours} ชั่วโมง
                    </span>{' '}
                    คืนเงิน <span className="font-bold text-forest-900">100% (เต็มจำนวน)</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-bamboo-600 shrink-0" />
                  <p>
                    ยกเลิกหลังกำหนด คืนเงิน{' '}
                    <span className="font-bold text-forest-900 font-mono px-1.5 py-0.5 rounded-md bg-white border border-cream-200">
                      {policy.late_refund_percent}%
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {updatedAtText && (
            <p className="text-[11px] text-charcoal-400 pt-1 font-mono">
              อัปเดตล่าสุด: {updatedAtText}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
