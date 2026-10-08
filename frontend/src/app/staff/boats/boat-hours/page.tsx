'use client';

import { useState, useEffect } from 'react';
import { Clock, Save, ShieldAlert, Sparkles, AlertCircle } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { notify } from '@/lib/admin-notify';
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

  const [bulkOpenTime, setBulkOpenTime] = useState('08:00');
  const [bulkCloseTime, setBulkCloseTime] = useState('18:00');

  const updateDay = <K extends keyof DayHour>(day: number, field: K, value: DayHour[K]): void => {
    setHours((prev) => prev.map((h) => (h.day_of_week === day ? { ...h, [field]: value } : h)));
  };

  // ใช้งานเวลานี้กับทุกวัน (ทั้ง 7 วัน)
  const handleApplyToAllDays = (): void => {
    setHours((prev) =>
      prev.map((h) => ({
        ...h,
        open_time: bulkOpenTime,
        close_time: bulkCloseTime,
        is_open: true,
      })),
    );
    notify.success(`ตั้งเวลา ${bulkOpenTime} - ${bulkCloseTime} น. ให้กับทุกวันเรียบร้อย (อย่าลืมกดบันทึกข้อมูล)`);
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
    <div className="space-y-6 pb-16 max-w-[1200px] mx-auto">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-forest-800 text-white flex items-center justify-center shadow-md shadow-forest-800/10 shrink-0">
              <Clock size={20} className="stroke-[2.2]" />
            </span>
            <div>
              <h1 className="font-display text-2xl lg:text-3xl font-bold text-forest-900 tracking-tight">
                เวลาทำการเรือ
              </h1>
              <p className="text-xs sm:text-sm text-charcoal-500 mt-1">
                กำหนดเวลาเปิด-ปิดบริการเรือพายคายัค กฎการจองล่วงหน้า และข้อกำหนดการใช้บริการ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading || loadError}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold bg-forest-800 hover:bg-forest-900 text-white shadow-xs transition-all active:scale-95 disabled:opacity-50"
            >
              <Save size={16} aria-hidden="true" />
              <span>{saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Row 1: Two-Column Layout (เวลาเปิด-ปิดรายวัน ฝั่งซ้าย + กฎการจองล่วงหน้าและนโยบายคืนเงิน ฝั่งขวา) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* COLUMN 1 (ฝั่งซ้าย ~7 cols): เวลาเปิด-ปิดรายวัน 7 วัน */}
        {/* ========================================================= */}
        <section className="xl:col-span-7 bg-white rounded-3xl p-6 shadow-panel border border-cream-200/90 space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-cream-200/80">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-forest-800" />
              <h2 className="text-base font-bold text-forest-900 font-display">
                เวลาเปิด-ปิดรายวัน
              </h2>
            </div>
            <span className="text-xs text-charcoal-400 font-medium hidden sm:inline">
              กำหนดเวลาให้บริการในแต่ละวัน
            </span>
          </div>

          {/* Quick Bulk Time Setter: กำหนดเวลามาตรฐานทุกวัน */}
          <div className="bg-cream-50/80 border border-cream-200/90 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold text-forest-900">
              กำหนดเวลามาตรฐานทุกวัน
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              <TimeSelect
                label="เวลาเปิดมาตรฐาน"
                value={bulkOpenTime}
                onChange={setBulkOpenTime}
              />
              <span className="text-xs sm:text-sm font-semibold text-charcoal-400 font-mono">–</span>
              <TimeSelect
                label="เวลาปิดมาตรฐาน"
                value={bulkCloseTime}
                onChange={setBulkCloseTime}
              />
              <button
                type="button"
                onClick={handleApplyToAllDays}
                disabled={loading || loadError}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-forest-800 hover:bg-forest-900 text-white shadow-2xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                title="คัดลอกเวลานี้ไปใส่ให้กับทุกวัน"
              >
                <span>นำไปใช้ทุกวัน</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 pt-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-2xl bg-cream-100" />
              ))}
            </div>
          ) : loadError ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-700">
              <AlertCircle size={16} className="shrink-0" />
              <span>โหลดเวลาทำการไม่สำเร็จ กรุณาลองรีเฟรชหน้า</span>
            </div>
          ) : (
            <div className="divide-y divide-cream-100 overflow-hidden rounded-2xl border border-cream-200/90 bg-white">
              {hours.map((h) => {
                const isOpen = h.is_open;
                return (
                  <div
                    key={h.day_of_week}
                    className={`flex flex-wrap items-center justify-between gap-3 px-3.5 sm:px-4 py-3 transition-colors ${
                      isOpen ? 'bg-white hover:bg-cream-50/50' : 'bg-cream-50/40 opacity-70'
                    }`}
                  >
                    {/* วันในสัปดาห์ */}
                    <div className="w-20 sm:w-22 shrink-0 flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isOpen ? 'bg-forest-600' : 'bg-charcoal-300'
                        }`}
                      />
                      <span
                        className={`text-xs sm:text-sm font-bold ${
                          isOpen ? 'text-forest-950' : 'text-charcoal-400'
                        }`}
                      >
                        วัน{DAY_NAMES[h.day_of_week]}
                      </span>
                    </div>

                    {/* ช่องเลือกเวลา */}
                    <div
                      className={`flex items-center gap-1.5 sm:gap-2 transition-opacity ${
                        !isOpen ? 'pointer-events-none opacity-40' : ''
                      }`}
                    >
                      <TimeSelect
                        label={`เวลาเปิด วัน${DAY_NAMES[h.day_of_week]}`}
                        value={h.open_time}
                        onChange={(v) => updateDay(h.day_of_week, 'open_time', v)}
                      />
                      <span className="text-xs sm:text-sm font-semibold text-charcoal-400 font-mono">–</span>
                      <TimeSelect
                        label={`เวลาปิด วัน${DAY_NAMES[h.day_of_week]}`}
                        value={h.close_time}
                        onChange={(v) => updateDay(h.day_of_week, 'close_time', v)}
                      />
                    </div>

                    {/* สถานะ & Toggle Switch */}
                    <div className="flex shrink-0 items-center gap-2.5 ml-auto sm:ml-0">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                          isOpen
                            ? 'bg-forest-50 text-forest-800 border-forest-200/80'
                            : 'bg-cream-100 text-charcoal-500 border-cream-200'
                        }`}
                      >
                        {isOpen ? 'เปิด' : 'ปิด'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isOpen}
                        aria-label={`สถานะวัน${DAY_NAMES[h.day_of_week]}`}
                        onClick={() => updateDay(h.day_of_week, 'is_open', !isOpen)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                          isOpen ? 'bg-forest-800' : 'bg-cream-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
                            isOpen ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ========================================================= */}
        {/* COLUMN 2 (ฝั่งขวา ~5 cols): กฎการจองล่วงหน้า + นโยบายคืนเงิน */}
        {/* ========================================================= */}
        <div className="xl:col-span-5 space-y-6">
          {/* Card: กฎการจองล่วงหน้า */}
          <section className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/90 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-cream-200/80">
              <div className="w-2.5 h-2.5 rounded-full bg-forest-800" />
              <h2 className="text-base font-bold text-forest-900 font-display">
                กฎการจองล่วงหน้า
              </h2>
            </div>

            <div className="bg-cream-50/80 border border-cream-200/90 rounded-2xl p-4 space-y-2.5">
              <p className="text-xs text-charcoal-500 leading-relaxed">
                ระยะเวลาขั้นต่ำที่ลูกค้าต้องทำการจองก่อนถึงรอบเวลา เพื่อให้เจ้าหน้าที่เตรียมความพร้อม
              </p>
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-xs sm:text-sm font-semibold text-charcoal-800">
                  ต้องจองก่อนรอบเริ่มอย่างน้อย
                </span>
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
                  className="w-20 rounded-xl border border-cream-300 bg-white px-2.5 py-1.5 text-center text-xs sm:text-sm font-bold font-mono text-forest-950 focus:border-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-800/15 disabled:opacity-50"
                />
                <span className="text-xs sm:text-sm font-semibold text-charcoal-700">
                  นาที
                </span>
                <span className="text-xs text-charcoal-400 font-mono">
                  ({(Number(advanceMinutes) / 60).toFixed(1)} ชม.)
                </span>
              </div>
            </div>
          </section>

          {/* Card: นโยบายการคืนเงิน */}
          <CancellationPolicyCard />
        </div>
      </div>

      {/* Row 2: ข้อกำหนดการจองเรือ (อยู่ด้านล่างแบบเต็มความกว้าง รองรับจำนวนข้อที่เพิ่มได้ไม่จำกัด) */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 shadow-panel border border-cream-200/90 space-y-4">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-cream-200/80">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-forest-800" />
            <h2 className="text-base font-bold text-forest-900 font-display">
              ข้อกำหนดการจองเรือ
            </h2>
          </div>
          <span className="text-xs text-charcoal-400 font-medium hidden sm:inline">
            แสดงในหน้าเลือกจองเรือ
          </span>
        </div>

        <p className="text-xs text-charcoal-500 leading-relaxed">
          ข้อควรระวังและความปลอดภัยที่จะแสดงให้ลูกค้าเห็นในหน้าเลือกจองเรือ (สามารถเพิ่มข้อกำหนดได้ตามต้องการ)
        </p>

        <TermsListEditor
          value={boatTerms}
          onChange={setBoatTerms}
          disabled={loading || loadError}
          placeholder="เช่น สวมเสื้อชูชีพตลอดการพายเรือ"
        />
      </section>
    </div>
  );
}
