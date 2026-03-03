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

export interface RoomType {
  id: number;
  room_image?: string;
  room_name: string;
  type_name?: string;
  price: number;
  capacity?: number;
  description?: string;
  amenity_id?: number;
  status: boolean;
}

export interface Room {
  room_id: number;
  room_type_id: number;
  room_number?: string;
  status: 'available' | 'occupied' | 'maintenance';
}

export interface BoatType {
  boat_type_id: number;
  type_name?: string;
  description?: string;
  seat_count?: number;
  price: number;
  quantity: number;
  is_active: boolean;
}

export interface BoatRound {
  boat_round_id: number;
  boat_type_id: number;
  start_time: string;
  end_time: string;
  max_booking?: number;
  is_active: boolean;
}

export interface RoomBooking {
  room_booking_id: number;
  member_id: number;
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

export interface BoatBooking {
  boat_booking_id: number;
  member_id: number;
  boat_type_id: number;
  boat_round_id: number;
  booking_date: Date;
  num_passengers?: number;
  total_price: number;
  payment_status: 'pending' | 'paid' | 'failed';
  payment_slip?: string;
  status: 'pending' | 'paid' | 'approved' | 'rejected' | 'cancelled';
  created_at: Date;
}

export interface AuthPayload {
  id: number;
  email: string;
  role: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

