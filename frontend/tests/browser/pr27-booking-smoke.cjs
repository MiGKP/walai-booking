const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const baseURL = process.env.TEST_FRONTEND_URL || 'http://localhost:3107';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const settings=[{id:3,infant_max_age_exclusive:6},{id:4,name:'ห้องพัก',infant_max_age_exclusive:0,kids_policy:'เด็ก 0-5 ปี: เข้าพักฟรี\nเด็ก 6-17 ปี: มีค่าบริการเตียงเสริม 500 บาท/คืน (ชำระหน้าเคาน์เตอร์)\n18 ปีขึ้นไป: คิดราคาผู้ใหญ่'}];
 for(const viewport of [{width:390,height:844},{width:1440,height:1000}]){
 const context=await browser.newContext({viewport});let role='customer';const errors=[];
 await context.addInitScript(()=>localStorage.setItem('token','TEST_LOCAL_ONLY'));
 await context.route('**/api/**',async route=>{
  const req=route.request();assert.equal(req.method(),'GET','Do not mutate production'); const pathname=new URL(req.url()).pathname;
  let data=[];if(pathname.endsWith('/settings/notifications/pending')) data={counts:{room_slips:0,boat_slips:0,today_checkins:0,today_checkouts:0,today_boat_checkins:0,total_urgent:0},recent_items:[]};
  if(pathname.endsWith('/auth/profile')) data={id:9001,role,first_name:'TEST',last_name:'Local',email:'test@example.test',has_password:true};
  if(pathname.endsWith('/settings/resort'))data=settings;
  await route.fulfill({json:{success:true,data},headers:{'access-control-allow-origin':'*'}});
 });
 const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(baseURL + '/rooms?adults=1&children=1&check_in=2099-11-01&check_out=2099-11-02');
 await page.getByRole('button',{name:/ผู้เข้าพัก/}).first().click();
 await page.getByRole('button',{name:'เลือกอายุ',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'12 ปี',exact:true}).count(),0);
 await page.getByRole('button',{name:'6 ปี',exact:true}).click();
 await page.getByRole('button',{name:'ตกลง',exact:true}).click();
 assert(page.url().includes('child_ages=6'));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'room horizontal overflow');
 await page.goto(baseURL + '/dashboard?tab=profile');
 await page.getByRole('button',{name:'รีวิวของฉัน',exact:true}).first().click();
 await page.waitForURL('**/dashboard?tab=reviews');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'dashboard horizontal overflow');
 role='admin';await page.goto(baseURL + '/admin/promotions');
 await page.getByRole('button',{name:/เพิ่มโปรโมชั่น/}).first().click();
 assert.equal(await page.getByText('บริการที่ใช้ส่วนลดได้',{exact:true}).count(),0);
 assert.equal(await page.getByText('ใช้ร่วมกับคูปองอื่นที่อนุญาตให้ใช้ร่วมกันได้',{exact:true}).count(),0);
 await page.goto(baseURL + '/admin/policies');
 const input=page.getByPlaceholder('เช่น 500').first();await input.waitFor();
 await input.fill('');await input.pressSequentially('123', { delay: 80 });
 const price=await page.getByPlaceholder('เช่น 500').first().inputValue();
 console.log(JSON.stringify({viewport,price,errors}));
 assert.equal(price,'123','Price entry must keep focus through all digits');
 assert.deepEqual(errors,[]);
 await context.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
