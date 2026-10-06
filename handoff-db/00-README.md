
ไฟล์ SQL สำหรับตรวจ schema และงานแก้ข้อมูลที่ควบคุมเป็นขั้นตอน ไม่เก็บ credentials ในไฟล์

## ลำดับการทำงาน (ทำทีละขั้น อย่าข้าม)

| ลำดับ | ไฟล์ | ทำอะไร | แก้ข้อมูลไหม |
|---|---|---|---|
| 1 | `01-check-prod-columns.sql` | ตรวจว่ามีคอลัมน์ครบหรือไม่ | ไม่ (SELECT) |
| 2 | `02-check-resort-row.sql` | ตรวจว่ามีแถว resort_info id 3 | ไม่ (SELECT) |
| 3 | `03-check-staff-column.sql` | ตรวจชื่อ `approved_by_staff_id` ให้ตรงกับโค้ด | ไม่ (SELECT) |
| 4 | `04-migration-missing-columns.sql` | เพิ่มคอลัมน์ที่ขาด | ใช่ (ALTER) |
| 5 | `05-migration-security-hardening.sql` | เพิ่มคอลัมน์ความปลอดภัย | ใช่ (ALTER) |
| 6 | `06-check-backfill-candidates.sql` | หาบุ๊กกิ้งเก่าที่ต้อง backfill | ไม่ (SELECT) |
| 7 | `07-staging-review-reminder-test.sql` | เตรียมข้อมูลทดสอบ (staging เท่านั้น) | ใช่ (UPDATE) |
| 8 | `08-preview-promotion-ledger-backfill.sql` | ตรวจแผนยอดใช้โปร/ledger/wallet และ fingerprint | ไม่ (SELECT) |
| 9 | `09-apply-promotion-ledger-backfill.sql` | backfill และปรับยอดใน transaction พร้อม audit marker | ใช่ (INSERT/UPDATE) |
| 10 | `10-verify-promotion-ledger-backfill.sql` | ตรวจยอดและแถวเดิมหลัง COMMIT | ไม่ (SELECT) |

ไฟล์ 07 เป็นงานทดสอบแยก ไม่ต้องรันเพื่อทำ backfill โปรโมชั่น

## Backfill โปรโมชั่นครั้งเดียว

อ่าน `11-promotion-ledger-rollout-notes.md` ก่อน ใช้ 08 -> 09 -> 10 บน branch สำรองที่สร้างจาก production ล่าสุด แล้วลองรัน 09 ซ้ำเพื่อยืนยันว่าถูกปฏิเสธโดยไม่มีข้อมูลเปลี่ยน

ไฟล์ 09 ตั้ง `apply=false` และมี fingerprint placeholder อยู่ ต้องใส่ fingerprint จากไฟล์ 08 ของฐานเป้าหมายและตั้ง `apply=true` ก่อน จึงจะ COMMIT ได้ อย่าคัดลอก fingerprint จาก branch สำรองมาข้ามการตรวจ production และอย่าตัดคำสั่งป้องกันออก

ก่อน production ให้หยุดงานเขียนการจองชั่วคราว ตรวจ 08 ใหม่ (`exceptions=[]`) แล้วใช้ 09 ครั้งเดียวและ 10 ทันที ไฟล์ 09 ไม่ลบ ledger เดิม ไม่สร้าง wallet ใหม่ และเก็บ snapshot ก่อนแก้ใน `promotion_backfill_runs` ใช้กฎคืนโควตาเฉพาะสถานะก่อนหน้า `pending`/`paid`; การใช้หลัง `approved` หรือ `checked_out` ต้องคงอยู่ รายการปฏิเสธที่ไม่ทราบประวัติสองรายการคงโควตาตามคำสั่งผู้ใช้

## กฎความปลอดภัย
- **รันแต่ละไฟล์บน branch สำรองก่อน** ใน Neon ให้สร้าง branch จาก production ก่อน
- ไฟล์ที่เป็น SELECT ปลอดภัยรันซ้ำได้เสมอ
- ไฟล์ ALTER ใช้ `IF NOT EXISTS` รันซ้ำได้ ไม่ทำให้ข้อมูลหาย
- คำสั่งย้อนกลับ (ROLLBACK) อยู่ท้ายแต่ละไฟล์ใน comment ใช้เฉพาะเมื่อจำเป็น และ **ย้อนกลับ ALTER จะทำให้คอลัมน์และข้อมูลในคอลัมน์นั้นหายไป** ใช้ได้เฉพาะตอนที่เพิ่งเพิ่มเข้าไปและยังไม่มีข้อมูลใช้งาน
- ไฟล์ 07 ห้ามรันบน production เด็ดขาด

## คำสั่งที่ต้องเช็คก่อนรันทุกครั้ง
- ดูว่าเชื่อมต่อฐานไหนอยู่ (branch ชื่ออะไร) ให้แน่ใจว่าไม่ใช่ production ถ้ากำลังทดสอบ
