const origin='https://www.fiosperfeitos.com.br';
export function storeShareUrl(value){
 try{const url=new URL(value,origin);if(url.origin!==origin||url.pathname!=='/pages/vitrine-influenciador.html'||!url.searchParams.get('loja'))return '';return origin+url.pathname+'?'+new URLSearchParams({loja:url.searchParams.get('loja')});}catch{return '';}
}
export function mountStoreSharing(container){
 if(!container)return {update(){},reset(){}};
 const copy=container.querySelector('[data-copy-store]'),whatsapp=container.querySelector('[data-share-store-whatsapp]'),message=container.querySelector('[data-share-message]'),field=container.querySelector('[data-share-url]');let current='';
 copy.addEventListener('click',async()=>{
  if(!current)return;
  try{await navigator.clipboard.writeText(current);message.textContent='Link copiado! Compartilhe na bio, nos stories ou nas mensagens.';}
  catch{field.focus();field.select();message.textContent='Selecione e copie o endereço acima para compartilhar.';}
 });
 return {
  update(value,name){current=storeShareUrl(value);container.hidden=!current;field.value=current;message.textContent='';if(current)whatsapp.href='https://wa.me/?text='+encodeURIComponent('Conheça minha seleção de produtos na Fios Perfeitos'+(name?' — '+name:'')+': '+current);else whatsapp.removeAttribute('href');},
  reset(){current='';container.hidden=true;field.value='';message.textContent='';whatsapp.removeAttribute('href');}
 };
}
