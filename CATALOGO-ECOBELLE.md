# Seleção EcoBelle — revisão de 29/10/2026

As oito colunas comerciais originais foram preservadas: SKU, nome, peso, preço, categoria, estoque, descrição e imagem. CSV UTF-8, separador `;`, listas com `|`. SKUs são texto, inclusive zeros à esquerda.

## Oito grupos de atributos

1. Tipo e etapa: individual ou kit; lavar, condicionar, tratar ou finalizar.
2. Finalidade: objetivo principal separado dos secundários.
3. Tipo de cabelo, conforme a fonte.
4. Química, sem presumir compatibilidade a partir de um campo vazio.
5. Marca e linha, separadas da categoria e do fornecedor.
6. Composição do kit, com SKU e quantidade conferidos.
7. Uso e restrições: doméstico, profissional ou desconhecido; restrições de tom e procedimento.
8. Evidência: ficha oficial do SKU, data e situação da revisão.

Preço, estoque disponível e visibilidade usam os dados comerciais atuais da loja. O estoque do CSV não foi importado nesta operação.

## Resultado da revisão

Foram localizadas fichas oficiais correspondentes ao SKU de 117 dos 118 registros EcoBelle. A finalidade de 63 produtos foi conferida e registrada em `data/catalog/ecobelle-evidence.json`, com fontes individuais. Isso não confirma todas as compatibilidades.

- 58 registros com finalidade verificada e revisão aprovada para os filtros, incluindo 6 kits com composição conferida.
- 44 pendentes, incluindo 5 kits com finalidade conferida mas composição ainda pendente.
- 16 fora do questionário capilar, incluindo oxidantes; permanecem à venda.

Entre os 58 aprovados, apenas 10 têm escopo de tipo de cabelo explicitamente preenchido e 6 têm escopo químico preenchido. Os demais conservam `unknown`. Sete produtos têm restrições de tom; aprovação não remove essas restrições. Disponibilidade comercial continua sendo requisito.

Os outros três fornecedores não receberam novas aprovações. Brae.csv (339), Inovax.csv (65) e Truss-clean.csv (225) mantêm 27 colunas. EcoBelle.csv (118) passa a 30. Os arquivos históricos não são fontes ativas.

## Modelo e manutenção

As 19 colunas comuns de classificação permanecem. EcoBelle acrescenta:

| Coluna | Valores / significado |
|---|---|
| care_usage | `home`, `professional`, `unknown` |
| care_evidence_status | `purpose_verified` ou `unverified` |
| care_verified_at | Data ISO da conferência, `AAAA-MM-DD` |

Objetivos: `hydration`, `nutrition`, `repair`, `frizz`, `curls`, `oiliness`, `color`. Tipos de cabelo: `straight`, `wavy`, `curly`, `coily`. Química: `natural`, `treated`.

Escopos: `unknown` = não informado; `selected` = opções confirmadas; `all` = todos, com confirmação. Não preencher listas para `unknown`. `all` exige lista completa ou vazia. Nenhum campo desconhecido é convertido em indicação universal.

`primary_goal` deve estar em `care_goals`. Composição: `SKU:quantidade|SKU:quantidade`. A validação rejeita componentes repetidos, ausentes, o próprio kit e quantidades inválidas. Kit aprovado exige composição aprovada.

No modelo anterior (27 colunas), aprovação geral exige indicações preenchidas. No modelo EcoBelle (30 colunas), é possível aprovar a finalidade mantendo cabelo/química desconhecidos, desde que a fonte seja uma ficha oficial do domínio Grupo EcoBelle, haja data, objetivo, tipo, etapa e uso doméstico. A interface mostra a informação ausente em “Sobre esta indicação”. Não se trata de certificação de compatibilidade química.

## Funcionamento da página

O questionário tem três etapas: cabelo/química; prioridade/comprimento e pontas; orçamento. A condição do comprimento pode ser normal, ressecada, danificada ou com frizz. Para cuidado da cor, aparece uma pergunta adicional sobre o tom. Sem essa resposta, matizadores não entram. `blonde_only` exige loiro/descolorido; `light_tones_only` aceita também grisalho/branco. Outros tons não recebem matizadores.

Com os novos dados EcoBelle, a seleção automática usa somente finalidade verificada e uso doméstico. Não infere indicação por preço, nome da linha ou cadastro antigo. Escopos explícitos são respeitados. Escopos desconhecidos permitem busca por finalidade, com observação sobre a informação ausente. Procedimentos químicos e uso profissional não entram.

