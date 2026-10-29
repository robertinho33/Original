# CSVs de produtos — preenchimento e revisão

Os quatro arquivos ativos foram ampliados de 8 para 27 colunas. Os valores originais de SKU, nome, peso, preço, categoria, estoque, descrição e imagem foram preservados, inclusive zeros à esquerda dos códigos. Formato: UTF-8, separador ponto e vírgula. Dentro de listas, use `|`.

| Arquivo | Registros |
|---|---:|
| Brae.csv | 339 |
| EcoBelle.csv | 118 |
| Inovax.csv | 65 |
| Truss-clean.csv | 225 |
| Total | 747 |

Os arquivos Tru.csv, Truss_.csv, Truss.csv e outros históricos não fazem parte das quatro fontes ativas e não foram alterados. Não substitua Truss-clean.csv por essas cópias antigas.

## Como revisar

1. Filtre `care_review_status` por `pending`.
2. Confira marca, linha, categoria, tipo e etapa do produto.
3. Confira as indicações com o rótulo ou a ficha do fabricante. Os preenchimentos por nome e descrição são sugestões, não aprovações.
4. Defina o objetivo principal. Ter vários objetivos em `care_goals` não significa que todos tenham a mesma prioridade.
5. Confira os componentes dos kits pelo SKU, tamanho da embalagem e quantidade.
6. Preencha a fonte em `care_source`. Depois da conferência, use `approved`. Produtos que devem ficar fora da recomendação podem usar `excluded`.

A revisão inicial foi importada em 29/10/2026: 3 registros aprovados com fonte do fabricante, 32 classificados fora do questionário e 712 pendentes. Nos pendentes, dados anteriores ou sugeridos continuam identificados para conferência. Não houve aprovação em massa.

## Colunas novas

| Coluna | Uso |
|---|---|
| source_id | Fornecedor: `brae`, `ecobelle`, `inovax` ou `truss`. |
| brand | Marca comercial, separada do fornecedor. |
| line | Linha do produto, por exemplo HidraSim. |
| product_category | Categoria organizada, por exemplo `cuidados-capilares`, `cuidados-com-a-pele` ou `perfumaria`. |
| product_subcategory | Subcategoria, por exemplo `shampoos`, `condicionadores`, `mascaras-e-tratamentos`, `finalizadores` ou `kits`. |
| product_type | `individual` ou `kit`. |
| care_step | `wash` (lavar), `condition` (condicionar), `treat` (tratar), `finish` (finalizar), `scalp` (couro cabeludo), `accessory` (acessório) ou `kit`. |
| hair_types | `straight` (liso), `wavy` (ondulado), `curly` (cacheado), `coily` (crespo). Exemplo: `wavy|curly`. |
| hair_scope | `unknown` (não informado), `selected` (somente os tipos listados) ou `all` (todos, após confirmação). |
| chemistry_types | `natural` (sem química), `treated` (com química ou coloração). Exemplo: `natural|treated`. Mantém as opções do questionário atual. |
| chemistry_scope | `unknown`, `selected` ou `all`, com o mesmo significado do campo de cabelo. |
| care_goals | `hydration` (hidratação), `repair` (reparação), `frizz` (controle do frizz), `curls` (definição), `color` (cuidado da cor). |
| primary_goal | Um único objetivo, que também deve constar em `care_goals`. Não é escolhido automaticamente quando o cadastro tem vários objetivos. |
| care_restrictions | Restrições confirmadas, separadas por `|`. Vazio significa que ainda não foram registradas, e não comprova ausência de restrições. |
| kit_components | SKU e quantidade: `SKU1:1|SKU2:1`. Usa o SKU do produto individual com a embalagem correta. |
| kit_review_status | `pending`, `approved` ou `excluded`, referente somente à composição. |
| care_review_status | `pending`, `approved` ou `excluded`, referente à revisão geral. |
| care_source | Rótulo, ficha ou endereço da fonte usada na conferência. |
| care_notes | Pendências e observações para a equipe administrativa. |

