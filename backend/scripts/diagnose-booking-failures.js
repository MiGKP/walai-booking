/* One-off production diagnosis — prints schema/errors only, never secrets. */
require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const u = process.env.DATABASE_URL || '';
  if (!u) {
    console.log('NO_DB');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: u,
    ssl: u.includes('neon') || u.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    const cols = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'room_bookings'
       ORDER BY ordinal_position`
    );
    console.log(
      'room_bookings cols:',
      cols.rows.map((r) => r.column_name).join(',')
    );

    const triggers = await pool.query(
      `SELECT tgname, pg_get_triggerdef(t.oid) AS def
       FROM pg_trigger t
       WHERE t.tgrelid = 'public.room_bookings'::regclass
         AND NOT t.tgisinternal`
    );
    console.log('room_bookings triggers:', JSON.stringify(triggers.rows, null, 2));

    const fn = await pool.query(
      `SELECT pg_get_functiondef(p.oid) AS def
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE p.proname = 'calculate_booking_price' AND n.nspname = 'public'`
    );
    const def = fn.rows[0] ? fn.rows[0].def : 'MISSING';
    console.log('calculate_booking_price mentions room_id:', /room_id/.test(def));
    console.log('calculate_booking_price head:\n', String(def).slice(0, 700));

    const tables = await pool.query(
      `SELECT to_regclass('public.booking_room') AS booking_room,
              to_regclass('public.booking_boat') AS booking_boat`
    );
    console.log('tables:', tables.rows[0]);

    const rounds = await pool.query(
      `SELECT boat_type_id, COUNT(*)::int AS n,
              array_agg(start_time::text || '-' || end_time::text ORDER BY start_time) AS windows
       FROM boat_rounds
       WHERE is_active = true
       GROUP BY boat_type_id
       ORDER BY boat_type_id NULLS FIRST`
    );
    console.log('active rounds by type:', rounds.rows);

    const types = await pool.query(
      `SELECT boat_type_id, type_name FROM boat_types WHERE is_active = true ORDER BY boat_type_id`
    );
    console.log('active boat types:', types.rows);

    const member = await pool.query(
      `SELECT member_id FROM members ORDER BY member_id LIMIT 1`
    );
    const memberId = member.rows[0] && member.rows[0].member_id;
    if (!memberId) {
      console.log('NO_MEMBER');
      return;
    }

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
      console.log('HEADER_INSERT_OK id=', ins.rows[0].room_booking_id);

      const room = await pool.query(
        `SELECT room_id FROM rooms WHERE status <> 'maintenance' LIMIT 1`
      );
      if (room.rows[0]) {
        await pool.query(
          `INSERT INTO booking_room (
             room_booking_id, room_id, price_per_night, nights, subtotal, status
           ) VALUES ($1, $2, 100, 1, 100, 'pending')`,
          [ins.rows[0].room_booking_id, room.rows[0].room_id]
        );
        console.log('LINE_INSERT_OK');
      } else {
        console.log('NO_ROOM_FOR_LINE');
      }
    } catch (err) {
      console.log('ROOM_INSERT_FAIL:', err.message);
    }
    await pool.query('ROLLBACK');
    console.log('rolled back probe inserts');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
