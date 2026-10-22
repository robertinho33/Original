# Portal dos influenciadores — Fios Perfeitos

Boas-vindas para clientes: `/`. Loja: `/index.html`. Portal: `/pages/influenciadores.html`.

## Liberar um acesso

Na administração, abra Influenciadores. Cadastre ou edite nome, e-mail exclusivo e telefone válido, e mantenha o cadastro ativo. Clique em **Liberar acesso** e defina uma senha de 10 a 128 caracteres, somente letras e números, com pelo menos uma letra e um número. O mesmo botão permite alterar a senha ou bloquear o acesso. Compartilhe a senha por um canal privado. O portal não oferece cadastro público.

O influenciador entra com e-mail, telefone cadastrado e senha. A senha é armazenada somente como hash scrypt com salt aleatório, em uma coleção reservada ao servidor, sem texto puro ou logs. A sessão do portal usa um cookie HttpOnly, Secure e SameSite Strict, independente da sessão administrativa, com validade de 8 horas. O telefone é conferido contra o cadastro; não se trata de autenticação por SMS.

## Consultas e isolamento

A API confere a sessão e o cadastro ativo em cada consulta. A entrada exige correspondência do e-mail, telefone e hash da senha. O bloqueio e a alteração de senha invalidam as sessões anteriores pela versão do acesso. O influenciador não recebe credenciais ou tokens de acesso ao Firebase. O ID do influenciador não é aceito do navegador para escolher dados. As vendas seguem os vínculos de cupons e contratos do módulo de parcerias. Comissões estimadas, conciliadas pendentes e repassadas são exibidas separadamente. A conciliação e a marcação de repasse continuam administrativas.

O portal mostra referência, data, cupom, total, pagamento, comissão e etapa logística. Não expõe nome ou endereço do cliente, documentos, chaves PIX, tokens privados de acompanhamento ou dados de outros influenciadores. O período limita a consulta; a tabela exibe até 200 vendas, com totais do período inteiro.

As coleções influencerPortalAccess, influencerPortalEmails e influencerPortalSessions são utilizadas somente pelo servidor; o portal não lê Firestore no navegador. Nenhum usuário real é criado ou tem sua senha alterada durante a publicação. A liberação de cada conta é feita pelo administrador na nova interface.

## Outras alterações

A retirada fica oculta e desativada no checkout público; pedidos antigos e regras administrativas permanecem preservados. O link de consulta de pagamento vira um botão visual. O modal de pedidos respeita o estado fechado e oferece fechamento por Escape. O filtro de marcas usa botões acessíveis com logotipos locais quando disponíveis e identificação textual para novas marcas.

## Mais vendidos e campanhas exclusivas

O portal mostra até seis produtos mais vendidos por quantidade nas vendas pagas do próprio influenciador, respeitando o período consultado. Pedidos pendentes ou cancelados não entram no ranking.

No painel administrativo, em Vitrine, a seção “Campanha exclusiva dos influenciadores” permite escolher até três SKUs diferentes do catálogo. A seleção preenche nome, imagem e descrição; estes textos e a URL da imagem podem ser personalizados. É possível definir vigência e desativar a campanha. Apenas administradores alteram a configuração. A campanha é comum aos influenciadores autorizados e não depende do filtro das vendas. O preço continua sendo o do catálogo: essa seção não cria descontos automáticos.

A configuração fica na coleção restrita `influencerPortalCampaigns/current`, acessada somente pelo servidor. Na prévia, o editor `/campaign-editor` usa dados temporários locais, perdidos ao reiniciar a prévia; não altera a configuração real.

## Vitrine individual e Cuidado do seu jeito

Na lista de influenciadores, o botão “Vitrine pública” permite ao administrador cadastrar nome público, apresentação, foto HTTPS, um link de vídeo, até seis favoritos e um cupom ativo vinculado àquele influenciador. A ativação torna somente esses dados públicos. Desativar a vitrine ou o influenciador retira a página do ar. Compartilhe o link exibido nesse formulário. E-mail, telefone, Pix, credenciais e resultados não fazem parte da página pública.

