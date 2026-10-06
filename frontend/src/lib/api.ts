import axios from 'axios';
import { isSafeInternalPath, setPostLoginRedirect } from '@/lib/auth-redirect';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        const path = `${window.location.pathname}${window.location.search}`;
        if (isSafeInternalPath(path)) {
          setPostLoginRedirect(path);
        }
        localStorage.removeItem('token');
        if (!window.location.pathname.startsWith('/auth/login')) {
          window.location.href = '/auth/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

/** ดึงข้อความ error จาก backend ที่ตอบรูปแบบ { success, message } โดยไม่ต้องใช้ any */
/** ข้อความภาษาไทยสำหรับกรณีที่ request ไม่ถึง server หรือไม่ได้รับคำตอบ (เน็ตหลุด, timeout, server ล่ม) */
export const getNetworkErrorMessage = (error: unknown): string | null => {
  if (!axios.isAxiosError(error)) return null;
  if (error.code === 'ECONNABORTED') {
    return 'การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง';
  }
  if (!error.response) {
    return 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
  }
  if (error.response.status >= 500) {
    return 'เซิร์ฟเวอร์เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
  }
  return null;
};

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }
  return getNetworkErrorMessage(error) ?? fallback;
};

export default api;
