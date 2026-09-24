const fs = require('fs');
let code = fs.readFileSync('frontend/src/app/promotions/page.tsx', 'utf8');
code = code.replace(/\s*badge=\{promo\.is_collectible \? '??????' : '?????????'\}/g, '');
fs.writeFileSync('frontend/src/app/promotions/page.tsx', code);

