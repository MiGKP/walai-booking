"use client";

import { useState, useEffect, useRef, useId } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { ArrowRight, Anchor, Calendar, CreditCard, Star, MapPin, Phone, Waves, Facebook, Compass, ConciergeBell, ShieldCheck, Languages, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/avatar';
import { resolveFacebookLink } from '@/lib/social';
import { maskReviewerName } from '@/lib/format';
import { FacilityGroup, ROOM_SPECIFIC_FACILITY_CATEGORIES } from '@/lib/facilities';
import {
  googleMapsEmbedUrl,
  googleMapsSearchUrl,
  parseLatLng,
} from '@/lib/coordinates';
import Navbar from '@/components/layout/Navbar';
interface ResortInfo {
  name?: string;
  address?: string;
  coordinates?: string;
  phone?: string;
  email?: string;
  facebook?: string;
  line_id?: string;
  operating_days?: string;
  operating_hours?: string;
}

interface LandingRoomType {
  id: number;
  room_name: string;
  type_name: string;
  description?: string;
  capacity: number;
  price_per_night: number;
  main_image?: string;
  available_count?: number;
}

interface LandingReview {
  review_id: number;
  rating: number;
  comment: string;
  first_name?: string;
  last_name?: string;
  room_name?: string;
  type_name?: string;
}

interface LandingStats {
  room_type_count: number;
  boat_type_count: number;
  guest_count: number;
  avg_rating: number | null;
  review_count: number;
}

/* ———————————————————————————————
   Scroll-reveal hook (IntersectionObserver)
   ——————————————————————————————— */
function useRevealOnScroll(...deps: unknown[]) {
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    const targets = node.querySelectorAll(".reveal-on-scroll:not(.revealed)");
    targets.forEach((el) => observer.observe(el));
    if (
      node.classList.contains("reveal-on-scroll") &&
      !node.classList.contains("revealed")
    ) {
      observer.observe(node);
    }

    return () => observer.disconnect();
  }, deps);

  return containerRef;
}

/* ———————————————————————————————
   Wave divider — the one recurring motif that ties sections
   back to the floating-house / water theme. Used sparingly,
   only at the two structural transitions that need it.
   ——————————————————————————————— */
