## Correios

Origem configurada no código: 04883-000. Integração usa APIs oficiais Preço/Prazo e autenticação no servidor. PAC, SEDEX, SEDEX 10 e SEDEX 12 aparecem apenas com preço e prazo válidos. Opções indisponíveis são omitidas; alterar CEP invalida a seleção. O servidor consulta novamente e recusa valor alterado antes do pagamento. Fretes simulados foram removidos.

Preparação confirmada pelo lojista: até 3 dias úteis após confirmação do pagamento, além do prazo de transporte. CEP de origem e preparação foram salvos nas variáveis do serviço aurea-pix-api no Render em 15/10/2026. O código local usa 3 dias por padrão quando a variável está ausente ou vazia.

A conferência das quatro fontes CSV ativas encontrou tamanho/conteúdo comercial em ml, L, g e kg, mas não peso bruto de postagem nem dimensões da caixa. As duas ocorrências de 30 cm em Brae.csv são instruções de uso, não dimensões. Nenhum peso ou dimensão de envio foi inventado ou gravado no catálogo.

**Ainda não ativado em produção.** Faltam:
- Conta/contrato com acesso às APIs e código de acesso configurado como segredo no servidor.
- CORREIOS_DR e contrato, conforme cadastro dos Correios.
- Medidas reais da caixa, tara e capacidade máxima nas variáveis CORREIOS_PACKAGE_*.
- shippingWeightGrams real no cadastro de cada produto do servidor. Não foi convertido volume em ml para peso.
- Validar preço/prazo com credenciais reais e CEPs atendidos antes de publicar.

Enquanto falta configuração, o checkout informa indisponibilidade da entrega e impede comprar com frete fictício. Retirada continua com frete zero. O pagamento só deve ser testado em ambiente de teste.

## Pendências de confiança e validação

Faltam razão social e endereço empresarial completo. O CNPJ foi validado matematicamente, sem consulta cadastral oficial. A política de devolução respeita o direito de arrependimento previsto no CDC; operação e endereço de devolução precisam ser confirmados pela loja.

A revisão visual no navegador não pôde ser realizada: o ambiente não abriu a prévia local. Há uma prévia HTML estática para revisar a direção visual; ela não testa busca, checkout ou APIs.

Nesta atualização foram alteradas apenas as configurações não secretas de CEP de origem e prazo de preparação no Render. Não foram criadas credenciais, contratados serviços, compradas etiquetas nem alterados pedidos de produção. A ativação da API ainda depende do cadastro/contrato da empresa e dos dados físicos de envio.

Documentação oficial: https://www.correios.com.br/atendimento/developers/manuais/manual-api-preco-1 e https://www.correios.com.br/atendimento/developers/manuais/manual-api-prazo.
