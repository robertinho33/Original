'use strict';
let modelPromise,busy=false,worker;
function decision(predictions){
 const values=Object.fromEntries(predictions.map(p=>[p.className,p.probability]));
 if(!['Porn','Hentai','Sexy','Neutral','Drawing'].every(key=>Number.isFinite(values[key])&&values[key]>=0&&values[key]<=1))return {status:'unavailable'};
 if(values.Porn>=.35||values.Hentai>=.35||values.Sexy>=.4)return {status:'blocked'};
 return {status:values.Porn>=.12||values.Hentai>=.12||values.Sexy>=.2?'review':'clear'};
}
async function prepareImage(value){
 const {CommunityError}=require('./community-service');
 if(typeof value!=='string'||value.length>1500000||!/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value))throw new CommunityError(400,'Envie uma foto JPG, PNG ou WebP de até 1 MB.');
 const bytes=Buffer.from(value.split(',')[1],'base64');if(bytes.length>1000000)throw new CommunityError(400,'Foto acima de 1 MB.');
 try{
  const sharp=require('sharp');const meta=await sharp(bytes,{limitInputPixels:12000000,animated:false}).metadata();
  if(!['jpeg','png','webp'].includes(meta.format)||meta.pages>1||!meta.width||!meta.height)throw Error();
  let output=await sharp(bytes,{limitInputPixels:12000000}).rotate().resize({width:1000,height:1000,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality:76}).toBuffer();
  if(output.length>180000)output=await sharp(output).resize({width:800,height:800,fit:'inside'}).jpeg({quality:48}).toBuffer();
  if(output.length>180000)throw Error();return output;
 }catch{throw new CommunityError(400,'Não foi possível validar esta imagem. Use uma foto JPG, PNG ou WebP menor.');}
}
async function analyzeLocally(bytes){
 let tensor;
 try{
  const tf=require('@tensorflow/tfjs'),sharp=require('sharp');
  if(!modelPromise)modelPromise=(async()=>{
   await tf.setBackend('cpu');await tf.ready();
   const {load}=require('nsfwjs/core'),path=require('node:path');
   const directory=path.resolve(path.dirname(require.resolve('nsfwjs/models/mobilenet_v2')),'../../models/mobilenet_v2');
   const spec=require(path.join(directory,'model.min.js'));
   const shards=spec.weightsManifest.flatMap(group=>group.paths).map(name=>Buffer.from(require(path.join(directory,name+'.min.js')),'base64'));
   const bytes=Buffer.concat(shards);
   // Read the pinned bundled assets directly: the browser import helper expands
   // each base64 character into a namespace property and exceeds small servers.
   return load({load:async()=>({modelTopology:spec.modelTopology,weightSpecs:spec.weightsManifest.flatMap(group=>group.weights),weightData:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),format:spec.format,generatedBy:spec.generatedBy,convertedBy:spec.convertedBy})},{size:224});
  })().catch(error=>{modelPromise=null;throw error;});
  const model=await modelPromise;
  const raw=await sharp(bytes).resize(224,224,{fit:'cover'}).removeAlpha().toColourspace('srgb').raw().toBuffer();
  tensor=tf.tensor3d(new Uint8Array(raw),[224,224,3],'int32');
  return decision(await model.classify(tensor,5));
 }catch{return {status:'unavailable'};}
 finally{tensor?.dispose();}
}
async function analyzeImage(bytes){
 if(busy)return {status:'unavailable'};busy=true;
 return new Promise(resolve=>{
  const {Worker}=require('node:worker_threads');
  if(!worker){try{worker=new Worker(require('node:path').join(__dirname,'image-moderation-worker.js'),{resourceLimits:{maxOldGenerationSizeMb:192}});const created=worker;created.on('error',()=>{if(worker===created)worker=null;});created.on('exit',()=>{if(worker===created)worker=null;});worker.unref();}catch{busy=false;resolve({status:'unavailable'});return;}}
  const current=worker;current.ref();let finished=false;
  const timer=setTimeout(()=>{current.terminate();if(worker===current)worker=null;finish({status:'unavailable'});},45000);
  function finish(result){if(finished)return;finished=true;clearTimeout(timer);current.removeListener('message',finish);current.removeListener('error',error);current.removeListener('exit',exit);current.unref();busy=false;resolve(['clear','review','blocked'].includes(result?.status)?result:{status:'unavailable'});}
  function error(){if(worker===current)worker=null;finish({status:'unavailable'});}
  function exit(){if(worker===current)worker=null;finish({status:'unavailable'});}
  current.once('message',finish);current.once('error',error);current.once('exit',exit);current.postMessage(Buffer.from(bytes));
 });
}
module.exports={prepareImage,analyzeImage,analyzeLocally,decision};