function WaveDivider({
  className = "",
  flip = false,
}: {
  className?: string;
  flip?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`w-full overflow-hidden leading-[0] ${className}`}
    >
      <svg
        viewBox="0 0 1200 64"
        preserveAspectRatio="none"
        className={`w-full h-10 md:h-16 ${flip ? "rotate-180" : ""}`}
      >
        <path
          d="M0 34C140 12 280 12 420 30C560 48 700 52 840 34C960 18 1080 14 1200 28V64H0V34Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

/* ———————————————————————————————
   Scroll Mouse Indicator
   ——————————————————————————————— */
function ScrollMouseIndicator({ targetId }: { targetId: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY < 120);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTarget = () => {
    const el = document.getElementById(targetId);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollToTarget}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') scrollToTarget(); }}
      className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer group transition-all duration-500 z-10 bg-transparent border-0 p-0 ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none"
      }`}
      aria-label="เลื่อนลงเพื่อดูเนื้อหา"
    >
      <div className="relative w-6 h-10 rounded-full border-2 border-forest-800/40 group-hover:border-forest-800 group-hover:scale-110 transition-all duration-300 flex justify-center pt-2 bg-white/30 backdrop-blur-xs">
        <div className="w-1.5 h-1.5 rounded-full bg-bamboo-400 animate-scroll-dot" />
      </div>
      <span className="text-xs font-medium text-forest-800/70 group-hover:text-forest-800 transition-colors">
        เลื่อนลงเพื่อดูต่อ
      </span>
    </button>
  );
}

/* ———————————————————————————————
   Stats counter component
   ——————————————————————————————— */


const FACILITY_CATEGORY_ICONS: Record<string, React.ElementType> = {
  ConciergeBell,
  ShieldCheck,
  Languages,
};

function getFacilityCategoryIcon(iconName: string): React.ReactElement {
  const IconComponent = FACILITY_CATEGORY_ICONS[iconName] || Sparkles;
  return <IconComponent size={20} className="text-forest-800" />;
}

function formatPrice(value: number): string {
  return Number(value).toLocaleString("th-TH");
}

function getReviewerName(review: LandingReview): string {
  return maskReviewerName(review.first_name, review.last_name);
}

/* ———————————————————————————————
   Room card — full-bleed photographic treatment.
   The featured room is deliberately larger and more
   detailed than the two runners-up beside it.
   ——————————————————————————————— */
function RoomCard({ room, large = false }: { room: LandingRoomType; large?: boolean }) {
  return (
    <Link
      href={`/rooms/${room.id}`}
      className={`group relative block overflow-hidden rounded-2xl bg-stone-200 ${
        large ? "h-[420px] md:h-full md:min-h-[520px]" : "h-[210px] md:h-[248px]"
      }`}
    >
      {room.main_image ? (
        <Image
          src={resolveMediaUrl(room.main_image)}
          alt={room.room_name}
          fill
          sizes={large ? "(max-width: 1024px) 100vw, 60vw" : "(max-width: 1024px) 100vw, 30vw"}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-stone-500 text-sm">
          ไม่มีรูปภาพ
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-forest-900/90 via-forest-900/10 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-5 md:p-6 text-cream-100">
        <span className="text-xs font-medium text-bamboo-300">{room.type_name}</span>
        <h3
          className={`font-display font-bold leading-snug mt-0.5 ${
            large ? "text-2xl md:text-[1.75rem]" : "text-lg"
          }`}
        >
          {room.room_name}
        </h3>
        {large && (
          <p className="text-cream-100/75 text-sm mt-2 max-w-md font-light line-clamp-2">
            {room.description || "สัมผัสประสบการณ์การพักผ่อนริมน้ำสุดพิเศษ..."}
          </p>
        )}
        <div className="flex items-end justify-between mt-3 md:mt-4">
          <div>
            <span className="text-xs text-cream-100/65">เริ่มต้น</span>
            <div className="font-display font-bold text-lg leading-none">
              ฿{formatPrice(room.price_per_night)}
              <span className="text-xs font-normal text-cream-100/70"> /คืน</span>
            </div>
          </div>
          <span className="text-xs bg-white/15 backdrop-blur-sm px-2.5 py-1 rounded-full whitespace-nowrap">
            พักได้ {room.capacity} ท่าน
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ———————————————————————————————
   Review carousel — editorial pull-quote, not a boxed card
   ——————————————————————————————— */
function ReviewCarousel({ reviews }: { reviews: LandingReview[] }) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (reviews.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % reviews.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [reviews.length, isPaused]);

  if (reviews.length === 0) {
    return (
      <div className="text-center text-charcoal-400 py-10 border-y border-stone-200">
        ยังไม่มีรีวิวจากแขกผู้เข้าพัก — มาเป็นคนแรกที่แชร์ประสบการณ์กับเรา
      </div>
    );
  }

  return (
    <div
      className="max-w-3xl mx-auto px-4"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="border-l-2 border-bamboo-400 pl-6 md:pl-10">
        {/* aria-live ทำให้ screen reader อ่านรีวิวที่เปลี่ยนใหม่ */}
        <div
          className="relative min-h-[190px] md:min-h-[160px]"
          aria-live="polite"
          aria-atomic="true"
        >
          {reviews.map((review, i) => (
            <div
              key={review.review_id}
              className={`transition-opacity duration-700 ${
                i === current
                  ? "opacity-100 relative"
                  : "opacity-0 absolute inset-0 pointer-events-none"
              }`}
              aria-hidden={i !== current}
            >
              <p className="font-display text-2xl md:text-[1.75rem] text-forest-800 leading-snug font-medium mb-6">
                {review.comment}
              </p>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <span className="font-semibold text-forest-800">
                    {getReviewerName(review)}
                  </span>
                  {(review.room_name || review.type_name) && (
                    <span className="text-charcoal-400 text-sm block">
                      {review.room_name || review.type_name}
                    </span>
                  )}
                </div>
                <div className="flex gap-0.5" aria-label={`คะแนน ${review.rating} ดาว`}>
                  {Array.from({ length: review.rating }).map((_, j) => (
                    <Star key={j} size={15} className="fill-bamboo-400 text-bamboo-400" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {reviews.length > 1 && (
        <div className="flex items-center gap-3 mt-8 pl-6 md:pl-10">
          {/* ปุ่ม pause/resume สำหรับ WCAG 2.2.2 */}
          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            aria-label={isPaused ? "เล่นรีวิวอัตโนมัติ" : "หยุดรีวิวอัตโนมัติ"}
            className="w-6 h-6 rounded-full border border-stone-300 flex items-center justify-center text-stone-400 hover:border-forest-400 hover:text-forest-700 transition-colors shrink-0"
          >
            {isPaused ? (
              <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-current"><polygon points="2,1 9,5 2,9" /></svg>
            ) : (
              <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-current"><rect x="2" y="1" width="2.5" height="8" /><rect x="5.5" y="1" width="2.5" height="8" /></svg>
            )}
          </button>
          <div className="flex gap-2">
            {reviews.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`ไปที่รีวิวที่ ${i + 1}`}
                aria-current={i === current ? "true" : "false"}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === current
                    ? "bg-forest-800 w-9"
                    : "bg-stone-300 w-3 hover:bg-stone-400"
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════
   MAIN HOME PAGE
   ═══════════════════════════════ */
export default function HomePage() {
  const mapTitleId = useId();
  const [resortInfo, setResortInfo] = useState<ResortInfo>({});
  const [roomTypes, setRoomTypes] = useState<LandingRoomType[]>([]);
  const [reviews, setReviews] = useState<LandingReview[]>([]);
  const [landingStats, setLandingStats] = useState<LandingStats>({
    room_type_count: 0,
    boat_type_count: 0,
    guest_count: 0,
    avg_rating: null,
    review_count: 0,
  });
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [facilities, setFacilities] = useState<FacilityGroup[]>([]);

  const experienceRef = useRevealOnScroll();
  const roomsRef = useRevealOnScroll(loadingRooms, roomTypes.length);
  const testimonialsRef = useRevealOnScroll(loadingReviews, reviews.length);
  const locationRef = useRevealOnScroll();
  const ctaRef = useRevealOnScroll();
  const facebookLink = resolveFacebookLink(resortInfo.facebook);
  const mapCoords = parseLatLng(resortInfo.coordinates || "16.219759824221544, 103.32908547853327");
  const mapSrc = mapCoords
    ? googleMapsEmbedUrl(mapCoords)
    : googleMapsSearchUrl(
        resortInfo.name || 'สวนวลัยรุกขเวช มหาสารคาม'
      );

  useEffect(() => {
    const fetchLandingData = async () => {
      const [resortRes, roomsRes, reviewsRes, statsRes, facilitiesRes] =
        await Promise.allSettled([
          api.get("/settings/resort"),
          api.get("/rooms"),
          api.get("/reviews/public", { params: { limit: 6 } }),
          api.get("/settings/landing-stats"),
          api.get("/settings/resort", { params: { id: 4 } }),
        ]);

      if (resortRes.status === "fulfilled")
        setResortInfo(resortRes.value.data?.data || {});
      if (roomsRes.status === "fulfilled")
        setRoomTypes(roomsRes.value.data?.data || []);
      setLoadingRooms(false);

      // หมวดที่ไม่ใช่ของเจาะจงห้องพัก (อินเทอร์เน็ต/สิ่งอำนวยความสะดวกในห้อง ไปโชว์ที่หน้าห้องแทน) — ที่นี่โชว์แค่หมวดรวมของรีสอร์ท
      if (facilitiesRes.status === "fulfilled") {
        const all: FacilityGroup[] = Array.isArray(facilitiesRes.value.data?.data?.facilities)
          ? facilitiesRes.value.data.data.facilities
          : [];
        setFacilities(all.filter((g) => !ROOM_SPECIFIC_FACILITY_CATEGORIES.includes(g.category)));
      }

      if (reviewsRes.status === "fulfilled")
        setReviews(reviewsRes.value.data?.data || []);
      setLoadingReviews(false);

      if (statsRes.status === "fulfilled") {
        setLandingStats(
          statsRes.value.data?.data || {
            room_type_count: 0,
            boat_type_count: 0,
            guest_count: 0,
            avg_rating: null,
            review_count: 0,
          },
        );
      }
    };

    fetchLandingData();
  }, []);

  const featuredRooms = roomTypes.slice(0, 3);
  const featured = featuredRooms[0];
  const secondary = featuredRooms.slice(1, 3);

  const features = [
    {
      icon: <Waves className="text-lagoon-600" size={22} />,
      title: "เรือนแพลอยน้ำ",
      desc: "สัมผัสความเย็นสบายของสายน้ำ เปิดรับทัศนียภาพแบบ 360 องศาจากระเบียงห้องพัก",
    },
    {
      icon: <Anchor className="text-forest-700" size={22} />,
      title: "กิจกรรมเรือคายัค",
      desc: "พายเรือออกสำรวจความสมบูรณ์ของระบบนิเวศ เหมาะสำหรับทั้งมือใหม่และครอบครัว",
    },
    {
      icon: <Compass className="text-bamboo-600" size={22} />,
      title: "ทำเลเงียบสงบ",
      desc: "โอบล้อมด้วยแมกไม้และธรรมชาติอันบริสุทธิ์ ให้คุณได้สูดอากาศสดชื่นเต็มปอด",
    },
    {
      icon: <CreditCard className="text-amber-600" size={22} />,
      title: "จองง่าย สะดวกรวดเร็ว",
      desc: "ระบบจองห้องพักออนไลน์ รองรับการชำระเงินผ่าน QR PromptPay ทันที",
    },
  ];

  return (
    <div className="bg-cream-100 text-charcoal min-h-screen overflow-x-hidden">
      {/* ═══════════════════════════════
          1. HERO SECTION
          ═══════════════════════════════ */}
      <section className="relative min-h-[100vh] flex flex-col items-center justify-center pt-32 pb-24 overflow-hidden">
        {/* Full-bleed Background Image */}
        <div className="absolute inset-0 w-full h-full">
          <img 
            src="/images/balcony.jpg"
            alt="Walai Resort Background"
            className="w-full h-full object-cover transition-transform duration-[20s] hover:scale-105"
          />
          {/* Overlays to ensure readability */}
          {/* Top gradient for Navbar (cream-100 is #fbfaf8) */}
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-cream-100/90 via-cream-100/50 to-transparent" />
          
          {/* Main dark overlay for text contrast */}
          <div className="absolute inset-0 bg-forest-950/40 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-forest-950/80 via-forest-900/40 to-transparent" />
          
          {/* Bottom fade into next section (cream-100) */}
          <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-cream-100 to-transparent" />
        </div>

        <div className="relative container mx-auto px-4 z-10 w-full flex flex-col items-center mt-12">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <h1 
              className="font-display text-5xl md:text-6xl lg:text-[6.5rem] font-bold text-white leading-[1.05] tracking-tight mb-8 animate-reveal-up drop-shadow-xl" 
              style={{ animationDelay: '100ms' }}
            >
              ค้นพบความสงบที่แท้จริง <br className="hidden md:block" />
              บน <span className="text-bamboo-300 italic font-light pr-4">เรือนแพลอยน้ำ</span>
            </h1>

            <p 
              className="text-lg md:text-2xl text-cream-100/90 leading-relaxed max-w-3xl mx-auto mb-12 animate-reveal-up font-light drop-shadow-md" 
              style={{ animationDelay: '200ms' }}
            >
              หลบหนีความวุ่นวายมาผ่อนคลายกับบรรยากาศสุดสโลว์ไลฟ์ พร้อมกิจกรรมพายเรือคายัคชมทัศนียภาพอันร่มรื่นกลางผืนน้ำ
            </p>

            <div 
              className="flex flex-col sm:flex-row items-center justify-center gap-5 animate-reveal-up w-full sm:w-auto" 
              style={{ animationDelay: '300ms' }}
            >
              <Link
                href="/rooms"
                className="group relative inline-flex items-center justify-center gap-3 bg-bamboo-500 text-forest-950 font-bold px-10 py-4 rounded-full overflow-hidden transition-all duration-300 hover:scale-105 active:scale-[0.98] w-full sm:w-auto shadow-[0_0_40px_rgba(234,179,8,0.3)]"
              >
                <span className="relative flex items-center gap-2 text-lg">
                  <Calendar size={20} />
                  จองห้องพัก
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
              
              <Link
                href="/kayaks"
                className="inline-flex items-center justify-center gap-3 font-semibold px-10 py-4 rounded-full bg-white/10 text-white backdrop-blur-md border border-white/30 hover:bg-white/20 active:scale-[0.98] transition-all duration-300 w-full sm:w-auto text-lg"
              >
                <Anchor size={20} />
                บริการเรือคายัค
              </Link>
            </div>
          </div>
        </div>

        <ScrollMouseIndicator targetId="stats-section" />
      </section>

      {/* ═══════════════════════════════
          2. STATS STRIP
          ═══════════════════════════════ */}
      <section
        id="stats-section"
        className="border-y border-bamboo-200 bg-white"
      >
        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <h2 className="font-display text-3xl lg:text-4xl font-bold text-forest-800 leading-tight">
                จุดหมายปลายทางแห่ง<br />
                <span className="italic font-light text-forest-600 text-2xl lg:text-3xl">ความสงบเรียบง่าย</span>
              </h2>
              <p className="mt-5 text-lg text-charcoal-500 font-light leading-relaxed">
                เราตั้งใจสร้างสรรค์พื้นที่ให้คุณได้ทิ้งความวุ่นวาย แล้วกลับมาเชื่อมต่อกับธรรมชาติตามวิถีอีสานริมน้ำ
                ดื่มด่ำกับความเรียบง่ายที่ได้รับการดูแลอย่างใส่ใจ
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-12">
              <div className="border-l border-bamboo-300 pl-6">
                <span className="block text-sm tracking-wide text-forest-700 uppercase font-semibold mb-1">Accommodation</span>
                <div className="font-display text-3xl font-bold text-forest-900">
                  {landingStats.room_type_count ? (
                    <>{landingStats.room_type_count} <span className="text-xl font-normal text-forest-700">รูปแบบ</span></>
                  ) : (
                    <span className="text-xl font-normal text-forest-700">หลากหลายรูปแบบ</span>
                  )}
                </div>
                <p className="text-sm text-charcoal-400 mt-2 font-light">ห้องพักลอยน้ำที่ออกแบบอย่างกลมกลืน</p>
              </div>
              <div className="border-l border-bamboo-300 pl-6">
                <span className="block text-sm tracking-wide text-forest-700 uppercase font-semibold mb-1">Experience</span>
                <div className="font-display text-3xl font-bold text-forest-900">
                  {landingStats.boat_type_count ? (
                    <>{landingStats.boat_type_count} <span className="text-xl font-normal text-forest-700">กิจกรรม</span></>
                  ) : (
                    <span className="text-xl font-normal text-forest-700">บริการเรือคายัค</span>
                  )}
                </div>
                <p className="text-sm text-charcoal-400 mt-2 font-light">สัมผัสวิถีชีวิตริมน้ำอย่างใกล้ชิด</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════
          3. TESTIMONIALS SECTION
          ═══════════════════════════════ */}
      <section className="py-24 bg-white" ref={testimonialsRef}>
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto px-4 mb-12">
            <p className="text-forest-700 font-medium text-sm mb-3">เสียงจากแขกผู้เข้าพัก</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-forest-800">
              ความประทับใจที่เล่าต่อกันมา
            </h2>
          </div>
          <ReviewCarousel reviews={reviews} />
        </div>
      </section>

      {/* ═══════════════════════════════
          4. ROOM TYPES SECTION
          ═══════════════════════════════ */}
      <section className="py-24" ref={roomsRef}>
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <div>
              <p className="text-forest-700 font-medium text-sm mb-3">ที่พัก</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-forest-800">
                ห้องพักแนะนำ
              </h2>
            </div>
            <Link
              href="/rooms"
              className="inline-flex items-center gap-2 text-forest-800 font-semibold hover:text-bamboo-600 transition-colors mt-4 md:mt-0"
            >
              ดูห้องพักทั้งหมด
              <ArrowRight size={18} />
            </Link>
          </div>

          {loadingRooms ? (
            <div className="grid lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3 h-[420px] md:h-[520px] rounded-2xl bg-stone-200 animate-pulse" />
              <div className="lg:col-span-2 grid gap-5">
                <div className="h-[210px] md:h-[248px] rounded-2xl bg-stone-200 animate-pulse" />
                <div className="h-[210px] md:h-[248px] rounded-2xl bg-stone-200 animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="grid lg:grid-cols-5 gap-5">
              {featured && (
                <div className="lg:col-span-3">
                  <RoomCard room={featured} large />
                </div>
              )}
              {secondary.length > 0 && (
                <div className="lg:col-span-2 grid gap-5">
                  {secondary.map((room) => (
                    <RoomCard key={room.id} room={room} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════
          5. EXPERIENCE SECTION (Why Choose Us)
          ═══════════════════════════════ */}
      <section className="py-24 bg-white" ref={experienceRef}>
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-12 gap-12 items-start">
            <div className="md:col-span-5 space-y-4 md:sticky md:top-24">
              <p className="text-forest-700 font-medium text-sm">เหตุผลที่ควรมาพัก</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-forest-800 leading-tight">
                เติมเต็มวันพักผ่อน
                <br />
                ด้วยบรรยากาศธรรมชาติ
              </h2>
              <p className="text-charcoal-400 text-lg leading-relaxed font-light">
                เราใส่ใจในทุกรายละเอียดเพื่อให้การเดินทางมาพักผ่อนของคุณที่{" "}
                <span className="font-medium text-forest-800">
                  {resortInfo.name || "สวนวลัยรุกขเวช"}
                </span>{" "}
                เต็มไปด้วยความสุข ความเงียบสงบ และความทรงจำอันแสนพิเศษ
              </p>
            </div>

            <div className="md:col-span-7 divide-y divide-stone-200">
              {features.map((item, idx) => (
                <div key={idx} className="flex items-start gap-5 py-6 first:pt-0 last:pb-0">
                  <div className="w-11 h-11 rounded-full bg-stone-50 border border-stone-200 flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-semibold text-forest-800 mb-1">
                      {item.title}
                    </h3>
                    <p className="text-charcoal-400 text-sm leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════
          5.5 FACILITIES SECTION (Resort-wide services)
          ═══════════════════════════════ */}
      {facilities.length > 0 && (
        <section className="py-24 bg-white border-t border-stone-200">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
              <div className="lg:col-span-4 lg:sticky lg:top-32">
                <p className="text-forest-700 font-medium text-sm tracking-widest uppercase mb-3">Resort Facilities</p>
                <h2 className="font-display text-3xl md:text-4xl font-bold text-forest-800 leading-tight">
                  สิ่งอำนวยความสะดวก<br />และการบริการ
                </h2>
                <p className="text-charcoal-500 text-lg leading-relaxed font-light mt-5">
                  ความสุขของคุณคือสิ่งสำคัญ เราเตรียมความพร้อมครบถ้วนทั้งด้านความปลอดภัย 
                  ความสะดวกสบาย และบริการที่พร้อมดูแลคุณด้วยใจ
                </p>
              </div>
              
              <div className="lg:col-span-8 flex flex-col gap-10">
                {facilities.map((group, idx) => (
                  <div 
                    key={group.category} 
                    className={`flex flex-col sm:flex-row gap-6 ${idx !== facilities.length - 1 ? 'pb-10 border-b border-stone-200/60' : ''}`}
                  >
                    <div className="sm:w-1/3 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="text-bamboo-600">
                          {getFacilityCategoryIcon(group.icon)}
                        </div>
                        <h3 className="font-display text-xl font-semibold text-forest-900">{group.category}</h3>
                      </div>
                    </div>
                    <div className="sm:w-2/3">
                      <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
                        {group.items.map((item) => (
                          <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-charcoal-600">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-200" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════
          6. LOCATION & MAP SECTION
          ═══════════════════════════════ */}
      <section className="bg-stone-50" ref={locationRef}>
        <WaveDivider className="text-white" />
        <div className="container mx-auto px-4 md:px-6 py-16">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5 space-y-6">
              <p className="text-forest-700 font-medium text-sm">แผนที่และการเดินทาง</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-forest-800">
                การเดินทาง & ที่ตั้ง
              </h2>
              <div className="space-y-4 text-charcoal/80">
                <div className="flex items-start gap-3">
                  <MapPin className="text-forest-800 shrink-0 mt-1" size={20} />
                  <span>
                    {resortInfo.address ||
                      "มหาวิทยาลัยมหาสารคาม ต.ขามเรียง อ.กันทรวิชัย จ.มหาสารคาม"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="text-forest-800 shrink-0" size={20} />
                  <span>{resortInfo.phone || "080-000-0000"}</span>
                </div>
              </div>

              {facebookLink && (
                <div className="flex items-start gap-3">
                  <Facebook size={18} className="text-bamboo-400 mt-1 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-forest-800 mb-0.5">Facebook</p>
                    <a
                      href={facebookLink.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-charcoal-400 text-sm underline decoration-stone-300 underline-offset-4 transition-colors hover:text-forest-800 hover:decoration-bamboo-400 break-words"
                    >
                      {facebookLink.label}
                    </a>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Waves size={18} className="text-bamboo-400 mt-1 shrink-0" />
                <div>
                  <p className="font-display font-semibold text-forest-800 mb-0.5">เวลาเปิด-ปิด</p>
                  <p className="text-charcoal-400 text-sm">
                    {resortInfo.operating_days && resortInfo.operating_hours
                      ? `${resortInfo.operating_days} ${resortInfo.operating_hours}`
                      : 'เปิดทุกวัน 08:00 – 20:00 น.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 h-80 rounded-2xl overflow-hidden border border-stone-200 relative">
              <iframe
                title={`แผนที่ ${resortInfo.name || "สวนวลัยรุกขเวช"}`}
                aria-labelledby={mapTitleId}
                src={mapSrc}
                className="w-full h-full border-0"
                loading="lazy"
              />
              <span id={mapTitleId} className="sr-only">
                แผนที่แสดงตำแหน่ง {resortInfo.name || "สวนวลัยรุกขเวช"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════
          7. FINAL CTA
          ═══════════════════════════════ */}
      <section className="relative bg-forest-800 text-cream-100" ref={ctaRef}>
        <WaveDivider className="text-stone-50 -mb-px" flip />
        <div className="container mx-auto px-4 py-20 md:py-28 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            พร้อมพักผ่อนกลางสายน้ำหรือยัง?
          </h2>
          <p className="text-cream-100/70 max-w-xl mx-auto mb-10 text-lg font-light">
            จองห้องพักวันนี้ พร้อมกิจกรรมพายเรือคายัคชมทัศนียภาพอันร่มรื่นกลางผืนน้ำ
          </p>
          <Link
            href="/rooms"
            className="inline-flex items-center justify-center gap-2 bg-bamboo-400 text-forest-900 font-semibold px-8 py-4 rounded-2xl hover:bg-bamboo-500 active:scale-[0.97] transition-all duration-200"
          >
            <Calendar size={18} aria-hidden="true" />
            จองห้องพักตอนนี้
          </Link>
        </div>
      </section>
    </div>
  );
}
