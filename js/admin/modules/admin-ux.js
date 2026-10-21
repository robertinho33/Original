// Shared presentation only: permissions and business actions remain in their own modules.
export function installAdminUX(){
  const root=document.getElementById('admin-root');if(!root)return;
  const nav=document.querySelector('.admin-navigation'),sidebar=document.querySelector('.admin-sidebar');
  if(nav&&sidebar){
    const toggle=document.createElement('button');toggle.type='button';toggle.className='admin-mobile-menu';toggle.textContent='Menu do painel';toggle.setAttribute('aria-expanded','false');
    nav.id='admin-navigation';toggle.setAttribute('aria-controls',nav.id);sidebar.insertBefore(toggle,nav);sidebar.dataset.menuOpen='false';
    toggle.addEventListener('click',()=>{const open=sidebar.dataset.menuOpen!=='true';sidebar.dataset.menuOpen=String(open);toggle.setAttribute('aria-expanded',String(open));});
    nav.addEventListener('click',event=>{if(event.target.closest('[data-admin-section]')){sidebar.dataset.menuOpen='false';toggle.setAttribute('aria-expanded','false');}});
  }
  let pending=false;
  const enhance=()=>{
    pending=false;
    for(const table of root.querySelectorAll('table')){
      const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
      for(const row of table.querySelectorAll('tbody tr'))[...row.children].forEach((cell,i)=>{if(headers[i]&&!cell.hasAttribute('colspan')&&!cell.dataset.label)cell.dataset.label=headers[i];});
    }
    const heading=document.getElementById('adminPageTitle');
    for(const button of document.querySelectorAll('[data-admin-section]'))if(button.classList.contains('active'))button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    if(heading)root.setAttribute('aria-label',heading.textContent.trim());
  };
  const observer=new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(enhance);});observer.observe(root,{childList:true,subtree:true});enhance();
}
