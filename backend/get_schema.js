const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_6cCuU4LwHiVE@ep-wispy-dust-ao3kox7x-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'room_bookings'")
  .then(res => console.log(res.rows))
  .finally(() => pool.end());
