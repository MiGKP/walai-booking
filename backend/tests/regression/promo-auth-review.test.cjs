const assert = require('node:assert/strict');
const test = require('node:test');
require('ts-node/register/transpile-only');
let query;
const db = require.resolve('../../src/config/database.ts');
require.cache[db] = {id:db,filename:db,loaded:true,exports:{__esModule:true,default:{query:(...args)=>query(...args)}}};
const controller=require('../../src/controllers/promotion.controller.ts');
const {applyPromotionList}=require('../../src/services/promotion-apply.ts');
const {loadPromosForApply}=require('../../src/services/promotion-ledger.ts');
const validators=require('../../src/middleware/validators.ts');
const rows=data=>({rows:data,rowCount:data.length});
const response=()=>({status(){return this;},json(body){this.body=body;}});
const promo=overrides=>({id:1,code:'X',name:'X',discount_type:'percent',discount_value:50,min_nights:null,min_price:null,max_discount:null,usage_limit:null,usage_count:0,is_active:true,start_date:null,end_date:null,usage_limit_per_member:2,is_collectible:false,stackable:false,applies_to:'room',...overrides});
const ctx=overrides=>({memberId:7,nights:1,basePrice:200,now:new Date(),memberUsedCountByPromoId:{},walletsByPromoId:{},scope:'room',...overrides});
test('admin listing preserves paid addon metadata',async()=>{query=async sql=>{const source=promo({boat_addon_mode:'paid',boat_addon_price:250});const fields=sql.split('FROM')[0];return rows([Object.fromEntries(Object.entries(source).filter(([key])=>fields.includes(key)))]);};const res=response();await controller.getAllPromotions({},res);assert.equal(res.body.data[0].boat_addon_mode,'paid');assert.equal(res.body.data[0].boat_addon_price,250);});
test('room promotion validates actual types',()=>{assert.throws(()=>applyPromotionList([promo({room_type_id:99})],ctx({roomTypeIds:[2]})),/ประเภทห้อง/);assert.equal(applyPromotionList([promo({room_type_id:99})],ctx({roomTypeIds:[99]})).totalPrice,100);assert.throws(()=>applyPromotionList([promo({room_type_id:99})],ctx({roomTypeIds:[99,2]})),/ประเภทห้อง/);});
test('catalog loader preserves room restriction',async()=>{const loaded=await loadPromosForApply({query:async sql=>rows([promo({room_type_id:sql.includes('room_type_id')?99:undefined})])},[1]);assert.equal(loaded[0].room_type_id,99);});
test('used collectible wallet can redeem after cap increase',()=>{const wallet={1:{member_promotion_id:4,status:'used'}};assert.equal(applyPromotionList([promo({is_collectible:true})],ctx({memberUsedCountByPromoId:{1:1},walletsByPromoId:wallet})).totalPrice,100);assert.throws(()=>applyPromotionList([promo({is_collectible:true})],ctx({memberUsedCountByPromoId:{1:2},walletsByPromoId:wallet})),/ครบจำนวน/);});
test('auth validators preserve Gmail dots and suffix',async()=>{for(const key of ['registerValidator','loginValidator','forgotPasswordValidator','resetPasswordValidator','createStaffValidator','initAdminValidator']){const req={body:{email:' John.Smith+Stay@Gmail.com '}};for(const rule of validators[key])await rule.run(req);assert.equal(req.body.email,'john.smith+stay@gmail.com',key);}});

test('missing email produces validation errors instead of throwing in its sanitizer', async () => {
  const { validationResult } = require('express-validator');
  for (const key of ['registerValidator', 'loginValidator', 'forgotPasswordValidator', 'resetPasswordValidator']) {
    const req = { body: {} };
    for (const rule of validators[key]) await rule.run(req);
    assert.equal(validationResult(req).isEmpty(), false, key);
  }
});

test('dotted login can resolve legacy undotted account without rewriting stored identity', async()=>{
 const mail=require.resolve('../../src/services/mail.service.ts');require.cache[mail]={id:mail,filename:mail,loaded:true,exports:{sendPasswordResetEmail:async()=>{}}};
 const cloud=require.resolve('../../src/services/cloudinary.service.ts');require.cache[cloud]={id:cloud,filename:cloud,loaded:true,exports:{}};
 const bcrypt=require.resolve('bcryptjs');require.cache[bcrypt]={id:bcrypt,filename:bcrypt,loaded:true,exports:{compare:async()=>true,hash:async()=>'hash'}};
 const auth=require('../../src/controllers/auth.controller.ts');process.env.JWT_SECRET='test-only-secret';
 query=async(sql,params)=>{if(sql.includes('FROM staff'))return rows([]);return rows(params.includes('johnsmith@gmail.com')?[{member_id:7,email:'johnsmith@gmail.com',password:'hash',is_active:true}]:[]);};
 const res={code:200,status(code){this.code=code;return this;},json(body){this.body=body;}};
 await auth.login({body:{email:'john.smith@gmail.com',password:'pass'}},res);assert.equal(res.code,200);assert.equal(res.body.data.user.email,'johnsmith@gmail.com');
});

test('room restriction cannot apply without actual room context',()=>{
 assert.throws(()=>applyPromotionList([promo({room_type_id:99})],ctx({})),/ประเภทห้อง/);
 assert.equal(applyPromotionList([promo({room_type_id:null})],ctx({})).totalPrice,100);
});
test('expired and missing wallets never reopen with increased cap',()=>{
 for(const walletsByPromoId of [{},{1:{member_promotion_id:4,status:'expired'}}]){
  assert.throws(()=>applyPromotionList([promo({is_collectible:true})],ctx({walletsByPromoId})),/เก็บโค้ด/);
 }
});
test('exact Gmail identity takes priority over a distinct legacy row',async()=>{
 const auth=require('../../src/controllers/auth.controller.ts');
 query=async(sql,params)=>{
  if(sql.includes('FROM staff'))return rows([]);
  const accounts=[{member_id:8,email:'john.smith@gmail.com',password:'hash',is_active:true},{member_id:7,email:'johnsmith@gmail.com',password:'hash',is_active:true}];
  const matched=accounts.filter(a=>params.includes(a.email));
  if(sql.includes('ORDER BY CASE WHEN LOWER(email)'))matched.sort((a,b)=>Number(b.email===params[0])-Number(a.email===params[0]));
  return rows(matched);
 };
 const res={status(){return this;},json(body){this.body=body;}};
 await auth.login({body:{email:'john.smith@gmail.com',password:'pass'}},res);
 assert.equal(res.body.data.user.id,8);assert.equal(res.body.data.user.email,'john.smith@gmail.com');
});

test('registration blocks the reverse Gmail alias of an existing dotted Google account',async()=>{
 const auth=require('../../src/controllers/auth.controller.ts');
 query=async(sql)=>{if(sql.startsWith('SELECT member_id'))return rows(sql.includes('REGEXP_REPLACE')?[{member_id:8}]:[]);return rows([{member_id:9}]);};
 const res={code:200,status(code){this.code=code;return this;},json(body){this.body=body;}};
 await auth.register({body:{email:'johnsmith@gmail.com',password:'long-password',first_name:'John',last_name:'Smith'}},res);
 assert.equal(res.code,400);
});
