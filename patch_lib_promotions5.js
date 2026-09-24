const fs = require('fs');

const file = 'frontend/src/lib/promotions.ts';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  'max_discount: number | null;',
  'max_discount: number | null;\n  boat_ticket_count?: number | null;\n  boat_addon_mode?: "free" | "paid" | null;\n  boat_addon_price?: number | null;'
);

c = c.replace(
  'end_date: string | null;\n}',
  'end_date: string | null;\n  min_nights?: number | null;\n  max_discount?: number | null;\n  boat_ticket_count?: number | null;\n  boat_addon_mode?: "free" | "paid" | null;\n  boat_addon_price?: number | null;\n}'
);

fs.writeFileSync(file, c);
console.log('patched lib/promotions.ts cleanly');
