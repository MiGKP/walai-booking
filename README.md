# 🌊 Walai Booking System (ระบบจองห้องพักและเรือคายัค สวนวลัยรุกขเวช)

ระบบบริหารจัดการการจองห้องพักและบริการเรือคายัคสำหรับ **สวนวลัยรุกขเวช (Walai Floating Resort)** พัฒนาในรูปแบบ Full-Stack Web Application ด้วย **Next.js 16 (App Router)**, **Express.js (TypeScript)** และ **PostgreSQL**

---

## 🌟 ฟีเจอร์หลักของระบบ (Key Features)

### 👤 1. ฝั่งลูกค้า (Customer / Member)
- **ค้นหาและเลือกดูห้องพัก**: กรองห้องพักตามวันที่เช็คอิน-เช็คเอาต์, จำนวนผู้เข้าพัก, ช่วงราคา พร้อมแสดงสิ่งอำนวยความสะดวกและรูปภาพห้องพัก
- **จองเรือคายัคตามรอบเวลา**: ระบบตรวจสอบจำนวนเรือว่างจริงในแต่ละรอบเวลา (Boat Rounds) และจำกัดสล็อตท่าเรือเพื่อป้องกันการจองซ้ำ
- **ระบบโปรโมชั่น & ส่วนลด**: รองรับการกรอกโค้ดส่วนลด (เปอร์เซ็นต์ หรือ จำนวนเงิน) ซึ่งคำนวณราคาสุทธิอัตโนมัติด้วย Database Trigger
- **ชำระเงิน & แนบสลิป**: สร้าง QR Code PromptPay หรือแสดงเลขบัญชีสำหรับโอนเงิน พร้อมระบบอัปโหลดสลิปการโอนเงิน
- **อีเมลแจ้งเตือนอัตโนมัติ**: ได้รับอีเมลสรุปการจองทันทีที่จองสำเร็จ และได้รับอีเมลแจ้งเตือนเมื่อพนักงานกดอนุมัติ/ปฏิเสธสลิป
- **ประวัติการจอง & เขียนรีวิว**: ดูประวัติการจอง ยืนยันการเช็คเอาต์ และให้คะแนนเขียนรีวิวหลังเข้าพัก

### 👨‍💼 2. ฝั่งพนักงาน (Staff & Department Dashboard)
- **แดชบอร์ดพนักงานห้องพัก (Room Staff)**: ตรวจสอบสลิปการโอนเงิน, อนุมัติ/ปฏิเสธรายการจอง และบันทึกการ Check-out ห้องพัก (ระบบคืนสถานะห้องเป็น "ว่าง" อัตโนมัติ)
- **แดชบอร์ดพนักงานเรือ (Boat Staff)**: ตรวจสอบสลิป, ยืนยันรอบเวลาการพายเรือคายัค และบันทึกการคืนเรือ
- **บันทึกชื่อผู้ดำเนินการ**: ทุกการอนุมัติสลิปจะถูกบันทึกชื่อพนักงานผู้กดอนุมัติไว้ในฐานข้อมูลเพื่อความโปร่งใส

### 👑 3. ฝั่งผู้ดูแลระบบ (Admin)
- **ภาพรวมธุรกิจ & รายงานสถิติ**: สรุปรายได้แยกตามห้องพักและเรือคายัค, จำนวนการจองรายวัน/รายเดือน, สัดส่วนการใช้บริการ
- **ตารางสรุปรายการจองทั้งหมด**: สามารถดูรายการจองทั้งหมด พร้อมระบุชื่อพนักงานผู้ยืนยันสลิป และกดดูรูปสลิปได้ทันที
- **จัดการพนักงาน (Staff Management)**: เพิ่ม/แก้ไข/ลบ บัญชีพนักงาน และกำหนดบทบาท (Room Staff, Boat Staff, Admin)
- **จัดการห้องพัก & รายห้อง**: เพิ่มประเภทห้องพัก (Room Types), สิ่งอำนวยความสะดวก (Amenities), รูปภาพ และหมายเลขห้องย่อย (Single Rooms)
- **จัดการเรือ & รอบเวลา**: กำหนดประเภทเรือ, จำนวนลำที่มีให้บริการ, รอบเวลาการบริการ (Rounds) และเวลาเปิด-ปิดทำการแต่ละวัน
- **จัดการโค้ดส่วนลด (Promotions)**: สร้างและแก้ไขโปรโมชั่น กำหนดวันหมดอายุ และจำกัดจำนวนครั้งการใช้งาน
- **จัดการสมาชิก & รีวิว**: ค้นหา/ปิดการใช้งานบัญชีสมาชิก และจัดการแสดงผลรีวิวจากผู้เข้าพัก

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

