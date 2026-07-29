"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Anchor,
  CreditCard,
  Star,
  MapPin,
  Phone,
  Waves,
} from "lucide-react";
import api from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatar";

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
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
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
    <svg
      className={className}
      width="320"
      height="320"
      viewBox="0 0 320 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M160 20C160 20 60 80 60 180C60 240 100 280 160 300C220 280 260 240 260 180C260 80 160 20 160 20Z"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.12"
        fill="none"
      />
      <path
        d="M160 60C160 60 90 110 90 190C90 230 120 260 160 275C200 260 230 230 230 190C230 110 160 60 160 60Z"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.08"
        fill="none"
      />
      <path
        d="M160 100C160 100 120 130 120 190C120 215 135 235 160 245C185 235 200 215 200 190C200 130 160 100 160 100Z"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.06"
        fill="none"
      />
    </svg>
  );
}

/* ———————————————————————————————
   Hero Illustration — right side of hero
   ——————————————————————————————— */
function HeroIllustration({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Background organic circles */}
        <circle
          cx="250"
          cy="250"
          r="220"
          stroke="#4E878C"
          strokeWidth="0.8"
          opacity="0.12"
        />
        <circle
          cx="250"
          cy="250"
          r="180"
          stroke="#4E878C"
          strokeWidth="0.6"
          opacity="0.08"
        />
        <circle
          cx="250"
          cy="250"
          r="140"
          stroke="#D9A05B"
          strokeWidth="0.5"
          opacity="0.10"
        />

        {/* Water surface */}
        <path
          d="M60 300C120 285 180 310 250 295C320 280 380 305 440 290"
          stroke="#4E878C"
          strokeWidth="1.5"
          opacity="0.25"
          strokeLinecap="round"
        >
          <animate
            attributeName="d"
            dur="4s"
            repeatCount="indefinite"
            values="M60 300C120 285 180 310 250 295C320 280 380 305 440 290;M60 295C120 310 180 285 250 300C320 285 380 310 440 295;M60 300C120 285 180 310 250 295C320 280 380 305 440 290"
          />
        </path>
        <path
          d="M80 315C140 300 200 325 270 310C340 295 400 320 450 305"
          stroke="#4E878C"
          strokeWidth="1"
          opacity="0.15"
          strokeLinecap="round"
        >
          <animate
            attributeName="d"
            dur="5s"
            repeatCount="indefinite"
            values="M80 315C140 300 200 325 270 310C340 295 400 320 450 305;M80 310C140 325 200 300 270 315C340 300 400 325 450 310;M80 315C140 300 200 325 270 310C340 295 400 320 450 305"
          />
        </path>
        <path
          d="M50 330C130 318 200 340 280 325C360 310 420 335 460 320"
          stroke="#4E878C"
          strokeWidth="0.8"
          opacity="0.10"
          strokeLinecap="round"
        >
          <animate
            attributeName="d"
            dur="6s"
            repeatCount="indefinite"
            values="M50 330C130 318 200 340 280 325C360 310 420 335 460 320;M50 325C130 340 200 318 280 330C360 318 420 340 460 325;M50 330C130 318 200 340 280 325C360 310 420 335 460 320"
          />
        </path>

        {/* Floating house structure */}
        {/* Raft/platform */}
        <rect
          x="155"
          y="260"
          width="190"
          height="12"
          rx="3"
          fill="#123C30"
          opacity="0.15"
        />
        <rect
          x="160"
          y="256"
          width="180"
          height="8"
          rx="2"
          fill="#D9A05B"
          opacity="0.30"
        />

        {/* House body */}
        <rect
          x="180"
          y="200"
          width="140"
          height="56"
          rx="4"
          fill="#123C30"
          fillOpacity="0.12"
          stroke="#123C30"
          strokeWidth="1"
          strokeOpacity="0.20"
        />
        {/* Roof */}
        <path
          d="M170 200L250 155L330 200"
          stroke="#123C30"
          strokeWidth="1.5"
          opacity="0.25"
          fill="#123C30"
          fillOpacity="0.06"
        />
        {/* Door */}
        <rect
          x="235"
          y="225"
          width="30"
          height="31"
          rx="2"
          fill="#D9A05B"
          opacity="0.20"
        />
        {/* Windows */}
        <rect
          x="195"
          y="215"
          width="22"
          height="18"
          rx="2"
          fill="#4E878C"
          fillOpacity="0.15"
          stroke="#4E878C"
          strokeWidth="0.5"
          strokeOpacity="0.25"
        />
        <rect
          x="283"
          y="215"
          width="22"
          height="18"
          rx="2"
          fill="#4E878C"
          fillOpacity="0.15"
          stroke="#4E878C"
          strokeWidth="0.5"
          strokeOpacity="0.25"
        />

        {/* Trees on left */}
        <line
          x1="110"
          y1="260"
          x2="110"
          y2="210"
          stroke="#123C30"
          strokeWidth="2"
          opacity="0.18"
        />
        <ellipse
          cx="110"
          cy="200"
          rx="22"
          ry="30"
          fill="#123C30"
          opacity="0.10"
        />
        <ellipse
          cx="110"
          cy="195"
          rx="16"
          ry="22"
          fill="#4E878C"
          opacity="0.08"
        />

        {/* Trees on right */}
        <line
          x1="395"
          y1="260"
          x2="395"
          y2="195"
          stroke="#123C30"
          strokeWidth="2"
          opacity="0.18"
        />
        <ellipse
          cx="395"
          cy="185"
          rx="25"
          ry="35"
          fill="#123C30"
          opacity="0.10"
        />
        <ellipse
          cx="395"
          cy="180"
          rx="18"
          ry="25"
          fill="#4E878C"
          opacity="0.08"
        />

        {/* Small tree */}
        <line
          x1="365"
          y1="260"
          x2="365"
          y2="225"
          stroke="#123C30"
          strokeWidth="1.5"
          opacity="0.15"
        />
        <ellipse
          cx="365"
          cy="218"
          rx="14"
          ry="18"
          fill="#123C30"
          opacity="0.08"
        />

        {/* Kayak on water */}
        <ellipse
          cx="350"
          cy="310"
          rx="30"
          ry="5"
          fill="#D9A05B"
          opacity="0.25"
        />
        <line
          x1="350"
          y1="310"
          x2="350"
          y2="295"
          stroke="#D9A05B"
          strokeWidth="1"
          opacity="0.20"
        />
        <line
          x1="345"
          y1="295"
          x2="355"
          y2="300"
          stroke="#D9A05B"
          strokeWidth="0.8"
          opacity="0.15"
        />

        {/* Birds */}
        <path
          d="M130 140C135 135 140 140 145 135"
          stroke="#123C30"
          strokeWidth="1"
          opacity="0.15"
          strokeLinecap="round"
        />
        <path
          d="M160 125C165 120 170 125 175 120"
          stroke="#123C30"
          strokeWidth="0.8"
          opacity="0.12"
          strokeLinecap="round"
        />
        <path
          d="M320 110C325 105 330 110 335 105"
          stroke="#123C30"
          strokeWidth="0.8"
          opacity="0.12"
          strokeLinecap="round"
        />

        {/* Water reflections */}
        <line
          x1="200"
          y1="350"
          x2="220"
          y2="350"
          stroke="#4E878C"
          strokeWidth="0.8"
          opacity="0.08"
        />
        <line
          x1="260"
          y1="365"
          x2="290"
          y2="365"
          stroke="#4E878C"
          strokeWidth="0.8"
          opacity="0.06"
        />
        <line
          x1="310"
          y1="345"
          x2="340"
          y2="345"
          stroke="#4E878C"
          strokeWidth="0.8"
          opacity="0.08"
        />
        <line
          x1="150"
          y1="370"
          x2="175"
          y2="370"
          stroke="#4E878C"
          strokeWidth="0.6"
          opacity="0.06"
        />
        <line
          x1="360"
          y1="380"
          x2="385"
          y2="380"
          stroke="#4E878C"
          strokeWidth="0.6"
          opacity="0.05"
        />

        {/* Ripple circles in water */}
        <circle
          cx="180"
          cy="340"
          r="15"
          stroke="#4E878C"
          strokeWidth="0.5"
          opacity="0.06"
          fill="none"
        >
          <animate
            attributeName="r"
            dur="3s"
            repeatCount="indefinite"
            values="10;20;10"
          />
          <animate
            attributeName="opacity"
            dur="3s"
            repeatCount="indefinite"
            values="0.08;0.02;0.08"
          />
        </circle>
        <circle
          cx="320"
          cy="355"
          r="12"
          stroke="#4E878C"
          strokeWidth="0.5"
          opacity="0.06"
          fill="none"
        >
          <animate
            attributeName="r"
            dur="4s"
            repeatCount="indefinite"
            values="8;18;8"
          />
          <animate
            attributeName="opacity"
            dur="4s"
            repeatCount="indefinite"
            values="0.08;0.02;0.08"
          />
        </circle>

        {/* Sun/moon */}
        <circle cx="400" cy="100" r="25" fill="#D9A05B" opacity="0.10" />
        <circle cx="400" cy="100" r="18" fill="#D9A05B" opacity="0.06" />
      </svg>
    </div>
  );
}

