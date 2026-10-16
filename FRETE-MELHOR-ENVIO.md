# Frete dentro do checkout

A opção SHIPPING_PROVIDER=melhor_envio permite cotar PAC e SEDEX pela conta Melhor Envio autorizada da loja. Mantém SHIPPING_PROVIDER=correios como padrão para a integração anterior. Não troca automaticamente de provedor se faltar configuração.

O cliente informa o CEP, recebe preço e prazo, escolhe o serviço e o valor integra o total. Antes de criar o pagamento, o servidor consulta novamente e recusa valores adulterados ou cotações alteradas. Preços e prazos são os campos customizados retornados pela API. A preparação de três dias úteis é apresentada separadamente. A estimativa informada pela loja de seis dias não substitui o prazo recebido para cada destino.

## Ativar

1. O proprietário precisa criar sua conta em https://melhorenvio.com.br/ e concluir o cadastro exigido pela plataforma.
2. Conectar acesso de produção com permissão de cotação. Guardar MELHOR_ENVIO_TOKEN somente nas variáveis privadas do servidor; nunca no navegador, Git ou chat. Informar MELHOR_ENVIO_USER_AGENT com nome da aplicação e contato. A integração não compra etiquetas nem movimenta saldo.
3. Definir SHIPPING_PROVIDER=melhor_envio no servidor. Dimensões confirmadas: 16 cm de comprimento, 24 cm de largura, 8 cm de altura. Limite: SHIPPING_PACKAGE_MAX_WEIGHT_GRAMS=2000.
4. Preencher CORREIOS_PACKAGE_TARE_GRAMS com o peso real da caixa vazia e CORREIOS_PACKAGE_MAX_ITEMS com a quantidade de itens que cabe com segurança nessa caixa. Manter shippingWeightGrams real de cada produto embalado individualmente no cadastro do servidor, sem incluir novamente a caixa coletiva. Conteúdo em ml/g não substitui peso bruto. O limite de 2 kg não é tratado como peso medido de todos os pedidos.
5. Conferir uma cotação real por CEP, o total do pedido e os dados da embalagem antes de habilitar a operação. A disponibilidade pública verifica a configuração local; não certifica a validade do token nem a completude dos dados de todos os produtos.

## Postagem

As tarifas são do Melhor Envio: a loja precisa emitir a etiqueta correspondente na plataforma e postar conforme as regras dela. Pagar diretamente o frete de balcão dos Correios pode gerar outro preço. Este código somente cota e guarda os dados selecionados no pedido; emissão e pagamento da etiqueta ficam a cargo da loja.

Somente cota uma embalagem por pedido, respeitando peso e capacidade configurados. Sacolas que excedem a capacidade exigem outra cotação/embalagem e são bloqueadas para evitar cobrança incorreta. Não considera qualquer carrinho automaticamente acomodável na caixa informada.

Documentação: https://docs.melhorenvio.com.br/docs/cotacao-de-fretes e https://docs.melhorenvio.com.br/reference/calculo-de-fretes-por-produtos

Atualização autorizada pelo proprietário: usar SHIPPING_WEIGHT_MODE=fixed e SHIPPING_PACKAGE_FIXED_WEIGHT_GRAMS=2000 para cotar com pacote total estimado de 2 kg, incluindo caixa de 40 g e até quatro produtos. Não acrescentar 40 g aos 2 kg. Nesse modo, shippingWeightGrams não é obrigatório, mas pesos conhecidos que ultrapassem o limite continuam bloqueados. O checkout informa que a cotação usa peso padrão estimado e pode superar o frete de pacotes mais leves. O modo actual continua disponível para cálculos por pesos medidos; o item 4 acima descreve esse modo.

Conta criada e credencial inserida pelo proprietário no Render. Configuração de pacote e modo fixo registrada na hospedagem. O código ainda precisa ser publicado e uma cotação real precisa ser confirmada. Não declarar o frete ativo antes dessa verificação.
