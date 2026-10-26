# Comunidade e galeria dos influenciadores

## Uso

Na vitrine pública, o visitante clica em **Me seguir para mais novidades**, informa nome e WhatsApp e autoriza o vínculo. A autorização para receber mensagens é opcional e separada. O botão seguinte prepara uma mensagem para o atendimento; não há envio automático.

No painel administrativo, abra **Influenciadores → Comunidade e fotos** no cadastro correspondente. Confira a conversa original recebida no WhatsApp da loja, o número real do remetente e o código enviado. Digite os dois na fila e confirme. O pedido expira em 48 horas. Cadastros confirmados com o mesmo número e influenciador atualizam o mesmo vínculo, sem duplicar a contagem.

O visitante pode conferir a confirmação e cancelar o acompanhamento na mesma vitrine e aparelho. O cancelamento também retira a autorização para novidades. Se perder o aparelho ou os dados do navegador, deve solicitar o cancelamento ao atendimento. O influenciador vê apenas a contagem de seguidores confirmados; os contatos ficam restritos ao atendimento administrativo.

No portal do influenciador, **Minha comunidade e fotos comerciais → Abrir minha comunidade** permite acompanhar a contagem e enviar até seis fotos vinculadas a produtos disponíveis. Fotos rejeitadas podem ser removidas para liberar uma vaga. Cada foto tem legenda e declaração de direitos de uso e de conformidade com as regras.

## Revisão das fotos

A triagem usa NSFWJS MobileNetV2, com pesos incluídos na dependência e TensorFlow.js em CPU. Não chama uma API externa de moderação. O processamento roda em worker isolado, com um trabalho por vez, tempo e memória limitados. Uma indisponibilidade mantém a foto pendente; o administrador pode repetir a triagem.

Essa triagem cobre probabilidades de conteúdo pornográfico, nudez e conteúdo sexual sugestivo. **Não detecta de forma abrangente crianças, armas, drogas ou violência.** Todas as fotos exigem revisão humana dos quatro itens: somente adultos; ausência de conteúdo sexual; ausência de armas, drogas, violência e conteúdo ofensivo; adequação comercial e declaração de direitos de uso. A aprovação registra o administrador, a data e o checklist. A triagem não substitui essa conferência nem garante classificação perfeita.

Imagens com pontuação de bloqueio não são armazenadas. Imagens inconclusivas ficam privadas para revisão. Falha técnica na triagem impede aprovação. Nenhuma foto da galeria comercial é publicada automaticamente. A triagem e esse fluxo aplicam-se à galeria comercial, não às URLs de foto de perfil preexistentes.

## Armazenamento e custo

Não foi contratado serviço pago adicional. As bibliotecas são abertas e a confirmação usa o WhatsApp existente da loja. O uso continua sujeito à capacidade e às cotas do servidor e do Firestore já usados pelo projeto; não é uma promessa de armazenamento ou tráfego ilimitado sem custo.

O servidor valida o arquivo e regrava somente JPEG, sem metadados EXIF, com no máximo 180 KB por foto. Os bytes são guardados em documentos privados do Firestore, separados por foto, e servidos pela API. A vitrine recebe somente metadados de fotos aprovadas. Fotos pendentes só podem ser abertas pelo dono autenticado ou por administradores; o conteúdo não é exposto como arquivo estático.

As coleções novas são `influencerCommunities` (com subcoleção privada `followers`), `influencerGalleryPhotos`, `communityFollowRequests` e `communityFollowLimits`. As regras existentes negam acesso direto de clientes a essas coleções; as operações passam pelo servidor. Mensagens de novidades e campanhas não são disparadas por essa implementação.

## Verificação

Os testes cobrem consentimento, confirmação de WhatsApp, prazo e cancelamento, duplicidade de seguidores, limite concorrente de seis imagens, isolamento entre influenciadores, privacidade antes da aprovação, checklist obrigatório, falha da triagem e execução real do modelo gratuito com uma imagem sintética.
