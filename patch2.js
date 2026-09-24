const fs = require('fs');
let code = fs.readFileSync('frontend/src/app/promotions/page.tsx', 'utf8');
code = code.replace(/\s*badge=\{promo\.is_collectible \? '[^']+' : '[^']+'\}/g, '');
fs.writeFileSync('frontend/src/app/promotions/page.tsx', code);
console.log('Replaced in promotions page');

if (fs.existsSync('frontend/src/components/dashboard/MyCouponsSection.tsx')) {
    let code2 = fs.readFileSync('frontend/src/components/dashboard/MyCouponsSection.tsx', 'utf8');
    code2 = code2.replace(/\s*badge=\{[^}]+\}/g, '');
    fs.writeFileSync('frontend/src/components/dashboard/MyCouponsSection.tsx', code2);
    console.log('Replaced in MyCouponsSection');
}
