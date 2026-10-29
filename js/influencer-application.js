const form=document.querySelector('form'),status=document.getElementById('applicationStatus');
form.addEventListener('submit',async event=>{
 event.preventDefault();const button=form.querySelector('button');if(button.disabled)return;
 const data=Object.fromEntries(new FormData(form));data.consent=form.elements.consent.checked;data.adult=form.elements.adult.checked;
 button.disabled=true;status.textContent='Enviando…';
 try{const response=await fetch('/api/influencer-applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw Error(result.error||'Não foi possível enviar.');form.reset();status.textContent=result.message;}
 catch(error){status.textContent=error.message||'Não foi possível enviar. Tente novamente.';}finally{button.disabled=false;}
});
