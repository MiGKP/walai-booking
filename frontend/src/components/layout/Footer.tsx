'use client';

import Link from 'next/link';
import { Waves, MapPin, Phone, Mail, Facebook, Instagram } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container mx-auto px-4 py-14">
        <div className="grid md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-white mb-4">
              <Waves size={28} className="text-teal-400" />
              วลัย
            </Link>
            <p className="text-sm leading-relaxed text-gray-400">
              ที่พักลอยน้ำสุดพิเศษ ท่ามกลางธรรมชาติอันงดงาม พร้อมกิจกรรมเรือคายัคสนุกสนาน
            </p>
            <div className="flex gap-3 mt-5">
              <a href="#" className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center hover:bg-teal-600 transition-colors">
                <Facebook size={16} />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center hover:bg-teal-600 transition-colors">
                <Instagram size={16} />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">บริการของเรา</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/rooms" className="hover:text-teal-400 transition-colors">ห้องพักลอยน้ำ</Link></li>
              <li><Link href="/kayaks" className="hover:text-teal-400 transition-colors">เรือคายัค</Link></li>
              <li><Link href="/dashboard/bookings" className="hover:text-teal-400 transition-colors">การจองของฉัน</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">บัญชีผู้ใช้</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/auth/login" className="hover:text-teal-400 transition-colors">เข้าสู่ระบบ</Link></li>
              <li><Link href="/auth/register" className="hover:text-teal-400 transition-colors">สมัครสมาชิก</Link></li>
              <li><Link href="/dashboard" className="hover:text-teal-400 transition-colors">โปรไฟล์</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">ติดต่อเรา</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <MapPin size={16} className="text-teal-400 mt-0.5 shrink-0" />
                <span>123 หมู่ 4 ตำบลริมน้ำ อำเภอธรรมชาติ จังหวัดสวยงาม 10000</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={16} className="text-teal-400 shrink-0" />
                <a href="tel:+66812345678" className="hover:text-teal-400 transition-colors">081-234-5678</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={16} className="text-teal-400 shrink-0" />
                <a href="mailto:info@walai.com" className="hover:text-teal-400 transition-colors">info@walai.com</a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-800 py-5 text-center text-sm text-gray-500">
        © 2024 วลัย ที่พักลอยน้ำ. สงวนลิขสิทธิ์ทุกประการ
      </div>
    </footer>
  );
}
