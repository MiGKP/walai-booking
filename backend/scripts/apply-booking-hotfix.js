/* Apply hotfix migration; never print connection secrets. */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const u = process.env.DATABASE_URL || '';
  if (!u) {
    console.log('NO_DB');
    process.exit(1);
  }

  let host = 'unknown';
  try {
    host = new URL(u).hostname;
  } catch {
    host = 'unparsed';
  }

  const sqlPath = path.join(
    __dirname,
    '..',
    'src',
    'db',
    'migrations',
    '2026-08-11-fix-booking-trigger-and-rounds.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const pool = new Pool({
    connectionString: u,
    ssl: u.includes('neon') || u.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    console.log('Applying hotfix to host:', host);
    await pool.query(sql);

    const fn = await pool.query(
      `SELECT pg_get_functiondef(p.oid) AS def
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE p.proname = 'calculate_booking_price' AND n.nspname = 'public'`
    );
    const def = fn.rows[0] ? fn.rows[0].def : '';
    console.log('trigger fn mentions room_id:', /room_id/.test(def));

    const member = await pool.query(
      `SELECT member_id FROM members ORDER BY member_id LIMIT 1`
    );
    const memberId = member.rows[0].member_id;
    await pool.query('BEGIN');
    try {
      const ins = await pool.query(
        `INSERT INTO room_bookings (
           member_id, check_in, check_out, guest_count, adults, children,
           status, total_price
         ) VALUES ($1, '2099-01-01', '2099-01-02', 1, 1, 0, 'pending', 1)
         RETURNING room_booking_id`,
        [memberId]
      );
      console.log('HEADER_INSERT_OK', ins.rows[0].room_booking_id);
    } catch (err) {
      console.log('HEADER_INSERT_FAIL', err.message);
    }
    await pool.query('ROLLBACK');

    const rounds = await pool.query(
      `SELECT bt.boat_type_id, bt.type_name, COUNT(br.boat_round_id)::int AS rounds
       FROM boat_types bt
       LEFT JOIN boat_rounds br
         ON br.boat_type_id = bt.boat_type_id AND br.is_active = true
       WHERE bt.is_active = true
       GROUP BY bt.boat_type_id, bt.type_name
       ORDER BY bt.boat_type_id`
    );
    console.log('active typed rounds:', rounds.rows);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
