'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, Phone, Mail } from 'lucide-react';
import { SiFacebook as Facebook } from '@icons-pack/react-simple-icons';
import api from '@/lib/api';
import { resolveFacebookLink } from '@/lib/social';
import Image from 'next/image';
import { pickResortInfo } from '@/lib/resort-info';

interface ResortContact {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  facebook?: string;
  line_id?: string;
}

const WAVE_TOP = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='8' viewBox='0 0 44 8'%3E%3Cpath d='M0 4 Q11 8 22 4 T44 4' fill='none' stroke='%23274F41' stroke-width='1.2'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'repeat-x',
  backgroundPosition: 'top',
  backgroundSize: '44px 8px',
} as const;

// แสดงหัวข้อของแต่ละคอลัมน์ในส่วนท้ายเว็บไซต์
function FooterHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-1 font-display text-lg font-semibold text-cream-100">{children}</h4>;
}

// แสดงลิงก์นำทางในส่วนท้ายเว็บไซต์พร้อมเอฟเฟกต์เส้นใต้เมื่อชี้เมาส์
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative inline-block text-cream-400 transition-colors duration-200 hover:text-bamboo-400"
    >
      {children}
      <span className="absolute -bottom-0.5 left-0 right-0 h-px origin-left scale-x-0 bg-bamboo-400 transition-transform duration-200 group-hover:scale-x-100" />
    </Link>
  );
}

// แสดงส่วนท้ายของเว็บไซต์พร้อมลิงก์บริการและข้อมูลติดต่อรีสอร์ท
export default function Footer() {
  const [info, setInfo] = useState<ResortContact>({});

  useEffect(() => {
    api
      .get('/settings/resort')
      .then((res) => setInfo(pickResortInfo(res.data?.data, 'main')))
      .catch(() => {});
  }, []);

  const year = new Date().getFullYear();
  const facebookLink = resolveFacebookLink(info.facebook);

  return (
    <footer className="bg-forest-800 text-cream-300" style={WAVE_TOP}>
      <div className="container mx-auto px-4 pb-14 pt-16">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <Link href="/" className="group mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-cream-100 p-0.5">
                <Image
                  src="/images/logocolor.jpg"
                  alt={`โลโก้ ${info.name || 'วลัย'}`}
                  width={28}
                  height={28}
                  className="object-contain"
                />
              </div>
              <span className="font-display text-xl font-semibold text-cream-100">{info.name || 'วลัย'}</span>
            </Link>
            <p className="max-w-[260px] text-sm leading-relaxed text-cream-400">
              ที่พักลอยน้ำสุดพิเศษ ท่ามกลางธรรมชาติอันงดงาม พร้อมกิจกรรมเรือสนุกสนาน
            </p>
            {facebookLink && (
              <a
                href={facebookLink.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex max-w-full items-center gap-2.5 rounded-full bg-forest-700 py-1.5 pl-1.5 pr-4 text-sm text-cream-200 transition-colors duration-200 hover:bg-bamboo-400 hover:text-forest-900"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest-800/60">
                  <Facebook size={14} />
                </span>
                <span className="truncate">{facebookLink.label}</span>
              </a>
            )}
          </div>

          <div>
            <FooterHeading>บริการ</FooterHeading>
            <span className="mb-4 block h-[2px] w-8 rounded-full bg-bamboo-400" />
            <ul className="space-y-2.5 text-sm">
              <li>
                <FooterLink href="/rooms">ห้องพักลอยน้ำ</FooterLink>
              </li>
              <li>
                <FooterLink href="/kayaks">เรือ</FooterLink>
              </li>
              <li>
                <FooterLink href="/dashboard">การจองของฉัน</FooterLink>
              </li>
            </ul>
          </div>

          <div>
            <FooterHeading>บัญชีผู้ใช้</FooterHeading>
            <span className="mb-4 block h-[2px] w-8 rounded-full bg-bamboo-400" />
            <ul className="space-y-2.5 text-sm">
              <li>
                <FooterLink href="/auth/login">เข้าสู่ระบบ</FooterLink>
              </li>
              <li>
                <FooterLink href="/auth/register">สมัครสมาชิก</FooterLink>
              </li>
              <li>
                <FooterLink href="/dashboard">โปรไฟล์</FooterLink>
              </li>
            </ul>
          </div>

          <div>
            <FooterHeading>ติดต่อ</FooterHeading>
            <span className="mb-4 block h-[2px] w-8 rounded-full bg-bamboo-400" />
            <ul className="space-y-3 text-sm">
              {info.address && (
                <li className="flex items-start gap-2.5">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-bamboo-400" />
                  <span className="text-cream-400">{info.address}</span>
                </li>
              )}
              {info.phone && (
                <li className="flex items-center gap-2.5">
                  <Phone size={16} className="shrink-0 text-bamboo-400" />
                  <a
                    href={`tel:${info.phone.replace(/[^0-9+]/g, '')}`}
                    className="text-cream-400 transition-colors duration-200 hover:text-bamboo-400"
                  >
                    {info.phone}
                  </a>
                </li>
              )}
              {info.email && (
                <li className="flex items-center gap-2.5">
                  <Mail size={16} className="shrink-0 text-bamboo-400" />
                  <a
                    href={`mailto:${info.email}`}
                    className="min-w-0 wrap-break-word text-cream-400 transition-colors duration-200 hover:text-bamboo-400"
                  >
                    {info.email}
                  </a>
                </li>
              )}
              {info.line_id && (
                <li className="flex items-center gap-2.5">
                  <span className="shrink-0 text-xs font-bold text-bamboo-400">LINE</span>
                  <span className="text-cream-400">{info.line_id}</span>
                </li>
              )}
              {!info.address && !info.phone && !info.email && !info.line_id && (
                <li className="text-xs italic text-cream-500">ยังไม่ได้ตั้งค่าข้อมูลติดต่อ</li>
              )}
            </ul>
          </div>
        </div>
      </div>
      <div
        className="py-5 text-center text-sm text-cream-500"
        style={{
          backgroundImage: 'linear-gradient(90deg, transparent, var(--color-bamboo-400, #C9A876), transparent)',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 1px',
          backgroundPosition: 'top',
          opacity: 1,
        }}
      >
        © {year} {info.name || 'วลัย'} ที่พักลอยน้ำ — สงวนลิขสิทธิ์ทุกประการ
      </div>
    </footer>
  );
}
