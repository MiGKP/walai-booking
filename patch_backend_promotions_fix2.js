const fs = require('fs');

const file = 'backend/src/controllers/promotion.controller.ts';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  `p.usage_limit_per_member, p.is_collectible, p.stackable, p.applies_to, p.min_nights, p.max_discount, p.boat_ticket_count, p.boat_addon_mode, p.boat_addon_price, p.boat_ticket_count, p.boat_addon_mode, p.boat_addon_price,`,
  `p.usage_limit_per_member, p.is_collectible, p.stackable, p.applies_to, p.boat_ticket_count, p.boat_addon_mode, p.boat_addon_price,`
);

c = c.replace(
  `p.is_collectible, p.stackable, p.applies_to,
              (SELECT COUNT(*)::int`,
  `p.is_collectible, p.stackable, p.applies_to, p.min_nights, p.max_discount, p.boat_ticket_count, p.boat_addon_mode, p.boat_addon_price,
              (SELECT COUNT(*)::int`
);

fs.writeFileSync(file, c);
