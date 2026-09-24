const fs = require('fs');

const file = 'frontend/src/lib/promotions.ts';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  /export interface WalletPromo \{[\s\S]*?\}/,
  (match) => {
    return match.replace('}', '  min_nights?: number | null;\n  max_discount?: number | null;\n  boat_ticket_count?: number | null;\n  boat_addon_mode?: "free" | "paid" | null;\n  boat_addon_price?: number | null;\n}');
  }
);

fs.writeFileSync(file, c);
