const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),source=fs.readFileSync(root+'/js/admin/admin.js','utf8');
const sections=source.match(/const sections = \[[\s\S]*?\];/)[0];
test('every administrative navigation button targets a registered section',()=>{
 const html=fs.readFileSync(root+'/pages/admin.html','utf8');const registered=vm.runInNewContext(sections+';sections;');
 for(const match of html.matchAll(/data-admin-section="([^"]+)"/g))assert.ok(registered.includes(match[1]),'Seção ausente: '+match[1]);
});
test('salons and perfumeries navigation mounts the partner module instead of dashboard',async()=>{
 const start=source.indexOf('async function load(section)'),end=source.indexOf('function updateHeader(',start),content={};let mounted=0,dashboard=0;
 const sandbox={window:{},root:{innerHTML:'',querySelector:()=>content},state:{},setActiveNavigation:()=>{},updateHeader:()=>{},shell:()=>'',renderBusinessPartners:async target=>{assert.equal(target,content);mounted++;},renderOperationalEnvironment:async()=>{dashboard++;},renderStoreVisits:async()=>{},console};
 vm.createContext(sandbox);vm.runInContext(sections+'\nlet catalogRequestedTab="";\n'+source.slice(start,end),sandbox);
 await sandbox.load('business-partners');assert.equal(mounted,1);assert.equal(dashboard,0);assert.equal(sandbox.state.section,'business-partners');assert.equal(sandbox.state.ready,true);
});
