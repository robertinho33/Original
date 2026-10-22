const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const source=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'../../js/admin/admin.js'),'utf8');
function extract(name){
  const start=source.indexOf('function '+name+'(');assert.ok(start>=0,`${name} precisa estar definida`);
  const next=/^(?:async )?function \w+\(/m.exec(source.slice(start+1));
  return source.slice(start,next?start+1+next.index:source.length);
}
function context(){
  const sandbox={document:{getElementById:()=>null,querySelectorAll:()=>[]},metricCard:(label,value)=>`${label}: ${value}`,formatNumber:String,formatCurrency:value=>`R$ ${value}`,escapeHtml:String,renderStatus:String,emptyState:String};
  vm.createContext(sandbox);
  vm.runInContext(['pick','couponId','couponIsActive','couponType','couponValue','couponUsageCount','couponUsageLimit','renderCoupons'].map(extract).join('\n'),sandbox);
  return sandbox;
}
test('coupon module renders real list code without missing helper references',()=>{
  const ui=context(),content={outerHTML:''};
  ui.renderCoupons(content,[{id:'one',code:'ATIVO',active:true,discountType:'percentage',discount:10,uses:2,usageLimit:5},{docId:'two',coupon_code:'FIXO',status:'inactive',type:'fixed_amount',value:20,usage_count:3}]);
  assert.match(content.outerHTML,/Cupons ativos: 1/);assert.match(content.outerHTML,/Cupons inativos: 1/);
  assert.match(content.outerHTML,/ATIVO/);assert.match(content.outerHTML,/FIXO/);assert.match(content.outerHTML,/10%/);assert.match(content.outerHTML,/R\$ 20/);
  assert.match(content.outerHTML,/data-coupon-id="two"/);
  assert.doesNotThrow(()=>ui.renderCoupons(content,undefined));
});
test('restored helpers preserve legacy field names and explicit active flags',()=>{
  const ui=context();assert.equal(ui.couponIsActive({active:false,status:'active'}),false);
  assert.equal(ui.couponIsActive({status:'ativo'}),true);assert.equal(ui.couponIsActive({state:'inactive'}),false);assert.equal(ui.couponIsActive({}),true);
  assert.equal(ui.couponId({couponId:'legacy'}),'legacy');assert.equal(ui.couponType({discount_type:'valor_fixo'}),'fixed');
  assert.equal(ui.couponValue({discount_value:15}),15);assert.equal(ui.couponUsageCount({uses_count:4}),4);assert.equal(ui.couponUsageLimit({max_uses:8}),8);
});