/* ———————————————————————————————
   Decorative dots grid
   ——————————————————————————————— */
function DotsPattern({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
    >
      {Array.from({ length: 6 }).map((_, row) =>
        Array.from({ length: 6 }).map((_, col) => (
          <circle
            key={`${row}-${col}`}
            cx={10 + col * 20}
            cy={10 + row * 20}
            r="1.5"
            fill="#D9A05B"
            opacity={0.15 + ((row * 7 + col * 13) % 10) * 0.01}
          />
        )),
      )}
    </svg>
  );
}

/* ———————————————————————————————
   Scroll Mouse Indicator
   ——————————————————————————————— */
function ScrollMouseIndicator({ targetId }: { targetId: string }) {
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY < 100);
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
      ref={ref}
      onClick={scrollToTarget}
      className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer group transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      role="button"
      aria-label="เลื่อนลงเพื่อดูเนื้อหา"
    >
      {/* Mouse outline */}
      <div className="relative w-7 h-11 rounded-full border-2 border-forest-800/40 group-hover:border-forest-800/70 group-hover:scale-110 transition-all duration-300">
        {/* Animated dot */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-bamboo-400 animate-scroll-dot" />
      </div>
      <span className="text-[11px] font-medium text-charcoal-400 tracking-wider uppercase group-hover:text-forest-800 transition-colors duration-200">
        เลื่อนลง
      </span>
    </div>
  );
}

