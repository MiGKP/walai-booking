import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  avatar?: string;
  phone?: string;
  auth_provider?: string;
  has_password?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

// Zustand store กลางสำหรับเก็บสถานะการ login ของผู้ใช้ เช่น user profile, token และ action ที่เกี่ยวข้องกับ auth
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      // บันทึกข้อมูลผู้ใช้และ token ลง store พร้อม sync token ลง localStorage เพื่อให้หน้าอื่นเรียกใช้งานต่อได้
      login: (user, token) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', token);
        }
        set({ user, token, isAuthenticated: true });
      },
      // ล้างข้อมูลการ login ทั้งใน store และ localStorage เพื่อออกจากระบบอย่างสมบูรณ์
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
        }
        set({ user: null, token: null, isAuthenticated: false });
      },
      // ใช้อัปเดตข้อมูลบางส่วนของ user เช่น ชื่อ เบอร์โทร หรือ avatar โดยไม่ต้อง replace object ทั้งก้อน
      updateUser: (updatedUser) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updatedUser } : null,
        })),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);
