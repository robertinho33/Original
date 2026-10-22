# Segurança, performance e páginas de produto

## Dependências

- Removido apenas o pacote npm `firebase`: o código do Node não o importava. O SDK do navegador continua vindo de `www.gstatic.com`; Firebase Auth, Firestore e Analytics do navegador foram preservados.
- `firebase-admin` foi mantido. A dependência transitiva `@google-cloud/storage` passou de 8.2.0 para 8.4.0, dentro da faixa compatível da dependência existente. Isso substituiu a cadeia antiga de gaxios/uuid por versões corrigidas.
- `proxy-addr` passou de 2.0.7 para 2.0.8.
- Auditoria npm da instalação final: zero alertas. Isso não constitui garantia de ausência de vulnerabilidades desconhecidas ou nas bibliotecas carregadas por CDN.

## Firestore

As regras reais do projeto `base-total` foram lidas antes da mudança. A versão anterior permitia leitura/criação pública em clients, criação pública em orders e commissions e leitura/gravação pública em counters. Também permitia leitura direta de usuários com papel influencer, produtos, cupons e rastreamentos.

`firestore.rules` mantém os papéis e acessos administrativos existentes, a leitura do pedido pelo proprietário e a leitura pública das categorias. Fecha os acessos anônimos sensíveis e as gravações diretas de clientes em pedidos, comissões e rastreamentos. A vitrine usa a API com projeção pública, o cupom é validado pelo servidor e o rastreamento usa a API com token privado. O checkout atual da InfinitePay cria o pedido no servidor com Admin SDK; não depende de `allow create: if true` no navegador.

As regras foram compiladas e exercitadas pela API oficial com **79 casos**, todos aprovados e sem mensagens de erro de avaliação na rodada final. Os casos estão em `tests/firestore-rules-cases.json`. As funções de consulta ao cadastro de papel são simuladas explicitamente nos testes, para distinguir decisões de autorização de falhas de consulta. Não foram executadas gravações de documentos para testar bloqueios.

Após publicar as regras, leituras anônimas das coleções protegidas retornaram 403. A API pública continuou retornando 200 e 747 produtos. O ruleset anterior continua identificável no histórico do Firebase; rollback de código no Render não reverte as regras.

`firebase.json` versiona somente o caminho das regras. Para uma publicação futura autorizada: `firebase deploy --only firestore:rules --project base-total`. A conta de serviço local tem leitura das regras, mas não a permissão de teste; foi usada a sessão já autenticada do Firebase CLI para testar e publicar, sem ampliar permissões. Nenhuma credencial foi adicionada ao repositório.

## Páginas individuais

- `/produto/:sku` entrega HTML com nome, imagem, preço, disponibilidade, descrição, canonical, metadados sociais e Product/Offer em JSON-LD.
- `/produtos` oferece um diretório com 36 links por página e navegação por links reais. Os cards da vitrine apontam para as páginas individuais pelo nome; clicar na imagem mantém o modal existente.
- O sitemap inclui somente produtos ativos, com preço válido e marca visível, além das páginas públicas. Produtos ocultos ou inexistentes respondem 404; falha ao obter a visibilidade não libera um catálogo alternativo sem filtros.
- Não são inventados descontos, avaliações, GTINs ou descrições. Quando a descrição está vazia, a página orienta a consultar o atendimento.
- O botão de compra acrescenta SKU e quantidade à sacola já existente e continua para o checkout. O servidor continua conferindo preço, estoque, cupom e entrega antes do pagamento.
- HTML e JSON-LD escapam conteúdo do cadastro. O hash do JSON-LD é autorizado somente na resposta correspondente pela CSP; não foi liberado script inline arbitrário.

## Performance

- Leitura de JSON publicado passou a ser assíncrona e compartilhada. Falhas não são guardadas indefinidamente.
- Estado de visibilidade usa cache de 30 segundos e compartilha consultas concorrentes. Alterações feitas pelos métodos de visibilidade invalidam esse cache; uma consulta antiga em andamento não repopula um cache invalidado.
- O checkout deixou de importar um `db` Firebase que não utilizava, evitando essa carga desnecessária nessa entrada.
- APIs privadas e páginas operacionais usam `no-store`; scripts sem nomes com hash revalidam. Imagens têm cache limitado.

Nas três amostras HTTP anteriores ao deploy, a página inicial teve TTFB de 786/1619/829 ms e o catálogo de 6410/1566/1865 ms. O catálogo decodificado tinha 460.765 bytes e já usava Brotli no proxy. Essas amostras não são um benchmark controlado, nem medem LCP/INP/CLS.

O serviço Render está no plano gratuito, que pode suspender instâncias sem tráfego. Não foi alterado para um plano pago. As métricas disponíveis mostraram cerca de 88 MiB de memória no ponto mais recente consultado; o conjunto de latência HTTP retornou vazio. PageSpeed Insights recusou a medição móvel com HTTP 429 por cota; não há nota Lighthouse válida desta etapa.

## Verificações

- Suíte local: **126 testes passaram**, cobrindo as regressões existentes, cache, privacidade HTTP, canonical, sitemap, páginas individuais, 404, escape de conteúdo e hash CSP.
- Regras: **79 casos aprovados** na API oficial, além das consultas anônimas de verificação depois da publicação.
- Navegador: página individual conferida em desktop e celular; sem rolagem horizontal nas larguras verificadas. Compra para sacola vazia e combinação com item existente foram conferidas no checkout local, sem envio de pedido ou cobrança.
- Auditoria npm: zero alertas. Sintaxe do servidor e do módulo de páginas de produto e `git diff --check` conferidos.

Depois do push, verificar o commit efetivamente ativo no Render e as respostas de `/produto/BJP3XM8ES`, `/produtos`, `/sitemap.xml` e `/robots.txt`. Medições posteriores são registradas no relatório de entrega, sem atribuir diferenças de uma amostra ao código isoladamente. A descoberta e a posição no Google dependem do buscador; o sitemap e as páginas reais não garantem indexação.
