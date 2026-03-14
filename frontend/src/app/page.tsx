'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Waves, Anchor, CreditCard, Star, MapPin, Phone } from 'lucide-react';
import api from '@/lib/api';

interface ResortInfo {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  facebook?: string;
  line_id?: string;
  operating_days?: string;
  operating_hours?: string;
}

interface RoomType {
  name: string;
  price: string;
  color: string;
  capacity: string;
}

interface Review {
  name: string;
  rating: number;
  text: string;
}

interface Stat {
  number: string;
  label: string;
}

interface Feature {
  icon: JSX.Element;
  title: string;
  desc: string;
}

export default function HomePage() {
  const [resortInfo, setResortInfo] = useState<ResortInfo>({});
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);

  useEffect(() => {
    const fetchResortInfo = async () => {
      try {
        const response = await api.get('/settings/resort');
        setResortInfo(response.data?.data || {});
      } catch (error) {
        console.error('Failed to fetch resort info:', error);
      }
    };

    fetchResortInfo();
  }, []);

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center bg-gradient-to-br from-teal-900 via-teal-800 to-cyan-700 overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative container mx-auto px-4 py-20 text-center text-white">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6 text-sm font-medium">
            <Waves size={16} />
            <span>ที่พักลอยน้ำแห่งแรกในภูมิภาค</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            {resortInfo.name || 'สวนวลัยรุกขเวช'}
            <br />
            <br />
            <span className="text-cyan-300">ที่พักลอยน้ำ</span>
          </h1>
          <p className="text-xl md:text-2xl text-teal-100 mb-10 max-w-2xl mx-auto leading-relaxed">
            สัมผัสประสบการณ์การพักผ่อนสุดพิเศษกับที่พักลอยน้ำ
            พร้อมกิจกรรมเรือคายัคท่ามกลางธรรมชาติอันงดงาม
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/rooms"
              className="inline-flex items-center gap-2 bg-white text-teal-800 font-semibold px-8 py-4 rounded-2xl hover:bg-teal-50 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              จองห้องพัก
              <ArrowRight size={20} />
            </Link>
            <Link
              href="/kayaks"
              className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white font-semibold px-8 py-4 rounded-2xl hover:bg-white/30 transition-all duration-200 border border-white/30"
            >
              <Anchor size={20} />
              จองเรือคายัค
            </Link>
          </div>
        </div>
        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 105C120 90 240 60 360 52.5C480 45 600 60 720 67.5C840 75 960 75 1080 67.5C1200 60 1320 45 1380 37.5L1440 30V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { number: '4+', label: 'ประเภทห้องพัก' },
              { number: '3+', label: 'เรือคายัค' },
              { number: '500+', label: 'แขกพักอาศัย' },
              { number: '4.9★', label: 'คะแนนรีวิว' },
            ].map((stat, i) => (
              <div key={i} className="p-6">
                <div className="text-4xl font-bold text-teal-600 mb-2">{stat.number}</div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">ประสบการณ์ที่แตกต่าง</h2>
            <p className="text-gray-600 text-lg max-w-xl mx-auto">
              ที่{resortInfo.name || 'สวนวลัยรุกขเวช'} เราออกแบบทุกประสบการณ์เพื่อให้คุณได้พักผ่อนอย่างแท้จริง
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Waves className="text-teal-500" size={40} />,
                title: 'ที่พักลอยน้ำ',
                desc: 'ห้องพักสไตล์ไทยสุดชิล ลอยอยู่กลางน้ำ วิว 360 องศา บรรยากาศธรรมชาติแท้ๆ',
              },
              {
                icon: <Anchor className="text-cyan-500" size={40} />,
                title: 'เรือคายัค',
                desc: 'สำรวจธรรมชาติด้วยเรือคายัค มีทั้งแบบเดี่ยว คู่ และครอบครัว เหมาะสำหรับทุกวัย',
              },
              {
                icon: <CreditCard className="text-blue-500" size={40} />,
                title: 'ชำระเงินง่าย',
                desc: 'ชำระเงินผ่าน QR Code PromptPay ได้เลยทันที สะดวก รวดเร็ว ปลอดภัย',
              },
            ].map((f, i) => (
              <div key={i} className="card p-8 text-center hover:shadow-lg transition-all duration-300">
                <div className="flex justify-center mb-5">{f.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{f.title}</h3>
                <p className="text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Room Types */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">ประเภทห้องพัก</h2>
            <p className="text-gray-600 text-lg">เลือกห้องที่เหมาะกับคุณ</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Standard', price: '1,500', color: 'from-teal-400 to-teal-600', capacity: '2 คน' },
              { name: 'Deluxe', price: '2,500', color: 'from-cyan-400 to-cyan-600', capacity: '2 คน' },
              { name: 'Suite', price: '4,500', color: 'from-blue-400 to-blue-600', capacity: '4 คน' },
              { name: 'Family', price: '5,500', color: 'from-indigo-400 to-indigo-600', capacity: '6 คน' },
            ].map((room, i) => (
              <div key={i} className="card hover:shadow-xl transition-all duration-300 group">
                <div className={`h-48 bg-gradient-to-br ${room.color} flex items-center justify-center`}>
                  <Waves size={60} className="text-white/80 group-hover:scale-110 transition-transform" />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">ห้อง {room.name}</h3>
                  <p className="text-gray-500 text-sm mb-4">รองรับ {room.capacity}</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-2xl font-bold text-teal-600">฿{room.price}</span>
                      <span className="text-gray-500 text-sm">/คืน</span>
                    </div>
                    <Link
                      href="/rooms"
                      className="text-sm font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                    >
                      จองเลย <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/rooms" className="btn-primary inline-flex items-center gap-2">
              ดูห้องพักทั้งหมด <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-teal-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">รีวิวจากแขกของเรา</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'คุณสมชาย', rating: 5, text: 'ที่พักสวยมาก วิวน้ำสวยงาม เจ้าหน้าที่ใจดี แนะนำเลยครับ' },
              { name: 'คุณมาลี', rating: 5, text: 'เล่นเรือคายัคสนุกมาก เจ้าหน้าที่สอนดีมาก ห้องพักสะอาดมากค่ะ' },
              { name: 'ครอบครัวปิยะ', rating: 5, text: 'พาลูกมาเที่ยวครบทุกกิจกรรม สนุกมาก ราคาคุ้มค่า จะกลับมาอีกแน่นอน' },
            ].map((review, i) => (
              <div key={i} className="card p-6">
                <div className="flex text-yellow-400 mb-3">
                  {Array.from({ length: review.rating }).map((_, j) => (
                    <Star key={j} size={18} fill="currentColor" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4 leading-relaxed">"{review.text}"</p>
                <div className="font-semibold text-gray-900">{review.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Location / Map */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">ที่ตั้งของเรา</h2>
            <p className="text-gray-600 text-lg max-w-xl mx-auto">มาเยือนวลัย ที่พักลอยน้ำท่ามกลางธรรมชาติ</p>
          </div>
          <div className="grid md:grid-cols-2 gap-10 items-center max-w-5xl mx-auto">
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                  <MapPin size={20} className="text-teal-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">ที่อยู่</p>
                  <p className="text-gray-500 text-sm mt-0.5">{resortInfo.address || 'สวนวลัยรุกขเวช สถาบันวิจัยวลัยรุกขเวช มหาวิทยาลัยมหาสารคาม<br />จ.มหาสารคาม ประเทศไทย'}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                  <Phone size={20} className="text-teal-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">ติดต่อ</p>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {resortInfo.phone && `โทร: ${resortInfo.phone}`}
                    {resortInfo.phone && resortInfo.line_id && <br />}
                    {resortInfo.line_id && `Line: ${resortInfo.line_id}`}
                    {!resortInfo.phone && !resortInfo.line_id && 'โทร: 08x-xxx-xxxx<br />Line: @walai'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                  <Waves size={20} className="text-teal-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">เวลาเปิด-ปิด</p>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {resortInfo.operating_days && resortInfo.operating_hours 
                      ? `${resortInfo.operating_days} ${resortInfo.operating_hours}`
                      : 'เปิดทุกวัน 08:00 – 20:00 น.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-100 h-72 md:h-80">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3831.017633003897!2d103.32662857469161!3d16.219533184481886!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3122a5c428f5b683%3A0xdae6c58fa05c39c!2z4Liq4Lin4LiZ4Lin4Lil4Lix4Lii4Lij4Li44LiB4LiC4LmA4Lin4LiKIOC4quC4luC4suC4muC4seC4meC4p-C4tOC4iOC4seC4ouC4p-C4peC4seC4ouC4o-C4uOC4geC4guC5gOC4p-C4iiDguKHguKvguLLguKfguLTguJfguKLguLLguKXguLHguKLguKHguKvguLLguKrguLLguKPguITguLLguKE!5e0!3m2!1sth!2sth!4v1773388013866!5m2!1sth!2sth"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="สวนวลัยรุกขเวช สถาบันวิจัยวลัยรุกขเวช มหาวิทยาลัยมหาสารคาม"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold mb-4">พร้อมที่จะมาพักแล้วหรือยัง?</h2>
          <p className="text-xl text-teal-100 mb-8 max-w-xl mx-auto">
            จองห้องพักและกิจกรรมผ่านระบบออนไลน์ได้เลย ง่าย สะดวก รวดเร็ว
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register" className="bg-white text-teal-700 font-semibold px-8 py-4 rounded-2xl hover:bg-teal-50 transition-all inline-flex items-center gap-2">
              สมัครสมาชิก <ArrowRight size={18} />
            </Link>
            <Link href="/rooms" className="border-2 border-white text-white font-semibold px-8 py-4 rounded-2xl hover:bg-white/10 transition-all">
              ดูห้องพัก
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
