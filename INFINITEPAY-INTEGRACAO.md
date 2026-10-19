# InfinitePay — Fios Perfeitos

A integração adiciona uma opção InfinitePay ao checkout existente, sem remover o Mercado Pago. Está desativada por padrão. PIX e cartão são escolhidos no checkout hospedado da InfinitePay; boleto continua no Mercado Pago.

## Configuração no servidor

1. No aplicativo InfinitePay: Vendas → Checkout → Configurações → Habilitar Checkout Integrado. Crie uma API Key para esta loja.
2. Configure as variáveis no ambiente do backend, nunca em arquivos públicos:
   - `INFINITEPAY_ENABLED=false` durante a preparação.
   - `INFINITEPAY_HANDLE`: InfiniteTag sem `$`.
   - `INFINITEPAY_API_KEY`: chave secreta criada na InfinitePay. Esta implementação exige a chave para usar pagamento único e validade.
   - `PUBLIC_STORE_URL`: origem HTTPS pública da vitrine.
   - `INFINITEPAY_WEBHOOK_URL`: URL HTTPS pública do backend terminando em `/api/payments/infinitepay/webhook`.
3. Publique os arquivos do frontend e do backend. O frontend segue a mesma origem de API já usada pela loja (`aurea-pix-api.onrender.com` fora de localhost).
4. Ative `INFINITEPAY_ENABLED=true` somente depois da configuração e validação. Reinicie o servidor ao mudar variáveis.

## Fluxo e garantias

O servidor recalcula produtos, frete e cupons, reserva estoque e persiste o pedido antes de criar o link. O valor enviado é o total autorizado em centavos, em uma linha com a referência do pedido. O link aceita um pagamento e expira em 30 minutos. O navegador conserva sacola e rascunho durante o redirecionamento.

Webhook e retorno do navegador consultam `/payment_check` com a chave da conta antes de confirmar. Valores recebidos no navegador ou no webhook não são usados como comprovação. A confirmação verifica valor e método; pedido, vínculo único da transação e baixa de estoque são atualizados na mesma transação Firestore. Eventos repetidos não descontam estoque novamente. O aviso de expedição usa o mecanismo existente.

Se a criação do link tiver resposta incerta, o sistema conserva pedido e reserva e não cria automaticamente outro link para a mesma tentativa. O cliente recebe acesso ao acompanhamento. Links prontos podem ser retomados até o prazo configurado.

## Conferências antes de liberar vendas

- Validar chave, conta recebedora, URL retornada e webhook com a conta real.
- Fazer uma compra controlada, conferindo valor com frete/cupom, confirmação, estoque, acompanhamento e aviso de expedição. A integração não executa cobranças nos testes automatizados.
- Conferir retorno após PIX e cartão, atualização por webhook sem retorno do cliente e reenvio do mesmo evento.
- Não há ambiente sandbox documentado nas páginas consultadas. Trate qualquer teste com credenciais reais como uma possível venda real.

## Limites operacionais

O prazo de 30 minutos bloqueia a retomada de links vencidos. A expiração **não libera automaticamente a reserva**: antes de cancelar um pedido abandonado ou uma criação incerta, confira na InfinitePay que não houve pagamento. Essa restrição evita liberar estoque de vendas cuja confirmação atrasou. O cancelamento deve seguir o procedimento administrativo de estoque da loja.

Estornos e cancelamentos não são inferidos de notificações sem confirmação: esta versão confirma pagamentos aprovados, e o tratamento administrativo de estornos permanece manual. Não há ativação, alteração de credenciais ou publicação automática.

Documentação consultada: https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-integrado-da-infinitepay e https://www.infinitepay.io/checkout-documentacao.
