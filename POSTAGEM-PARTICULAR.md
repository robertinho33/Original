# Postagem da loja — dados confirmados

- CEP de origem: 04883-000.
- Postagem particular, sem contrato próprio com os Correios.
- Serviços desejados: PAC e SEDEX à vista.
- Outra embalagem: comprimento 16 cm, largura 24 cm, altura 8 cm.
- Caixa vazia: 40 g. Capacidade confirmada: até quatro produtos com proteção.
- Regra autorizada pelo proprietário: cotar com peso total padrão de 2 kg, incluindo a caixa, sem somar a tara novamente. A cotação é uma estimativa e pode superar o custo de pacotes mais leves. Não preencher os produtos com pesos fictícios; limites conhecidos de peso continuam sendo respeitados.
- Preparação confirmada anteriormente: três dias úteis.
- Limite de peso bruto informado: até 2 kg por pacote. Não representa o peso exato de todos os pedidos.
- Estimativa informada pelo proprietário: seis dias úteis após a postagem, além dos três dias úteis de preparação. Referência total: até nove dias úteis, sujeita ao prazo efetivo do serviço e do destino. Não usar como prazo garantido nacional nem como resposta da API dos Correios.

Para cotação exata, ainda são necessários o peso bruto real de cada pacote e a quantidade/capacidade de produtos por embalagem. Para carrinhos diferentes, a embalagem e o peso precisam corresponder ao conjunto enviado. Não tratar o limite de 2 kg como peso medido nem presumir que qualquer carrinho cabe em um único pacote.

A integração atual do servidor exige credenciais de API com contrato e não faz cotação à vista sem esse acesso. As medidas registradas em .env.example não ativam a integração nem alteram as variáveis da hospedagem.

Alternativa preparada: o provedor melhor_envio permite cotação de PAC e SEDEX no checkout mediante conta autorizada na plataforma. Ver FRETE-MELHOR-ENVIO.md. Nesse caso, as tarifas são da plataforma e a loja deve emitir a etiqueta por ela; não são uma simulação de preço de balcão. A ativação permanece pendente das credenciais e dos dados físicos completos.

Para postagem particular, consultar o calculador oficial com CEP de destino, peso bruto e dimensões. Preço e prazo variam conforme destino e serviço. Não substituir a cotação por frete grátis, preço inventado ou prazo fixo de seis dias.

Calculador oficial: https://www2.correios.com.br/sistemas/precosPrazos/?hidemenu=true
