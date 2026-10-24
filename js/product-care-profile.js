(function(root){
'use strict';
const options={hair:{straight:'Liso',wavy:'Ondulado',curly:'Cacheado',coily:'Crespo'},chemistry:{treated:'Com química ou coloração',natural:'Sem química'},goals:{hydration:'Hidratação e maciez',repair:'Fios danificados',frizz:'Controle do frizz',curls:'Definição dos cachos',color:'Cuidado da cor'}};
function normalize(value){const result={};for(const [field,choices] of Object.entries(options)){result[field]=[...new Set((Array.isArray(value?.[field])?value[field]:[]).filter(v=>typeof v==='string'&&Object.hasOwn(choices,v)))];}return result;}
function matches(value,input){const p=normalize(value);return (!p.hair.length||p.hair.includes(input.hair))&&(!p.chemistry.length||p.chemistry.includes(input.chemistry))&&(!p.goals.length||p.goals.includes(input.goal));}
const api={options,normalize,matches};root.ProductCareProfile=api;if(typeof module==='object'&&module.exports)module.exports=api;else root.ProductCareProfile=api;
})(typeof globalThis==='object'?globalThis:this);
