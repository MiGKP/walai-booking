import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// สร้าง PostgreSQL connection pool กลางของระบบเพื่อให้ทุก controller ใช้งานฐานข้อมูลร่วมกันได้อย่างมีประสิทธิภาพ
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// แสดง log เมื่อมีการเชื่อมต่อ database สำเร็จ เพื่อช่วยตรวจสอบว่า backend พร้อมใช้งานแล้ว
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

// ดักจับ error ของ client ที่อยู่ใน pool เพื่อป้องกันแอปค้างเงียบเมื่อการเชื่อมต่อฐานข้อมูลมีปัญหา
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// export pool ออกไปให้ทุกส่วนของ backend ใช้ query แบบรวมศูนย์ผ่าน config นี้
export default pool;
