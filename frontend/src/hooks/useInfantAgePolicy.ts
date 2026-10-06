"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

export function useInfantAgePolicy(): number {
  const [age, setAge] = useState(6);
  useEffect(() => {
    let active = true;
    api.get('/settings/resort', { params: { id: 3 } }).then(({ data }) => {
      const value = Number(data?.data?.infant_max_age_exclusive);
      if (active && Number.isInteger(value) && value >= 0 && value <= 18) setAge(value);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return age;
}
