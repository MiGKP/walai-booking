"use client";

import { useState, useEffect, useRef, useId } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { ArrowRight, Anchor, Calendar, CreditCard, Star, MapPin, Phone, Waves, Facebook, Compass, ConciergeBell, ShieldCheck, Languages, Sparkles, Users } from 'lucide-react';
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
   River Ripple Background (For Rooms Section)
   ——————————————————————————————— */
function RippleBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden mix-blend-multiply">
      {/* Top Left Ripple */}
      <div 
        className="absolute w-[150vw] h-[150vw] md:w-[100vw] md:h-[100vw] rounded-full left-[-30vw] top-[-30vw] md:left-[-10vw] md:top-[-20vw]"
        style={{
          background: 'repeating-radial-gradient(circle at center, transparent 0, transparent 45px, rgba(18, 60, 48, 0.03) 45px, rgba(18, 60, 48, 0.03) 46px)'
        }}
      />
      {/* Bottom Right Ripple */}
      <div 
        className="absolute w-[150vw] h-[150vw] md:w-[120vw] md:h-[120vw] rounded-full right-[-50vw] bottom-[-20vw] md:right-[-20vw] md:bottom-[-40vw]"
        style={{
          background: 'repeating-radial-gradient(circle at center, transparent 0, transparent 60px, rgba(199, 169, 119, 0.035) 60px, rgba(199, 169, 119, 0.035) 61px)'
        }}
      />
    </div>
  );
}

/* ———————————————————————————————
   Room card — Zig-Zag Editorial treatment (For exactly 2 rooms).
   ——————————————————————————————— */
function EditorialRoomCard({ room, index }: { room: LandingRoomType, index: number }) {
  const isEven = index % 2 === 0;
  return (
    <Link href={`/rooms/${room.id}`} className="group flex flex-col md:flex-row items-center gap-8 md:gap-16 py-12 md:py-16 border-b border-stone-200/50 last:border-0">
      {/* Image Side */}
      <div className={`w-full md:w-1/2 ${isEven ? 'md:order-1' : 'md:order-2'}`}>
        <div className="relative aspect-[4/3] w-full rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_-15px_rgba(18,60,48,0.2)] transition-transform duration-700 group-hover:scale-[1.03]">
          {room.main_image ? (
            <Image 
              src={resolveMediaUrl(room.main_image)} 
              alt={room.room_name} 
              fill 
              sizes="(max-width: 768px) 100vw, 50vw" 
              className="object-cover transition-transform duration-[10s] group-hover:scale-110" 
            />
          ) : (
            <div className="w-full h-full bg-stone-200 absolute inset-0 flex items-center justify-center text-stone-400">ไม่มีรูปภาพ</div>
          )}
        </div>
      </div>
      
      {/* Text Side */}
      <div className={`w-full md:w-1/2 ${isEven ? 'md:order-2' : 'md:order-1'} space-y-5 md:px-6`}>
         {room.type_name?.toLowerCase() !== room.room_name?.toLowerCase() && (
           <span className="text-sm font-semibold tracking-wider text-bamboo-600 uppercase block">{room.type_name}</span>
         )}
         <h3 className="font-display text-3xl md:text-5xl font-bold text-forest-900 leading-tight group-hover:text-bamboo-700 transition-colors duration-300">
           {room.room_name}
         </h3>
         <p className="text-charcoal-500 text-base md:text-lg font-light leading-relaxed">
           {room.description || "สัมผัสประสบการณ์การพักผ่อนริมน้ำสุดพิเศษ ท่ามกลางธรรมชาติที่เงียบสงบ พร้อมสิ่งอำนวยความสะดวกครบครันให้คุณได้พักผ่อนอย่างเต็มที่..."}
         </p>
         <div className="pt-8 mt-8 border-t border-stone-200/60 flex items-end justify-between">
            <div>
              <span className="text-sm text-charcoal-400">เริ่มต้น</span>
              <div className="font-display font-bold text-3xl text-forest-900 leading-none mt-1">
                ฿{formatPrice(room.price_per_night)}
                <span className="text-sm font-normal text-charcoal-400"> /คืน</span>
              </div>
            </div>
            <div className="flex items-center gap-3 md:gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-forest-800 bg-forest-50 px-4 py-2.5 rounded-full">
                <Users size={16} /> พักได้ {room.capacity} ท่าน
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white bg-forest-900 px-6 py-2.5 rounded-full group-hover:bg-bamboo-600 transition-colors duration-300 shadow-lg shadow-forest-900/20 group-hover:shadow-bamboo-600/30">
                ดูรายละเอียด <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
         </div>
      </div>
    </Link>
  );
}

