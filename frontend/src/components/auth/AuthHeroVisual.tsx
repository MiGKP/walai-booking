"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BedDouble, Compass, Waves } from "lucide-react";

export interface HeroScene {
  id: string;
  src: string;
  title: string;
  subtitle: string;
  alt: string;
  icon: "room" | "kayak" | "balcony";
}

const HERO_SCENES: HeroScene[] = [
  {
    id: "room",
    src: "/images/room.jpg",
    title: "ห้องพักแพริมน้ำ",
    subtitle: "นอนชมวิวผืนน้ำและแสงอาทิตย์อัสดง สัมผัสความผ่อนคลายอย่างแท้จริง",
    alt: "ห้องพักแพลอยน้ำ วิวพระอาทิตย์ตก วลัยรุกขเวช",
    icon: "room",
  },
  {
    id: "boat",
    src: "/images/boat.jpg",
    title: "พายเรือคายัคใส",
    subtitle: "สัมผัสสายน้ำใสและธรรมชาติอันเงียบสงบในบรรยากาศยามเย็น",
    alt: "พายเรือคายัคใส สวนวลัยรุกขเวช มหาสารคาม",
    icon: "kayak",
  },
  {
    id: "balcony",
    src: "/images/balcony.jpg",
    title: "ชานระเบียงริมน้ำ",
    subtitle: "ทอดสายตารับลมธรรมชาติบนแพไม้ส่วนตัวริมผืนน้ำอันกว้างใหญ่",
    alt: "ระเบียงที่พักแพริมน้ำ วลัยรุกขเวช",
    icon: "balcony",
  },
];

interface AuthHeroVisualProps {
  mode?: "login" | "register";
  headingOverride?: string;
  subheadingOverride?: string;
}

// แสดงภาพสไลด์บรรยากาศรีสอร์ทพร้อมข้อความต้อนรับในหน้าเข้าสู่ระบบและสมัครสมาชิก
export default function AuthHeroVisual({
  mode = "login",
  headingOverride,
  subheadingOverride,
}: AuthHeroVisualProps): React.ReactElement {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setActiveIdx((current) => (current + 1) % HERO_SCENES.length);
    }, 6500);

    return () => clearInterval(timer);
  }, [isPaused]);

  const defaultHeading =
    mode === "login" ? (
      <>
        กลับมาพักใจ
        <br />
        กลางสายน้ำ
      </>
    ) : (
      <>
        เริ่มต้นทริปแรก
        <br />
        ริมสายน้ำ
      </>
    );

  const defaultSubheading =
    mode === "login"
      ? "จัดการการจองที่พักลอยน้ำและเรือของคุณ ในบรรยากาศธรรมชาติของวลัยรุกขเวช"
      : "สมัครสมาชิกเพื่อจองที่พักลอยน้ำและเรือ พร้อมติดตามสถานะการจองได้ทุกที่";

  return (
    <section
      className="relative flex min-h-[360px] flex-col justify-between overflow-hidden bg-forest-950 sm:min-h-[440px] lg:min-h-0"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="ทัศนียภาพวลัยรุกขเวช"
    >
      <div className="absolute inset-0 z-0">
        {HERO_SCENES.map((scene, index) => {
          const isActive = index === activeIdx;
          return (
            <div
              key={scene.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                isActive ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <Image
                src={scene.src}
                alt={scene.alt}
                fill
                priority={index === 0}
                sizes="(max-width: 1024px) 100vw, 55vw"
                className={`object-cover transition-transform duration-[7000ms] ease-out ${
                  isActive ? "scale-105" : "scale-100"
                } ${
                  scene.id === "room"
                    ? "object-[center_35%]"
                    : scene.id === "balcony"
                    ? "object-[center_55%]"
                    : "object-center"
                }`}
              />
            </div>
          );
        })}

        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-forest-950/80 via-forest-950/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-forest-950/95 via-forest-900/65 to-transparent" />
        <div className="absolute inset-0 bg-forest-900/15 mix-blend-multiply" />
      </div>

      <div className="relative z-20 flex items-center justify-between p-5 sm:p-7 lg:p-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-forest-950/40 px-4 py-2 text-sm font-medium text-cream-100 shadow-sm backdrop-blur-md transition-colors hover:border-white/40 hover:bg-forest-950/70 focus:outline-none focus:ring-2 focus:ring-bamboo-400"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>กลับหน้าหลัก</span>
        </Link>
      </div>

      <div className="relative z-20 px-6 pb-6 pt-12 sm:px-9 sm:pb-8 lg:px-12 lg:pb-10">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-bamboo-300">
          <span className="h-px w-8 bg-bamboo-400" />
          <span>Walai Booking</span>
        </div>

        <h1 className="max-w-xl text-3xl font-semibold leading-[1.2] text-cream-100 sm:text-4xl lg:text-5xl">
          {headingOverride || defaultHeading}
        </h1>

        <p className="mt-3 max-w-lg text-sm leading-relaxed text-cream-100/85 sm:text-base">
          {subheadingOverride || defaultSubheading}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2 pt-2 sm:gap-2.5">
          {HERO_SCENES.map((scene, idx) => {
            const isSelected = idx === activeIdx;
            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`group flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all duration-200 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-bamboo-400 ${
                  isSelected
                    ? "border border-bamboo-400/80 bg-forest-950/80 text-bamboo-200 shadow-md ring-1 ring-bamboo-400/40"
                    : "border border-white/15 bg-forest-950/40 text-cream-100/70 hover:border-white/30 hover:bg-forest-950/60 hover:text-cream-100"
                }`}
                aria-pressed={isSelected}
                aria-label={`เลือกดูภาพ ${scene.title}`}
              >
                {scene.icon === "room" && (
                  <BedDouble
                    size={14}
                    className={isSelected ? "text-bamboo-300" : "text-cream-100/60"}
                  />
                )}
                {scene.icon === "kayak" && (
                  <Waves
                    size={14}
                    className={isSelected ? "text-bamboo-300" : "text-cream-100/60"}
                  />
                )}
                {scene.icon === "balcony" && (
                  <Compass
                    size={14}
                    className={isSelected ? "text-bamboo-300" : "text-cream-100/60"}
                  />
                )}
                <span>{scene.title}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          {HERO_SCENES.map((_, idx) => (
            <span
              key={idx}
              className={`h-1 rounded-full transition-all duration-300 ${
                idx === activeIdx
                  ? "w-8 bg-bamboo-400"
                  : "w-2 bg-white/30"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
