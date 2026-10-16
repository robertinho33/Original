const status=new URL(location.href).searchParams.get('status');
document.getElementById('connectionStatus').textContent=status==='connected'?'Conta conectada para consultar fretes. Volte ao painel e confira uma cotação antes de liberar a operação.':'A autorização não foi concluída. Volte ao painel para tentar novamente. Nenhuma etiqueta foi comprada.';
history.replaceState(null,'',location.pathname);
