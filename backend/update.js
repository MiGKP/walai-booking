const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_6cCuU4LwHiVE@ep-wispy-dust-ao3kox7x-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
pool.query("UPDATE promotions SET boat_ticket_count = 1 WHERE code = 'ROOMANDBOAT'")
  .then(() => console.log('ok'))
  .finally(() => pool.end());
