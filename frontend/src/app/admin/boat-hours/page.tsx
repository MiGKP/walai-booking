'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';

const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

interface DayHour {
  id?: number;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
}

const defaultHours = (): DayHour[] =>
  Array.from({ length: 7 }, (_, i) => ({ day_of_week: i, open_time: '08:00', close_time: '18:00', is_open: true }));

export default function BoatHoursPage() {
  const { ready, user } = useAuthGuard({ allowedRoles: ['admin', 'boat_staff'] });
  const [hours, setHours] = useState<DayHour[]>(defaultHours());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const backPath = user?.role === 'admin' ? '/admin' : '/staff/boats/dashboard';

  useEffect(() => {
    if (!ready) return;
    api.get('/settings/boat-hours').then(res => {
      const data: DayHour[] = res.data?.data || [];
      if (data.length > 0) {
        const merged = defaultHours().map(def => {
          const found = data.find(d => d.day_of_week === def.day_of_week);
          return found ? {
            ...found,
            open_time: String(found.open_time).slice(0, 5),
            close_time: String(found.close_time).slice(0, 5),
          } : def;
        });
        setHours(merged);
      }
    }).catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ')).finally(() => setLoading(false));
  }, [ready]);

  const updateDay = (day: number, field: keyof DayHour, value: any) => {
    setHours(prev => prev.map(h => h.day_of_week === day ? { ...h, [field]: value } : h));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        hours.map(h => api.put('/settings/boat-hours', {
          day_of_week: h.day_of_week,
          open_time: h.open_time,
          close_time: h.close_time,
          is_open: h.is_open,
        }))
      );
      toast.success('บันทึกเวลาทำการสำเร็จ');
    } catch { toast.error('บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href={backPath} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">เวลาทำการบริการเรือ</h1>
            <p className="text-gray-500 mt-0.5">กำหนดเวลาเปิด-ปิดบริการเรือแต่ละวัน</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="card h-16 animate-pulse bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="divide-y divide-gray-100">
              {hours.map(h => (
                <div key={h.day_of_week} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-24 shrink-0">
                    <span className={`text-sm font-semibold ${h.is_open ? 'text-gray-900' : 'text-gray-400'}`}>
                      {DAY_NAMES[h.day_of_week]}
                    </span>
                  </div>
                  <div className={`flex items-center gap-3 flex-1 transition-opacity ${!h.is_open ? 'opacity-40 pointer-events-none' : ''}`}>
                    <input
                      type="time"
                      className="input-field text-sm py-1.5 w-32"
                      value={h.open_time}
                      onChange={e => updateDay(h.day_of_week, 'open_time', e.target.value)}
                    />
                    <span className="text-gray-400 text-sm">–</span>
                    <input
                      type="time"
                      className="input-field text-sm py-1.5 w-32"
                      value={h.close_time}
                      onChange={e => updateDay(h.day_of_week, 'close_time', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium ${h.is_open ? 'text-green-600' : 'text-gray-400'}`}>
                      {h.is_open ? 'เปิด' : 'ปิด'}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateDay(h.day_of_week, 'is_open', !h.is_open)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${h.is_open ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${h.is_open ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="btn-primary w-full mt-6 flex items-center justify-center gap-2"
        >
          <Save size={16} /> {saving ? 'กำลังบันทึก...' : 'บันทึกเวลาทำการ'}
        </button>
      </div>
    </div>
  );
}
