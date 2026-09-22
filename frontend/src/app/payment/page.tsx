'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CreditCard, Upload, CheckCircle, ArrowLeft, XCircle, Receipt, Landmark, QrCode, Info, X } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { formatThaiDate, formatTimeRange, nightsBetween } from '@/lib/date';
import toast from 'react-hot-toast';
import Link from 'next/link';

const CARD = 'rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(18,60,48,0.02),0_8px_24px_-8px_rgba(18,60,48,0.08)] p-5 sm:p-6';

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-700">{icon}</span>
      <h2 className="font-sans text-[16px] font-semibold text-forest-900">{title}</h2>
    </div>
  );
}

// การ์ดบัตรเสริมเรือคายัคต่อห้องพักจริง 1 ห้อง — ให้ลูกค้าเลือกประเภทเรือ/เวลา/จำนวน ตอนกดชำระเงินห้องพัก
// (จองคิวรอบจริงทันทีตามเงื่อนไข ไม่ใช่แค่บันทึกความต้องการไว้ก่อน)
function BoatAddonCard({
  bookingRoomId,
  roomLabel,
  onTotalChanged,
}: {
  bookingRoomId: number;
  roomLabel: string;
  onTotalChanged: () => void;
}) {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [kayakTypes, setKayakTypes] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [numPassengers, setNumPassengers] = useState(1);
  const [boatCount, setBoatCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const fetchInfo = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/kayaks/room-addon/${bookingRoomId}`);
      setInfo(res.data.data);
    } catch {
      // ไม่มีบัตรเสริมสำหรับห้องนี้ก็แค่ไม่แสดงส่วนนี้
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingRoomId]);

  useEffect(() => {
    if (showPicker && kayakTypes.length === 0) {
      api
        .get('/kayaks')
        .then((res) => setKayakTypes(res.data.data || []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPicker]);

  useEffect(() => {
    if (selectedDate && selectedTypeId) {
      api
        .get('/kayaks/rounds-availability', {
          params: { kayak_id: selectedTypeId, booking_date: selectedDate },
        })
        .then((res) => setRounds(res.data.data?.rounds || []))
        .catch(() => setRounds([]));
      setSelectedRoundId('');
    }
  }, [selectedDate, selectedTypeId]);

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTypeId || !selectedRoundId) {
      toast.error('กรุณาเลือกวันที่ ประเภทเรือ และรอบเวลาให้ครบ');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/kayaks/room-addon/${bookingRoomId}`, {
        boat_type_id: Number(selectedTypeId),
        boat_round_id: Number(selectedRoundId),
        booking_date: selectedDate,
        num_passengers: numPassengers,
        boat_count: boatCount,
      });
      toast.success('เพิ่มทริปพายเรือสำเร็จ');
      setShowPicker(false);
      setSelectedDate('');
      setSelectedTypeId('');
      setSelectedRoundId('');
      await fetchInfo();
      onTotalChanged();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เพิ่มทริปพายเรือไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !info) return null;
  const hasBalance = info.balance > 0;
  const hasExisting = Array.isArray(info.existing_addons) && info.existing_addons.length > 0;
  if (!hasBalance && !hasExisting) return null;

  return (
    <div className="rounded-xl border border-lagoon-200 bg-lagoon-50/50 p-3 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <p className="text-[12.5px] font-bold text-lagoon-800">🚣 บัตรเสริมเรือคายัค — {roomLabel}</p>
        {hasBalance && (
          <span className="text-[11px] font-semibold text-lagoon-700">
            เหลือ {info.balance} ครั้ง {info.mode === 'paid' ? `(฿${info.unit_price}/ครั้ง)` : '(แจกฟรี)'}
          </span>
        )}
      </div>

      {hasExisting && (
        <ul className="space-y-1">
          {info.existing_addons
            .filter((a: any) => a.status !== 'cancelled')
            .map((a: any) => (
              <li
                key={a.boat_booking_id}
                className="text-[11.5px] text-charcoal-500 flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5"
              >
                <span>
                  {a.boat_type_name} · {formatThaiDate(String(a.booking_date).slice(0, 10))} ·{' '}
                  {String(a.start_time || '').slice(0, 5)}-{String(a.end_time || '').slice(0, 5)} · {a.boat_count} ลำ
                </span>
                <span className="font-semibold shrink-0 ml-2">
                  {a.mode === 'paid' ? `฿${Number(a.price).toLocaleString()}` : 'ฟรี'}
                </span>
              </li>
            ))}
        </ul>
      )}

      {hasBalance && !info.valid_from && (
        <p className="text-[11px] text-stone-400">ที่พักคืนเดียวไม่มีวันที่ให้เลือกใช้บัตรเสริม</p>
      )}

      {hasBalance && info.valid_from && !showPicker && (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="text-[11.5px] font-bold text-lagoon-700 hover:underline"
        >
          + เพิ่มทริปพายเรือ
        </button>
      )}

      {showPicker && (
        <div className="space-y-2 bg-white rounded-lg p-2.5 border border-lagoon-100">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="addon-date" className="text-[10.5px] font-bold text-stone-500 block mb-1">วันที่ใช้บริการ</label>
              <input
                id="addon-date"
                type="date"
                min={info.valid_from}
                max={info.valid_to}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field text-xs px-2 py-1.5"
              />
            </div>
            <div>
              <label htmlFor="addon-type" className="text-[10.5px] font-bold text-stone-500 block mb-1">ประเภทเรือ</label>
              <select
                id="addon-type"
                value={selectedTypeId}
                onChange={(e) => setSelectedTypeId(e.target.value)}
                className="input-field text-xs px-2 py-1.5"
              >
                <option value="">เลือก</option>
                {kayakTypes.map((k: any) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedDate && selectedTypeId && (
            <div>
              <label htmlFor="addon-round" className="text-[10.5px] font-bold text-stone-500 block mb-1">รอบเวลา</label>
              <select
                id="addon-round"
                value={selectedRoundId}
                onChange={(e) => setSelectedRoundId(e.target.value)}
                className="input-field text-xs px-2 py-1.5"
              >
                <option value="">เลือกรอบ</option>
                {rounds.map((r: any) => (
                  <option key={r.boat_round_id} value={r.boat_round_id} disabled={!r.available || r.remaining <= 0}>
                    {String(r.start_time).slice(0, 5)}-{String(r.end_time).slice(0, 5)} (เหลือ {Math.max(0, r.remaining)} ลำ)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10.5px] font-bold text-stone-500">จำนวนผู้โดยสาร</label>
              <input
                type="number"
                min={1}
                value={numPassengers}
                onChange={(e) => setNumPassengers(Math.max(1, Number(e.target.value)))}
                className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-bold text-stone-500">จำนวนเรือ (สูงสุด {info.balance})</label>
              <input
                type="number"
                min={1}
                max={info.balance}
                value={boatCount}
                onChange={(e) => setBoatCount(Math.min(info.balance, Math.max(1, Number(e.target.value))))}
                className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowPicker(false)}
              className="text-[11px] font-semibold text-stone-500 px-3 py-1.5"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="text-[11px] font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg px-3 py-1.5 disabled:opacity-60"
            >
              {submitting ? 'กำลังบันทึก...' : 'ยืนยันจอง'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// component หลักของหน้าชำระเงิน ทำหน้าที่โหลดข้อมูล payment, แสดง QR, รับสลิป และส่งสลิปไป backend
function PaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { ready } = useAuthGuard();
  const booking_type = searchParams.get('booking_type');
  const booking_id = searchParams.get('booking_id');

  const [payment, setPayment] = useState<any>(null);
  const [bookingDetail, setBookingDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [slip, setSlip] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  // สถานะจริงของการจอง (ไม่ใช่ payment_status ที่ค้างเป็น 'paid' ตลอดหลังส่งสลิป) ใช้แยกว่าเจ้าหน้าที่อนุมัติ/ปฏิเสธไปแล้วหรือยังรอตรวจสอบ
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!booking_type || !booking_id) { router.push('/'); return; }
    createPayment();
  }, [ready, booking_type, booking_id]);

  // เรียก backend เพื่อสร้างหรือดึงข้อมูล payment ของ booking ปัจจุบัน รวมถึง QR Code และข้อมูลบัญชีรับเงิน
  const createPayment = async () => {
    try {
      const res = await api.post('/payments', { booking_type, booking_id: Number(booking_id) });
      setPayment(res.data.data);
      setBookingStatus(res.data.data.booking_status ?? null);
      setRejectReason(res.data.data.reject_reason ?? null);
      if (res.data.data.slip_image) {
        setDone(true); // ส่งสลิปแล้ว — สถานะจริงหลังจากนี้ (รอตรวจสอบ/อนุมัติ/ปฏิเสธ) ดูจาก bookingStatus
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'ไม่สามารถสร้างรายการชำระเงินได้');
    } finally {
      setLoading(false);
    }

    // ดึงรายละเอียดการจองแบบเต็ม (วันที่ ผู้เข้าพัก/ผู้โดยสาร รายการห้อง/เรือ) มาแสดงฝั่งซ้าย
    try {
      const detailUrl = booking_type === 'room' ? `/bookings/${booking_id}` : `/kayaks/bookings/${booking_id}`;
      const detailRes = await api.get(detailUrl);
      setBookingDetail(detailRes.data.data);
    } catch {
      // ไม่ critical ต่อการชำระเงิน แค่แสดงรายละเอียดเพิ่มไม่ได้ ไม่ต้อง toast รบกวนผู้ใช้
    }
  };

  // รับไฟล์สลิปจาก input แล้วสร้าง preview ให้ผู้ใช้เห็นก่อนกดยืนยันอัปโหลด
  const handleSlipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSlip(file);
      setSlipPreview(URL.createObjectURL(file));
    }
  };

  // ส่งสลิปการโอนเงินไปยัง backend ในรูปแบบ multipart/form-data แล้วอัปเดตหน้าจอเป็นสถานะส่งสำเร็จ
  const handleUploadSlip = async () => {
    if (!slip || !payment) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('slip', slip);
      await api.post(`/payments/${payment.id}/slip`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDone(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'อัปโหลดสลิปไม่สำเร็จ'));
    } finally {
      setUploading(false);
    }
  };

  // ยกเลิกการจอง (เฉพาะสถานะ pending ที่ยังไม่ได้ส่งสลิป) แล้วพากลับไปหน้าการจองของฉัน
  const handleCancelBooking = async () => {
    if (!booking_type || !booking_id) return;
    setCancelling(true);
    try {
      const cancelUrl = booking_type === 'room' ? `/bookings/${booking_id}/cancel` : `/kayaks/bookings/${booking_id}/cancel`;
      await api.put(cancelUrl);
      toast.success('ยกเลิกการจองแล้ว');
      router.push('/dashboard');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'ไม่สามารถยกเลิกการจองได้'));
    } finally {
      setCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-cream-100 pt-20 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-forest-800 border-t-transparent" />
    </div>
  );

  if (done) {
    const isRejected = bookingStatus === 'rejected';
    const isApproved = bookingStatus === 'approved' || bookingStatus === 'checked_out';

    return (
    <div className="min-h-screen bg-cream-100 pt-20 flex items-center justify-center px-4 pb-10">
      <div className={`${CARD} max-w-md w-full text-center px-6 py-10 sm:px-10`}>
        <div className="relative mx-auto mb-6 grid h-24 w-24 place-items-center">
          <span className={`absolute inset-0 rounded-full ${isRejected ? 'bg-red-50' : 'bg-forest-50'}`} />
          {!isRejected && (
            <span className="absolute inset-0 animate-ping rounded-full bg-forest-100 opacity-60" style={{ animationDuration: '2s' }} />
          )}
          <div className={`relative grid h-20 w-20 place-items-center rounded-full shadow-lg ${isRejected ? 'bg-red-500 shadow-red-900/20' : 'bg-forest-800 shadow-forest-900/20'}`}>
            {isRejected ? <XCircle size={40} className="text-white" /> : <CheckCircle size={40} className="text-cream-100" />}
          </div>
        </div>

        {isRejected ? (
          <>
            <h1 className="font-sans text-[22px] font-semibold text-red-700 sm:text-[24px]">การจองถูกปฏิเสธ</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-charcoal-400">
              {rejectReason ? `เหตุผล: ${rejectReason}` : 'เจ้าหน้าที่ตรวจสอบแล้วไม่สามารถยืนยันการจองนี้ได้ กรุณาติดต่อเจ้าหน้าที่หากต้องการสอบถามเพิ่มเติม'}
            </p>
          </>
        ) : isApproved ? (
          <>
            <h1 className="font-sans text-[22px] font-semibold text-forest-900 sm:text-[24px]">การจองได้รับการยืนยันแล้ว!</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-charcoal-400">
              เจ้าหน้าที่ตรวจสอบและยืนยันการชำระเงินของคุณเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ
            </p>
          </>
        ) : (
          <>
            <h1 className="font-sans text-[22px] font-semibold text-forest-900 sm:text-[24px]">ส่งสลิปสำเร็จแล้ว!</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-charcoal-400">
              ขอบคุณสำหรับการชำระเงิน เจ้าหน้าที่กำลังตรวจสอบสลิปของคุณ
            </p>
          </>
        )}

        {payment && (
          <div className="mt-5 flex items-center justify-between rounded-xl bg-forest-50/60 px-4 py-3 text-left text-[13px]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">หมายเลขการจอง</p>
              <p className="font-semibold text-forest-900">#{payment.booking_id}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">ยอดที่ชำระ</p>
              <p className="font-sans text-[16px] font-extrabold text-forest-900">฿{Number(payment.amount).toLocaleString()}</p>
            </div>
          </div>
        )}

        {!isRejected && (
          <>
            {/* Progress Steps */}
            <div className="mt-6 flex items-center justify-center gap-2 px-2">
              <div className="flex flex-1 flex-col items-center gap-1.5">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-forest-800 text-cream-100"><CheckCircle size={14} /></div>
                <span className="text-[10.5px] font-semibold text-forest-900">ส่งสลิปแล้ว</span>
              </div>
              <div className="h-0.5 flex-1 rounded-full bg-forest-200 -mt-5" />
              <div className="flex flex-1 flex-col items-center gap-1.5">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-forest-800 text-cream-100"><CheckCircle size={14} /></div>
                <span className="text-[10.5px] font-semibold text-forest-900">รอตรวจสอบ</span>
              </div>
              <div className={`h-0.5 flex-1 rounded-full -mt-5 ${isApproved ? 'bg-forest-200' : 'bg-stone-200'}`} />
              <div className="flex flex-1 flex-col items-center gap-1.5">
                {isApproved ? (
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-forest-800 text-cream-100"><CheckCircle size={14} /></div>
                ) : (
                  <div className="grid h-7 w-7 place-items-center rounded-full border-2 border-stone-200 bg-white text-stone-400 text-[11px] font-bold">3</div>
                )}
                <span className={`text-[10.5px] font-semibold ${isApproved ? 'text-forest-900' : 'text-stone-400'}`}>ยืนยันการจอง</span>
              </div>
            </div>
            {!isApproved && <p className="mt-3 text-[11.5px] text-charcoal-400">ใช้เวลาตรวจสอบประมาณ 15-30 นาที</p>}
          </>
        )}

        <div className="mt-7 flex flex-col gap-3">
          <Link href="/dashboard" className="btn-primary text-center">ดูการจองของฉัน</Link>
          <Link href="/" className="inline-flex w-full items-center justify-center rounded-xl border border-stone-200 py-3 text-[13px] font-bold text-forest-800 transition-colors hover:bg-stone-50">กลับหน้าแรก</Link>
        </div>
      </div>
    </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100 pt-20">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header Section */}
        <div>
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-4 text-[13px] font-bold text-forest-800 shadow-[0_1px_2px_rgba(18,60,48,0.04),0_6px_16px_-6px_rgba(18,60,48,0.2)] ring-1 ring-stone-200/70 transition-all duration-200 hover:-translate-x-0.5 hover:ring-forest-300"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-700 transition-colors group-hover:bg-forest-100">
              <ArrowLeft size={14} />
            </span>
            กลับไปการจอง
          </Link>

          <div className="mt-4 flex items-center gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-700"><CreditCard size={18} /></span>
            <div>
              <h1 className="font-sans text-[24px] font-semibold leading-tight text-forest-900 sm:text-[28px]">ชำระเงิน</h1>
              <p className="text-[12.5px] text-charcoal-400">ทำตามขั้นตอนด้านล่างเพื่อยืนยันการจองของคุณ</p>
            </div>
          </div>
        </div>

        {payment && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
            {/* ---- คอลัมน์ 1: สรุปรายการจอง + รายละเอียดการเข้าพัก (การ์ดเดียว) ---- */}
            <div className="space-y-5">
              <section className={CARD}>
                <SectionHeading icon={<Receipt size={16} />} title="สรุปรายการ" />
                <div className="mt-4 space-y-2 text-[13.5px]">
                  <div className="flex justify-between text-charcoal-500">
                    <span>ประเภทการจอง</span>
                    <span className="font-semibold text-forest-900">{payment.booking_type === 'room' ? 'ห้องพัก' : 'เรือ'}</span>
                  </div>
                  <div className="flex justify-between text-charcoal-500">
                    <span>หมายเลขการจอง</span>
                    <span className="font-semibold text-forest-900">#{payment.booking_id}</span>
                  </div>
                  {payment.status && (
                    <div className="flex justify-between text-charcoal-500">
                      <span>สถานะ</span>
                      <span className="font-semibold text-forest-900">{payment.status === 'pending' ? 'รอชำระเงิน' : payment.status}</span>
                    </div>
                  )}
                  {bookingDetail?.created_at && (
                    <div className="flex justify-between text-charcoal-500">
                      <span>วันที่จอง</span>
                      <span className="font-semibold text-forest-900">{formatThaiDate(String(bookingDetail.created_at).slice(0, 10))}</span>
                    </div>
                  )}
                  {payment.booking_type === 'kayak' && bookingDetail?.boats?.length > 0 && (
                    <div className="flex justify-between text-charcoal-500">
                      <span>รายการเรือ</span>
                      <span className="font-semibold text-forest-900">
                        {bookingDetail.boats.map((b: any) => b.type_name).join(', ')}
                        {' · '}
                        {bookingDetail.boats.reduce((sum: number, b: any) => sum + Number(b.boat_count), 0)} ลำ
                        {' · '}
                        {bookingDetail.num_passengers} คน
                      </span>
                    </div>
                  )}
                </div>

                {bookingDetail && payment.booking_type === 'room' && (
                  <>
                    <div className="mt-4 flex flex-wrap gap-4 border-t border-stone-100 pt-4 text-[13.5px]">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">วันเข้าพัก – วันออก</p>
                        <p className="mt-0.5 font-semibold text-forest-900">
                          {formatThaiDate(String(bookingDetail.check_in_date).slice(0, 10))} – {formatThaiDate(String(bookingDetail.check_out_date).slice(0, 10))}
                          <span className="ml-1.5 rounded-full bg-forest-50 px-2 py-0.5 text-[11px] font-bold text-forest-700">
                            {nightsBetween(String(bookingDetail.check_in_date).slice(0, 10), String(bookingDetail.check_out_date).slice(0, 10))} คืน
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">ผู้เข้าพัก</p>
                        <p className="mt-0.5 font-semibold text-forest-900">ผู้ใหญ่ {bookingDetail.adults} · เด็ก {bookingDetail.children}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 border-t border-stone-100 pt-4">
                      {(bookingDetail.rooms || []).map((room: any) => (
                        <div key={room.booking_room_id} className="flex items-center justify-between gap-3 rounded-xl bg-stone-50/60 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-bold text-forest-900">{room.room_name} (ห้อง {room.room_number})</p>
                            <p className="text-[11.5px] text-charcoal-400">฿{Number(room.price_per_night).toLocaleString()} / คืน × {room.nights} คืน</p>
                          </div>
                          <span className="shrink-0 text-[13px] font-bold text-forest-900">฿{Number(room.subtotal).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    {!['rejected', 'cancelled', 'checked_out'].includes(String(bookingStatus)) && (
                      <div className="mt-4 space-y-2 border-t border-stone-100 pt-4">
                        {(bookingDetail.rooms || []).map((room: any) => (
                          <BoatAddonCard
                            key={room.booking_room_id}
                            bookingRoomId={room.booking_room_id}
                            roomLabel={`${room.room_name} #${room.room_number}`}
                            onTotalChanged={createPayment}
                          />
                        ))}
                      </div>
                    )}

                    {bookingDetail.special_request && (
                      <div className="mt-4 rounded-xl bg-bamboo-50/40 p-3 text-[12.5px] text-charcoal-500">
                        <span className="font-bold text-bamboo-600">คำขอพิเศษ:</span> {bookingDetail.special_request}
                      </div>
                    )}
                  </>
                )}

                {bookingDetail && payment.booking_type === 'kayak' && (
                  <>
                    <div className="mt-4 flex flex-wrap gap-4 border-t border-stone-100 pt-4 text-[13.5px]">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">วันที่ · รอบเวลา</p>
                        <p className="mt-0.5 font-semibold text-forest-900">
                          {formatThaiDate(String(bookingDetail.booking_date).slice(0, 10))}
                          <span className="ml-1.5 rounded-full bg-forest-50 px-2 py-0.5 text-[11px] font-bold text-forest-700">
                            {formatTimeRange(bookingDetail.start_time, bookingDetail.end_time)}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">ผู้โดยสาร</p>
                        <p className="mt-0.5 font-semibold text-forest-900">{bookingDetail.num_passengers} คน</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 border-t border-stone-100 pt-4">
                      {(bookingDetail.boats || []).map((boat: any) => (
                        <div key={boat.booking_boat_id} className="flex items-center justify-between gap-3 rounded-xl bg-stone-50/60 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-bold text-forest-900">{boat.type_name}</p>
                            <p className="text-[11.5px] text-charcoal-400">
                              ผู้โดยสาร {boat.num_passengers} คน · {boat.boat_count} ลำ · ฿{Number(boat.unit_price).toLocaleString()}/ลำ
                            </p>
                          </div>
                          <span className="shrink-0 text-[13px] font-bold text-forest-900">฿{Number(boat.subtotal).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Price Breakdown */}
                <div className="mt-4 space-y-2 border-t border-stone-100 pt-4 text-[13.5px]">
                  <div className="flex justify-between text-charcoal-500">
                    <span>{payment.booking_type === 'room' ? 'ยอดรวมห้องพัก' : 'ยอดรวมเรือ'}</span>
                    <span className="font-semibold text-forest-900">
                      ฿{(
                        bookingDetail?.rooms?.length
                          ? bookingDetail.rooms.reduce((sum: number, r: any) => sum + Number(r.subtotal), 0)
                          : bookingDetail?.boats?.length
                            ? bookingDetail.boats.reduce((sum: number, b: any) => sum + Number(b.subtotal), 0)
                            : Number(payment.amount)
                      ).toLocaleString()}
                    </span>
                  </div>
                  {(bookingDetail?.promotions || []).map((promo: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-emerald-600">
                      <span>ส่วนลด{promo.name || promo.code ? ` (${promo.name || promo.code})` : ''}</span>
                      <span className="font-semibold">-฿{Number(promo.discount_amount).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-stone-100 pt-3 mt-1">
                    <span className="text-[14px] font-bold text-forest-900">ยอดชำระสุทธิ</span>
                    <span className="font-sans text-[20px] font-extrabold text-bamboo-600">฿{Number(payment.amount).toLocaleString()}</span>
                  </div>
                </div>
              </section>
            </div>

            {/* ---- คอลัมน์ 2: ช่องทางการชำระเงิน (QR ข้างบน + บัญชีข้างล่าง ในการ์ดเดียวกัน) ---- */}
            <div className="space-y-5">
              <section className={CARD}>
                {payment.qr_code_url && (
                  <div className="text-center">
                    <SectionHeading icon={<QrCode size={16} />} title="สแกน QR Code ชำระเงิน" />
                    <div className="mt-4 inline-block rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                      <img src={payment.qr_code_url} alt={`QR Code สำหรับสแกนจ่ายเงินจำนวน ${Number(payment.amount).toLocaleString()} บาท`} className="w-52 h-52 mx-auto" />
                    </div>
                    <p className="mt-3 text-[12.5px] text-charcoal-400">สแกนด้วยแอปธนาคารหรือ PromptPay</p>
                    <p className="mt-1 font-sans text-[18px] font-extrabold text-forest-900">฿{Number(payment.amount).toLocaleString()}</p>
                  </div>
                )}
                {/* Fallback to Bank Info if no QR */}
                {!payment.qr_code_url && (
                  <div className="text-center">
                    <SectionHeading icon={<CreditCard size={16} />} title="โอนผ่านบัญชีธนาคาร" />
                    <div className="mt-4 inline-block rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm space-y-2 text-left w-full max-w-xs mx-auto">
                      <p className="text-[13px] font-medium text-forest-800">ธนาคาร: <span className="font-semibold text-charcoal-600">กสิกรไทย (KBank)</span></p>
                      <p className="text-[13px] font-medium text-forest-800">เลขบัญชี: <span className="font-sans font-bold text-lg text-bamboo-600 tracking-wider">123-4-56789-0</span></p>
                      <p className="text-[13px] font-medium text-forest-800">ชื่อบัญชี: <span className="font-semibold text-charcoal-600">บริษัท สวนวลัย จำกัด</span></p>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* ---- คอลัมน์ 3: ยืนยันการโอนเงิน (อัปโหลดสลิป) ---- */}
            <div className="space-y-5">
              {/* Upload Slip */}
              <section className={CARD}>
                <SectionHeading icon={<Upload size={16} />} title="แจ้งชำระเงิน (อัปโหลดสลิป)" />
                <div className="mt-4 flex flex-col items-center">
                  {slipPreview ? (
                    <div className="relative w-full max-w-[200px] rounded-xl overflow-hidden border-2 border-stone-200/80">
                      <img src={slipPreview} alt="Slip preview" className="w-full h-auto object-cover" />
                      <button
                        onClick={() => {
                          setSlip(null);
                          setSlipPreview('');
                        }}
                        className="absolute top-2 right-2 bg-red-500/90 hover:bg-red-600 text-white p-1 rounded-full backdrop-blur-sm transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-stone-300 rounded-xl bg-stone-50/50 hover:bg-stone-50 cursor-pointer transition-colors group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6 text-stone-400 group-hover:text-forest-600 transition-colors">
                        <Upload size={24} className="mb-2" />
                        <p className="text-[12.5px] font-medium">คลิกเพื่อเลือกไฟล์สลิป</p>
                        <p className="text-[11px] mt-1">PNG, JPG</p>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={handleSlipChange} />
                    </label>
                  )}
                </div>
                <button
                  onClick={handleUploadSlip}
                  disabled={!slip || uploading}
                  className="btn-primary w-full mt-4 text-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'กำลังอัปโหลด...' : 'ยืนยันการชำระเงิน'}
                </button>
              </section>

              <section className={`${CARD} bg-transparent border-none shadow-none items-center text-center px-0 pt-0`}>
                <p className="mt-3 text-[12.5px] leading-relaxed text-charcoal-400">
                  หลังโอนเงินแล้ว กรุณาอัปโหลดสลิปการโอนด้านบนเพื่อให้เจ้าหน้าที่ตรวจสอบและยืนยันการจองของคุณ
                  หากยังไม่สะดวกชำระเงินตอนนี้ สามารถยกเลิกการจองนี้ได้
                </p>
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={cancelling}
                  className="w-auto mt-2 inline-flex py-2 px-4 text-red-600/80 font-medium text-[12.5px] hover:text-red-700 hover:bg-red-50/50 rounded-lg transition-colors disabled:opacity-60 underline underline-offset-2"
                >
                  ต้องการยกเลิกการจองใช่หรือไม่?
                </button>
              </section>
            </div>
          </div>
        )}
      </div>

      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-950/40 backdrop-blur-sm p-4" onClick={() => setShowCancelConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-500">
              <XCircle size={22} />
            </div>
            <h3 className="text-center text-[16px] font-bold text-forest-900">ยกเลิกการจองนี้?</h3>
            <p className="mt-1.5 text-center text-[13px] leading-relaxed text-stone-500">
              ห้อง/เรือที่จองไว้จะถูกปล่อยว่าง และไม่สามารถกู้คืนรายการนี้ได้
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowCancelConfirm(false)} className="flex-1 rounded-xl border border-stone-200 py-2.5 text-[13px] font-bold text-stone-600 hover:bg-stone-50 transition-colors">
                ไม่ยกเลิก
              </button>
              <button onClick={handleCancelBooking} disabled={cancelling} className="flex-1 rounded-xl bg-red-600 py-2.5 text-[13px] font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-60">
                {cancelling ? 'กำลังยกเลิก...' : 'ยกเลิกการจอง'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ครอบ PaymentContent ด้วย Suspense เพื่อรองรับ useSearchParams ใน Next.js App Router อย่างปลอดภัย
export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream-100 pt-20 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-forest-800 border-t-transparent" /></div>}>
      <PaymentContent />
    </Suspense>
  );
}
