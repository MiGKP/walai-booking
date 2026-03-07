'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CreditCard, Upload, CheckCircle, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';

// component หลักของหน้าชำระเงิน ทำหน้าที่โหลดข้อมูล payment, แสดง QR, รับสลิป และส่งสลิปไป backend
function PaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { ready } = useAuthGuard();
  const booking_type = searchParams.get('booking_type');
  const booking_id = searchParams.get('booking_id');

  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [slip, setSlip] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

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
      if (res.data.data.slip_image) {
        setDone(true); // already paid
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'ไม่สามารถสร้างรายการชำระเงินได้');
    } finally {
      setLoading(false);
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
      toast.success('อัปโหลดสลิปสำเร็จ! รอการตรวจสอบจากเจ้าหน้าที่');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'อัปโหลดสลิปไม่สำเร็จ');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen pt-16 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent" />
    </div>
  );

  if (done) return (
    <div className="min-h-screen pt-16 bg-gray-50 flex items-center justify-center px-4">
      <div className="card p-10 max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-5">
          <CheckCircle size={48} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">ส่งสลิปสำเร็จแล้ว!</h1>
        <p className="text-gray-500 mb-8">รอเจ้าหน้าที่ตรวจสอบและยืนยันการชำระเงิน ประมาณ 15-30 นาที</p>
        <div className="flex flex-col gap-3">
          <Link href="/dashboard/bookings" className="btn-primary">ดูการจองของฉัน</Link>
          <Link href="/" className="btn-secondary text-center block w-full py-2 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition-all">กลับหน้าแรก</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Link href="/dashboard/bookings" className="inline-flex items-center gap-2 text-gray-500 hover:text-teal-600 mb-6 transition-colors">
          <ArrowLeft size={18} /> กลับไปการจอง
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <CreditCard className="text-teal-600" /> ชำระเงิน
        </h1>

        {payment && (
          <div className="space-y-5">
            {/* Payment Summary */}
            <div className="card p-6">
              <h2 className="font-bold text-gray-900 mb-4">สรุปรายการ</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>ประเภทการจอง</span>
                  <span className="font-medium">{payment.booking_type === 'room' ? 'ห้องพัก' : 'เรือ'}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>หมายเลขการจอง</span>
                  <span className="font-medium">#{payment.booking_id}</span>
                </div>
                <div className="flex justify-between font-bold text-lg text-gray-900 pt-2 border-t">
                  <span>ยอดรวม</span>
                  <span className="text-teal-600">฿{Number(payment.amount).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Bank Info */}
            <div className="card p-6">
              <h2 className="font-bold text-gray-900 mb-4">ข้อมูลบัญชี</h2>
              <div className="bg-teal-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">ธนาคาร</span>
                  <span className="font-semibold text-gray-900">{payment.bank_info?.bank_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">เลขบัญชี</span>
                  <span className="font-semibold text-gray-900">{payment.bank_info?.account_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ชื่อบัญชี</span>
                  <span className="font-semibold text-gray-900">{payment.bank_info?.account_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">PromptPay</span>
                  <span className="font-semibold text-gray-900">{payment.bank_info?.promptpay}</span>
                </div>
              </div>
            </div>

            {/* QR Code */}
            {payment.qr_code_url && (
              <div className="card p-6 text-center">
                <h2 className="font-bold text-gray-900 mb-4">สแกน QR Code ชำระเงิน</h2>
                <div className="inline-block p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm mb-3">
                  <img src={payment.qr_code_url} alt="QR Code" className="w-52 h-52 mx-auto" />
                </div>
                <p className="text-sm text-gray-500">สแกนด้วยแอปธนาคารหรือ PromptPay</p>
                <p className="text-lg font-bold text-teal-600 mt-2">฿{Number(payment.amount).toLocaleString()}</p>
              </div>
            )}

            {/* Upload Slip */}
            <div className="card p-6">
              <h2 className="font-bold text-gray-900 mb-4">อัปโหลดสลิปการโอนเงิน</h2>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-teal-400 transition-colors">
                {slipPreview ? (
                  <div className="space-y-3">
                    <img src={slipPreview} alt="Slip" className="max-h-60 mx-auto rounded-xl object-contain" />
                    <button onClick={() => { setSlip(null); setSlipPreview(''); }} className="text-sm text-red-500 hover:text-red-600">
                      ลบรูปภาพ
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <Upload size={36} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 text-sm mb-1">คลิกเพื่ออัปโหลดสลิป</p>
                    <p className="text-gray-400 text-xs">PNG, JPG ขนาดไม่เกิน 5MB</p>
                    <input type="file" accept="image/*" className="hidden" onChange={handleSlipChange} />
                  </label>
                )}
              </div>
              <button
                onClick={handleUploadSlip}
                disabled={!slip || uploading}
                className="btn-primary w-full mt-4 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {uploading ? 'กำลังอัปโหลด...' : 'ยืนยันการชำระเงิน'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ครอบ PaymentContent ด้วย Suspense เพื่อรองรับ useSearchParams ใน Next.js App Router อย่างปลอดภัย
export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-16 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent" /></div>}>
      <PaymentContent />
    </Suspense>
  );
}