### Frontend
- **Framework**: Next.js 16.1.6 (App Router, React 19)
- **Styling**: Vanilla CSS + Tailwind CSS (Custom Color Tokens: Forest Green `#123C30`, Teal `#0f766e`, Bamboo `#D9A05B`, Cream `#f5f7fb`)
- **Icons & UI**: Lucide React, React Hot Toast
- **HTTP Client**: Axios (พร้อม Interceptor สำหรับจัดการ JWT Token)

### Backend
- **Runtime**: Node.js + Express.js (TypeScript)
- **Database**: PostgreSQL (เชื่อมต่อด้วย `pg` Pool)
- **Authentication**: Passport.js (JWT Strategy & Google OAuth 2.0), `bcryptjs`
- **Email Service**: Nodemailer (Gmail SMTP integration)
- **File Upload**: Multer (จัดเก็บสลิปชำระเงินและรูปโปรไฟล์ใน `./uploads`)
- **Security & Protection**: `express-rate-limit`, `helmet`, `cors`, `cookie-parser`

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
walai_booking/
├── frontend/                   # Next.js Frontend Application
│   ├── src/
│   │   ├── app/                # Next.js App Router (Pages & Routes)
│   │   │   ├── admin/          # Admin Management Pages & Dashboards
│   │   │   ├── auth/           # Login, Register, Forgot/Reset Password
│   │   │   ├── dashboard/      # Customer Dashboard & Booking History
│   │   │   ├── kayaks/         # Kayak Browsing & Booking Pages
│   │   │   ├── rooms/          # Room Browsing & Booking Pages
│   │   │   ├── staff/          # Staff Room/Boat Dashboards
│   │   │   └── page.tsx        # Landing Page
│   │   ├── components/         # Reusable UI Components (Navbar, Footer, etc.)
│   │   ├── hooks/              # Custom React Hooks (useAuth, useAuthGuard)
│   │   └── lib/                # API Client & Utility Functions
│   └── package.json
│
├── backend/                    # Express.js Backend API
│   ├── src/
│   │   ├── config/             # Database connection & Passport setup
│   │   ├── controllers/        # Route logic (Auth, Booking, Kayak, Room, etc.)
│   │   ├── middleware/         # Auth, Authorization, Rate Limit, Validators
│   │   ├── routes/             # API Endpoint Routes (/api/...)
│   │   ├── services/           # Mail Service, Auto-Cancel Cron Tasks
│   │   └── index.ts            # Express Server Entry Point
│   ├── uploads/                # Directory for uploaded slips and avatars
│   └── package.json
│
├── .agents/
│   └── AGENTS.md               # Developer & AI Agent Guidelines
└── README.md                   # Main Documentation
```

---

## ⚙️ การตั้งค่า Environment Variables

### 1. Backend (`backend/.env`)
สร้างไฟล์ `backend/.env` และกำหนดค่าดังนี้:

```env
PORT=5000
NODE_ENV=development

# Database Connection
DATABASE_URL=postgresql://postgres:811471@localhost:5432/walai

# Authentication & JWT
JWT_SECRET=walai_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=7d
SESSION_SECRET=walai_session_secret_change_in_production

# Google OAuth 2.0 (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Cloudinary Media Storage
# Cloudinary Dashboard → Settings → API Keys
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Payment Info
PROMPTPAY_ID=0956500770
BANK_ACCOUNT_NUMBER=152-8-68655-5

# Email — Brevo HTTPS API (ส่งหาใครก็ได้ ไม่ต้องมีโดเมน)
# Brevo → Settings → SMTP & API → API Keys → สร้าง API key
# Brevo → Settings → Senders → เพิ่ม/verify อีเมลผู้ส่ง
MAIL_PROVIDER=brevo
BREVO_API_KEY=your_brevo_api_key
MAIL_FROM="Walai Booking <your_verified_sender@email.com>"
APP_NAME=Walai Booking
PASSWORD_RESET_EXPIRES_MINUTES=30

