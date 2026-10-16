export async function hydrateRatings(root) {
    const nodes=[...root.querySelectorAll('[data-rating-sku]')];
    if(!nodes.length) return;
    try {
        const skus=[...new Set(nodes.map(node=>node.dataset.ratingSku))];
        const response=await fetch('/api/storefront/engagement/ratings?skus='+encodeURIComponent(skus.join(',')));
        if(!response.ok) throw Error();
        const {data}=await response.json(), bySku=new Map(data.map(row=>[row.sku,row]));
        for(const node of nodes) {
            const row=bySku.get(node.dataset.ratingSku);
            const count=Number(row?.count)||0, average=Math.max(0,Math.min(5,Number(row?.average)||0));
            const stars=document.createElement('span'); stars.setAttribute('aria-hidden','true'); stars.className='product-rating-stars';
            stars.textContent=count?'★'.repeat(Math.round(average))+'☆'.repeat(5-Math.round(average)):'☆☆☆☆☆';
            const label=document.createElement('span'); label.textContent=count?average.toFixed(1).replace('.',',')+' ('+count+' '+(count===1?'avaliação':'avaliações')+')':'Ainda sem avaliações';
            node.replaceChildren(stars,document.createTextNode(' '),label);
            node.setAttribute('aria-label',count?average.toFixed(1)+' de 5 estrelas, '+count+' avaliações de compradores':'Ainda sem avaliações de compradores');
        }
    } catch {for(const node of nodes) node.textContent='Avaliações indisponíveis';}
}
