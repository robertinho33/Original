## Correios

Origem configurada no código: 04883-000. Integração usa APIs oficiais Preço/Prazo e autenticação no servidor. PAC, SEDEX, SEDEX 10 e SEDEX 12 aparecem apenas com preço e prazo válidos. Opções indisponíveis são omitidas; alterar CEP invalida a seleção. O servidor consulta novamente e recusa valor alterado antes do pagamento. Fretes simulados foram removidos.

**Ainda não ativado em produção.** Faltam:
- Conta/contrato com acesso às APIs e código de acesso configurado como segredo no servidor.
- CORREIOS_DR e contrato, conforme cadastro dos Correios.
- Medidas reais da caixa, tara, capacidade máxima e prazo de preparação nas variáveis CORREIOS_PACKAGE_* e CORREIOS_PREPARATION_DAYS.
- shippingWeightGrams real no cadastro de cada produto do servidor. Não foi convertido volume em ml para peso.
- Validar preço/prazo com credenciais reais e CEPs atendidos antes de publicar.

Enquanto falta configuração, o checkout informa indisponibilidade da entrega e impede comprar com frete fictício. Retirada continua com frete zero. O pagamento só deve ser testado em ambiente de teste.

## Pendências de confiança e validação

Faltam razão social e endereço empresarial completo. O CNPJ foi validado matematicamente, sem consulta cadastral oficial. A política de devolução respeita o direito de arrependimento previsto no CDC; operação e endereço de devolução precisam ser confirmados pela loja.

A revisão visual no navegador não pôde ser realizada: o ambiente não abriu a prévia local. Há uma prévia HTML estática para revisar a direção visual; ela não testa busca, checkout ou APIs.

Não houve publicação, alteração de segredos, envio de mensagens, compra ou modificação de dados de produção. O pacote contém apenas arquivos alterados; mantenha a instalação e configuração atuais do projeto.

Documentação oficial: https://www.correios.com.br/atendimento/developers/manuais/manual-api-preco-1 e https://www.correios.com.br/atendimento/developers/manuais/manual-api-prazo.
