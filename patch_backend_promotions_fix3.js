const fs = require('fs');

const file = 'backend/src/controllers/promotion.controller.ts';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  'p.is_collectible, p.stackable, p.applies_to,\r\n              (SELECT COUNT(*)',
  'p.is_collectible, p.stackable, p.applies_to, p.min_nights, p.max_discount, p.boat_ticket_count, p.boat_addon_mode, p.boat_addon_price,\r\n              (SELECT COUNT(*)'
);
c = c.replace(
  'p.is_collectible, p.stackable, p.applies_to,\n              (SELECT COUNT(*)',
  'p.is_collectible, p.stackable, p.applies_to, p.min_nights, p.max_discount, p.boat_ticket_count, p.boat_addon_mode, p.boat_addon_price,\n              (SELECT COUNT(*)'
);

fs.writeFileSync(file, c);
