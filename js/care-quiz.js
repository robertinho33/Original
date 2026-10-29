export function mountCareQuiz(form){
 const panels=[...form.querySelectorAll('[data-quiz-panel]')];if(!panels.length)return;
 let step=0;const next=form.querySelector('[data-quiz-next]'),back=form.querySelector('[data-quiz-back]'),submit=form.querySelector('[type=submit]'),progress=form.querySelector('[data-quiz-progress]');
 function show(){panels.forEach((p,i)=>p.hidden=i!==step);back.hidden=step===0;next.hidden=step===panels.length-1;submit.hidden=step!==panels.length-1;progress.textContent=['1 de 3 · Seu cabelo','2 de 3 · Seu momento','3 de 3 · Seu investimento'][step];progress.setAttribute('aria-valuenow',step+1);}
 next.addEventListener('click',()=>{const invalid=[...panels[step].querySelectorAll('input,select')].find(i=>!i.checkValidity());if(invalid){invalid.reportValidity();return;}step++;show();panels[step].querySelector('input,select')?.focus();});
 back.addEventListener('click',()=>{step=Math.max(0,step-1);show();});
 form.querySelectorAll('[data-budget]').forEach(button=>button.addEventListener('click',()=>{form.elements.budget.value=button.dataset.budget;form.elements.budget.dispatchEvent(new Event('input',{bubbles:true}));form.elements.budget.focus();}));
 form.addEventListener('keydown',event=>{if(event.key==='Enter'&&step<panels.length-1&&event.target.tagName==='INPUT'){event.preventDefault();next.click();}});
 form.addEventListener('invalid',event=>{const panel=event.target.closest('[data-quiz-panel]');if(panel&&panel.hidden){step=panels.indexOf(panel);show();}},{capture:true});
 show();return {open(){step=0;show();}};
}
