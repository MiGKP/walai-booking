// ข้อมูลสมาชิก (ลูกค้า)
export interface Member {
  member_id: number;
  first_name?: string;
  last_name?: string;
  email: string;
  password?: string;
  phone?: string;
  image_profile?: string;
  google_id?: string;
  avatar_url?: string;
  auth_provider: 'email' | 'google';
  address?: string;
  date_of_birth?: Date;
  gender?: 'male' | 'female' | 'other';
  created_at: Date;
  updated_at: Date;
}

// ข้อมูลพนักงานและผู้ดูแลระบบ
export interface Staff {
  staff_id: number;
  first_name?: string;
  last_name?: string;
  email: string;
  password?: string;
  phone?: string;
  status: boolean;
  role: string;
  address?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  postal_code?: string;
  created_at: Date;
}

// ข้อมูลประเภทห้องพัก
export interface RoomType {
  id: number;
  room_image?: string;
  room_name: string;
  type_name?: string;
  price: number;
  capacity?: number;
  description?: string;
  amenity_ids: number[];
  status: boolean;
}

// ข้อมูลห้องพักรายห้อง
export interface Room {
  room_id: number;
  room_type_id: number;
  room_number?: string;
  status: 'available' | 'occupied' | 'maintenance';
}

// ข้อมูลประเภทเรือคายัค
export interface BoatType {
  boat_type_id: number;
  type_name?: string;
  description?: string;
  seat_count?: number;
  price: number;
  quantity: number;
  is_active: boolean;
}

// ข้อมูลรอบเวลาให้บริการเรือคายัค
export interface BoatRound {
  boat_round_id: number;
  boat_type_id: number;
  start_time: string;
  end_time: string;
  max_booking?: number;
  is_active: boolean;
}

// ข้อมูลการจองห้องพัก
export interface RoomBooking {
  room_booking_id: number;
  member_id: number;
  user_phone?: string;
  phone?: string;
  room_id: number;
  check_in: Date;
  check_out: Date;
  guest_count?: number;
  total_price: number;
  special_request?: string;
  promotion_id?: number;
  payment_status: 'pending' | 'paid' | 'failed';
  payment_slip?: string;
  payment_date?: Date;
  verify_by_staff_id?: number;
  status: 'pending' | 'paid' | 'approved' | 'rejected' | 'cancelled';
  created_at: Date;
}

// ข้อมูลการจองเรือคายัค
export interface BoatBooking {
  boat_booking_id: number;
  member_id: number;
  booking_date: Date;
  start_time?: string;
  end_time?: string;
  num_passengers?: number;
  total_price: number;
  payment_status: 'pending' | 'paid' | 'failed';
  payment_slip?: string;
  status: 'pending' | 'paid' | 'approved' | 'rejected' | 'cancelled' | 'checked_out';
  reject_reason?: string;
  created_at: Date;
}

// ข้อมูลรายการย่อยของการจองเรือคายัคแต่ละประเภท
export interface BookingBoatLine {
  booking_boat_id: number;
  boat_booking_id: number;
  boat_type_id: number;
  boat_round_id: number;
  num_passengers: number;
  boat_count: number;
  unit_price: number;
  subtotal: number;
  status: string;
  type_name?: string;
}

// ข้อมูลผู้ใช้ที่ถอดรหัสจาก JWT token
export interface AuthPayload {
  id: number;
  email: string;
  role: string;
  issued_at_ms?: number;
}

// โครงสร้างข้อมูลตอบกลับมาตรฐานของ API
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}