Toda opção exibida começa obrigatoriamente por um kit. Escolhe o kit de maior preço entre os que atendem à prioridade, aos escopos e à composição conferida, inclusive em limites de R$ 120 ou menores quando houver kit que caiba. Se faltar um kit específico para a prioridade, procura um kit compatível com o cuidado adicional informado. Quando existe um individual confirmado para o objetivo principal, reserva orçamento para ele. Sem indicação confirmada para o objetivo principal naquele perfil, pode atender ao cuidado adicional, informando essa limitação. Como última possibilidade, um kit-base de hidratação/nutrição só entra se houver espaço para um individual que atenda a uma necessidade informada. Não amplia a indicação de tipo de cabelo nem apresenta o kit de apoio como específico para o objetivo principal.

Complementos entram por preço decrescente enquanto couberem no saldo, sem repetir componentes do kit. Atendem ao objetivo principal ou, somente nas etapas tratar/finalizar, à finalidade principal confirmada para a necessidade adicional do comprimento: ressecamento → nutrição/hidratação; danos → reparação; frizz → controle do frizz. Pontas normais não adicionam necessidades. O individual reservado também é apresentado em ordem de preço entre os complementos. Cada SKU aparece uma vez. Empate de preço usa SKU para manter estabilidade. Se faltarem opções pertinentes, o saldo permanece livre. Essa regra não é um otimizador de quantidade máxima nem de soma mais próxima.

Sem kit elegível dentro do orçamento, não retorna combinações de itens avulsos: orienta ajustar o valor ou entrar em contato. A regra vale também para configurações antigas de curadoria manual na rota pública. A interface rejeita qualquer combinação que não comece por kit. Não completa o orçamento com itens sem indicação confirmada. Frete separado.

## Três opções para comparar

O resultado apresenta até três combinações. A primeira mantém a seleção por preço decrescente. As próximas priorizam outros kits elegíveis; quando faltam kits distintos, variam os complementos preservando o kit e o objetivo principal. Conjuntos com os mesmos SKUs são considerados iguais independentemente da ordem e não se repetem. Cada opção respeita integralmente o mesmo orçamento, estoque, composição e restrições. O cálculo é limitado a vinte tentativas de kits e vinte e quatro variações de complementos por seleção-base.

O resumo inicial mostra as três opções com fotos e totais. Os cartões de comparação atualizam a galeria, o detalhamento e o valor ao escolher uma opção. A sacola recebe somente os produtos da opção selecionada. Quando o catálogo não permite três combinações adequadas, a página informa a quantidade efetivamente disponível, sem duplicar conjuntos para completar a contagem.

O editor administrativo mostra a ficha EcoBelle, escopos, composição, restrições, fonte e data. A tabela em lote mostra os sete objetivos, inclusive nutrição e oleosidade. Para todos os produtos importados, usa a ficha de origem: indicações pendentes não viram universais; produtos fora do questionário não recebem indicações capilares. Essas fichas ficam protegidas contra edição pelos controles gerais antigos e são atualizadas pelo CSV com fonte conferida. Produtos manuais continuam editáveis.

## Importação e validação

Importadores aceitam descrições entre aspas, quebras de linha e ponto e vírgula. O importador antigo cria apenas produtos ausentes. O importador completo do fornecedor atualiza também campos comerciais: não usá-lo para uma operação somente de classificação.

A atualização desta revisão foi feita somente nos atributos dos 118 registros EcoBelle, com cópia de segurança, verificação de concorrência e auditoria em `catalogSupplierImports`. Nenhuma diferença comercial foi encontrada após a gravação. Um CSV pendente não substitui classificação anteriormente aprovada.

Os 747 cadastros foram alinhados à classificação existente, com cópia de segurança: 690 precisaram de atualização de indicações ou de classificação de oxidantes. Nenhuma diferença comercial foi encontrada. Isso não representa aprovação das fichas pendentes nem nova pesquisa sobre outras marcas.

Testes cobrem combinações de cabelo, química, objetivo, comprimento e orçamento, finalidade, estoque, ocultação, soma em centavos, composição sem repetição, restrições de tom e proteção dos dados administrativos. Na simulação ondulado/com química/raiz oleosa/R$ 490, pontas ressecadas resultaram em R$ 479,00; danificadas em R$ 481,18; com frizz em R$ 424,88. Cada combinação mantém o kit e acrescenta produtos pertinentes distintos, com os preços conferidos nesta revisão. Preços e disponibilidade podem mudar na operação normal.
