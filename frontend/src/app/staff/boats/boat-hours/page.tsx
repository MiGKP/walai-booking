'use client';

import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { notify } from '@/lib/admin-notify';
import { PageHeader, Panel } from '@/components/admin/ui';
import TermsListEditor from '@/components/admin/TermsListEditor';
import TimeSelect from '@/components/admin/TimeSelect';
import CancellationPolicyCard from '@/components/settings/CancellationPolicyCard';

const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

interface DayHour {
  id?: number;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
}

interface BoatHoursResponse {
  success: boolean;
  data?: DayHour[];
}

interface ResortResponse {
  success: boolean;
  data?: { additional_terms?: string | null; boat_advance_booking_minutes?: number | null };
}

const defaultHours = (): DayHour[] =>
  Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i,
    open_time: '08:00',
    close_time: '18:00',
    is_open: true,
  }));

export default function BoatHoursPage(): React.ReactElement | null {
  const { ready } = useAuthGuard({ allowedRoles: ['admin', 'boat_staff'] });
  const [hours, setHours] = useState<DayHour[]>(defaultHours());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [boatTerms, setBoatTerms] = useState('');
  const [advanceMinutes, setAdvanceMinutes] = useState('60');

  const updateDay = <K extends keyof DayHour>(day: number, field: K, value: DayHour[K]): void => {
    setHours((prev) => prev.map((h) => (h.day_of_week === day ? { ...h, [field]: value } : h)));
  };

  useEffect(() => {
    if (!ready) return;
    api
      .get<BoatHoursResponse>('/settings/boat-hours')
      .then((res) => {
        const data: DayHour[] = res.data?.data ?? [];
        if (data.length > 0) {
          const merged = defaultHours().map((def) => {
            const found = data.find((d) => d.day_of_week === def.day_of_week);
            return found
              ? {
                  ...found,
                  open_time: String(found.open_time).slice(0, 5),
                  close_time: String(found.close_time).slice(0, 5),
                }
              : def;
          });
          setHours(merged);
        }
      })
      .catch(() => {
        setLoadError(true);
        notify.error('โหลดข้อมูลเวลาไม่สำเร็จ');
      })
      .finally(() => setLoading(false));

    api
      .get<ResortResponse>('/settings/resort?id=5')
      .then((res) => {
        if (res.data?.data?.additional_terms) {
          setBoatTerms(res.data.data.additional_terms);
        }
        if (res.data?.data?.boat_advance_booking_minutes != null) {
          setAdvanceMinutes(String(res.data.data.boat_advance_booking_minutes));
        }
      })
      .catch(() => {
        setLoadError(true);
        notify.error('โหลดกฎการจองเรือไม่สำเร็จ กรุณาลองรีเฟรชหน้า');
      });
  }, [ready]);

  const handleSave = async (): Promise<void> => {
    const minutes = Number(advanceMinutes);
    if (!/^\d+$/.test(advanceMinutes.trim()) || minutes > 10080) {
      notify.error('จองล่วงหน้าขั้นต่ำต้องเป็นจำนวนเต็มระหว่าง 0 ถึง 10080 นาที');
      return;
    }

    setSaving(true);
    try {
      await Promise.all([
        ...hours.map((h) =>
          api.put('/settings/boat-hours', {
            day_of_week: h.day_of_week,
            open_time: h.open_time,
            close_time: h.close_time,
            is_open: h.is_open,
          }),
        ),
        api.put('/settings/resort', {
          id: 5,
          additional_terms: boatTerms,
          boat_advance_booking_minutes: minutes,
        }),
      ]);
      notify.success('บันทึกข้อมูลสำเร็จ');
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, 'บันทึกไม่สำเร็จ'));
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="เวลาทำการเรือ"
        actions={
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || loadError}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={16} aria-hidden="true" /> {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </button>
        }
      />

      <Panel title="เวลาเปิด-ปิดรายวัน">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-cream-200" />
            ))}
          </div>
        ) : loadError ? (
          <p className="text-sm font-medium text-rose-600">โหลดเวลาทำการไม่สำเร็จ กรุณาลองรีเฟรชหน้า</p>
        ) : (
          <div className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200/80">
            {hours.map((h) => (
              <div key={h.day_of_week} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <div className="w-24 shrink-0">
                  <span className={`text-sm font-semibold ${h.is_open ? 'text-charcoal' : 'text-charcoal-400'}`}>
                    {DAY_NAMES[h.day_of_week]}
                  </span>
                </div>

                <div className={`flex items-center gap-2 transition-opacity ${!h.is_open ? 'pointer-events-none opacity-40' : ''}`}>
                  <TimeSelect
                    label={`เวลาเปิด วัน${DAY_NAMES[h.day_of_week]}`}
                    value={h.open_time}
                    onChange={(v) => updateDay(h.day_of_week, 'open_time', v)}
                  />
                  <span className="text-sm text-charcoal-400">–</span>
                  <TimeSelect
                    label={`เวลาปิด วัน${DAY_NAMES[h.day_of_week]}`}
                    value={h.close_time}
                    onChange={(v) => updateDay(h.day_of_week, 'close_time', v)}
                  />
                </div>


                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <span className={`text-xs font-semibold ${h.is_open ? 'text-forest-800' : 'text-charcoal-400'}`}>
                    {h.is_open ? 'เปิด' : 'ปิด'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={h.is_open}
                    aria-label={`สถานะวัน${DAY_NAMES[h.day_of_week]}`}
                    onClick={() => updateDay(h.day_of_week, 'is_open', !h.is_open)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${h.is_open ? 'bg-forest-800' : 'bg-stone-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${h.is_open ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="กฎการจองล่วงหน้า">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-charcoal-700">ลูกค้าต้องจองก่อนรอบเริ่มอย่างน้อย</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={10080}
            step={5}
            aria-label="จองล่วงหน้าขั้นต่ำ (นาที)"
            disabled={loading || loadError}
            value={advanceMinutes}
            onChange={(e) => setAdvanceMinutes(e.target.value)}
            className="input-field w-24 py-1.5 text-center text-sm"
          />
          <span className="text-sm text-charcoal-700">นาที</span>
        </div>
      </Panel>

      <Panel title="ข้อกำหนดการจองเรือ">{/* แสดงในหน้าจอง */}
        <TermsListEditor
          value={boatTerms}
          onChange={setBoatTerms}
          disabled={loading || loadError}
          placeholder="เช่น สวมเสื้อชูชีพตลอดการพายเรือ"
        />
      </Panel>

      <CancellationPolicyCard />
    </div>
  );
}
