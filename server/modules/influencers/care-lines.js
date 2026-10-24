'use strict';
const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function careLine(product){
 const name=normalize(product.name);
 const brand=/bela ?pro/.test(name)?'bela-pro':/eco ?belle/.test(name)?'ecobelle':normalize(product.brand||product.sourceName||product.sourceId);
 const known=[
  [/hidrasim/,'hidrasim','HidraSim'],[/nutrisim/,'nutrisim','NutriSim'],[/curlys cachos/,'curlys-cachos','Curlys Cachos'],[/liso magico/,'liso-magico','Liso Mágico'],
  [/coco.*camomila/,'coco-camomila','Coco & Camomila'],[/pimenta rosa/,'pimenta-rosa','Pimenta Rosa'],[/doeden.*capim limao.*alecrim/,'doeden-capim-limao-alecrim','doÈden Capim-Limão e Alecrim'],
  [/manutencao lama.*la boue/,'manutencao-lama','Manutenção Lama La Boue'],[/la boue.*verte/,'la-boue-verte','La Boue Verte'],[/la boue.*blanc/,'la-boue-blanc','La Boue Blanc'],
  [/algas marinhas/,'algas-marinhas','Algas Marinhas'],[/leite de coco/,'leite-coco','Leite de Coco']
 ];
 for(const [pattern,id,label]of known)if(pattern.test(name))return {key:brand+':'+id,label};
 // Unknown lines are matched only by a strict, non-generic remainder, never by brand alone.
 const remainder=name.replace(/\b\d+(?: \d+)?\s*(?:ml|m l|l|g|kg)\b/g,' ').replace(/\b(?:shampoo|condicionador|recondicionador|mascara|tratamento|finalizador|creme|de|pentear|leave|in|novo|nova|embalagem|hidratante|hidratacao|profunda|intensivo|reparador|pontas|capilar|serum)\b/g,' ').replace(/\s+/g,' ').trim();
 if(!remainder || remainder.split(' ').length<2)return null;
 return {key:brand+':'+remainder,label:remainder};
}
function productRole(product){
 const name=normalize(product.name);
 if(/\bshampoo\b/.test(name))return 'wash';
 if(/condicionador/.test(name))return 'condition';
 if(/mascara|tratamento/.test(name))return 'treat';
 return 'finish';
}
module.exports={careLine,productRole};
