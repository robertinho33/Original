'use strict';
function planAdjustment(physical,reserved,delta){
  if(![physical,reserved,delta].every(Number.isSafeInteger)||physical<0||reserved<0||delta===0)throw Error('Informe uma quantidade inteira válida para movimentar o estoque.');
  const next=physical+delta;
  if(!Number.isSafeInteger(next)||next<0)throw Error('Estoque insuficiente para esta saída.');
  if(next<reserved)throw Error('Esta saída usaria unidades reservadas para pedidos. Confira as reservas antes de ajustar.');
  return {physical:next,reserved,available:next-reserved};
}
module.exports={planAdjustment};
