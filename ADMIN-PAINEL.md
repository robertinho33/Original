# Painel simplificado — Fios Perfeitos

## Produtos e estoque
Busque por nome, SKU ou marca. Combine filtros de marca, categoria, disponibilidade e visibilidade. A lista exibe até 25 itens por página (10 no celular) e mantém os filtros ao editar.

Use **Editar** para nome, preço, descrição e categoria. Use **Movimentar estoque** para registrar entrada ou saída, com quantidade e motivo. Físico é o saldo total; reservado está comprometido com pedidos; disponível é a diferença. Uma saída não pode consumir unidades reservadas. A movimentação atualiza o saldo público da vitrine e registra uma atividade com o responsável autenticado.

**Organizar categorias** agrupa os produtos pelas categorias do cadastro. Escolher uma categoria filtra seus produtos para edição. As antigas entradas de Estoque e Categorias do menu levam à área integrada, sem excluir dados.

## Vitrine e campanhas
Abra uma das três abas: Banner da loja, Ofertas dos influenciadores ou Indicações de cuidado. O banner tem título único, mensagem, imagem opcional, destino e texto do botão. A prévia acompanha a edição. Datas e campos complementares ficam em opções recolhidas. Salvar rascunho não altera o banner atual. Salvar e publicar exige acesso de administrador e respeita as datas configuradas.

## Vendas e resultados
Consulte por período, número de pedido, cliente e pagamento. A primeira aba lista os pagamentos e abre os pedidos; a segunda mostra os produtos vendidos em pedidos pagos. O CSV acompanha a seleção de pedidos. Pendentes e cancelados/estornados não entram nas vendas pagas. Os valores usam a data de criação do pedido no fuso de São Paulo. Esta visão não calcula lucro, taxas de adquirência ou saldo a receber da InfinitePay.

## Entregas
Mostra somente pedidos pagos em três filas: a separar/preparar, em transporte e entregues. Abra o pedido para usar as ações de logística existentes. Pendências de revisão aparecem sinalizadas. A lista não cria rastreios nem altera etapas automaticamente.

## Histórico de alterações
Consulta os eventos disponíveis nas coleções administrativas audit e auditLogs. Filtre por período e busque ação, responsável ou referência. Dados antigos sem responsável permanecem identificados como não registrados. A tela não é uma garantia de auditoria completa de todas as ações históricas.

## Prévia local
Acesse http://127.0.0.1:3000/admin-preview. São 746 produtos de demonstração, pedidos fictícios e alterações temporárias. O editor de produto e os detalhes de pedido nessa prévia são demonstrativos; no painel real, os botões abrem os editores já existentes. A prévia não deve ser publicada nem substituir a autenticação do painel.

## Revisão de busca e uso no celular
A busca aceita nome, SKU e marca, ignora acentos e oferece o botão Buscar. As marcas ausentes nos registros antigos são recuperadas pelo SKU a partir do catálogo, sem regravar o banco. Produtos e vitrine compartilham os preços atuais do cadastro. A consulta administrativa de pedidos usa a API protegida, sem o limite anterior de 100 pedidos da ponte do navegador.

A camada visual comum oferece menu recolhível no celular, tabelas em cartões com rótulos, botões legíveis e formulários em uma coluna. Produtos, estoque/categorias, banner, ofertas, cuidado personalizado, financeiro, entregas e histórico receberam conferência local dos fluxos principais. A prévia usa dados demonstrativos; ela não valida gravações reais nem substitui testes autenticados em produção.

## Cupons compactos e indicadores de vendas

Os indicadores de cupons ficam em uma faixa compacta, com rótulo e quantidade lado a lado. A tabela mantém uma linha por cupom também no celular, com rolagem horizontal contida para preservar todas as colunas e ações. Os seletores de editar, ativar/desativar e excluir foram preservados.

O dashboard consulta createdAt tanto como Timestamp quanto como texto ISO; une os resultados por ID e aplica o intervalo exato no horário de São Paulo. As consultas de texto incluem margem para offsets e o filtro final elimina os dias vizinhos. Pedidos hoje conta a data de criação; faturamento e série diária somam apenas pagamentos confirmados desse grupo, usando totals.total com fallback para total e cálculo em centavos. A série cobre os últimos 30 dias incluindo hoje e a interface mostra os dias mais recentes primeiro. Este indicador não representa fluxo de caixa por data de recebimento.

Envios pendentes considera pedidos pagos com logística ainda aberta, excluindo entregues e cancelados. Usa a logística do pedido, em vez de contar documentos de rastreamento antigos ou tentativas não pagas. Nenhum documento de pedido, pagamento, rastreamento ou cupom é alterado por esses cálculos.

Validação: testes cobrem strings ISO, offsets, Timestamp, fronteira de meia-noite em São Paulo, soma exata, totais legados, pagamentos não confirmados, duplicação entre consultas e entregas concluídas. Conferir a leitura do dashboard autenticado e as ações dos cupons após a publicação.

## Padrão compacto compartilhado

As telas administrativas usam indicadores menores e tabelas em linhas, inclusive no celular. Tabelas com muitas colunas possuem rolagem horizontal no próprio contêiner; tabelas menores podem ocupar a largura disponível. Formulários e permissões mantêm o comportamento anterior. A lista de influenciadores mantém os controles de editar, gerenciar/liberar acesso e vitrine pública. O estilo comum cobre as listagens de produtos/estoque, pedidos, clientes, cupons, influenciadores, contratos, comissões, relatórios e auditoria.
