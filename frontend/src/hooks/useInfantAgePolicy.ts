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
  childChargeMinAge: number | null;
  childChargeMaxAge: number | null;
}

export function parseGuestAgePolicy(
  kidsPolicy?: string | null,
  infantMaxAgeExclusive?: number | string | null
): GuestAgePolicy {
  const infantAge = (() => {
    const v = infantMaxAgeExclusive == null || infantMaxAgeExclusive === "" ? NaN : Number(infantMaxAgeExclusive);
    return Number.isInteger(v) && v >= 0 && v <= 18 ? v : 6;
  })();

  // Match booking validators; free-text policies do not change the API age range.
  const adultMinAge = 12;
  const childMaxAge = 11;
  let childChargePolicyTitle = `เด็ก ${infantAge}-${childMaxAge} ปี`;
  let childChargePolicyDetail = "ค่าบริการเป็นไปตามนโยบายของรีสอร์ต";
  let childChargePricePerNight: number | null = null;
  let childChargeMinAge: number | null = null;
  let childChargeMaxAge: number | null = null;

  if (kidsPolicy && typeof kidsPolicy === "string") {
    const lines = kidsPolicy
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      const parts = line.split(":");
      const title = parts[0]?.trim() || "";
      const detail = parts.slice(1).join(":").trim();

      // ตรวจหาแบบช่วงอายุ เช่น "เด็ก 0-5 ปี" หรือ "เด็ก 6-17 ปี"
      const rangeMatch = title.match(
        /(?:เด็ก\s*)?(\d+)\s*(?:-|–|ถึง)\s*(\d+)\s*ปี/
      );
      if (rangeMatch) {
        const min = parseInt(rangeMatch[1], 10);
        const max = parseInt(rangeMatch[2], 10);
        // Only quote a fee explicitly configured for all capacity-counted children.
        // Partial/overlapping age bands remain descriptive policy text, not a guessed total.
        if (min === infantAge && max >= childMaxAge && !detail.includes("ฟรี") &&
            (detail.includes("เตียงเสริม") || detail.includes("คิดราคาเด็ก") || detail.includes("มีค่าบริการ"))) {
          childChargeMinAge = min;
          childChargeMaxAge = childMaxAge;
          childChargePricePerNight = null;
          childChargePolicyTitle = title;
          if (detail) {
            childChargePolicyDetail = detail;
            // ดึงราคาถ้ามี เช่น "500 บาท", "300.-", "฿500", "500/คืน"
            const priceMatch = detail.match(/(?:฿\s*(\d+(?:,\d{3})*(?:\.\d+)?)|(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:บาท|\.-|บ\.|\/คืน))/);
            if (priceMatch) {
              const parsed = Number((priceMatch[1] || priceMatch[2]).replaceAll(",", ""));
              if (parsed >= 50 && parsed <= 10000) {
                childChargePricePerNight = parsed;
              }
            }
          }
        }
      }
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
    childChargeMinAge,
    childChargeMaxAge,
  };
}

interface ResortAgeRow {
  id?: number;
  name?: string;
  infant_max_age_exclusive?: number | string | null;
  kids_policy?: string | null;
}

export function guestPolicyFromResortRows(rows: ResortAgeRow[]): GuestAgePolicy {
  const main = rows.find(row => row.id === 3);
  const room = rows.find(row => row.id === 4);
  return parseGuestAgePolicy(room?.kids_policy ?? main?.kids_policy, main?.infant_max_age_exclusive);
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
        setPolicy(guestPolicyFromResortRows(rows));
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
