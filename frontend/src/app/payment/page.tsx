'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CreditCard, Upload, CheckCircle, ArrowLeft, XCircle, Receipt, Landmark, QrCode, Info } from 'lucide-react';
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
      <h2 className="font-sans text-base font-semibold text-forest-900">{title}</h2>
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
  const [step, setStep] = useState<1 | 2>(1);

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
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'อัปโหลดสลิปไม่สำเร็จ');
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
            <h1 className="font-sans text-xl font-semibold text-red-700 sm:text-2xl">การจองถูกปฏิเสธ</h1>
            <p className="mt-2 text-sm leading-relaxed text-charcoal-400">
              {rejectReason ? `เหตุผล: ${rejectReason}` : 'เจ้าหน้าที่ตรวจสอบแล้วไม่สามารถยืนยันการจองนี้ได้ กรุณาติดต่อเจ้าหน้าที่หากต้องการสอบถามเพิ่มเติม'}
            </p>
          </>
        ) : isApproved ? (
          <>
            <h1 className="font-sans text-xl font-semibold text-forest-900 sm:text-2xl">การจองได้รับการยืนยันแล้ว!</h1>
            <p className="mt-2 text-sm leading-relaxed text-charcoal-400">
              เจ้าหน้าที่ตรวจสอบและยืนยันการชำระเงินของคุณเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ
            </p>
          </>
        ) : (
          <>
            <h1 className="font-sans text-xl font-semibold text-forest-900 sm:text-2xl">ส่งสลิปสำเร็จแล้ว!</h1>
            <p className="mt-2 text-sm leading-relaxed text-charcoal-400">
              ขอบคุณสำหรับการชำระเงิน เจ้าหน้าที่กำลังตรวจสอบสลิปของคุณ
            </p>
          </>
        )}

        {payment && (
          <div className="mt-5 flex items-center justify-between rounded-xl bg-forest-50/60 px-4 py-3 text-left text-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-charcoal-400">หมายเลขการจอง</p>
              <p className="font-semibold text-forest-900">#{payment.booking_id}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-wider text-charcoal-400">ยอดที่ชำระ</p>
              <p className="font-sans text-base font-extrabold text-forest-900">฿{Number(payment.amount).toLocaleString()}</p>
            </div>
          </div>
        )}

        {!isRejected && (
          <>
            {/* Progress Steps */}
            <div className="mt-6 flex items-center justify-center gap-2 px-2">
              <div className="flex flex-1 flex-col items-center gap-1.5">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-forest-800 text-cream-100"><CheckCircle size={14} /></div>
                <span className="text-xs font-semibold text-forest-900">ส่งสลิปแล้ว</span>
              </div>
              <div className="h-0.5 flex-1 rounded-full bg-forest-200 -mt-5" />
              <div className="flex flex-1 flex-col items-center gap-1.5">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-forest-800 text-cream-100"><CheckCircle size={14} /></div>
                <span className="text-xs font-semibold text-forest-900">รอตรวจสอบ</span>
              </div>
              <div className={`h-0.5 flex-1 rounded-full -mt-5 ${isApproved ? 'bg-forest-200' : 'bg-stone-200'}`} />
              <div className="flex flex-1 flex-col items-center gap-1.5">
                {isApproved ? (
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-forest-800 text-cream-100"><CheckCircle size={14} /></div>
                ) : (
                  <div className="grid h-7 w-7 place-items-center rounded-full border-2 border-stone-200 bg-white text-stone-400 text-xs font-bold">3</div>
                )}
                <span className={`text-xs font-semibold ${isApproved ? 'text-forest-900' : 'text-stone-400'}`}>ยืนยันการจอง</span>
              </div>
            </div>
            {!isApproved && <p className="mt-3 text-xs text-charcoal-400">ใช้เวลาตรวจสอบประมาณ 15-30 นาที</p>}
          </>
        )}

        <div className="mt-7 flex flex-col gap-3">
          {payment?.booking_type === 'room' && (
             <div className="rounded-xl border border-bamboo-200 bg-bamboo-50/70 p-4 text-center mb-2 shadow-sm animate-fade-in">
               <h3 className="font-sans text-base font-bold text-bamboo-900">🎉 พิเศษ! คุณอาจได้รับโปรโมชั่นพายเรือฟรี</h3>
               <p className="text-xs text-bamboo-700 mt-1.5 mb-4 leading-relaxed">
                 หากคุณมีโปรโมชั่นแถมเรือ กรุณาเลือกวันและเวลาพายเรือตอนนี้เลย<br/>(เพื่อป้องกันคิวเต็มในวันที่คุณต้องการ)
               </p>
               <Link href={`/kayaks?room_booking_id=${payment.booking_id}&check_in=${bookingDetail?.check_in_date}&check_out=${bookingDetail?.check_out_date}`} className="flex items-center justify-center gap-2 w-full rounded-xl bg-bamboo-600 py-3 text-sm font-bold text-white transition-colors hover:bg-bamboo-700 shadow-md">
                 จองคิวเรือคายัค
               </Link>
             </div>
          )}
          <Link href="/dashboard" className="btn-primary text-center">ดูการจองของฉัน</Link>
          <Link href="/" className="inline-flex w-full items-center justify-center rounded-xl border border-stone-200 py-3 text-sm font-bold text-forest-800 transition-colors hover:bg-stone-50">กลับหน้าแรก</Link>
        </div>
      </div>
    </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100 pt-20">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header Section */}
        <div>
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-4 text-sm font-bold text-forest-800 shadow-[0_1px_2px_rgba(18,60,48,0.04),0_6px_16px_-6px_rgba(18,60,48,0.2)] ring-1 ring-stone-200/70 transition-all duration-200 hover:-translate-x-0.5 hover:ring-forest-300"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-700 transition-colors group-hover:bg-forest-100">
              <ArrowLeft size={14} />
            </span>
            กลับไปการจอง
          </Link>

          <div className="mt-4 flex items-center gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-700"><CreditCard size={18} /></span>
            <div>
              <h1 className="font-sans text-2xl font-semibold leading-tight text-forest-900 sm:text-3xl">ชำระเงิน</h1>
              <p className="text-xs text-charcoal-400">ทำตามขั้นตอนด้านล่างเพื่อยืนยันการจองของคุณ</p>
            </div>
          </div>
        </div>

        {payment && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr] items-start">
            {/* ---- ด้านซ้าย: สรุปรายการจอง ---- */}
            <div className="space-y-5 lg:sticky lg:top-24">
              <section className={CARD}>
                <SectionHeading icon={<Receipt size={16} />} title="สรุปรายการ" />
                <div className="mt-4 space-y-2 text-sm">
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
                    <div className="mt-4 flex flex-wrap gap-4 border-t border-stone-100 pt-4 text-sm">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-charcoal-400">วันเข้าพัก – วันออก</p>
                        <p className="mt-0.5 font-semibold text-forest-900">
                          {formatThaiDate(String(bookingDetail.check_in_date).slice(0, 10))} – {formatThaiDate(String(bookingDetail.check_out_date).slice(0, 10))}
                          <span className="ml-1.5 rounded-full bg-forest-50 px-2 py-0.5 text-xs font-bold text-forest-700">
                            {nightsBetween(String(bookingDetail.check_in_date).slice(0, 10), String(bookingDetail.check_out_date).slice(0, 10))} คืน
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-charcoal-400">ผู้เข้าพัก</p>
                        <p className="mt-0.5 font-semibold text-forest-900">ผู้ใหญ่ {bookingDetail.adults} · เด็ก {bookingDetail.children}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 border-t border-stone-100 pt-4">
                      {(bookingDetail.rooms || []).map((room: any) => (
                        <div key={room.booking_room_id} className="flex items-center justify-between gap-3 rounded-xl bg-stone-50/60 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-forest-900">{room.room_name} (ห้อง {room.room_number})</p>
                            <p className="text-xs text-charcoal-400">฿{Number(room.price_per_night).toLocaleString()} / คืน × {room.nights} คืน</p>
                          </div>
                          <span className="shrink-0 text-sm font-bold text-forest-900">฿{Number(room.subtotal).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    {bookingDetail.special_request && (
                      <div className="mt-4 rounded-xl bg-bamboo-50/40 p-3 text-xs text-charcoal-500">
                        <span className="font-bold text-bamboo-600">คำขอพิเศษ:</span> {bookingDetail.special_request}
                      </div>
                    )}
                  </>
                )}

                {bookingDetail && payment.booking_type === 'kayak' && (
                  <>
                    <div className="mt-4 flex flex-wrap gap-4 border-t border-stone-100 pt-4 text-sm">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-charcoal-400">วันที่ · รอบเวลา</p>
                        <p className="mt-0.5 font-semibold text-forest-900">
                          {formatThaiDate(String(bookingDetail.booking_date).slice(0, 10))}
                          <span className="ml-1.5 rounded-full bg-forest-50 px-2 py-0.5 text-xs font-bold text-forest-700">
                            {formatTimeRange(bookingDetail.start_time, bookingDetail.end_time)}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-charcoal-400">ผู้โดยสาร</p>
                        <p className="mt-0.5 font-semibold text-forest-900">{bookingDetail.num_passengers} คน</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 border-t border-stone-100 pt-4">
                      {(bookingDetail.boats || []).map((boat: any) => (
                        <div key={boat.booking_boat_id} className="flex items-center justify-between gap-3 rounded-xl bg-stone-50/60 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-forest-900">{boat.type_name}</p>
                            <p className="text-xs text-charcoal-400">
                              ผู้โดยสาร {boat.num_passengers} คน · {boat.boat_count} ลำ · ฿{Number(boat.unit_price).toLocaleString()}/ลำ
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-bold text-forest-900">฿{Number(boat.subtotal).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Price Breakdown */}
                <div className="mt-4 space-y-2 border-t border-stone-100 pt-4 text-sm">
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
                    <span className="text-sm font-bold text-forest-900">ยอดชำระสุทธิ</span>
                    <span className="font-sans text-xl font-extrabold text-bamboo-600">฿{Number(payment.amount).toLocaleString()}</span>
                  </div>
                </div>
              </section>
            </div>

            {/* ---- ด้านขวา: ขั้นตอนการชำระเงิน ---- */}
            <div className="space-y-5">
              {step === 1 ? (
                <>
                  {/* Step 1: ช่องทางชำระเงิน */}
                  <section className={CARD}>
                    {payment.qr_code_url && (
                      <div className="text-center">
                        <SectionHeading icon={<QrCode size={16} />} title="สแกน QR Code ชำระเงิน" />
                        <div className="mt-4 inline-block rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                          <img src={payment.qr_code_url} alt="QR Code" className="w-52 h-52 mx-auto" />
                        </div>
                        <p className="mt-3 text-xs text-charcoal-400">สแกนด้วยแอปธนาคารหรือ PromptPay</p>
                        <p className="mt-1 font-sans text-lg font-extrabold text-forest-900">฿{Number(payment.amount).toLocaleString()}</p>
                      </div>
                    )}

                    <div className={payment.qr_code_url ? 'mt-6 border-t border-stone-100 pt-6' : ''}>
                      <SectionHeading icon={<Landmark size={16} />} title="ช่องทางการชำระเงิน" />
                      <div className="mt-4 space-y-2 rounded-xl bg-forest-50/50 p-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-charcoal-500">ธนาคาร</span>
                          <span className="font-semibold text-forest-900">{payment.bank_info?.bank_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-charcoal-500">เลขบัญชี</span>
                          <span className="font-semibold text-forest-900">{payment.bank_info?.account_number}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-charcoal-500">ชื่อบัญชี</span>
                          <span className="font-semibold text-forest-900">{payment.bank_info?.account_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-charcoal-500">PromptPay</span>
                          <span className="font-semibold text-forest-900">{payment.bank_info?.promptpay}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setStep(2)}
                      className="btn-primary w-full mt-6 text-center shadow-lg shadow-forest-900/20 py-3 text-sm"
                    >
                      ชำระเงินเรียบร้อยแล้ว, ไปหน้าอัปโหลดสลิป
                    </button>
                  </section>

                  {/* คำแนะนำและยกเลิกการจอง */}
                  <section className={CARD}>
                    <SectionHeading icon={<Info size={16} />} title="คำแนะนำและยกเลิกการจอง" />
                    <ul className="mt-4 list-disc pl-5 text-xs text-charcoal-500 space-y-1.5">
                      <li>กรุณาชำระเงินภายในเวลาที่กำหนด หากเกินกำหนดระบบจะยกเลิกการจองอัตโนมัติ</li>
                      <li>หากชำระเงินแล้ว ไม่สามารถขอคืนเงินได้เว้นแต่กรณีฉุกเฉินหรือภัยพิบัติร้ายแรงตามนโยบาย</li>
                      <li>ใช้รูปสลิปโอนเงินที่เห็นข้อมูลครบถ้วนชัดเจนเท่านั้น</li>
                    </ul>
                    <div className="mt-5 border-t border-stone-100 pt-5">
                      <p className="text-xs text-stone-500 mb-3">หากเปลี่ยนใจหรือไม่ต้องการจองแล้ว สามารถยกเลิกได้ที่นี่</p>
                      <button
                        onClick={() => setShowCancelConfirm(true)}
                        className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
                      >
                        <XCircle size={15} /> ยืนยันการยกเลิกการจอง
                      </button>
                    </div>
                  </section>
                </>
              ) : (
                <>
                  {/* Step 2: อัปโหลดสลิป */}
                  <section className={CARD}>
                    <div className="flex items-center justify-between mb-4 border-b border-stone-100 pb-4">
                      <SectionHeading icon={<Upload size={16} />} title="ยืนยันการโอนเงิน" />
                      <button 
                        onClick={() => setStep(1)}
                        className="text-xs font-semibold text-forest-600 hover:text-forest-800 transition-colors"
                      >
                        กลับไปดูช่องทางชำระเงิน
                      </button>
                    </div>

                    <div className="mt-4 rounded-xl border-2 border-dashed border-stone-200 p-6 text-center transition-colors hover:border-forest-300">
                      {slipPreview ? (
                        <div className="space-y-3">
                          <img src={slipPreview} alt="Slip" className="max-h-60 mx-auto rounded-xl object-contain shadow-sm" />
                          <button onClick={() => { setSlip(null); setSlipPreview(''); }} className="text-xs font-semibold text-red-500 hover:text-red-600">
                            เปลี่ยนรูปสลิป
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer block">
                          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-forest-50 mb-3 text-forest-600">
                            <Upload size={22} />
                          </div>
                          <p className="text-sm font-semibold text-forest-900 mb-1">คลิกเพื่ออัปโหลดสลิปโอนเงิน</p>
                          <p className="text-xs text-stone-400">รองรับ PNG, JPG ขนาดไม่เกิน 5MB</p>
                          <input type="file" accept="image/*" className="hidden" onChange={handleSlipChange} />
                        </label>
                      )}
                    </div>
                    <button
                      onClick={handleUploadSlip}
                      disabled={!slip || uploading}
                      className="btn-primary w-full mt-5 text-center py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading ? 'กำลังอัปโหลดและส่งให้เจ้าหน้าที่...' : 'ยืนยันการชำระเงิน'}
                    </button>
                  </section>
                </>
              )}
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
            <h3 className="text-center text-base font-bold text-forest-900">ยกเลิกการจองนี้?</h3>
            <p className="mt-1.5 text-center text-sm leading-relaxed text-stone-500">
              ห้อง/เรือที่จองไว้จะถูกปล่อยว่าง และไม่สามารถกู้คืนรายการนี้ได้
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowCancelConfirm(false)} className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors">
                ไม่ยกเลิก
              </button>
              <button onClick={handleCancelBooking} disabled={cancelling} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-60">
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
