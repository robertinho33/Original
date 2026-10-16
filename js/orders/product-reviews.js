export async function mountProductReviews(root,token) {
    root.querySelector('[data-product-reviews]')?.remove();
    if(!/^[a-f0-9]{64}$/i.test(token || '')) return;
    const section=document.createElement('article'); section.className='tracking-card'; section.dataset.productReviews=''; root.append(section);
    const title=document.createElement('h2'); title.textContent='Avalie seus produtos';
    const status=document.createElement('p'); status.setAttribute('role','status'); status.textContent='Carregando avaliações…'; section.append(title,status);
    try {
        const response=await fetch('/api/storefront/engagement/review-products',{headers:{Authorization:'Bearer '+token}});
        if(!response.ok) throw Error();
        const {data}=await response.json();
        status.textContent=data.length?'Sua opinião ajuda outros clientes. Uma avaliação por produto neste pedido.':'As avaliações são liberadas após o pagamento e a entrega. Produtos já avaliados não aparecem novamente.';
        for(const item of data) {
            const form=document.createElement('form'); form.className='product-review-form';
            const label=document.createElement('label'); label.textContent=item.name+' — Sua nota: ';
            const select=document.createElement('select'); select.required=true;
            const placeholder=document.createElement('option'); placeholder.value=''; placeholder.textContent='Escolha de 1 a 5 estrelas'; select.append(placeholder);
            for(let i=1;i<=5;i++){const option=document.createElement('option'); option.value=i; option.textContent='★'.repeat(i)+'☆'.repeat(5-i)+' — '+i+' de 5'; select.append(option);}
            label.append(select);
            const button=document.createElement('button'); button.type='submit'; button.textContent='Enviar avaliação';
            const result=document.createElement('p'); result.setAttribute('role','status');
            form.append(label,button,result); section.append(form);
            form.addEventListener('submit',async event=>{
                event.preventDefault(); button.disabled=true; result.textContent='Enviando…';
                try {
                    const saved=await fetch('/api/storefront/engagement/reviews',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({sku:item.sku,stars:Number(select.value)})});
                    const body=await saved.json();
                    if(!saved.ok) throw Error(body.error || 'Não foi possível enviar. Tente novamente.');
                    result.textContent='Avaliação registrada. Obrigado!'; select.disabled=true;
                } catch(error){result.textContent=error.message || 'Não foi possível enviar. Tente novamente.'; button.disabled=false;}
            });
        }
    } catch {status.textContent='Não foi possível carregar as avaliações. Consulte o pedido novamente para tentar.';}
}
