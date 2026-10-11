"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

export interface GuestAgePolicy {
  infantAge: number;
  adultMinAge: number;
  childMaxAge: number;
  adultHint: string;
  childHint: string;
  infantPolicyText: string;
  kidsPolicyRaw: string | null;
  childChargePolicyTitle: string;
  childChargePolicyDetail: string;
  childChargePricePerNight: number | null;
}

export function parseGuestAgePolicy(
  kidsPolicy?: string | null,
  infantMaxAgeExclusive?: number | string | null
): GuestAgePolicy {
  const infantAge = (() => {
    const v = Number(infantMaxAgeExclusive);
    return Number.isInteger(v) && v >= 0 && v <= 18 ? v : 6;
  })();

  let adultMinAge = 12;
  let childMaxAge = 11;
  let childChargePolicyTitle = `เด็ก ${infantAge}-${childMaxAge} ปี`;
  let childChargePolicyDetail = "คิดราคาเด็ก / เตียงเสริม";
  let childChargePricePerNight: number | null = null;

  if (kidsPolicy && typeof kidsPolicy === "string") {
    const lines = kidsPolicy
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    let foundPlusAge: number | null = null;
    let maxRangeAge: number | null = null;

    for (const line of lines) {
      const parts = line.split(":");
      const title = parts[0]?.trim() || "";
      const detail = parts.slice(1).join(":").trim();

      // ตรวจหาแบบระบุอายุขึ้นไป เช่น "18 ปีขึ้นไป" หรือ "เด็ก 12 ปีขึ้นไป"
      const plusMatch = title.match(/(\d+)\s*ปี\s*ขึ้นไป/);
      if (plusMatch) {
        const p = parseInt(plusMatch[1], 10);
        if (Number.isInteger(p) && p >= 1 && p <= 25) {
          foundPlusAge = p;
        }
      }

      // ตรวจหาแบบช่วงอายุ เช่น "เด็ก 0-5 ปี" หรือ "เด็ก 6-17 ปี"
      const rangeMatch = title.match(
        /(?:เด็ก\s*)?(\d+)\s*(?:-|–|ถึง)\s*(\d+)\s*ปี/
      );
      if (rangeMatch) {
        const min = parseInt(rangeMatch[1], 10);
        const max = parseInt(rangeMatch[2], 10);
        if (Number.isInteger(max) && max >= 0 && max <= 25) {
          if (maxRangeAge === null || max > maxRangeAge) {
            maxRangeAge = max;
          }
        }
        // ตรวจหาบรรทัดที่เกี่ยวกับเด็กที่ต้องคิดค่าบริการ (min >= infantAge หรือมีคำว่า เตียงเสริม / คิดราคา)
        if (min >= infantAge || detail.includes("เตียงเสริม") || detail.includes("คิดราคา")) {
          childChargePolicyTitle = title;
          if (detail) {
            childChargePolicyDetail = detail;
            // ดึงราคาถ้ามี เช่น "500 บาท", "300.-", "฿500", "500/คืน"
            const priceMatch = detail.match(/(?:฿|\b)(\d{2,5})\s*(?:บาท|.-|บ\.|\/คืน)?/);
            if (priceMatch) {
              const parsed = parseInt(priceMatch[1], 10);
              if (parsed >= 50 && parsed <= 10000) {
                childChargePricePerNight = parsed;
              }
            }
          }
        }
      }
    }

    if (foundPlusAge !== null) {
      adultMinAge = foundPlusAge;
      childMaxAge = Math.max(0, adultMinAge - 1);
    } else if (maxRangeAge !== null) {
      childMaxAge = maxRangeAge;
      adultMinAge = childMaxAge + 1;
    }
  }

  return {
    infantAge,
    adultMinAge,
    childMaxAge,
    adultHint: `อายุ ${adultMinAge} ปีขึ้นไป`,
    childHint: `อายุ 0–${childMaxAge} ปี`,
    infantPolicyText:
      infantAge === 0
        ? "เด็กทุกอายุนับรวมในความจุห้อง"
        : `เด็กอายุต่ำกว่า ${infantAge} ปี เข้าพักฟรีและไม่นับความจุห้อง`,
    kidsPolicyRaw: kidsPolicy || null,
    childChargePolicyTitle,
    childChargePolicyDetail,
    childChargePricePerNight,
  };
}

export function useGuestAgePolicy(): GuestAgePolicy {
  const [policy, setPolicy] = useState<GuestAgePolicy>(() =>
    parseGuestAgePolicy(null, 6)
  );

  useEffect(() => {
    let active = true;
    api
      .get("/settings/resort")
      .then(({ data }) => {
        if (!active) return;
        const rows = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
          ? data
          : [];
        const mainInfo =
          rows.find((r: { id?: number }) => r.id === 3) || rows[0] || {};
        const roomInfo =
          rows.find((r: { id?: number }) => r.id === 4) ||
          rows.find((r: { name?: string }) =>
            String(r.name || "").includes("ห้อง")
          ) ||
          {};

        const infantVal =
          roomInfo.infant_max_age_exclusive ?? mainInfo.infant_max_age_exclusive;
        const kidsPolicy = roomInfo.kids_policy ?? mainInfo.kids_policy;

        setPolicy(parseGuestAgePolicy(kidsPolicy, infantVal));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  return policy;
}

export function useInfantAgePolicy(): number {
  return useGuestAgePolicy().infantAge;
}
