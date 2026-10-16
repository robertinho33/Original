# Visitas e avaliações

## Dashboard

A seção Visitas à loja mostra hoje, últimos 30 dias e total. O dia segue o fuso de São Paulo. O total começa na primeira visita registrada após publicar esta versão; visitas anteriores não são recuperadas. A contagem é própria, não é uma consulta aos relatórios do Google Analytics.

Uma visita representa uma sessão de até 30 minutos em uma aba. Recarregar a página e navegar dentro da loja reutilizam a mesma sessão. Outra aba ou uma nova sessão podem somar outra visita. Somente acessos com aceite de estatísticas e sem preferência do navegador contrária à coleta são enviados. Bloqueadores, armazenamento desativado e acessos automatizados podem afetar os números; não representa pessoas únicas.

O contador funciona mesmo se o SDK do Google estiver indisponível. Falhas na contagem não impedem compras. O endpoint de consulta fica protegido pela autorização administrativa existente.

## Avaliações

Os cards mostram média e quantidade de avaliações recebidas. Sem notas, exibem estrelas vazias e Ainda sem avaliações. Falha na consulta exibe Avaliações indisponíveis.

O comprador usa seu link privado de acompanhamento para avaliar. O servidor confere o pedido persistido: pagamento confirmado, entrega concluída, produto pertencente ao pedido e ambiente real. Uma avaliação de 1 a 5 estrelas por produto por pedido; envios repetidos não somam outra nota. Não há nomes ou comentários públicos neste fluxo. Quem possui o link privado possui acesso à avaliação daquele pedido: mantenha esse link reservado.

## Persistência e publicação

Usa o Firestore já configurado no servidor, com as coleções storeVisitStats, storeVisitSessions, productRatings e verifiedProductReviews. O navegador acessa essas informações pela API do servidor. As regras de acesso direto do Firestore devem impedir escrita pública nessas coleções e leitura pública dos registros de sessões e avaliações individuais; somente os agregados são expostos na API pública de notas.

Os registros de sessão têm expiresAt para permitir uma política TTL de limpeza no Firestore. Configure TTL para esse campo na coleção storeVisitSessions se desejar remover automaticamente os registros antigos; sem TTL configurado, os registros permanecem, sem interferir na deduplicação. Não habilitar TTL nos agregados de visitas ou de notas.

Após publicar, verificar a dashboard autenticada, uma visita com aceite e uma com recusa. Avaliações reais exigem um pedido real já pago e entregue; os testes automatizados usam dados simulados e não escrevem no banco da loja.
