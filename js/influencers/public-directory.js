import {readFollow,verifyFollow,watchFollows} from './follow-state.js?v=20261104-2';
const controls=[];
function updateFollowControl(control){
 const saved=readFollow(control.owner),confirmed=saved?.status==='confirmed';
 control.node.textContent=confirmed?'Seguindo':saved?'Ver acompanhamento':'Seguir';
 control.node.setAttribute('aria-label',(confirmed?'Você segue ':saved?'Ver acompanhamento de ':'Seguir ')+control.name);
 control.node.classList.toggle('is-following',confirmed);
 const url=new URL(control.url,location.origin);if(!saved)url.searchParams.set('seguir','1');url.hash='storeCommunity';control.node.href=url.href;
}
async function refreshFollows(){for(const control of controls){updateFollowControl(control);try{await verifyFollow(control.owner);}catch{}updateFollowControl(control);}}
watchFollows(event=>{for(const control of controls)updateFollowControl(control);if(event?.type==='storage')void refreshFollows();});
window.addEventListener('pageshow',()=>void refreshFollows());
const target = document.getElementById('influencerDirectory');
if (target) {
    const status = document.getElementById('influencerDirectoryStatus');
    const load = async () => {
        try {
            const response = await fetch('/api/discovery/influencers', {signal:AbortSignal.timeout(20000)});
            const result = await response.json();
            if (!response.ok || !result.success || !Array.isArray(result.data)) throw Error();
            const fragment = document.createDocumentFragment();
            for (const person of result.data) {
                const url = new URL(person.url, location.origin);
                if (url.origin !== location.origin || url.pathname !== '/pages/vitrine-influenciador.html') continue;
                const card = document.createElement('article'); card.className = 'influencer-mini';
                const link = document.createElement('a'); link.href = url.href; link.className = 'influencer-mini-profile';
                const initials = document.createElement('span'); initials.className = 'influencer-mini-initials'; initials.setAttribute('aria-hidden','true');
                initials.textContent = String(person.name || '').trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('');
                const frame = document.createElement('span'); frame.className='influencer-mini-photo';frame.append(initials);
                try { const imageUrl=new URL(person.image);if(imageUrl.protocol==='https:'){const image=document.createElement('img');image.src=imageUrl.href;image.alt='';image.width=72;image.height=72;image.loading='lazy';image.decoding='async';image.addEventListener('error',()=>image.remove());frame.append(image);} } catch {}
                const name = document.createElement('span'); name.textContent = person.name;
                link.append(frame,name);card.append(link);
                const visit=document.createElement('a');visit.href=url.href;visit.textContent='Ver vitrine';visit.className='influencer-mini-visit';card.append(visit);
                if(person.canFollow){const follow=document.createElement('a');follow.className='influencer-mini-follow';const control={node:follow,owner:url.searchParams.get('loja'),name:person.name,url:url.href};controls.push(control);updateFollowControl(control);card.append(follow);}
                fragment.append(card);
            }
            target.replaceChildren(fragment);void refreshFollows();
            status.textContent=target.childElementCount?'Toque na foto para conhecer a seleção de cada influenciador.':'Novas vitrines de influenciadores aparecerão aqui em breve.';
        } catch {
            status.replaceChildren(document.createTextNode('Não foi possível carregar os perfis agora. '));
            const retry=document.createElement('button');retry.type='button';retry.textContent='Tentar novamente';retry.addEventListener('click',()=>{status.textContent='Carregando…';void load();});status.append(retry);
        }
    };
    void load();
}
