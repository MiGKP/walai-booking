"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import api from "@/lib/api";
import toast from "react-hot-toast";
import LoginScene3D from "@/components/auth/Scene3D";

interface LoginResponse {
  data: {
    user: {
      name?: string;
      first_name?: string;
      last_name?: string;
      email: string;
    };
    token: string;
    redirectUrl?: string;
  };
}

interface LoginErrorResponse {
  message?: string;
}

const getLoginErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError<LoginErrorResponse>(error)) {
    return error.response?.data?.message || "เข้าสู่ระบบไม่สำเร็จ";
  }
  return "เข้าสู่ระบบไม่สำเร็จ";
};

export default function LoginPage(): React.ReactElement | null {
  const router = useRouter();
  const { login } = useAuth();
  const { ready } = useAuthGuard({ guestOnly: true });
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!ready) return null;

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await api.post<LoginResponse>("/auth/login", form);
      const { user, token, redirectUrl } = response.data.data;
      await login(token);
      const displayName =
        user.name ||
        `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
        user.email;
      toast.success(`ยินดีต้อนรับ, ${displayName}!`);
      router.push(redirectUrl || "/");
    } catch (error: unknown) {
      toast.error(getLoginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = (): void => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-stone-100 p-3 sm:p-5 lg:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-[1500px] overflow-hidden rounded-[28px] border border-stone-200 bg-cream-100 shadow-[0_28px_90px_rgba(18,60,48,0.14)] sm:min-h-[calc(100vh-2.5rem)] lg:min-h-[calc(100vh-3rem)] lg:grid-cols-[1.12fr_0.88fr] lg:rounded-[36px]">
        <section className="relative min-h-[250px] overflow-hidden bg-[#d9ece7] sm:min-h-[300px] lg:min-h-0">
          <LoginScene3D />

          <Link
            href="/"
            className="absolute left-5 top-5 z-20 inline-flex items-center gap-2 rounded-full border border-white/50 bg-cream-100/85 px-4 py-2 text-sm font-semibold text-forest-800 shadow-sm backdrop-blur-md transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-bamboo-400 sm:left-7 sm:top-7"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            กลับหน้าหลัก
          </Link>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-forest-900/80 via-forest-900/26 to-transparent px-6 pb-6 pt-20 text-cream-100 sm:px-9 sm:pb-8 lg:px-12 lg:pb-12 lg:pt-32">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-bamboo-200">
              <span className="h-px w-8 bg-bamboo-300" />
              Walai floating stay
            </div>
            <h1 className="max-w-xl text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
              กลับมาพักใจ
              <br />
              กลางสายน้ำ
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-cream-100/80 sm:text-base">
              จัดการการจองที่พักลอยน้ำและเรือคายัคของคุณ
              ในบรรยากาศธรรมชาติของวลัยรุกขเวช
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-14 lg:py-12">
          <div className="w-full max-w-[440px] animate-fade-in">
            <div className="mb-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-lagoon-700">
                Login
              </p>
              <h2 className="text-3xl font-semibold text-charcoal sm:text-4xl">
                ยินดีต้อนรับกลับ
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                เข้าสู่ระบบเพื่อดูและจัดการการจองของคุณ
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
              aria-busy={loading}
            >
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-2 block text-sm font-semibold text-charcoal"
                >
                  อีเมล
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                    aria-hidden="true"
                  />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    className="input-field h-[52px] pl-12"
                    placeholder="your@email.com"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <label
                    htmlFor="login-password"
                    className="text-sm font-semibold text-charcoal"
                  >
                    รหัสผ่าน
                  </label>
                </div>
                <div className="relative">
                  <Lock
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                    aria-hidden="true"
                  />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="input-field h-[52px] pl-12 pr-12"
                    placeholder="รหัสผ่าน"
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-400 transition-colors hover:text-forest-800 focus:outline-none focus:ring-2 focus:ring-lagoon-400"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="mt-2 flex justify-end">
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm font-semibold text-lagoon-700 transition-colors hover:text-forest-800 focus:outline-none focus:underline"
                  >
                    ลืมรหัสผ่าน?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-forest-800 px-6 py-3.5 font-semibold text-cream-100 transition duration-200 hover:bg-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    กำลังเข้าสู่ระบบ...
                  </>
                ) : (
                  <>
                    เข้าสู่ระบบ
                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </>
                )}
              </button>
            </form>

            <div className="my-6 flex items-center gap-4">
              <span className="h-px flex-1 bg-stone-200" />
              <span className="text-xs font-medium text-stone-400">หรือ</span>
              <span className="h-px flex-1 bg-stone-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 font-semibold text-charcoal transition hover:border-stone-300 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-lagoon-400 focus:ring-offset-2 active:scale-[0.98]"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              เข้าสู่ระบบด้วย Google
            </button>

            <p className="mt-7 text-center text-sm text-stone-500">
              ยังไม่มีบัญชี?{" "}
              <Link
                href="/auth/register"
                className="font-semibold text-forest-800 transition-colors hover:text-lagoon-700 focus:outline-none focus:underline"
              >
                สมัครสมาชิก
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
