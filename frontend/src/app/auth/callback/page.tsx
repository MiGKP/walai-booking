'use client';

import { useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { clearAuthToken, useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { LoaderCircle, Waves } from 'lucide-react';

function CallbackContent(): React.ReactElement {
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
    <div className="grid min-h-screen place-items-center bg-cream-200 px-4">
      <div className="card w-full max-w-sm p-8 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-forest-800 text-cream-100">
          <LoaderCircle size={28} className="animate-spin" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lagoon-600">Walai Booking</p>
        <h1 className="mt-2 font-display text-xl text-forest-900">กำลังเข้าสู่ระบบ</h1>
        <p className="mt-2 text-sm leading-6 text-charcoal-500">กรุณารอสักครู่ ระบบกำลังยืนยันตัวตนของคุณ</p>
      </div>
    </div>
  );
}

export default function CallbackPage(): React.ReactElement {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-cream-200"><div className="h-10 w-10 animate-spin rounded-full border-2 border-forest-800 border-t-transparent" /></div>}>
      <CallbackContent />
    </Suspense>
  );
}