/* ———————————————————————————————
   Room card — Floating Glass treatment.
   ——————————————————————————————— */
function RoomCard({ room, large = false, className = "" }: { room: LandingRoomType; large?: boolean; className?: string }) {
  return (
    <Link
      href={`/rooms/${room.id}`}
      className={`group block relative pb-16 md:pb-20 ${className}`}
    >
      {/* Image Container (Floating) */}
      <div className={`relative w-full rounded-[2.5rem] overflow-hidden shadow-[0_20px_60px_-15px_rgba(18,60,48,0.2)] transition-transform duration-700 group-hover:scale-[1.02] ${
        large ? "h-[360px] md:h-[420px]" : "h-[240px] md:h-[280px]"
      }`}>
        {room.main_image ? (
          <Image
            src={resolveMediaUrl(room.main_image)}
            alt={room.room_name}
            fill
            sizes={large ? "(max-width: 1024px) 100vw, 60vw" : "(max-width: 1024px) 100vw, 30vw"}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[10s] group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 bg-stone-200 flex items-center justify-center text-stone-500 text-sm">
            ไม่มีรูปภาพ
          </div>
        )}
      </div>

      {/* Floating Glass Text Box (Overlap) */}
      <div className="absolute -bottom-2 left-4 right-4 md:-bottom-4 md:left-8 md:right-8 bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)] rounded-[2rem] p-6 md:p-8 transition-transform duration-700 group-hover:-translate-y-4">
        {room.type_name?.toLowerCase() !== room.room_name?.toLowerCase() && (
          <span className="text-xs font-semibold tracking-wider text-bamboo-600 uppercase mb-2 block">{room.type_name}</span>
        )}
        <h3
          className={`font-display font-bold leading-snug text-forest-900 ${
            large ? "text-2xl md:text-3xl" : "text-xl md:text-2xl"
          }`}
        >
          {room.room_name}
        </h3>
        {large && (
          <p className="text-charcoal-500 text-sm mt-3 font-light line-clamp-2">
            {room.description || "สัมผัสประสบการณ์การพักผ่อนริมน้ำสุดพิเศษท่ามกลางธรรมชาติ..."}
          </p>
        )}
        <div className="flex items-end justify-between mt-5 pt-5 border-t border-stone-200/60">
          <div>
            <span className="text-xs text-charcoal-400">เริ่มต้น</span>
            <div className="font-display font-bold text-xl text-forest-900 leading-none mt-1">
              ฿{formatPrice(room.price_per_night)}
              <span className="text-xs font-normal text-charcoal-400"> /คืน</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-forest-800 bg-forest-50 px-3 py-2 rounded-full">
              <Users size={14} />
              {room.capacity} ท่าน
            </div>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-forest-900 text-white group-hover:bg-bamboo-600 transition-colors duration-300">
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ———————————————————————————————
   Review Gallery — Auto-scrolling and draggable, or static if <= 3 reviews
   ——————————————————————————————— */
function ReviewGallery({ reviews }: { reviews: LandingReview[] }) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    if (reviews.length <= 3) return;
    
    const el = galleryRef.current;
    if (!el) return;

    let animationId: number;
    let isPaused = false;
    let accumulatedScroll = 0;
    const speed = 1.0; 
    
    const scroll = () => {
      if (!isPaused) {
        accumulatedScroll += speed;
        if (accumulatedScroll >= 1) {
          el.scrollLeft += Math.floor(accumulatedScroll);
          accumulatedScroll -= Math.floor(accumulatedScroll);
        }
        
        if (el.scrollLeft >= el.scrollWidth / 2) {
          el.scrollLeft -= el.scrollWidth / 2;
        }
      }
      animationId = requestAnimationFrame(scroll);
    };

    animationId = requestAnimationFrame(scroll);

    const handleInteractStart = () => {
      isPaused = true;
      setIsInteracting(true);
    };
    const handleInteractEnd = () => {
      isPaused = false;
      setIsInteracting(false);
    };

    el.addEventListener('mouseenter', handleInteractStart);
    el.addEventListener('mouseleave', handleInteractEnd);
    el.addEventListener('touchstart', handleInteractStart, { passive: true });
    el.addEventListener('touchend', handleInteractEnd);

    return () => {
      cancelAnimationFrame(animationId);
      el.removeEventListener('mouseenter', handleInteractStart);
      el.removeEventListener('mouseleave', handleInteractEnd);
      el.removeEventListener('touchstart', handleInteractStart);
      el.removeEventListener('touchend', handleInteractEnd);
    };
  }, [reviews.length]);

  if (reviews.length === 0) {
    return (
      <div className="text-center text-charcoal-400 py-10 border-y border-stone-200 container mx-auto">
        ยังไม่มีรีวิวจากแขกผู้เข้าพัก — มาเป็นคนแรกที่แชร์ประสบการณ์กับเรา
      </div>
    );
  }

  const ReviewCard = ({ review }: { review: LandingReview }) => (
    <div className="w-[300px] md:w-[400px] bg-white border border-stone-200/60 rounded-3xl p-6 shadow-sm shrink-0 flex flex-col gap-4 text-left">
       <div className="flex gap-0.5" aria-label={`คะแนน ${review.rating} ดาว`}>
          {Array.from({ length: review.rating }).map((_, j) => (
            <Star key={j} size={14} className="fill-bamboo-400 text-bamboo-400" />
          ))}
       </div>
       <p className="font-display text-lg text-forest-800 leading-snug font-medium line-clamp-3">
         "{review.comment}"
       </p>
       <div className="mt-auto pt-4 border-t border-stone-100 flex items-center justify-between">
         <div>
           <span className="font-semibold text-forest-900 text-sm block">
             {getReviewerName(review)}
           </span>
           {(review.room_name || review.type_name) && (
             <span className="text-stone-400 text-xs block mt-0.5">
               {review.room_name || review.type_name}
             </span>
           )}
         </div>
       </div>
    </div>
  );

  if (reviews.length <= 3) {
    return (
      <div className="container mx-auto px-4 mt-8">
        <div className="flex flex-wrap justify-center gap-4 md:gap-6">
          {reviews.map((r, i) => <ReviewCard key={i} review={r} />)}
        </div>
      </div>
    );
  }

  // Ensure enough items to scroll infinitely on large screens
  const safeReviews = [...reviews, ...reviews, ...reviews];

  return (
    <div className="relative overflow-hidden group/gallery mt-8 py-4">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-12 w-16 md:w-48 bg-gradient-to-r from-stone-50 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-12 w-16 md:w-48 bg-gradient-to-l from-stone-50 to-transparent z-10 pointer-events-none" />
      
      {/* Scroll Container */}
      <div 
        ref={galleryRef}
        className="flex overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing"
        style={{ scrollBehavior: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' }}
      >
        {/* Set 1 */}
        <div className="flex gap-4 md:gap-6 px-4 md:px-6 shrink-0">
           {safeReviews.map((r, i) => <ReviewCard key={`set1-${i}`} review={r} />)}
        </div>
        {/* Set 2 (Exact Duplicate) */}
        <div className="flex gap-4 md:gap-6 pr-4 md:pr-6 shrink-0">
           {safeReviews.map((r, i) => <ReviewCard key={`set2-${i}`} review={r} />)}
        </div>
      </div>
      
      {/* Hint Below Gallery */}
      <div className={`mt-6 flex justify-center items-center gap-2 text-stone-400 transition-opacity duration-700 ${isInteracting ? 'opacity-0' : 'opacity-100'}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
          <path d="M17 8l4 4-4 4"></path>
          <path d="M7 8l-4 4 4 4"></path>
          <path d="M3 12h18"></path>
        </svg>
        <span className="font-display font-medium text-sm tracking-wide">เลื่อนเพื่อดูรีวิว</span>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 10s infinite alternate;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}} />
    </div>
  );
}

/* ———————————————————————————————
   Cover Flow Gallery — Apple Music / Card Stack style
   ——————————————————————————————— */
function CoverFlowGallery() {
  const images = [
    '/images/boat.jpg',
    '/images/balcony.jpg',
    '/images/boat.jpg',
    '/images/balcony.jpg',
    '/images/boat.jpg',
    '/images/balcony.jpg'
  ];
  
  const [activeIndex, setActiveIndex] = useState(0);
  const [startX, setStartX] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const next = () => setActiveIndex((p) => (p + 1) % images.length);
  const prev = () => setActiveIndex((p) => (p - 1 + images.length) % images.length);

  // Auto-scroll effect
  useEffect(() => {
    if (isHovered || startX !== null) return;
    const interval = setInterval(next, 3500); // Change image every 3.5s
    return () => clearInterval(interval);
  }, [isHovered, startX]);

  const handleTouchStart = (e: React.TouchEvent) => setStartX(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startX === null) return;
    const diff = startX - e.changedTouches[0].clientX;
    if (diff > 50) next();
    else if (diff < -50) prev();
    setStartX(null);
  };
  
  const handleMouseDown = (e: React.MouseEvent) => setStartX(e.clientX);
  const handleMouseUp = (e: React.MouseEvent) => {
    if (startX === null) return;
    const diff = startX - e.clientX;
    if (diff > 50) next();
    else if (diff < -50) prev();
    setStartX(null);
  };

  return (
    <div 
      className="relative mt-8 group/gallery flex flex-col items-center w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className="w-full max-w-[1200px]" 
        style={{ WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)', maskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)' }}
      >
        <div 
          className="relative h-[420px] md:h-[560px] w-full flex items-center justify-center overflow-hidden touch-pan-y"
          style={{ WebkitMaskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)', maskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setStartX(null)}
        >
          {images.map((src, i) => {
          let offset = i - activeIndex;
          // Handle circular array indexing so cards loop
          const half = Math.floor(images.length / 2);
          if (offset > half) offset -= images.length;
          if (offset < -half) offset += images.length;
          
          const isCenter = offset === 0;
          const absOffset = Math.abs(offset);
          
          // Math for smooth 3D-like stacking
          const scale = isCenter ? 1 : Math.max(0.7, 1 - absOffset * 0.15);
          const translateX = offset * 65; // percentage shift
          const zIndex = 20 - absOffset; // Use 20 instead of 50 to avoid overlapping the z-50 Navbar
          const opacity = absOffset > 2 ? 0 : isCenter ? 1 : 0.8;
          const blur = isCenter ? '0px' : '6px';

          return (
            <div
              key={i}
              onClick={() => {
                if (offset > 0) next();
                if (offset < 0) prev();
              }}
              className="absolute transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
              style={{
                transform: `translateX(${translateX}%) scale(${scale})`,
                zIndex,
                opacity,
                filter: `blur(${blur})`,
                cursor: isCenter ? 'grab' : 'pointer'
              }}
            >
              <div className="relative w-[280px] h-[360px] md:w-[420px] md:h-[500px] rounded-[2.5rem] overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.4)]">
                <img src={src} className="w-full h-full object-cover pointer-events-none select-none" alt="Gallery" />
                {!isCenter && <div className="absolute inset-0 bg-forest-900/20 pointer-events-none" />}
              </div>
            </div>
          );
        })}
        </div>
      </div>
      
      {/* Hint */}
      <div className="mt-2 flex justify-center items-center gap-2 text-stone-400">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
          <path d="M17 8l4 4-4 4"></path>
          <path d="M7 8l-4 4 4 4"></path>
          <path d="M3 12h18"></path>
        </svg>
        <span className="font-display font-medium text-sm tracking-wide">ปัดหรือคลิกเพื่อเลื่อน</span>
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
      title: "ห้องพักกลางสายน้ำ",
      desc: "สัมผัสความเย็นสบายของสายน้ำ เปิดรับทัศนียภาพแบบ 360 องศาจากระเบียงห้องพัก",
    },
    {
      icon: <Anchor className="text-forest-700" size={22} />,
      title: "กิจกรรมเรือพายเรือ",
      desc: "พายเรือออกสำรวจความสมบูรณ์ของระบบนิเวศ เหมาะสำหรับทั้งมือใหม่และครอบครัว",
    },
    {
      icon: <Compass className="text-bamboo-600" size={22} />,
      title: "เงียบสงบ",
      desc: "โอบล้อมด้วยแมกไม้และธรรมชาติอันบริสุทธิ์ ให้คุณได้สูดอากาศสดชื่นเต็มปอด",
    },
    {
      icon: <ShieldCheck className="text-amber-600" size={22} />,
      title: "ปลอดภัย มั่นใจได้",
      desc: "ระบบจองห้องพักออนไลน์ ที่ดูแลและตรวจสอบการชำระเงินทุกรายการด้วยทีมงานโดยตรง",
    },
  ];

  return (
    <div className="bg-cream-100 text-charcoal min-h-screen overflow-x-hidden">
      {/* ═══════════════════════════════
          1. HERO SECTION
          ═══════════════════════════════ */}
      <section className="relative min-h-[90vh] flex flex-col justify-center pt-32 pb-24 overflow-hidden bg-cream-100">
        <div className="relative container mx-auto px-4 z-10 w-full">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left: Floating text content */}
            <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left">
              
              <h1 className="font-display text-5xl md:text-6xl lg:text-6xl xl:text-[5rem] font-bold leading-[1.05] tracking-tight mb-8 whitespace-nowrap">
                {resortInfo.name && resortInfo.name !== 'สวนวลัยรุกขเวช' ? (
                  <span className="inline-block animate-reveal-up opacity-0 bg-clip-text text-transparent bg-gradient-to-br from-forest-950 via-forest-800 to-bamboo-800" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
                    {resortInfo.name}
                  </span>
                ) : (
                  <span className="inline-flex flex-wrap overflow-hidden pb-4 -mb-4 bg-clip-text text-transparent bg-gradient-to-br from-forest-950 via-forest-800 to-bamboo-800">
                    {["ส", "ว", "น", "ว", "ลัย", "รุก", "ข", "เวช"].map((syllable, index) => (
                      <span 
                        key={index} 
                        className="inline-block animate-reveal-up opacity-0" 
                        style={{ 
                          animationDelay: `${150 + index * 60}ms`,
                          animationFillMode: 'forwards',
                          transform: 'translateY(100%)'
                        }}
                      >
                        {syllable}
                      </span>
                    ))}
                  </span>
                )}
              </h1>

              <p 
                className="text-lg md:text-xl text-charcoal-500 leading-relaxed max-w-xl mb-12 animate-reveal-up font-medium" 
                style={{ animationDelay: '200ms' }}
              >
                ทิ้งความวุ่นวายไว้ข้างหลัง แล้วมาเอนกายพักใจรับลมเย็นๆ กลางผืนน้ำ ให้เสียงธรรมชาติช่วยเยียวยาความเหนื่อยล้า และชาร์จพลังให้คุณ
              </p>

              <div 
                className="flex flex-col sm:flex-row items-center gap-4 animate-reveal-up w-full sm:w-auto mb-10 lg:mb-0" 
                style={{ animationDelay: '300ms' }}
              >
                <Link
                  href="/rooms"
                  className="group relative inline-flex items-center justify-center gap-3 bg-forest-900 text-cream-100 font-medium px-8 py-4 rounded-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-forest-900/20 active:scale-[0.98] w-full sm:w-auto"
                >
                  <span className="relative flex items-center gap-2">
                    <Calendar size={18} />
                    จองห้องพัก
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
                
                <Link
                  href="/kayaks"
                  className="inline-flex items-center justify-center gap-3 font-medium px-8 py-4 rounded-full bg-transparent text-forest-900 border-2 border-forest-900/20 hover:border-forest-900/50 hover:bg-forest-50 active:scale-[0.98] transition-all duration-300 w-full sm:w-auto"
                >
                  <Anchor size={18} />
                  บริการเรือคายัค
                </Link>
              </div>
            </div>

            {/* Right: Huge Playful Bento Cluster */}
            <div 
              className="lg:col-span-7 relative w-full h-[400px] sm:h-[500px] lg:h-[600px] animate-reveal-up mt-10 lg:mt-0" 
              style={{ animationDelay: '400ms' }}
            >
              {/* Main Hero Image */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[90%] md:w-[85%] h-full md:h-[90%] rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-[0_20px_50px_rgba(18,60,48,0.15)] z-10 group">
                <img 
                  src="/images/boat.jpg"
                  alt="Walai Resort Kayak"
                  className="w-full h-full object-cover transition-transform duration-[20s] group-hover:scale-105"
                />
              </div>

              {/* Floating Accents (Rotated) */}
              <div className="absolute left-[0%] md:left-[2%] top-[5%] md:top-[8%] w-[45%] md:w-[35%] h-[45%] md:h-[45%] rounded-[1.5rem] md:rounded-[2rem] overflow-hidden shadow-2xl shadow-forest-900/20 z-20 border-[8px] border-cream-100 hidden sm:block -rotate-6 group hover:rotate-0 transition-all duration-500 hover:scale-105 cursor-pointer origin-bottom-right">
                <img 
                  src="/images/balcony.jpg"
                  alt="Resort Balcony"
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="absolute left-[5%] md:left-[8%] bottom-[5%] md:bottom-[8%] w-[40%] md:w-[30%] h-[35%] md:h-[35%] rounded-[1.5rem] md:rounded-[2rem] overflow-hidden shadow-2xl shadow-forest-900/20 z-20 border-[8px] border-cream-100 hidden sm:block rotate-6 group hover:rotate-0 transition-all duration-500 hover:scale-105 cursor-pointer origin-top-right">
                <img 
                  src="/images/balcony.jpg" 
                  alt="Relaxing View"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>

        <ScrollMouseIndicator targetId="gallery-section" />
      </section>

      {/* ═══════════════════════════════
          2. GALLERY 
          ═══════════════════════════════ */}
      <section id="gallery-section" className="pt-20 pb-16 md:pt-32 md:pb-32 overflow-hidden relative bg-[#FDFCF7]">
        {/* Decorative Topographic / Ripple Pattern matching the Vibe */}
        <div className="absolute inset-0 pointer-events-none z-0 mix-blend-multiply overflow-hidden">
          <div 
            className="absolute w-[150vw] h-[150vw] md:w-[100vw] md:h-[100vw] rounded-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              background: 'repeating-radial-gradient(circle at center, transparent 0, transparent 60px, rgba(18, 60, 48, 0.03) 60px, rgba(18, 60, 48, 0.03) 61px)'
            }}
          />
          <div 
            className="absolute w-[150vw] h-[150vw] md:w-[120vw] md:h-[120vw] rounded-full left-[20%] top-[80%] -translate-x-1/2 -translate-y-1/2"
            style={{
              background: 'repeating-radial-gradient(circle at center, transparent 0, transparent 80px, rgba(199, 169, 119, 0.02) 80px, rgba(199, 169, 119, 0.02) 81px)'
            }}
          />
        </div>

        <div className="container mx-auto px-4 mb-10 md:mb-14 text-center relative z-10">
          <span className="text-forest-600/80 font-semibold tracking-widest text-sm uppercase mb-3 block">Gallery</span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-forest-900">
            บรรยากาศรอบสวนวลัยรุกขเวช
          </h2>
        </div>

        {/* Gallery */}
        <div className="relative z-10 mb-16 md:mb-24">
          <CoverFlowGallery />
        </div>

        {/* Features: editorial layout matching Facilities section */}
        <article className="container mx-auto px-4 md:px-6 relative z-10" ref={experienceRef}>
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Left: sticky label + heading */}
            <div className="lg:col-span-4 lg:sticky lg:top-32">
              <p className="text-forest-700 font-medium text-sm tracking-widest uppercase mb-3">Why Walai</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-forest-800 leading-tight">
                ทำไมต้อง<br />วลัยรุกขเวช
              </h2>
              <p className="text-charcoal-500 text-lg leading-relaxed font-light mt-5">
                ประสบการณ์พักผ่อนที่คุณจะไม่ลืม ท่ามกลางธรรมชาติอีสานที่เงียบสงบ พร้อมบริการที่ใส่ใจทุกรายละเอียด
              </p>
            </div>

            {/* Right: feature rows */}
            <div className="lg:col-span-8 flex flex-col">
              {features.map((item, idx) => (
                <div 
                  key={idx} 
                  className={`group flex flex-col sm:flex-row gap-6 py-8 md:py-10 ${idx !== features.length - 1 ? 'border-b border-stone-200/60' : ''}`}
                >
                  <div className="sm:w-1/3 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="text-bamboo-600 group-hover:text-forest-700 transition-colors duration-300">
                        {item.icon}
                      </div>
                      <h3 className="font-display text-xl font-semibold text-forest-900">{item.title}</h3>
                    </div>
                  </div>
                  <div className="sm:w-2/3">
                    <p className="text-charcoal-500 text-base leading-relaxed font-light">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      {/* ═══════════════════════════════
          3. ROOM TYPES SECTION
          ═══════════════════════════════ */}
      <section className="pt-8 pb-24 relative overflow-hidden bg-cream-50/50" ref={roomsRef}>
        <RippleBackground />
        
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <div>
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
            <div className="grid md:grid-cols-2 gap-5 md:gap-6">
              <div className="h-[380px] md:h-[480px] rounded-2xl bg-stone-200 animate-pulse" />
              <div className="h-[380px] md:h-[480px] rounded-2xl bg-stone-200 animate-pulse" />
            </div>
          ) : (
            <div className={`grid gap-5 md:gap-6 ${
              roomTypes.length === 1 ? 'md:grid-cols-1 max-w-4xl mx-auto' : 
              roomTypes.length === 2 ? 'grid-cols-1 gap-12' : 
              'lg:grid-cols-5'
            }`}>
              {roomTypes.length === 2 ? (
                // 2 rooms: Zig-Zag Editorial layout
                <div className="flex flex-col">
                  {roomTypes.map((room, index) => (
                    <EditorialRoomCard key={room.id} room={room} index={index} />
                  ))}
                </div>
              ) : roomTypes.length === 1 ? (
                // 1 room: Full width Floating Glass
                roomTypes.map((room) => (
                  <div key={room.id} className="w-full">
                    <RoomCard room={room} large className="md:!h-[520px]" />
                  </div>
                ))
              ) : (
                // 3 or more rooms: Magazine asymmetric layout
                <>
                  {featured && (
                    <div className="lg:col-span-3">
                      <RoomCard room={featured} large />
                    </div>
                  )}
                  {secondary.length > 0 && (
                    <div className="lg:col-span-2 grid gap-5 md:gap-6">
                      {secondary.map((room) => (
                        <RoomCard key={room.id} room={room} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
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
          5. TESTIMONIALS / REVIEWS SECTION
          ═══════════════════════════════ */}
      <section id="testimonials-section" className="min-h-[80vh] md:min-h-screen flex flex-col justify-center py-16 md:py-24 relative overflow-hidden" ref={testimonialsRef}>
        {/* Pastel Blurred Background Orbs */}
        <div className="absolute top-10 left-1/4 w-96 h-96 bg-bamboo-200/40 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-blob pointer-events-none" />
        <div className="absolute top-10 right-1/4 w-96 h-96 bg-lagoon-200/40 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-blob animation-delay-2000 pointer-events-none" />
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-cream-300/40 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-blob animation-delay-4000 pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-12 md:mb-16">
            <span className="text-bamboo-600 font-semibold tracking-widest text-sm uppercase mb-3 block">Guest Experiences</span>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-forest-900">
              บันทึกความทรงจำ ณ สวนวลัยรุกขเวช
            </h2>
          </div>
        </div>
        <div className="relative z-10">
          <ReviewGallery reviews={reviews} />
        </div>
      </section>

      {/* ═══════════════════════════════
          6. LOCATION & MAP SECTION
          ═══════════════════════════════ */}
      <section className="bg-stone-50" ref={locationRef}>
        <WaveDivider className="text-[#FDFCF7]" />
        <div className="container mx-auto px-4 md:px-6 py-16">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5 space-y-6">
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

            <div className="lg:col-span-7 h-80 md:h-[420px] rounded-2xl overflow-hidden border border-stone-200 relative shadow-sm">
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
