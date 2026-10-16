import {getAdminIdToken} from '../../auth/admin-auth.js';
export async function renderFreightConnection(root) {
    const section=document.createElement('section');section.className='module-panel';
    const heading=document.createElement('h2');heading.textContent='Conexão de frete';
    const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Verificando conexão…';
    const button=document.createElement('button');button.type='button';button.className='admin-primary-button';button.textContent='Conectar Melhor Envio';button.disabled=true;
    const detail=document.createElement('p');detail.textContent='Autorize apenas a consulta de fretes. A loja não solicitará permissão para comprar etiquetas ou acessar sua carteira.';
    section.append(heading,status,detail,button);root.prepend(section);
    async function request(path,method='GET') {
        const token=await getAdminIdToken(false);
        const response=await fetch('/api/admin/shipping/melhor-envio/'+path,{method,headers:{Authorization:'Bearer '+token},credentials:'same-origin'});
        if(!response.ok) throw Error();
        return response.json();
    }
    try {
        const {data}=await request('status');
        status.textContent=data.connected?'Conta conectada. Faça uma cotação para conferir os preços e prazos.':data.configured?'Aplicativo configurado. Autorize a conexão para consultar os fretes.':'O aplicativo ainda precisa ser configurado no servidor.';
        button.disabled=!data.configured;
        if(data.connected)button.textContent='Reconectar Melhor Envio';
    } catch {status.textContent='Conexão disponível somente ao proprietário da loja ou temporariamente indisponível.';}
    button.addEventListener('click',async()=>{
        button.disabled=true;
        try {
            const {data}=await request('connect','POST');
            const url=new URL(data.url);
            if(url.origin!=='https://www.melhorenvio.com.br'||url.pathname!=='/oauth/authorize'||url.searchParams.get('scope')!=='shipping-calculate') throw Error();
            location.assign(url.href);
        } catch {status.textContent='Não foi possível iniciar a conexão. Confira a configuração do aplicativo.';button.disabled=false;}
    });
}
