const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
function card(combo){
 const article=el('article',undefined,'combo-card');article.id=combo.id;
 const top=el('div',undefined,'combo-card-top');top.append(el('span','25% OFF','combo-badge'),el('span',`${combo.units} unidades`));article.append(top);
 article.append(el('h3',`Seleção ${combo.target.toLocaleString('pt-BR')}`),el('p',`${combo.items.length} produtos diferentes para compor seu estoque.`,'combo-subtitle'));
 const photos=el('div',undefined,'combo-photos');combo.items.slice(0,3).forEach(p=>{if(p.image){const img=el('img');img.src=p.image;img.alt=p.name;img.loading='lazy';img.width=92;img.height=110;photos.append(img);}});article.append(photos);
 const list=el('ul',undefined,'combo-products');combo.items.forEach(p=>{
  const li=el('li'),quantity=el('span',`${p.quantity}×`,'combo-quantity'),detail=el('div');
  const link=el('a',p.name);link.href='/produto/'+encodeURIComponent(p.sku);detail.append(link,el('small',`${money(p.unitCents)} por unidade`));li.append(quantity,detail,el('span',money(p.unitCents*p.quantity),'combo-line-price'));list.append(li);
 });article.append(list);
 const offer=el('div',undefined,'combo-offer');
 if(combo.available){
  offer.append(el('p',`De ${money(combo.subtotalCents)}`,'combo-original'),el('strong',money(combo.totalCents),'combo-price'),el('p',`Você economiza ${money(combo.discountCents)}`,'combo-saving'));
  offer.append(el('p','Pague em até 3x no cartão','combo-installments'));
  const text=`Olá! Quero solicitar o combo ${combo.brand} — Seleção ${combo.target}.\n`+combo.items.map(p=>`${p.quantity}x ${p.name} (${p.sku}) — ${money(p.unitCents*p.quantity)}`).join('\n')+`\nSubtotal: ${money(combo.subtotalCents)}\nDesconto de 25%: ${money(combo.discountCents)}\nTotal dos produtos: ${money(combo.totalCents)}\nGostaria de confirmar o frete e as condições de pagamento em até 3x.`;
  const button=el('a','Quero este combo ↗','solid-button');button.href='https://wa.me/5511986215473?text='+encodeURIComponent(text);button.target='_blank';button.rel='noopener noreferrer';offer.append(button);
 }else{offer.append(el('p','Combo temporariamente indisponível','combo-unavailable'),el('p','Estamos conferindo a disponibilidade dos produtos. Escolha outra seleção ou fale com a loja.'));}
 article.append(offer);return article;
}
async function load(){
 const status=document.querySelector('#combosStatus');
 try{const response=await fetch('/api/professional-combos',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();
  for(const brand of ['EcoBelle','Bela Pro']){const grid=document.querySelector(brand==='EcoBelle'?'#ecoCombos':'#belaCombos');grid.replaceChildren(...data.combos.filter(c=>c.brand===brand).map(card));}status.hidden=true;
 }catch{status.replaceChildren(el('p','Não foi possível carregar os combos.'));const retry=el('button','Tentar novamente','outline-button');retry.type='button';retry.addEventListener('click',()=>{status.textContent='Consultando os produtos…';load();});status.append(retry);}
}
load();