/* ———————————————————————————————
   Stats counter hook
   ——————————————————————————————— */
function useCountUp(target: number, duration = 800) {
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
      { threshold: 0.5 },
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
      // ease-out-quart
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
  const display = decimal ? (count / 10).toFixed(1) : count;
  return (
    <div ref={ref} className="text-center py-4">
      <span className="font-display text-3xl md:text-4xl font-semibold text-forest-800">
        {display}
        {suffix}
      </span>
      <p className="text-charcoal-400 text-sm mt-1 font-medium">{label}</p>
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

function getRoomGridSpan(index: number): string {
  if (index === 0) return "lg:col-span-6 lg:row-span-2";
  if (index === 1 || index === 2) return "lg:col-span-3";
  return "lg:col-span-6";
}

/* ———————————————————————————————
   Review carousel
   ——————————————————————————————— */
function ReviewCarousel({ reviews }: { reviews: LandingReview[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (reviews.length <= 1) return;
    const timer = setInterval(
      () => setCurrent((c) => (c + 1) % reviews.length),
      5000,
    );
    return () => clearInterval(timer);
  }, [reviews.length]);

  if (reviews.length === 0) {
    return (
      <p className="text-center text-charcoal-400 text-lg py-8">
        ยังไม่มีรีวิวจากแขกผู้เข้าพัก — มาเป็นคนแรกที่แชร์ประสบการณ์กับเรา
      </p>
    );
  }

  return (
    <div className="relative max-w-2xl mx-auto text-center">
      <span className="font-display text-8xl md:text-9xl text-bamboo-400/30 leading-none select-none absolute -top-10 left-1/2 -translate-x-1/2">
        "
      </span>

      <div className="pt-12 min-h-[160px] relative">
        {reviews.map((review, i) => (
          <div
            key={review.review_id}
            className={`transition-all duration-500 absolute inset-0 pt-12 ${
              i === current
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4 pointer-events-none"
            }`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
            }}
          >
            <div className="flex justify-center gap-1 mb-5">
              {Array.from({ length: review.rating }).map((_, j) => (
                <Star key={j} size={16} fill="#D9A05B" stroke="#D9A05B" />
              ))}
            </div>
            <p className="text-lg md:text-xl text-charcoal leading-relaxed font-light mb-6 px-4">
              {review.comment}
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="w-8 h-[1px] bg-bamboo-400" />
              <span className="font-display font-semibold text-forest-800">
                {getReviewerName(review)}
              </span>
              <div className="w-8 h-[1px] bg-bamboo-400" />
            </div>
            {(review.room_name || review.type_name) && (
              <p className="text-sm text-charcoal-400 mt-2">
                {review.room_name || review.type_name}
              </p>
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
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === current
                  ? "bg-bamboo-400 w-6"
                  : "bg-charcoal-200 hover:bg-charcoal-300"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════
   HOME PAGE
   ═══════════════════════════════ */
export default function HomePage() {
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

  useEffect(() => {
    const fetchLandingData = async () => {
      const [resortRes, roomsRes, reviewsRes, statsRes] =
        await Promise.allSettled([
          api.get("/settings/resort"),
          api.get("/rooms"),
          api.get("/reviews/public", { params: { limit: 6 } }),
          api.get("/settings/landing-stats"),
        ]);

      if (resortRes.status === "fulfilled") {
        setResortInfo(resortRes.value.data?.data || {});
      }

      if (roomsRes.status === "fulfilled") {
        setRoomTypes(roomsRes.value.data?.data || []);
      }
      setLoadingRooms(false);

      if (reviewsRes.status === "fulfilled") {
        setReviews(reviewsRes.value.data?.data || []);
      }
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

  const featuredRooms = roomTypes.slice(0, 4);

  return (
    <div className="bg-cream-100">
      {/* ═══════════════════════════════
          HERO SECTION
          ═══════════════════════════════ */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background decorative elements */}
        <LeafPattern className="absolute top-20 left-[-80px] text-forest-800 opacity-30 scale-50 hidden lg:block" />
        <DotsPattern className="absolute top-32 right-16 hidden lg:block" />
        <DotsPattern className="absolute bottom-40 left-20 hidden lg:block rotate-45 opacity-60" />

        {/* Subtle gradient wash at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-cream-200/50 to-transparent pointer-events-none" />

        <div className="relative container mx-auto px-4 py-32 md:py-36">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Left — Text content */}
            <div>
              {/* Gold accent line */}
              <div className="w-16 h-[3px] bg-bamboo-400 mb-8 animate-hero-line" />

              {/* Headline */}
              <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-forest-800 leading-[1.15] mb-6 animate-reveal-up">
                สวนวลัยรุกขเวช
                <br />
                <span className="text-lagoon-500 font-semibold">
                  ที่พักลอยน้ำ
                </span>
              </h1>

              {/* Subtitle */}
              <p
                className="text-lg md:text-xl text-charcoal-400 leading-relaxed max-w-xl mb-10 animate-reveal-up"
                style={{ animationDelay: "120ms" }}
              >
                สัมผัสประสบการณ์การพักผ่อนสุดพิเศษกับที่พักลอยน้ำ
                พร้อมกิจกรรมเรือคายัคท่ามกลางธรรมชาติอันงดงาม
              </p>

              {/* CTA Buttons */}
              <div
                className="flex flex-col sm:flex-row gap-4 animate-reveal-up"
                style={{ animationDelay: "240ms" }}
              >
                <Link
                  href="/rooms"
                  className="inline-flex items-center justify-center gap-2 bg-forest-800 text-cream-100 font-semibold px-8 py-4 rounded-xl hover:bg-forest-700 active:scale-[0.97] transition-all duration-200"
                >
                  จองห้องพัก
                  <ArrowRight size={18} />
                </Link>
                <Link
                  href="/kayaks"
                  className="inline-flex items-center justify-center gap-2 font-semibold px-8 py-4 rounded-xl border-2 border-forest-800/20 text-forest-800 hover:border-forest-800/40 hover:bg-forest-50 active:scale-[0.97] transition-all duration-200"
                >
                  <Anchor size={18} />
                  จองเรือคายัค
                </Link>
              </div>
            </div>

            {/* Right — Illustration */}
            <div
              className="hidden lg:block animate-reveal-up"
              style={{ animationDelay: "300ms" }}
            >
              <HeroIllustration className="w-full max-w-[480px] mx-auto" />
            </div>
          </div>
        </div>

        {/* Scroll Mouse Indicator */}
        <ScrollMouseIndicator targetId="stats-section" />
      </section>

      {/* ═══════════════════════════════
          STATS STRIP
          ═══════════════════════════════ */}
      <section
        id="stats-section"
        className="py-10 border-y"
        style={{ borderColor: "var(--color-stone-200)" }}
      >
        <div className="container mx-auto px-4">
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x"
            style={{ borderColor: "var(--color-stone-200)" }}
          >
            <StatItem
              number={landingStats.room_type_count || roomTypes.length}
              suffix="+"
              label="ประเภทห้องพัก"
            />
            <StatItem
              number={landingStats.boat_type_count}
              suffix="+"
              label="เรือคายัค"
            />
            <StatItem
              number={landingStats.guest_count}
              suffix="+"
              label="แขกพักอาศัย"
            />
            {landingStats.avg_rating != null ? (
              <StatItem
                number={landingStats.avg_rating}
                suffix="★"
                label="คะแนนรีวิว"
                decimal
              />
            ) : (
              <div className="text-center py-4">
                <span className="font-display text-3xl md:text-4xl font-semibold text-forest-800">
                  —
                </span>
                <p className="text-charcoal-400 text-sm mt-1 font-medium">
                  คะแนนรีวิว
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════
          EXPERIENCE SECTION
          ═══════════════════════════════ */}
      <section className="py-24 md:py-32" ref={experienceRef}>
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-16 md:gap-20 items-start">
            {/* Left — Title */}
            <div className="reveal-on-scroll">
              <div className="w-12 h-[2px] bg-bamboo-400 mb-6" />
              <h2 className="font-display text-4xl md:text-5xl font-bold text-forest-800 leading-tight mb-5">
                ประสบการณ์
                <br />
                ที่แตกต่าง
              </h2>
              <p className="text-charcoal-400 text-lg leading-relaxed max-w-md">
                ที่{resortInfo.name || "สวนวลัยรุกขเวช"}{" "}
                เราออกแบบทุกประสบการณ์เพื่อให้คุณได้พักผ่อนอย่างแท้จริง
              </p>
            </div>

            {/* Right — Features as editorial list */}
            <div className="space-y-8">
              {[
                {
                  icon: <Waves className="text-lagoon-500" size={22} />,
                  title: "ที่พักลอยน้ำ",
                  desc: "ห้องพักสไตล์ไทยสุดชิล ลอยอยู่กลางน้ำ วิว 360 องศา บรรยากาศธรรมชาติแท้ๆ",
                },
                {
                  icon: <Anchor className="text-forest-600" size={22} />,
                  title: "เรือคายัค",
                  desc: "สำรวจธรรมชาติด้วยเรือคายัค มีทั้งแบบเดี่ยว คู่ และครอบครัว เหมาะสำหรับทุกวัย",
                },
                {
                  icon: <CreditCard className="text-bamboo-500" size={22} />,
                  title: "ชำระเงินง่าย",
                  desc: "ชำระเงินผ่าน QR Code PromptPay ได้เลยทันที สะดวก รวดเร็ว ปลอดภัย",
                },
              ].map((f, i) => (
                <div
                  key={i}
                  className={`reveal-on-scroll stagger-${i + 1} flex gap-5 group`}
                >
                  <div className="flex-shrink-0 w-[3px] bg-bamboo-400/40 group-hover:bg-bamboo-400 transition-colors duration-300 rounded-full" />
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      {f.icon}
                      <h3 className="font-display text-xl font-semibold text-charcoal">
                        {f.title}
                      </h3>
                    </div>
                    <p className="text-charcoal-400 leading-relaxed">
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════
          ROOM TYPES
          ═══════════════════════════════ */}
      <section
        className="py-24 md:py-32"
        style={{ borderTop: "1px solid var(--color-stone-200)" }}
        ref={roomsRef}
      >
        <div className="container mx-auto px-4">
          <div className="reveal-on-scroll mb-14">
            <div className="w-12 h-[2px] bg-bamboo-400 mb-6" />
            <h2 className="font-display text-4xl md:text-5xl font-bold text-forest-800 leading-tight mb-3">
              ประเภทห้องพัก
            </h2>
            <p className="text-charcoal-400 text-lg">เลือกห้องที่เหมาะกับคุณ</p>
          </div>

          {/* Editorial grid — 1 large + 3 small */}
          <div className="grid md:grid-cols-2 lg:grid-cols-12 gap-6">
            {loadingRooms ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`${getRoomGridSpan(i)} min-h-[180px] rounded-2xl animate-pulse bg-stone-200/60`}
                />
              ))
            ) : featuredRooms.length > 0 ? (
              featuredRooms.map((room, i) => (
                <div
                  key={room.id}
                  className={`reveal-on-scroll stagger-${i + 1} ${getRoomGridSpan(i)} group`}
                >
                  <div
                    className={`h-full rounded-2xl overflow-hidden flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 ${
                      i === 0 ? "min-h-[320px]" : "min-h-[180px]"
                    }`}
                    style={{
                      border: "1px solid var(--color-stone-200)",
                      backgroundColor: "var(--color-cream)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "#D9A05B";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "var(--color-stone-200)";
                    }}
                  >
                    {room.main_image && (
                      <div
                        className={`relative overflow-hidden ${i === 0 ? "h-40" : "h-28"}`}
                      >
                        <img
                          src={resolveMediaUrl(room.main_image)}
                          alt={room.room_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    )}
                    <div className="p-8 flex flex-col justify-between flex-1">
                      <div>
                        <h3 className="font-display text-2xl font-semibold text-forest-800 mb-1">
                          {room.room_name}
                        </h3>
                        <p className="text-charcoal-400 text-sm">
                          {room.type_name} · รองรับ {room.capacity} คน
                        </p>
                        {room.description && (
                          <p className="text-charcoal-400 text-sm mt-2 line-clamp-2">
                            {room.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-end justify-between mt-6">
                        <div>
                          <span className="font-display text-3xl font-bold text-bamboo-500">
                            ฿{formatPrice(room.price_per_night)}
                          </span>
                          <span className="text-charcoal-400 text-sm ml-1">
                            /คืน
                          </span>
                        </div>
                        <Link
                          href={`/rooms/${room.id}`}
                          className="text-sm font-semibold text-forest-800 hover:text-bamboo-500 flex items-center gap-1 transition-colors duration-200"
                        >
                          จองเลย <ArrowRight size={14} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="lg:col-span-12 text-center py-12 text-charcoal-400">
                ยังไม่มีประเภทห้องพักที่เปิดให้บริการ
              </div>
            )}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/rooms"
              className="btn-outline inline-flex items-center gap-2"
            >
              ดูห้องพักทั้งหมด <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════
          TESTIMONIALS
          ═══════════════════════════════ */}
      <section
        className="py-24 md:py-32"
        style={{ borderTop: "1px solid var(--color-stone-200)" }}
        ref={testimonialsRef}
      >
        <div className="container mx-auto px-4">
          <div className="reveal-on-scroll text-center mb-16">
            <div className="w-12 h-[2px] bg-bamboo-400 mx-auto mb-6" />
            <h2 className="font-display text-4xl md:text-5xl font-bold text-forest-800">
              เสียงจากแขกของเรา
            </h2>
          </div>
          <div className="reveal-on-scroll stagger-2">
            {loadingReviews ? (
              <div className="max-w-2xl mx-auto py-12">
                <div className="h-6 w-48 bg-stone-200/70 rounded mx-auto mb-4 animate-pulse" />
                <div className="h-20 bg-stone-200/60 rounded animate-pulse" />
              </div>
            ) : (
              <ReviewCarousel reviews={reviews} />
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════
          LOCATION
          ═══════════════════════════════ */}
      <section
        className="py-24 md:py-32"
        style={{ borderTop: "1px solid var(--color-stone-200)" }}
        ref={locationRef}
      >
        <div className="container mx-auto px-4">
          <div className="reveal-on-scroll mb-12">
            <div className="w-12 h-[2px] bg-bamboo-400 mb-6" />
            <h2 className="font-display text-4xl md:text-5xl font-bold text-forest-800 mb-3">
              ที่ตั้งของเรา
            </h2>
            <p className="text-charcoal-400 text-lg max-w-xl">
              มาเยือนวลัย ที่พักลอยน้ำท่ามกลางธรรมชาติ
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-start max-w-5xl">
            <div className="space-y-6 reveal-on-scroll stagger-1">
              {/* Address */}
              <div className="flex items-start gap-3">
                <MapPin size={18} className="text-bamboo-500 mt-1 shrink-0" />
                <div>
                  <p className="font-display font-semibold text-forest-800 mb-0.5">
                    ที่อยู่
                  </p>
                  <p className="text-charcoal-400 text-sm leading-relaxed">
                    {resortInfo.address ||
                      "สวนวลัยรุกขเวช สถาบันวิจัยวลัยรุกขเวช มหาวิทยาลัยมหาสารคาม จ.มหาสารคาม ประเทศไทย"}
                  </p>
                </div>
              </div>
              {/* Phone */}
              <div className="flex items-start gap-3">
                <Phone size={18} className="text-bamboo-500 mt-1 shrink-0" />
                <div>
                  <p className="font-display font-semibold text-forest-800 mb-0.5">
                    ติดต่อ
                  </p>
                  <p className="text-charcoal-400 text-sm">
                    {resortInfo.phone && `โทร: ${resortInfo.phone}`}
                    {resortInfo.phone && resortInfo.line_id && <br />}
                    {resortInfo.line_id && `Line: ${resortInfo.line_id}`}
                    {!resortInfo.phone && !resortInfo.line_id && (
                      <>
                        โทร: 08x-xxx-xxxx
                        <br />
                        Line: @walai
                      </>
                    )}
                  </p>
                </div>
              </div>
              {/* Hours */}
              <div className="flex items-start gap-3">
                <Waves size={18} className="text-bamboo-500 mt-1 shrink-0" />
                <div>
                  <p className="font-display font-semibold text-forest-800 mb-0.5">
                    เวลาเปิด-ปิด
                  </p>
                  <p className="text-charcoal-400 text-sm">
                    {resortInfo.operating_days && resortInfo.operating_hours
                      ? `${resortInfo.operating_days} ${resortInfo.operating_hours}`
                      : "เปิดทุกวัน 08:00 – 20:00 น."}
                  </p>
                </div>
              </div>
            </div>

            {/* Map */}
            <div
              className="reveal-on-scroll stagger-2 rounded-2xl overflow-hidden h-72 md:h-80"
              style={{ border: "1px solid var(--color-stone-200)" }}
            >
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

      {/* ═══════════════════════════════
          CTA SECTION
          ═══════════════════════════════ */}
      <section
        className="relative py-24 md:py-32 bg-forest-800 text-cream-100 overflow-hidden"
        ref={ctaRef}
      >
        {/* Organic pattern overlay */}
        <LeafPattern className="absolute top-[-40px] right-[-40px] text-cream-100 opacity-20 scale-75" />
        <LeafPattern className="absolute bottom-[-60px] left-[-60px] text-bamboo-400 opacity-10 scale-50 rotate-180" />

        <div className="relative container mx-auto px-4 text-center">
          <div className="reveal-on-scroll">
            <div className="w-12 h-[2px] bg-bamboo-400 mx-auto mb-6" />
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
              พร้อมที่จะมาพักแล้วหรือยัง?
            </h2>
            <p className="text-xl text-cream-300 mb-10 max-w-xl mx-auto leading-relaxed">
              จองห้องพักและกิจกรรมผ่านระบบออนไลน์ได้เลย ง่าย สะดวก รวดเร็ว
            </p>
          </div>
          <div className="reveal-on-scroll stagger-2 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center gap-2 bg-bamboo-400 text-forest-900 font-semibold px-8 py-4 rounded-xl hover:bg-bamboo-300 active:scale-[0.97] transition-all duration-200"
            >
              สมัครสมาชิก <ArrowRight size={18} />
            </Link>
            <Link
              href="/rooms"
              className="inline-flex items-center justify-center gap-2 border-2 border-cream-100/30 text-cream-100 font-semibold px-8 py-4 rounded-xl hover:bg-cream-100/10 active:scale-[0.97] transition-all duration-200"
            >
              ดูห้องพัก
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
