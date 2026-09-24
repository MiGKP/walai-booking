// รายชื่อหมวดหมู่ที่เจาะจงห้องพัก (แสดงในหน้ารายละเอียดห้อง) — ที่เหลือถือเป็นข้อมูลรวมของทั้งรีสอร์ท
// แสดงที่หน้าแรกแทน (ดู ROOM_SPECIFIC_FACILITY_CATEGORIES ใช้คู่กันทั้งสองหน้าเพื่อไม่ให้ตกหล่น/ซ้ำกัน)
// ปัจจุบันทุกหมวดใน resort_info.facilities เป็นข้อมูล "เหมือนกันทุกห้อง" ทั้งหมด (ของส่วนรวมทั้งรีสอร์ท)
// จึงย้ายไปโชว์ที่หน้าแรกทั้งหมด — หน้ารายละเอียดห้องใช้ระบบ room_types.amenity_ids เดิมที่ปรับได้ต่อห้องแทน
export const ROOM_SPECIFIC_FACILITY_CATEGORIES: string[] = [];

export interface FacilityGroup {
  category: string;
  icon: string;
  items: string[];
}
