"use client";

import { useState, useEffect, useRef, useId } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowRight, Anchor, Calendar, CreditCard, Sparkles, Star, MapPin, Phone, Waves, Facebook, Compass } from 'lucide-react';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/avatar';
import { resolveFacebookLink } from '@/lib/social';
import { pickResortInfo } from '@/lib/resort-info';

// โหลดแยก bundle เพราะ three.js หนัก และฉากต้องรันบนเบราว์เซอร์เท่านั้น
const WaterHouseScene3D = dynamic(
  () => import('@/components/3D/WaterHouseScene3D'),
  { ssr: false, loading: () => <div className="h-full w-full" /> }
);

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
   Decorative SVG components
   ——————————————————————————————— */
function LeafPattern({ className }: { className?: string }) {
  return (
    <svg className={className} width="320" height="320" viewBox="0 0 320 320" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M160 20C160 20 60 80 60 180C60 240 100 280 160 300C220 280 260 240 260 180C260 80 160 20 160 20Z" stroke="currentColor" strokeWidth="1" opacity="0.12" fill="none" />
      <path d="M160 60C160 60 90 110 90 190C90 230 120 260 160 275C200 260 230 230 230 190C230 110 160 60 160 60Z" stroke="currentColor" strokeWidth="1" opacity="0.08" fill="none" />
      <path d="M160 100C160 100 120 130 120 190C120 215 135 235 160 245C185 235 200 215 200 190C200 130 160 100 160 100Z" stroke="currentColor" strokeWidth="0.5" opacity="0.06" fill="none" />
    </svg>
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
    <div
      onClick={scrollToTarget}
      className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer group transition-all duration-500 z-10 ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none"
      }`}
      role="button"
      aria-label="เลื่อนลงเพื่อดูเนื้อหา"
    >
      <div className="relative w-6 h-10 rounded-full border-2 border-forest-800/40 group-hover:border-forest-800 group-hover:scale-110 transition-all duration-300 flex justify-center pt-2 bg-white/30 backdrop-blur-xs">
        <div className="w-1.5 h-1.5 rounded-full bg-bamboo-500 animate-bounce" />
      </div>
      <span className="text-[11px] font-semibold text-forest-800/70 tracking-widest uppercase group-hover:text-forest-800 transition-colors">
        เลื่อนลง
      </span>
    </div>
  );
}

/* ———————————————————————————————
   Stats counter component
   ——————————————————————————————— */
function useCountUp(target: number, duration = 1000) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [started, target, duration]);

  return { count, ref };
}

function StatItem({
  number,
  suffix,
  label,
  decimal,
}: {
  number: number;
  suffix: string;
  label: string;
  decimal?: boolean;
}) {
  const { count, ref } = useCountUp(decimal ? number * 10 : number);

  // ถ้าเป็นทศนิยม ให้แยกเลขหน้าจุด และเลขหลังจุดออกจากกัน
  const integerPart = decimal ? Math.floor(count / 10) : count;
  const decimalPart = decimal ? count % 10 : null;

  return (
    <div ref={ref} className="text-center py-6 px-4">
      <span className="font-display text-3xl md:text-5xl font-bold text-forest-800 tracking-tight inline-flex items-baseline justify-center">
        {decimal ? (
          <>
            <span>{integerPart}</span>
            {/* เว้นระยะห่างซ้าย-ขวาของจุดทศนิยมให้ดูสบายตา ไม่ติดตัวเลข */}
            <span className="text-bamboo-500 mx-0.5 font-normal">.</span>
            <span>{decimalPart}</span>
          </>
        ) : (
          count
        )}
        <span className="text-bamboo-500 ml-1 text-2xl md:text-4xl">{suffix}</span>
      </span>
      <p className="text-charcoal-400 text-sm mt-1.5 font-medium">{label}</p>
    </div>
  );
}

function formatPrice(value: number): string {
  return Number(value).toLocaleString("th-TH");
}

function getReviewerName(review: LandingReview): string {
  const fullName =
    `${review.first_name || ""} ${review.last_name || ""}`.trim();
  return fullName || "แขกผู้เข้าพัก";
}

/* ———————————————————————————————
   Review Carousel
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
      <div className="text-center text-charcoal-400 py-10 bg-white/60 backdrop-blur-md rounded-2xl border border-stone-200">
        ยังไม่มีรีวิวจากแขกผู้เข้าพัก — มาเป็นคนแรกที่แชร์ประสบการณ์กับเรา
      </div>
    );
  }

  return (
    <div className="relative max-w-3xl mx-auto text-center px-4">
      <div className="bg-white/80 backdrop-blur-xl p-8 md:p-12 rounded-3xl border border-white/60 shadow-xl shadow-forest-800/5 relative overflow-hidden">
        <span className="font-display text-8xl md:text-9xl text-bamboo-300/20 leading-none select-none absolute -top-4 left-6 pointer-events-none">
          “
        </span>

        <div className="relative min-h-[160px] flex items-center justify-center">
          {reviews.map((review, i) => (
            <div
              key={review.review_id}
              className={`transition-all duration-700 absolute inset-0 flex flex-col justify-center items-center ${
                i === current
                  ? "opacity-100 scale-100 pointer-events-auto"
                  : "opacity-0 scale-95 pointer-events-none"
              }`}
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: review.rating }).map((_, j) => (
                  <Star
                    key={j}
                    size={18}
                    className="fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <p className="text-lg md:text-xl text-charcoal leading-relaxed font-light mb-6 max-w-xl">
                "{review.comment}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-6 h-[2px] bg-bamboo-400" />
                <span className="font-display font-semibold text-forest-800">
                  {getReviewerName(review)}
                </span>
                <div className="w-6 h-[2px] bg-bamboo-400" />
              </div>
              {(review.room_name || review.type_name) && (
                <span className="text-xs text-charcoal-400 mt-1 font-medium">
                  {review.room_name || review.type_name}
                </span>
              )}
            </div>
          ))}
        </div>

        {reviews.length > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {reviews.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`ไปที่รีวิวที่ ${i + 1}`}
                aria-current={i === current ? "true" : "false"}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === current
                    ? "bg-forest-800 w-8"
                    : "bg-stone-300 w-2 hover:bg-stone-400"
                }`}
              />
            ))}
          </div>
        )}
      </div>
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

  const experienceRef = useRevealOnScroll();
  const roomsRef = useRevealOnScroll(loadingRooms, roomTypes.length);
  const testimonialsRef = useRevealOnScroll(loadingReviews, reviews.length);
  const locationRef = useRevealOnScroll();
  const ctaRef = useRevealOnScroll();
  const facebookLink = resolveFacebookLink(resortInfo.facebook);

  useEffect(() => {
    const fetchLandingData = async () => {
      const [resortRes, roomsRes, reviewsRes, statsRes] =
        await Promise.allSettled([
          api.get("/settings/resort"),
          api.get("/rooms"),
          api.get("/reviews/public", { params: { limit: 6 } }),
          api.get("/settings/landing-stats"),
        ]);

      if (resortRes.status === "fulfilled")
        setResortInfo(pickResortInfo(resortRes.value.data?.data, 'main'));
      if (roomsRes.status === "fulfilled")
        setRoomTypes(
          Array.isArray(roomsRes.value.data?.data)
            ? roomsRes.value.data.data
            : []
        );
      setLoadingRooms(false);

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

  return (
    <div className="bg-[#FAF8F5] text-charcoal min-h-screen overflow-x-hidden">
      {/* ═══════════════════════════════
          1. HERO SECTION
          ═══════════════════════════════ */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Ambient gradient washes */}
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-b from-lagoon-100/40 via-bamboo-100/20 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-0 w-1/3 h-1/3 bg-forest-800/5 blur-3xl pointer-events-none" />

        <div className="relative container mx-auto px-4 py-32 md:py-36">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left — Text content */}
            <div className="lg:col-span-7">
              {/* Eyebrow badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-6 rounded-full bg-forest-800/5 border border-forest-800/10 text-forest-800 text-xs font-semibold tracking-wide uppercase animate-reveal-up">
                <Sparkles size={14} className="text-bamboo-500" aria-hidden="true" />
                รีสอร์ต &amp; ที่พักลอยน้ำ
              </div>

              {/* Headline */}
              <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-forest-800 leading-[1.12] mb-6 animate-reveal-up">
                {resortInfo.name || 'สวนวลัยรุกขเวช'}
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-lagoon-600 via-forest-700 to-bamboo-600">
                  สัมผัสธรรมชาติลอยน้ำ
                </span>
              </h1>

              {/* Subtitle */}
              <p
                className="text-lg md:text-xl text-charcoal-400 leading-relaxed max-w-2xl mb-10 animate-reveal-up"
                style={{ animationDelay: '120ms' }}
              >
                หลบหนีความวุ่นวายมาผ่อนคลายกับที่พักเรือนแพลอยน้ำบรรยากาศสุดสโลว์ไลฟ์
                พร้อมกิจกรรมพายเรือคายัคชมทัศนียภาพอันร่มรื่นกลางผืนน้ำ
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link
                  href="/rooms"
                  className="inline-flex items-center justify-center gap-2 bg-forest-800 text-cream-100 font-semibold px-8 py-4 rounded-2xl shadow-lg shadow-forest-800/20 hover:bg-forest-700 active:scale-[0.97] transition-all duration-200"
                >
                  <Calendar size={18} aria-hidden="true" />
                  จองห้องพัก
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link
                  href="/kayaks"
                  className="inline-flex items-center justify-center gap-2 font-semibold px-8 py-4 rounded-2xl bg-cream-100 border border-stone-200 text-forest-800 shadow-sm hover:border-forest-800/30 hover:bg-cream-200 active:scale-[0.97] transition-all duration-200"
                >
                  <Anchor size={18} aria-hidden="true" />
                  บริการเรือคายัค
                </Link>
              </div>
            </div>

            {/* Right — Interactive 3D scene */}
            <div
              className="lg:col-span-5 relative h-[380px] sm:h-[460px] lg:h-[500px] w-full animate-reveal-up"
              style={{ animationDelay: '300ms' }}
            >
              <WaterHouseScene3D />
            </div>
          </div>
        </div>

        {/* Scroll Mouse Indicator */}
        <ScrollMouseIndicator targetId="stats-section" />
      </section>

      {/* ═══════════════════════════════
          2. STATS STRIP
          ═══════════════════════════════ */}
      <section
        id="stats-section"
        className="py-8 bg-white border-y border-stone-200/80 shadow-xs"
      >
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-stone-200/80">
            <StatItem
              number={landingStats.room_type_count || roomTypes.length}
              suffix="+"
              label="ประเภทห้องพัก"
            />
            <StatItem
              number={landingStats.boat_type_count || 5}
              suffix="+"
              label="เรือคายัคให้บริการ"
            />
            <StatItem
              number={landingStats.guest_count || 1200}
              suffix="+"
              label="ผู้เข้าพักที่ประทับใจ"
            />
            <StatItem
              number={landingStats.avg_rating || 4.9}
              suffix="★"
              label="คะแนนรีวิวเฉลี่ย"
              decimal
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════
          3. TESTIMONIALS SECTION (ย้ายขึ้นมาต่อจาก Stats)
          ═══════════════════════════════ */}
      <section className="py-24 bg-stone-50/50 border-b border-stone-200/60" ref={testimonialsRef}>
        <div className="container mx-auto px-4">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="text-bamboo-600 font-semibold tracking-wider text-xs uppercase">
              REVIEWS
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-forest-800 mt-2">
              ความประทับใจจากแขก
            </h2>
          </div>
          <ReviewCarousel reviews={reviews} />
        </div>
      </section>

      {/* ═══════════════════════════════
          4. ROOM TYPES SECTION (ย้ายมาต่อจาก รีวิว)
          ═══════════════════════════════ */}
      <section
        className="py-24 bg-white/50 border-b border-stone-200/80"
        ref={roomsRef}
      >
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <div>
              <span className="text-bamboo-600 font-semibold tracking-wider text-xs uppercase">
                ACCOMMODATION
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-forest-800 mt-2">
                ห้องพักแนะนำ
              </h2>
            </div>
            <Link
              href="/rooms"
              className="inline-flex items-center gap-2 text-forest-800 font-semibold hover:text-lagoon-600 transition-colors mt-4 md:mt-0"
            >
              ดูห้องพักทั้งหมด
              <ArrowRight size={18} />
            </Link>
          </div>

          {/* Rooms Cards */}
          <div className="grid md:grid-cols-3 gap-8">
            {loadingRooms
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-3xl p-6 border border-stone-200/80 animate-pulse space-y-4"
                  >
                    <div className="h-48 bg-stone-200 rounded-2xl w-full" />
                    <div className="h-4 bg-stone-200 rounded w-1/3" />
                    <div className="h-6 bg-stone-200 rounded w-2/3" />
                    <div className="h-10 bg-stone-200 rounded w-full mt-4" />
                  </div>
                ))
              : featuredRooms.map((room) => (
                  <div
                    key={room.id}
                    className="bg-white rounded-3xl overflow-hidden border border-stone-200/80 shadow-md hover:shadow-xl transition-all flex flex-col group"
                  >
                    <div className="relative h-60 overflow-hidden bg-stone-100">
                      {room.main_image ? (
                        <img
                          src={resolveMediaUrl(room.main_image)}
                          alt={room.room_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400">
                          ไม่มีรูปภาพ
                        </div>
                      )}
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-forest-800 border border-stone-200">
                        พักได้ {room.capacity} ท่าน
                      </div>
                    </div>

                    <div className="p-6 flex flex-col justify-between flex-1">
                      <div>
                        <span className="text-xs text-bamboo-600 font-semibold uppercase">
                          {room.type_name}
                        </span>
                        <h3 className="font-display text-2xl font-bold text-forest-800 mt-1 mb-2">
                          {room.room_name}
                        </h3>
                        <p className="text-charcoal-400 text-sm line-clamp-2 font-light">
                          {room.description ||
                            "สัมผัสประสบการณ์การพักผ่อนริมน้ำสุดพิเศษ..."}
                        </p>
                      </div>

                      <div className="pt-6 mt-6 border-t border-stone-100 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-charcoal-400">
                            ราคาเริ่มต้น
                          </span>
                          <div className="font-display text-2xl font-bold text-forest-800">
                            ฿{formatPrice(room.price_per_night)}
                            <span className="text-xs font-normal text-charcoal-400">
                              {" "}
                              /คืน
                            </span>
                          </div>
                        </div>
                        <Link
                          href={`/rooms/${room.id}`}
                          className="p-3 rounded-xl bg-stone-100 text-forest-800 hover:bg-forest-800 hover:text-white transition-colors"
                          aria-label={`ดูรายละเอียดห้อง ${room.room_name}`}
                        >
                          <ArrowRight size={20} />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════
          5. EXPERIENCE SECTION (Why Choose Us)
          ═══════════════════════════════ */}
      <section className="py-24" ref={experienceRef}>
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-12 gap-12 items-center">
            {/* Title */}
            <div className="md:col-span-5 space-y-4">
              <span className="text-bamboo-600 font-semibold tracking-wider text-xs uppercase">
                WHY CHOOSE US
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-forest-800 leading-tight">
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

            {/* Feature Cards Grid */}
            <div className="md:col-span-7 grid sm:grid-cols-2 gap-6">
              {[
                {
                  icon: <Waves className="text-lagoon-600" size={26} />,
                  title: "เรือนแพลอยน้ำ",
                  desc: "สัมผัสความเย็นสบายของสายน้ำ เปิดรับทัศนียภาพแบบ 360 องศาจากระเบียงห้องพัก",
                },
                {
                  icon: <Anchor className="text-forest-700" size={26} />,
                  title: "กิจกรรมเรือคายัค",
                  desc: "พายเรือออกสำรวจความสมบูรณ์ของระบบนิเวศ เหมาะสำหรับทั้งมือใหม่และครอบครัว",
                },
                {
                  icon: <Compass className="text-bamboo-600" size={26} />,
                  title: "ทำเลเงียบสงบ",
                  desc: "โอบล้อมด้วยแมกไม้และธรรมชาติอันบริสุทธิ์ ให้คุณได้สูดอากาศสดชื่นเต็มปอด",
                },
                {
                  icon: <CreditCard className="text-amber-600" size={26} />,
                  title: "จองง่าย สะดวกรวดเร็ว",
                  desc: "ระบบจองห้องพักออนไลน์ รองรับการชำระเงินผ่าน QR PromptPay ทันที",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white p-7 rounded-2xl border border-stone-200/70 shadow-sm hover:shadow-md hover:border-forest-800/20 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    {item.icon}
                  </div>
                  <h3 className="font-display text-xl font-semibold text-forest-800 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-charcoal-400 text-sm leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════
          6. LOCATION & MAP SECTION
          ═══════════════════════════════ */}
      <section
        className="py-2 bg-stone-100/60 border-t border-stone-200"
        ref={locationRef}
      >
        <div className="container mx-auto px-4 md:px-6 py-16">
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-6">
              <span className="text-bamboo-600 font-semibold tracking-wider text-xs uppercase">
                LOCATION
              </span>
              <h2 className="font-display text-4xl font-bold text-forest-800">
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
              {/* Facebook */}
              {facebookLink && (
                <div className="flex items-start gap-3">
                  <Facebook size={18} className="text-bamboo-500 mt-1 shrink-0" />
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
              {/* Hours */}
              <div className="flex items-start gap-3">
                <Waves size={18} className="text-bamboo-500 mt-1 shrink-0" />
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

            {/* Embed Map View */}
            <div className="lg:col-span-7 h-80 rounded-3xl overflow-hidden border border-stone-300 shadow-sm relative">
              <iframe
                title={`แผนที่ ${resortInfo.name || "สวนวลัยรุกขเวช"}`}
                aria-labelledby={mapTitleId}
                src="https://maps.google.com/maps?q=Walai+Rukhavej+Botanical+Research+Institute&t=&z=14&ie=UTF8&iwloc=&output=embed"
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
    </div>
  );
}