As compras são atribuídas pelo cupom, validado no checkout conforme as regras existentes. O link da vitrine encaminha o código nas URLs de produtos e do cuidado personalizado. Não há rastreamento de cliques ou comissão atribuída apenas por visita. O cliente pode escolher outro cupom no checkout; nenhum pagamento é marcado como aprovado por esta funcionalidade.

Em Vitrine, a seção “Curadoria · Cuidado do seu jeito” cadastra até 30 indicações revisadas pela loja: produto, objetivo, etapa, tipo de cabelo, presença de química e motivo. Habilite a curadoria após revisar. Não há recomendações automáticas em produção até essa configuração existir. A consulta usa apenas produtos visíveis, ativos e com estoque, os preços do catálogo e o orçamento sem frete. Seleciona no máximo um produto por etapa, priorizando tratamento, depois limpeza e finalização; dentro da etapa prefere o menor preço. Uma seleção parcial é sinalizada. As respostas não são armazenadas em perfil.

A adição do cuidado personalizado preserva a sacola anterior e acrescenta uma unidade por produto, mediante clique do cliente. O checkout continua validando preço, estoque, frete e cupom. Os dados demonstrativos e preços da prévia não representam uma oferta publicada.

Configurações: `storeRitualRules/current` e `influencerPublicStores/{influencerId}`. Os endpoints públicos retornam somente os campos necessários à experiência de compra. O administrador controla a curadoria, cupons e publicação. O influenciador pode editar somente foto, apresentação e produtos da própria vitrine após criar sua senha pessoal. No teste local, use `/ritual-editor`; suas alterações são temporárias e desaparecem ao reiniciar a prévia.

## Acesso e cuidado personalizado

A experiência agora se chama Cuidado do seu jeito, com Encontrar meu cuidado nos botões. As URLs e identificadores internos existentes foram preservados para manter links, cupons e integrações compatíveis.

Ao liberar um novo acesso, deixar a senha em branco gera uma senha inicial individual, exibida somente na resposta ao administrador. O administrador deve compartilhá-la por um canal privado. A senha não é enviada automaticamente. Acessos existentes mantêm a senha atual quando o campo fica vazio. No portal, Alterar minha senha exige a senha atual, grava somente o hash com salt e invalida as sessões anteriores. O usuário precisa entrar novamente.

A tela inicial foi simplificada em quatro botões, e a vitrine pública do influenciador também oferece acesso ao portal.

Novas senhas do portal aceitam de 8 a 16 caracteres, somente letras e números, incluindo ambos. O login preserva compatibilidade com senhas antigas mais longas. O botão Alterar minha senha aparece também antes do login e encaminha à troca após autenticação, exigindo a senha atual.

## Convite e conclusão do primeiro acesso

No cadastro do influenciador, Gerenciar acesso → Gerar convite / redefinir senha gera uma senha temporária individual de 16 caracteres, válida por 48 horas. O convite anterior e as sessões antigas deixam de funcionar. Abrir convite no WhatsApp prepara a mensagem para revisão e envio manual ao telefone salvo. Não há disparo automático nem envio em lote. A mensagem contém apenas portal, e-mail, telefone e senha temporária do destinatário; não inclui URLs ou credenciais administrativas. Não registrar nem persistir essa resposta no cliente.

O primeiro login permite somente conferir a sessão, sair ou criar a senha pessoal. Dashboard, perfil e seleção de produtos são bloqueados no servidor enquanto a troca estiver pendente. Após a troca, todas as sessões anteriores são invalidadas e o usuário entra com a senha pessoal. Acessos antigos continuam funcionando até uma redefinição explícita pelo administrador.

No início do painel: Minha foto e apresentação aceita foto por URL HTTPS e texto de até 500 caracteres; Produtos da minha vitrine aceita de um a seis produtos disponíveis. Uma vitrine inexistente passa a ser rascunho ao salvar o perfil. Nenhuma dessas ações permite editar identidade, cupom, comissão, ativação, permissões ou outra pessoa. O mesmo endereço de vitrine é preservado. Novas vitrines precisam de revisão e ativação do administrador.

A porta 3004 é uma prévia visual e não oferece login real. Para teste com contas reais, usar o servidor completo ou o domínio publicado. Testes automatizados cobrem senha obrigatória, expiração, sessões antigas, propriedade dos dados, campos administrativos indevidos e revisão concorrente. Contas reais não foram redefinidas na validação.
