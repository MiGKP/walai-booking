"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, Phone, Mail, Facebook } from 'lucide-react';
import api from '@/lib/api';
import { resolveFacebookLink } from '@/lib/social';
import Image from 'next/image';

interface ResortContact {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  facebook?: string;
  line_id?: string;
}

export default function Footer() {
  const [info, setInfo] = useState<ResortContact>({});

  useEffect(() => {
    api
      .get("/settings/resort")
      .then((res) => setInfo(res.data?.data || {}))
      .catch(() => {});
  }, []);

  const year = new Date().getFullYear();
  const facebookLink = resolveFacebookLink(info.facebook);

  return (
    <footer className="bg-forest-800 text-cream-300">
      <div className="container mx-auto px-4 py-14">
        <div className="grid md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4 group">
              {/* ✅ เปลี่ยนจาก SVG เป็น Image Component */}
              <div className="w-8 h-8 rounded-full bg-cream-100 p-0.5 flex items-center justify-center overflow-hidden">
                <Image
                  src="/images/logo_walai.png"
                  alt={`โลโก้ ${info.name || "วลัย"}`}
                  width={28}
                  height={28}
                  className="object-contain"
                />
              </div>
              <span className="font-display text-xl font-semibold text-cream-100">
                {info.name || "วลัย"}
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-cream-400 max-w-[260px]">
              ที่พักลอยน้ำสุดพิเศษ ท่ามกลางธรรมชาติอันงดงาม
              พร้อมกิจกรรมเรือคายัคสนุกสนาน
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
            <h4 className="font-display font-semibold text-cream-100 mb-4 text-lg">
              บริการ
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href="/rooms"
                  className="text-cream-400 hover:text-bamboo-400 transition-colors duration-200"
                >
                  ห้องพักลอยน้ำ
                </Link>
              </li>
              <li>
                <Link
                  href="/kayaks"
                  className="text-cream-400 hover:text-bamboo-400 transition-colors duration-200"
                >
                  เรือคายัค
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/bookings"
                  className="text-cream-400 hover:text-bamboo-400 transition-colors duration-200"
                >
                  การจองของฉัน
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold text-cream-100 mb-4 text-lg">
              บัญชีผู้ใช้
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href="/auth/login"
                  className="text-cream-400 hover:text-bamboo-400 transition-colors duration-200"
                >
                  เข้าสู่ระบบ
                </Link>
              </li>
              <li>
                <Link
                  href="/auth/register"
                  className="text-cream-400 hover:text-bamboo-400 transition-colors duration-200"
                >
                  สมัครสมาชิก
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="text-cream-400 hover:text-bamboo-400 transition-colors duration-200"
                >
                  โปรไฟล์
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold text-cream-100 mb-4 text-lg">
              ติดต่อ
            </h4>
            <ul className="space-y-3 text-sm">
              {info.address && (
                <li className="flex items-start gap-2.5">
                  <MapPin
                    size={16}
                    className="text-bamboo-400 mt-0.5 shrink-0"
                  />
                  <span className="text-cream-400">{info.address}</span>
                </li>
              )}
              {info.phone && (
                <li className="flex items-center gap-2.5">
                  <Phone size={16} className="text-bamboo-400 shrink-0" />
                  <a
                    href={`tel:${info.phone.replace(/[^0-9+]/g, "")}`}
                    className="text-cream-400 hover:text-bamboo-400 transition-colors duration-200"
                  >
                    {info.phone}
                  </a>
                </li>
              )}
              {info.email && (
                <li className="flex items-center gap-2.5">
                  <Mail size={16} className="text-bamboo-400 shrink-0" />
                  <a
                    href={`mailto:${info.email}`}
                    className="text-cream-400 hover:text-bamboo-400 transition-colors duration-200"
                  >
                    {info.email}
                  </a>
                </li>
              )}
              {info.line_id && (
                <li className="flex items-center gap-2.5">
                  <span className="text-bamboo-400 text-xs font-bold shrink-0">
                    LINE
                  </span>
                  <span className="text-cream-400">{info.line_id}</span>
                </li>
              )}
              {!info.address && !info.phone && !info.email && !info.line_id && (
                <li className="text-cream-500 text-xs italic">
                  ยังไม่ได้ตั้งค่าข้อมูลติดต่อ
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
      <div
        className="py-5 text-center text-sm text-cream-500"
        style={{ borderTop: "1px solid rgba(253,252,247,0.1)" }}
      >
        © {year} {info.name || "วลัย"} ที่พักลอยน้ำ — สงวนลิขสิทธิ์ทุกประการ
      </div>
    </footer>
  );
}
