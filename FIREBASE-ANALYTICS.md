# Estatísticas da Fios Perfeitos

Projeto existente: `base-total`. Identificador de medição informado no código: `G-TWSEGNXFXJ`.

A loja carrega o Analytics somente depois de aceitar estatísticas. A escolha expira em 180 dias e pode ser alterada no rodapé. As páginas administrativas e de acompanhamento não são instrumentadas. URLs enviadas não contêm parâmetros nem fragmentos. Sinais de publicidade e personalização estão desativados.

## Concluir a ativação

1. Publicar as alterações do site.
2. Abrir o projeto existente no Firebase com uma conta autorizada. Na verificação desta sessão, robertinho33@gmail.com não tinha acesso a base-total e sua lista de projetos estava vazia. Não criar outro projeto para substituir a base usada pela loja.
3. Em Configurações > Integrações, confirmar o vínculo com Google Analytics e conferir se o fluxo da loja tem o identificador acima. Revisar a medição otimizada e desativar coleta de formulários e pesquisa interna antes de habilitá-las.
4. Abrir a loja publicada com `?analytics_debug=1`, aceitar estatísticas e confirmar `page_view` no DebugView e atividade em Tempo real. Repetir com recusa e verificar que não há coleta.
5. Conferir o relatório de atividade ao longo do tempo após o processamento de novos acessos. A integração não recupera visitas anteriores à ativação.

Os dados copiados pelo proprietário confirmam o projeto e o identificador de medição. Na nova tentativa pelo navegador desta sessão, o console apresentou erro ao carregar o status de aceitação dos Termos de Serviço. O recebimento de eventos não foi confirmado. A mensagem de erro não comprova que faltem permissões à conta.

Referência: https://firebase.google.com/docs/analytics/web/get-started
