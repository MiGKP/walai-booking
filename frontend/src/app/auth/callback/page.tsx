'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Waves } from 'lucide-react';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      toast.error('การเข้าสู่ระบบด้วย Google ไม่สำเร็จ');
      router.push('/auth/login');
      return;
    }

    if (token) {
      console.log('Token found:', token); // Debug log
      localStorage.setItem('token', token);
      
      // Set token in api headers first
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Decode token to check payload
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('Token payload:', payload); // Debug log
      } catch (e) {
        console.error('Token decode error:', e);
      }
      
      api.get('/auth/profile').then((res) => {
        console.log('Profile response:', res.data); // Debug log
        login(res.data.data, token);
        toast.success('เข้าสู่ระบบสำเร็จ!');
        router.push('/dashboard');
      }).catch((err) => {
        console.error('Profile error:', err); // Debug log
        toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
        router.push('/auth/login');
      });
    } else {
      console.log('No token found'); // Debug log
      router.push('/auth/login');
    }
  }, [searchParams, router, login]);

  return (
    <div className="min-h-screen pt-16 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-100 mb-4 animate-pulse">
          <Waves size={32} className="text-teal-600" />
        </div>
        <p className="text-gray-600 text-lg">กำลังเข้าสู่ระบบ...</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-16 flex items-center justify-center"><p>Loading...</p></div>}>
      <CallbackContent />
    </Suspense>
  );
}
