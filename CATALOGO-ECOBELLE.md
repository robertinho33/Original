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
- 49 pendentes, incluindo 5 kits com finalidade conferida mas composição ainda pendente.
- 11 fora do questionário capilar; permanecem à venda.

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

As quatro perguntas básicas continuam sendo cabelo, química, objetivo e orçamento. Para cuidado da cor, aparece uma pergunta adicional sobre o tom. Sem essa resposta, matizadores não entram. `blonde_only` exige loiro/descolorido; `light_tones_only` aceita também grisalho/branco. Outros tons não recebem matizadores.

Com os novos dados EcoBelle, a seleção automática usa somente finalidade verificada e uso doméstico. Não infere indicação por preço, nome da linha ou cadastro antigo. Escopos explícitos são respeitados. Escopos desconhecidos permitem busca por finalidade, com observação sobre a informação ausente. Procedimentos químicos e uso profissional não entram.

Acima de R$ 120, escolhe primeiro um kit com finalidade confirmada e composição conferida. Objetivo principal tem prioridade sobre secundários; escopos conhecidos ajudam a desempatar; depois vem o maior preço e SKU. Complementos precisam ter finalidade confirmada para o mesmo objetivo, não podem repetir componentes do kit e entram por preço decrescente enquanto couberem no saldo. Cada SKU aparece uma vez. Se faltarem complementos pertinentes, o saldo permanece livre. Essa regra não é um otimizador de quantidade máxima nem de soma mais próxima.

Sem kit elegível, retorna individuais com finalidade confirmada. Sem produtos elegíveis, orienta contato com a loja. Não completa o orçamento com itens sem indicação confirmada. Frete separado.

O editor administrativo mostra a ficha EcoBelle, escopos, composição, restrições, fonte e data. As marcações gerais antigas continuam disponíveis; a seleção EcoBelle usa `catalogProfile`, revisado e importado pelo CSV. Alterações nas marcações gerais não modificam a evidência oficial.

## Importação e validação

Importadores aceitam descrições entre aspas, quebras de linha e ponto e vírgula. O importador antigo cria apenas produtos ausentes. O importador completo do fornecedor atualiza também campos comerciais: não usá-lo para uma operação somente de classificação.

A atualização desta revisão foi feita somente nos atributos dos 118 registros EcoBelle, com cópia de segurança, verificação de concorrência e auditoria em `catalogSupplierImports`. Nenhuma diferença comercial foi encontrada após a gravação. Um CSV pendente não substitui classificação anteriormente aprovada.

263 testes passaram: combinações de cabelo, química, objetivo e orçamento, finalidade, estoque, ocultação, soma em centavos, composição sem repetição, restrições de tom e proteção dos dados administrativos. Na simulação ondulado/com química/frizz/R$ 490, os preços conferidos nesta revisão retornaram um kit e quatro complementos por R$ 424,88. Preços e disponibilidade podem mudar na operação normal.
