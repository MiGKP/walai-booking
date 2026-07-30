'use client';

import { useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { clearAuthToken, useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import toast from 'react-hot-toast';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      toast.error('การเข้าสู่ระบบด้วย Google ไม่สำเร็จ');
      router.push('/auth/login');
      return;
    }

    if (token) {
      login(token).then(() => {
        toast.success('เข้าสู่ระบบสำเร็จ!');
        router.push('/dashboard');
      }).catch(() => {
        clearAuthToken();
        toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
        router.push('/auth/login'); 
      });
    } else {
      router.push('/auth/login');
    }
  }, [searchParams, router, login]);

  return (
    // ปรับสไตล์พื้นหลัง ระยะห่าง และการจัดกึ่งกลาง
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-lg border border-stone-100 text-center max-w-sm w-full flex flex-col items-center">
        {/* โลโก้พร้อมเอฟเฟกต์หมุน/กระพริบ */}
        <div className="w-20 h-20 rounded-full bg-cream-100 p-1 flex items-center justify-center overflow-hidden shadow-inner border border-stone-100 mb-4 animate-pulse">
          <Image 
            src="/images/logo_walai.png" 
            alt="โลโก้ วลัย" 
            width={72} 
            height={72} 
            className="object-contain"
            priority
          />
        </div>
        
        {/* Spinner วงกลมหมุนๆ */}
        <div className="animate-spin rounded-full h-8 w-8 border-3 border-bamboo-500 border-t-transparent mb-3" />
        
        <h2 className="text-xl font-bold text-forest-800 font-display">กำลังเข้าสู่ระบบ</h2>
        <p className="text-charcoal-500 text-sm mt-1">กรุณารอสักครู่ ระบบกำลังยืนยันตัวตนของคุณ...</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense 
      fallback={
        <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-bamboo-500 border-t-transparent" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}