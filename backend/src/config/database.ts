import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// สร้าง PostgreSQL connection pool กลางสำหรับเชื่อมต่อฐานข้อมูล
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// แสดงข้อความเมื่อเชื่อมต่อฐานข้อมูลสำเร็จ
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

// ดักจับข้อผิดพลาดของ client ที่ไม่ได้ใช้งานใน pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool;
