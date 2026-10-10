'use client';

import { useCallback, useEffect, useState } from 'react';
import { Anchor, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getApiErrorMessage } from '@/lib/api';
import { useConfirmStore } from '@/hooks/useConfirmStore';
import { canBookRoomBoatAddon, type RoomBoatAddonInfo } from '@/lib/room-boat-addon';
import RoomBoatAddonForm from './RoomBoatAddonForm';
import RoomBoatTicketSummary from './RoomBoatTicketSummary';

interface BoatAddon {
  boat_booking_id: number;
  booking_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  mode: string | null;
  price: number | string | null;
  printed_at: string | null;
  handed_out_at: string | null;
  checkin_at?: string | null;
  boat_type_name: string | null;
  boat_count: number | null;
  num_passengers: number | null;
}

interface AddonInfoResponse extends RoomBoatAddonInfo {
  existing_addons: BoatAddon[];
}

interface CancellationPolicy {
  full_refund_hours: number;
  late_refund_percent: number;
}

interface CancelAddonResponse {
  refund_amount: number | string;
  percent_applied: number | string;
  room_total_reduction: number | string;
}

const addonStatusLabel: Record<string, string> = {
  pending: 'รอดำเนินการ',
  paid: 'รอตรวจสอบชำระเงิน',
  approved: 'ยืนยันแล้ว',
  cancelled: 'ยกเลิกแล้ว',
  rejected: 'ถูกปฏิเสธ',
  checked_out: 'ใช้งานแล้ว',
};

const addonStatusClass: Record<string, string> = {
  pending: 'bg-orange-50 text-orange-700',
  paid: 'bg-lagoon-50 text-lagoon-700',
  approved: 'bg-forest-50 text-forest-700',
  cancelled: 'bg-stone-100 text-stone-500',
  rejected: 'bg-red-50 text-red-600',
  checked_out: 'bg-bamboo-50 text-bamboo-600',
};

const formatThb = (value: number | string | null | undefined): string => `฿${Number(value ?? 0).toLocaleString()}`;

// เวลาออกเรือ (เวลาไทย) ใช้คำนวณว่ายกเลิกทันเวลาคืนเงินเต็มจำนวนหรือไม่
const slotStartMs = (addon: BoatAddon): number => {
  const date = String(addon.booking_date).slice(0, 10);
  const time = (addon.start_time ?? '00:00').slice(0, 5);
  return new Date(`${date}T${time}:00+07:00`).getTime();
};

// ประมาณการยอดคืนเงินให้ลูกค้าเห็นก่อนยืนยัน (ยอดจริงคำนวณที่ฝั่งเซิร์ฟเวอร์)
const describeExpectedRefund = (addon: BoatAddon, roomStatus: string, policy: CancellationPolicy | null): string => {
  if (roomStatus === 'pending') {
    return 'ห้องพักยังไม่ได้ชำระเงิน บัตรเสริมจะถูกนำออกโดยไม่มียอดคืนเงิน';
  }
  const price = Number(addon.price ?? 0);
  if (price <= 0) {
    return 'บัตรเสริมนี้ไม่มียอดชำระ จึงไม่มียอดคืนเงิน';
  }
  if (!policy) {
    return 'ไม่สามารถโหลดนโยบายการคืนเงินได้ ยอดคืนเงินจะคำนวณตามนโยบายจริงของรีสอร์ท';
  }
  const hoursLeft = (slotStartMs(addon) - Date.now()) / (60 * 60 * 1000);
  const percent = hoursLeft >= policy.full_refund_hours ? 100 : Number(policy.late_refund_percent);
  const refund = Math.floor((price * percent) / 100);
  return `ยอดคืนเงินโดยประมาณ ${formatThb(refund)} (${percent}% ของ ${formatThb(price)})`;
};

interface BoatAddonSectionProps {
  bookingRoomId: number;
  roomBookingStatus: string;
  onChanged?: () => void;
  allowBooking?: boolean;
}

