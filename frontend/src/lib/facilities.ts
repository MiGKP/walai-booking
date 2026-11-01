// รายชื่อหมวดหมู่สิ่งอำนวยความสะดวกเฉพาะห้องพัก
export const ROOM_SPECIFIC_FACILITY_CATEGORIES: string[] = [];

export interface FacilityGroup {
  category: string;
  icon: string;
  items: string[];
}
