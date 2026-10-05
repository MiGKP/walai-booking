-- ขั้นที่ 2: ตรวจแถวข้อมูลของรีสอร์ท (SELECT อย่างเดียว)
-- หน้าบ้านดึงข้อมูลจากแถว id 3 เป็นหลัก ถ้าไม่มีแถวนี้ GET /settings/resort จะได้ค่า null
-- ผลที่คาดหวัง: มีแถว id = 3 พร้อมชื่อสถานที่ และมีเลขบัญชี/PromptPay ที่ถูกต้อง

SELECT id, name, phone, bank_account_no, bank_account_name, promptpay_id
FROM resort_info
ORDER BY id;

-- ถ้าไม่มีแถว id 3 ให้แจ้งคู่โปรเจกต์ก่อนเพิ่ม เพราะต้องกรอกข้อมูลจริงของรีสอร์ท
-- ตัวอย่างการเพิ่ม (ต้องแก้ค่าให้ถูกต้องก่อนรัน ห้ามรันค่าตัวอย่างบน production):
-- INSERT INTO resort_info (id, name, phone, bank_account_no, bank_account_name, promptpay_id)
-- VALUES (3, 'ชื่อสวน', 'เบอร์โทร', 'เลขบัญชี', 'ชื่อบัญชี', 'PromptPay');
-- ย้อนกลับ: DELETE FROM resort_info WHERE id = 3;