// แสดงบัตรเสริม (เรือ) ของห้องพักหนึ่งห้อง และให้ลูกค้ายกเลิกได้เมื่อยังไม่ได้รับเรือ
export default function BoatAddonSection({ bookingRoomId, roomBookingStatus, onChanged, allowBooking = false }: BoatAddonSectionProps) {
  const [addons, setAddons] = useState<BoatAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [info, setInfo] = useState<AddonInfoResponse | null>(null);

  const fetchAddons = useCallback(async (): Promise<void> => {
    try {
      const res = await api.get(`/kayaks/room-addon/${bookingRoomId}`);
      const data = res.data?.data as AddonInfoResponse | undefined;
      setAddons(data?.existing_addons ?? []);
      setInfo(data ?? null);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'ไม่สามารถโหลดบัตรเสริมเรือได้'));
    } finally {
      setLoading(false);
    }
  }, [bookingRoomId]);

  useEffect(() => {
    fetchAddons();
  }, [fetchAddons]);

  const canCancel = (addon: BoatAddon): boolean =>
    (addon.status === 'pending' || addon.status === 'approved') && addon.handed_out_at == null && addon.checkin_at == null;

  const performCancel = async (addon: BoatAddon): Promise<void> => {
    setCancellingId(addon.boat_booking_id);
    try {
      const res = await api.put(`/kayaks/room-addon/${addon.boat_booking_id}/cancel`, {});
      const data = res.data?.data as CancelAddonResponse | undefined;
      const refund = Number(data?.refund_amount ?? 0);
      toast.success(refund > 0 ? `ยกเลิกบัตรเสริมสำเร็จ คืนเงิน ${formatThb(refund)}` : 'ยกเลิกบัตรเสริมสำเร็จ');
      await fetchAddons();
      onChanged?.();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'ยกเลิกบัตรเสริมไม่สำเร็จ'));
    } finally {
      setCancellingId(null);
    }
  };

  const handleCancel = async (addon: BoatAddon): Promise<void> => {
    let policy: CancellationPolicy | null = null;
    try {
      const res = await api.get('/settings/cancellation-policy');
      policy = (res.data?.data as CancellationPolicy | undefined) ?? null;
    } catch {
      policy = null;
    }

    const policyText = policy
      ? `ยกเลิกก่อนเวลาออกเรืออย่างน้อย ${policy.full_refund_hours} ชั่วโมง คืนเงิน 100% · ยกเลิกหลังจากนั้นคืนเงิน ${policy.late_refund_percent}%`
      : 'นโยบายการคืนเงินของรีสอร์ทจะใช้ตามที่กำหนดไว้';

    useConfirmStore.getState().openConfirm({
      title: 'ยืนยันยกเลิกบัตรเสริมเรือ?',
      description: `${policyText}. ${describeExpectedRefund(addon, roomBookingStatus, policy)}`,
      confirmText: 'ยืนยันยกเลิก',
      cancelText: 'ไม่ยกเลิก',
      danger: true,
      onConfirm: () => performCancel(addon),
    });
  };

  if (loading) {
    return <div className="h-12 animate-pulse rounded-xl bg-stone-100" />;
  }
  if (addons.length === 0 && !allowBooking && !info?.total_tickets) {
    return null;
  }

  return (
    <div className="rounded-xl border border-stone-200/80 bg-stone-50/60 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-forest-900">
        <Anchor size={13} /> รอบเรือจากโปรโมชั่นห้องพัก
      </p>
      {info?.total_tickets != null && <div className="mb-3"><RoomBoatTicketSummary bookingStatus={['checked_out', 'cancelled', 'rejected'].includes(info.room_line_status ?? '') ? info.room_line_status! : roomBookingStatus} summary={{
        total_tickets: info.total_tickets, used_tickets: info.used_tickets ?? Math.max(0, info.total_tickets - info.balance), remaining_tickets: info.balance,
        bookable_tickets: canBookRoomBoatAddon(info, new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })) ? info.balance : 0,
        free_tickets: info.mode === 'free' ? info.total_tickets : 0, paid_tickets: info.mode === 'paid' ? info.total_tickets : 0,
        valid_from: info.valid_from, valid_to: info.valid_to,
      }} /></div>}
      {allowBooking && info && <RoomBoatAddonForm bookingRoomId={bookingRoomId} info={info} onCreated={async () => { await fetchAddons(); onChanged?.(); }} />}
      {allowBooking && info && info.balance <= 0 && <p className="mb-3 text-xs text-charcoal-500">ห้องนี้ไม่มีสิทธิ์เรือที่ยังไม่ได้ใช้</p>}
      {allowBooking && info && info.balance > 0 && (!info.valid_from || !info.valid_to) && <p className="mb-3 text-xs text-charcoal-500">ไม่พบช่วงวันที่ใช้สิทธิ์ กรุณาตรวจสอบรายละเอียดการจองห้องพัก</p>}
      {allowBooking && info?.mode === 'paid' && info.room_status !== 'pending' && <p className="mb-3 text-xs text-charcoal-500">สิทธิ์เรือแบบเสียเงินต้องเลือกก่อนชำระค่าห้องพัก</p>}
      <ul className="space-y-2">
        {addons.map((addon) => {
          const dateLabel = new Date(addon.booking_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
          const timeLabel = addon.start_time && addon.end_time ? ` · ${addon.start_time.slice(0, 5)} - ${addon.end_time.slice(0, 5)} น.` : '';
          return (
            <li key={addon.boat_booking_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-charcoal-700">
                  {addon.boat_type_name || 'เรือ'}
                  {addon.boat_count ? ` · ${addon.boat_count} ลำ` : ''}
                </p>
                <p className="text-xs text-charcoal-400">
                  {dateLabel}{timeLabel}
                </p>
                <p className="mt-0.5 text-xs text-charcoal-500">
                  {addon.mode === 'free' ? 'สิทธิ์ฟรีจากโปรโมชั่นห้องพัก' : `สิทธิ์แบบมีค่าใช้จ่ายจากโปรโมชั่นห้องพัก · ราคา ${formatThb(addon.price)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${addonStatusClass[addon.status] || 'bg-stone-100 text-charcoal-500'}`}>
                  {addonStatusLabel[addon.status] || addon.status}
                </span>
                {canCancel(addon) && (
                  <button
                    type="button"
                    onClick={() => handleCancel(addon)}
                    disabled={cancellingId !== null}
                    className="flex items-center gap-1 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                  >
                    <XCircle size={13} /> {cancellingId === addon.boat_booking_id ? 'กำลังยกเลิก...' : 'ยกเลิกบัตรเสริม'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