# (ทางเลือก) Resend — ฟรีส่งได้เฉพาะเมลที่สมัคร จนกว่าจะ verify โดเมน
# MAIL_PROVIDER=resend
# RESEND_API_KEY=re_xxx
# RESEND_FROM=Walai Booking <onboarding@resend.dev>
```

ไฟล์รูปใหม่ทั้งหมดถูกส่งจาก backend ไป Cloudinary โดยตรง ค่าทั้งสาม
`CLOUDINARY_*` ต้องตั้งเฉพาะใน `backend/.env` และ Render Environment เท่านั้น
ห้ามนำไปใส่ใน frontend หรือ commit ลง Git

ข้อมูลเดิมที่เก็บ path แบบ `/uploads/...` ยังอ่านได้เพื่อรองรับ local development
แต่ไฟล์ที่หายจาก Render Free แล้วไม่สามารถกู้คืนได้ ต้องอัปโหลดใหม่ผ่านหน้า admin
หรือหน้าชำระเงิน

### 2. Frontend (`frontend/.env.local`)
สร้างไฟล์ `frontend/.env.local` และกำหนดค่าดังนี้:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

---

## 🚀 วิธีการติดตั้งและเริ่มใช้งาน (Installation & Running)

### 1. เตรียมฐานข้อมูล PostgreSQL
1. สร้างฐานข้อมูลชื่อ `walai` ใน PostgreSQL
2. ตรวจสอบให้แน่ใจว่า Username และ Password ใน `backend/.env` ตรงกับฐานข้อมูลของคุณ

### 2. รัน Backend (Express.js Server)
เปิด Terminal ในโฟลเดอร์โปรเจกต์:

```bash
cd backend
npm install
npm run dev
```
*(Backend จะทำงานที่ `http://localhost:5000`)*

### 3. รัน Frontend (Next.js App)
เปิด Terminal อีกบานหนึ่ง:

```bash
cd frontend
npm install
npm run dev
```
*(Frontend จะทำงานที่ `http://localhost:3000`)*

---

## 🗄️ โครงสร้างฐานข้อมูล & Triggers สำคัญ (Database Architecture)

### 📌 ตารางหลักในระบบ
- `members`: ข้อมูลสมาชิก/ลูกค้า
- `staff`: ข้อมูลพนักงานและผู้ดูแลระบบ (`role`: `admin`, `room_staff`, `boat_staff`)
- `room_types` & `rooms`: ประเภทห้องพัก และห้องพักย่อย
- `room_bookings`: ประวัติการจองห้องพัก
- `boat_types` & `boat_rounds` & `boat_bookings`: ประเภทเรือ, รอบเวลาบริการ และประวัติการจองเรือ
- `promotions`: โค้ดส่วนลดและโปรโมชั่น

### ⚡ Database Triggers สำคัญ
1. **`calculate_booking_price`**: ทำงานเมื่อมีการจองห้องพักคำนวณราคาสุทธิจากราคาห้องต่อคืน, จำนวนคืนที่พัก และหักส่วนลดจากโปรโมชั่นให้อัตโนมัติ
2. **`update_room_status_on_booking`**: ทำงานเมื่อสถานะการจองเปลี่ยน:
   - เปลี่ยนเป็น `approved` ➔ ปรับสถานะห้องพักย่อยเป็น `occupied` (มีผู้เข้าพัก)
   - เปลี่ยนเป็น `cancelled`, `rejected` หรือ `checked_out` ➔ ปรับสถานะห้องพักย่อยเป็น `available` (ว่าง) อัตโนมัติ

---

## 👥 บทบาทผู้ใช้งานในระบบ (Roles & Permissions)

| Role | สิทธิ์การเข้าถึง |
| :--- | :--- |
| **customer** | จองห้องพัก/เรือ, ชำระเงิน/แนบสลิป, ดูประวัติการจองของตนเอง, เขียนรีวิว |
| **room_staff** | ดูแดชบอร์ดห้องพัก, ตรวจสอบสลิปจองห้อง, กดอนุมัติ/ปฏิเสธ, กด Check-out ห้องพัก |
| **boat_staff** | ดูแดชบอร์ดเรือคายัค, ตรวจสอบสลิปจองเรือ, กดอนุมัติ/ปฏิเสธ, กด Check-out คืนเรือ |
| **admin** | เข้าถึงได้ทุกเมนูในระบบ, จัดการพนักงาน, ประเภทห้อง/เรือ, โปรโมชั่น, ดูสถิติรายได้ |

---

## 📝 License
จัดทำขึ้นสำหรับโปรเจกต์ระบบจองห้องพักและเรือคายัค สวนวลัยรุกขเวช