A coluna original `category` foi preservada para manter os filtros existentes da loja. Use `product_category` e `product_subcategory` para a organização nova. Não coloque a marca ou a linha no lugar da categoria.

## Não informado e todos

Campo de indicação vazio com escopo `unknown` significa pendência. Não significa que o produto sirva para todos.

Para `selected`, preencha uma lista de indicações. Para `all`, deixe a lista vazia ou preencha a lista completa; não combine `all` com uma lista parcial. A aprovação geral exige escopos conhecidos, objetivo principal, marca, categoria, subcategoria, tipo, etapa e fonte.

## Kits preenchidos

Cinco composições foram associadas aos SKUs dos produtos individuais disponíveis, com quantidade 1 de cada item:

- doÈden Capim-Limão e Alecrim: shampoo, condicionador e máscara.
- HidraSim: shampoo, condicionador, máscara e sérum.
- NutriSim: shampoo, condicionador, máscara, creme de pentear e Ampolaço.
- Curlys Cachos: shampoo, condicionador e máscara.
- Coco & Camomila: shampoo, condicionador, máscara, finalizador térmico e reparador de pontas.

Essas cinco composições usam `kit_review_status=approved`, pois as apresentações e fotos foram conferidas durante este trabalho. A revisão geral de indicação desses kits continua `pending`. Uma mudança de embalagem ou de conteúdo exige nova conferência. Os demais kits têm composição pendente, sem códigos inventados.

## Importação e próximos passos

Os importadores foram ajustados para ler e validar as novas colunas, inclusive descrições com quebras de linha e ponto e vírgula. Uma composição com SKU ausente, repetido ou quantidade inválida bloqueia a importação.

A importação pelo módulo de fornecedores armazena a classificação em `catalogProfile`. Indicações `careProfile` só são atualizadas com revisão geral `approved`. Um CSV pendente não apaga indicações já existentes e não substitui uma classificação já aprovada. A importação antiga continua criando somente produtos que ainda não existem; para atualizar existentes, use a importação do fornecedor.

A classificação foi importada no banco em 29/10/2026, com cópia de segurança e conferência dos 747 registros após a gravação. A operação alterou somente classificação, indicações aprovadas, vínculo do fornecedor e composição dos kits. Preços, estoque, imagens, descrições e visibilidade foram preservados. O questionário respeita o estado excluded; registros pendentes mantêm o comportamento anterior até uma revisão confirmada. O próximo passo é obter as fichas técnicas que faltam e concluir as indicações pendentes.

## Validação

- 747 registros com 27 colunas, sem perda dos oito campos originais.
- Referências dos cinco kits resolvidas nos próprios arquivos.
- Separação entre indicação pendente, todos os tipos e seleção específica.
- Importação testada para dados novos e existentes, com preservação de revisões aprovadas.
- Importação de classificação autorizada, com cópia de segurança e auditoria. Nenhuma alteração comercial.

Validação final: 258 testes aprovados, incluindo os importadores, vínculos dos fornecedores e exclusões do questionário.

## Aprovações com fonte confirmada

Os três produtos Liso Mágico foram alinhados à indicação do fabricante: cabelo liso, natural ou quimicamente tratado, com objetivo principal de controle do frizz e reparação secundária. Não permanecem marcados para ondulados.

- Shampoo: https://www.grupoecobelle.com.br/shampoo-liso-magico-bela-pro-300-ml/p
- Condicionador: https://www.grupoecobelle.com.br/condicionador-liso-magico-bela-pro-300-ml/p
- Máscara: https://www.grupoecobelle.com.br/mascara-liso-magico-bela-pro-300-ml/p

Outras 21 fichas da EcoBelle tiveram revisão parcial de finalidade com fonte registrada, mas continuam pendentes por falta de confirmação completa dos tipos de cabelo e da condição química. Nutrição é uma finalidade citada pelo fabricante que ainda não existe como opção específica no questionário.
