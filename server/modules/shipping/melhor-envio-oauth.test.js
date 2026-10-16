const {test}=require('node:test');
const assert=require('node:assert/strict');
const {configuration,service,seal,unseal,validState,start,status,CALLBACK}=require('./melhor-envio-oauth');
const env={MELHOR_ENVIO_CLIENT_ID:'123',MELHOR_ENVIO_CLIENT_SECRET:'test-secret',MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY:'ab'.repeat(32),MELHOR_ENVIO_USER_AGENT:'Fios Perfeitos (test@example.com)'};
function dbFixture() {
    const values=new Map();let queue=Promise.resolve();
    const snapshot=ref=>({exists:values.has(ref.id),data:()=>values.get(ref.id)});
    function reference(name,id) {return {id:name+'/'+id,async get(){return snapshot(this);},async create(data){if(values.has(this.id))throw Error();values.set(this.id,data);},async set(data){values.set(this.id,data);}};}
    return {values,collection:name=>({doc:id=>reference(name,id)}),runTransaction(fn){const task=queue.then(async()=>{const writes=[];const result=await fn({get:async ref=>snapshot(ref),update:(ref,data)=>writes.push([ref.id,data])});for(const [key,data] of writes)values.set(key,{...values.get(key),...data});return result;});queue=task.catch(()=>{});return task;}};
}
const jwt=scope=>'ey.test.'.replace('test',Buffer.from(JSON.stringify({scopes:scope})).toString('base64url'));
function tokenResponse(overrides={}) {return {access_token:jwt(['shipping-calculate']),refresh_token:'refresh-secret',expires_in:3600,token_type:'Bearer',...overrides};}
function fixture(overrides={}) {return {db:dbFixture(),env,now:()=>1000000,fetch:async()=>({ok:true,json:async()=>tokenResponse()}),...overrides};}
test('tokens use authenticated encryption and reject altered ciphertext',()=>{
    const value={accessToken:'secret',refreshToken:'refresh'};
    const sealed=seal(value,env.MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY);
    assert.doesNotMatch(sealed,/secret|refresh/);assert.deepEqual(unseal(sealed,env.MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY),value);
    assert.throws(()=>unseal(sealed,'cd'.repeat(32)));
    const parts=sealed.split('.');parts[1]=Buffer.alloc(16).toString('base64url');assert.throws(()=>unseal(parts.join('.'),env.MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY));
});
test('authorization requests only quotation and binds one-use state to browser',async()=>{
    const deps=fixture(),oauth=service(deps),result=await oauth.start('owner');
    const url=new URL(result.url);assert.equal(url.origin,'https://www.melhorenvio.com.br');assert.equal(url.searchParams.get('scope'),'shipping-calculate');assert.equal(url.searchParams.get('redirect_uri'),CALLBACK);
    assert.doesNotMatch(result.url,/test-secret|refresh-secret/);
    await assert.rejects(oauth.complete({state:result.state,cookie:'ff'.repeat(32),code:'code'}));
    await oauth.complete({state:result.state,cookie:result.state,code:'code'});
    assert.equal((await oauth.status()).connected,true);
    assert.equal(await oauth.accessToken(),jwt(['shipping-calculate']));
    await assert.rejects(oauth.complete({state:result.state,cookie:result.state,code:'code'}));
    assert.doesNotMatch(JSON.stringify([...deps.db.values.values()]),/refresh-secret|accessToken/);
});
test('expired or denied state cannot connect and callback inputs are strict',async()=>{
    const deps=fixture(),oauth=service(deps),result=await oauth.start('owner');
    for(const state of ['',null,[result.state],{}]) assert.equal(validState(state,result.state),false);
    await assert.rejects(oauth.complete({state:result.state,cookie:result.state,denied:true}));
    assert.equal((await oauth.status()).connected,false);
    const another=await oauth.start('owner');
    const expired=service({...deps,now:()=>1600000});
    await assert.rejects(expired.complete({state:another.state,cookie:another.state,code:'code'}));
});
test('exchange requires exact scope and sanitizes failed provider responses',async()=>{
    for(const response of [{ok:false},{ok:true,json:async()=>tokenResponse({access_token:jwt([])})},{ok:true,json:async()=>tokenResponse({access_token:jwt(['shipping-calculate','shipping-checkout'])})},{ok:true,json:async()=>tokenResponse({refresh_token:''})}]) {
        const oauth=service(fixture({fetch:async()=>response})),result=await oauth.start('owner');
        await assert.rejects(oauth.complete({state:result.state,cookie:result.state,code:'private-code'}),e=>e.code==='SHIPPING_OAUTH_FAILED'&&!/secret|private-code/.test(e.message));
    }
});
test('expired access token is renewed and rotated credentials are persisted encrypted',async()=>{
    let calls=0;const deps=fixture({fetch:async(url,options)=>{calls++;const body=JSON.parse(options.body);assert.equal(body.client_secret,'test-secret');if(calls===2){assert.equal(body.grant_type,'refresh_token');assert.equal(body.refresh_token,'refresh-secret');}return {ok:true,json:async()=>tokenResponse({refresh_token:calls===1?'refresh-secret':'rotated-secret'})};}});
    const oauth=service(deps),result=await oauth.start('owner');await oauth.complete({state:result.state,cookie:result.state,code:'code'});
    await service({...deps,now:()=>4600000}).accessToken();assert.equal(calls,2);
    const record=deps.db.values.get('shippingPrivateCredentials/melhor_envio');
    assert.equal(unseal(record.sealed,env.MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY).refreshToken,'rotated-secret');
    assert.equal(record.leaseUntil,0);
});
test('concurrent refresh does not reuse a rotating refresh token',async()=>{
    const deps=fixture();const oauth=service(deps),result=await oauth.start('owner');await oauth.complete({state:result.state,cookie:result.state,code:'code'});
    let release;let calls=0;
    const refresh=service({...deps,now:()=>4600000,fetch:async()=>{calls++;await new Promise(resolve=>{release=resolve;});return {ok:true,json:async()=>tokenResponse()};}});
    const first=refresh.accessToken();
    while(!release) await new Promise(resolve=>setImmediate(resolve));
    await assert.rejects(refresh.accessToken(),e=>e.code==='SHIPPING_OAUTH_BUSY');
    release();await first;assert.equal(calls,1);
});
test('only store owner can start authorization or inspect connection',async()=>{
    const res={statusCode:200,sendStatus(value){this.statusCode=value;return this;}};
    for(const fn of [start,status]){await fn({admin:{role:'admin',isMaster:false}},res);assert.equal(res.statusCode,403);}
    await start({admin:{isMaster:true},headers:{origin:'https://example.com'}},res);assert.equal(res.statusCode,403);
    assert.throws(()=>configuration({...env,MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY:''}));
});
test('callback authorization code and state never appear in request logs',()=>{
    const {logger}=require('../../infrastructure/logger');const previous=logger.info;
    // Logger is frozen: capture its output rather than replacing the logger.
    const old=console.log;const logs=[];console.log=value=>logs.push(value);
    try {const {httpLogger}=require('../../infrastructure/http-logger');let finish;httpLogger({method:'GET',requestId:'test',originalUrl:'/api/shipping/melhor-envio/callback?code=private-code&state=private-state'},{on:(name,fn)=>{finish=fn;},statusCode:303},()=>{});finish();}
    finally {console.log=old;}
    assert.equal(previous,logger.info);assert.doesNotMatch(logs.join(''),/private-code|private-state/);
});
