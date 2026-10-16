# Aplicativo próprio — conexão de frete

## Cadastro preparado

Nome: Fios Perfeitos. Site: https://www.fiosperfeitos.com.br.

Retorno de autorização implementado: https://www.fiosperfeitos.com.br/api/shipping/melhor-envio/callback.

Permissão solicitada: shipping-calculate. Não solicita compra de etiquetas, carteira, perfil de usuários ou gestão de produtos.

O painel exige URL HTTPS de um ambiente de testes. Foi criado um serviço Render gratuito e isolado: https://fios-perfeitos-frete-testes.onrender.com (srv-db98b0ifngtc739998fg), ligado à main deste repositório. Ele executa npm test no build e exibe o relatório de testes automatizados com respostas simuladas. Não recebe credenciais de produção, não compra etiquetas e não atende clientes. Não é o Sandbox oficial do Melhor Envio; não declarar que houve validação real no Sandbox. Conferir o deploy e o relatório antes de concluir o cadastro.

## Servidor

Publicar o código antes de iniciar a autorização. Após criar o aplicativo e obter aprovação para seu acesso, guardar no Render:

- MELHOR_ENVIO_AUTH_MODE=oauth
- MELHOR_ENVIO_CLIENT_ID e MELHOR_ENVIO_CLIENT_SECRET recebidos do provedor.
- MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY: 32 bytes aleatórios em hexadecimal, gerados e mantidos somente no servidor.
- Manter MELHOR_ENVIO_USER_AGENT com aplicação e contato.

Não trocar a chave de criptografia sem reconectar a conta. O modo OAuth não usa como alternativa o token pessoal antigo.

## Autorizar

O painel administrativo mostra Conexão de frete. Somente o proprietário cadastrado pode iniciar a conexão. O botão abre a autorização oficial do Melhor Envio. Após confirmar a permissão, o servidor troca o código por credenciais e redireciona para uma página sem códigos ou tokens na URL.

A autorização usa state aleatório de uso único, cookie HttpOnly/Secure/SameSite=Lax e prazo de dez minutos. Credenciais ficam criptografadas com AES-256-GCM na coleção shippingPrivateCredentials, separadas do catálogo. A chave de descriptografia fica no Render. As regras do Firestore devem impedir acesso direto do cliente a shippingPrivateCredentials e shippingOAuthStates. Esta implementação não altera essas regras na nuvem automaticamente.

A renovação é feita ao consultar o frete perto da expiração, com bloqueio persistido para evitar dois usos simultâneos do refresh token. Quando o provedor revoga ou expira a autorização, o proprietário precisa reconectar. Nunca registrar código, state, tokens ou respostas integrais do provedor nos logs. Configurar limpeza por TTL de expiresAt em shippingOAuthStates se desejar limpeza automática dos estados expirados.

## Validação

Testes automatizados verificam criptografia, adulteração, state, expiração, repetição, autorização do proprietário, escopo mínimo, renovação, concorrência e ausência de códigos nos logs. Esses testes usam respostas simuladas e não comprovam liberação do aplicativo real.

Após conectar a conta em produção, consultar PAC e SEDEX com um produto real sem criar pedido ou pagamento. Somente declarar frete funcionando após receber preços e prazos do provedor.
