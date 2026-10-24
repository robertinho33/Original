'use strict';
const {createHash}=require('node:crypto');
const {getFirestore}=require('../../infrastructure/firebase/firebase-admin');
const values={hair:['straight','wavy','curly','coily'],chemistry:['treated','natural'],goal:['hydration','repair','frizz','curls','color'],budgetBand:['up100','100to200','200to400','over400']};
const origins=new Set(['https://www.fiosperfeitos.com.br','https://fiosperfeitos.com.br']);
const hash=v=>createHash('sha256').update(v).digest('hex');
const dayKey=(now=Date.now())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
function dimensions(input){
 if(!input || !['hair','chemistry','goal'].every(k=>values[k].includes(input[k])))return null;
 const budget=Number(input.budget);if(!Number.isFinite(budget)||budget<1||budget>10000)return null;
 return {hair:input.hair,chemistry:input.chemistry,goal:input.goal,budgetBand:budget<=100?'up100':budget<=200?'100to200':budget<=400?'200to400':'over400'};
}
function mayMeasure(req){return origins.has(req.headers?.origin) && req.headers?.['sec-gpc']!=='1' && req.headers?.dnt!=='1' && req.body?.measurement?.consent===true && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(req.body.measurement.session||'');}
async function recordInterest(db,input,result,session,now=Date.now()){
 const profile=dimensions(input);if(!profile)return false;
 const day=dayKey(now),signature=Object.values(profile).join('_');
 const receipt=db.collection('careInterestReceipts').doc(hash(day+':'+session+':'+signature));
 const aggregate=db.collection('careInterestStats').doc(day+'_'+signature);
 const complete=typeof result.routineComplete==='boolean'?result.routineComplete:result.products.length>=3;
 const outcome=complete?'complete':result.products.length?'partial':'none';
 return db.runTransaction(async tx=>{
  const [seen,previous]=await Promise.all([tx.get(receipt),tx.get(aggregate)]);if(seen.exists)return false;
  const old=previous.data()||{};
  tx.set(receipt,{expiresAt:new Date(now+2*86400000)});
  tx.set(aggregate,{day,...profile,queries:(old.queries||0)+1,complete:(old.complete||0)+Number(outcome==='complete'),partial:(old.partial||0)+Number(outcome==='partial'),none:(old.none||0)+Number(outcome==='none')});
  return true;
 });
}
function reportFilters(query={},now=Date.now()){
 const today=dayKey(now),last30=new Date(today+'T12:00:00Z');last30.setUTCDate(last30.getUTCDate()-29);
 const from=query.from||last30.toISOString().slice(0,10),to=query.to||today;
 const date=v=>typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
 if(!date(from)||!date(to)||from>to||(Date.parse(to)-Date.parse(from))/86400000>30)throw Error('Escolha um período válido de até 31 dias.');
 const result={from,to};for(const [key,options] of Object.entries(values)){const v=query[key]||'all';if(v!=='all'&&!options.includes(v))throw Error('Confira os filtros de interesses.');result[key]=v;}return result;
}
function summarize(rows,filters){
 const selected=rows.filter(row=>row.day>=filters.from && row.day<=filters.to && Object.keys(values).every(k=>filters[k]==='all'||filters[k]===row[k]));
 const totals={queries:0,complete:0,partial:0,none:0};
 const profiles=new Map();
 for(const row of selected){if(!Object.entries(values).every(([k,options])=>options.includes(row[k])))continue;
  const key=Object.keys(values).map(k=>row[k]).join('_'),profile=profiles.get(key)||Object.fromEntries(Object.keys(values).map(k=>[k,row[k]]));
  for(const key of Object.keys(totals)){const count=Number.isSafeInteger(row[key])&&row[key]>=0?row[key]:0;totals[key]+=count;profile[key]=(profile[key]||0)+count;}
  profiles.set(key,profile);
 }
 return {filters,...totals,profiles:[...profiles.values()].sort((a,b)=>b.queries-a.queries),note:'Consultas com aceite de estatísticas. Uma combinação por sessão de 30 minutos e dia; não representa pessoas únicas nem todas as visitas.'};
}
function report(getDb=getFirestore){return async(req,res)=>{
 if(req.admin?.role!=='admin')return res.status(403).json({success:false,error:'Acesso restrito ao administrador.'});
 let filters;try{filters=reportFilters(req.query);}catch(error){return res.status(400).json({success:false,error:error.message});}
 try{const snapshot=await getDb().collection('careInterestStats').where('day','>=',filters.from).where('day','<=',filters.to).limit(5001).get();
  if(snapshot.docs.length>5000)throw Error('bound');res.set('Cache-Control','no-store');res.json({success:true,data:summarize(snapshot.docs.map(doc=>doc.data()),filters)});
 }catch{res.status(503).json({success:false,error:'Não foi possível consultar os interesses agora.'});}
};}
module.exports={dimensions,mayMeasure,recordInterest,dayKey,reportFilters,summarize,report};
