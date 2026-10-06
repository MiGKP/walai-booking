# ชุดทดสอบ end-to-end (ใช้ฐานข้อมูลทดสอบเท่านั้น)

**ห้ามชี้ไปที่ production เด็ดขาด** ชุดนี้จะลบและสร้างข้อมูลทดสอบ

## สิ่งที่ต้องมี
- PostgreSQL 14 ขึ้นไป ที่สร้าง schema จาก migration ของ repo และมีตาราง baseline แล้ว
- ฐานข้อมูลทดสอบชื่อใดก็ได้ (ตัวอย่าง `walai_test`)
- backend ที่ build แล้ว (`npm run build`) และรันอยู่ที่พอร์ต 5055

## ตั้งค่า
```
TEST_DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/walai_test
TEST_API_URL=http://localhost:5055/api
```

## ขั้นตอน (รันจากโฟลเดอร์ backend)
1. seed ข้อมูลพื้นฐานใน ฐานทดสอบ:
   `psql "$TEST_DATABASE_URL" -f tests/e2e/seed-users.sql`
   `psql "$TEST_DATABASE_URL" -f tests/e2e/seed-rooms-promos.sql`
2. รัน backend ให้ชี้ไปยังฐานทดสอบ แล้วรอจนพร้อม
3. รันชุดทดสอบ (รีเซ็ตข้อมูลระหว่างชุดตามที่ต้องการ):
   `node tests/e2e/flow-tests.mjs`
   `node tests/e2e/flow-tests-2.mjs`
   `node tests/e2e/flow-tests-3.mjs`
   `node tests/e2e/flow-tests-4.mjs`
4. ชุด OTP ต้องรันในสองรอบ โดยรีสตาร์ต backend ระหว่างนั้น เพราะ rate limit นับคำขอผิด:
   `node tests/e2e/flow-tests-5-otp.mjs wrong`
   (รีสตาร์ต backend)
   `node tests/e2e/flow-tests-5-otp.mjs correct`

## ผลที่คาดหวัง
- flow-tests: 23/23
- flow-tests-2: 21/21
- flow-tests-3: 13/13
- flow-tests-4: 8/8
- flow-tests-5-otp: 1/1 ทั้งสองรอบ

## หมายเหตุ
- การแจ้งเตือนรีวิวใน flow-tests-4 จำลองการส่งอีเมลด้วย stub ไม่ได้ส่งจริง
- `seed-users.sql` มี hash ของรหัสผ่านทดสอบ `Passw0rd!` ใช้เฉพาะฐานทดสอบ
