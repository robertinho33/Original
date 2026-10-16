const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../../js/analytics/analytics-policy.js'), 'utf8');
const modulePromise = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('statistics strip URL details and exclude private and payment pages', async () => {
    const {analyticsPage} = await modulePromise;
    assert.equal(analyticsPage('https://www.fiosperfeitos.com.br/?email=private#private').page_location, 'https://www.fiosperfeitos.com.br/');
    for (const url of ['http://localhost/', 'https://www.fiosperfeitos.com.br/admin.html', 'https://www.fiosperfeitos.com.br/pages/checkout.html?payment_id=1', 'https://www.fiosperfeitos.com.br/?token=secret']) assert.equal(analyticsPage(url), null);
});
test('consent expires and rejects invalid or future records', async () => {
    const {readConsent, CONSENT_TTL} = await modulePromise;
    assert.equal(readConsent(JSON.stringify({value:'granted',savedAt:100}),101),'granted');
    for (const raw of ['broken', '{}', JSON.stringify({value:'granted',savedAt:102}), JSON.stringify({value:'granted',savedAt:101-CONSENT_TTL})]) assert.equal(readConsent(raw,101),null);
});
test('SDK loads only after consent and records one view', async () => {
    const {createAnalyticsController} = await modulePromise;
    const calls = [];
    const controller = createAnalyticsController({page:{},load:async()=>{calls.push('load');return {enable:v=>calls.push(v),pageView:()=>calls.push('view')};}});
    await controller.choose('denied'); assert.deepEqual(calls,[]);
    await controller.choose('granted'); await controller.choose('denied'); await controller.choose('granted');
    assert.deepEqual(calls,['load',true,'view',false,true]);
});
test('revocation during SDK loading prevents collection', async () => {
    const {createAnalyticsController} = await modulePromise;
    let resolve; let enabled = false;
    const controller = createAnalyticsController({page:{},load:()=>new Promise(r=>{resolve=r;})});
    const pending = controller.choose('granted');
    await controller.choose('denied');
    resolve({enable:()=>{enabled=true;},pageView:()=>assert.fail('unexpected event')});
    await pending; assert.equal(enabled,false);
});
test('browser privacy preference and unsupported pages prevent loading', async () => {
    const {createAnalyticsController} = await modulePromise;
    for (const options of [{page:null},{page:{},allowed:()=>false}]) await createAnalyticsController({...options,load:()=>assert.fail('unexpected loading')}).choose('granted');
});
test('SDK failure does not reject checkout interaction', async () => {
    const {createAnalyticsController} = await modulePromise;
    await assert.doesNotReject(createAnalyticsController({page:{},load:async()=>{throw Error('offline');}}).choose('granted'));
    await assert.doesNotReject(createAnalyticsController({page:{},load:async()=>({enable:()=>{throw Error('unsupported');}})}).choose('granted'));
});
