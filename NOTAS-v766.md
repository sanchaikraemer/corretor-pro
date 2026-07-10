# v766 — Tela travada no skeleton depois de voltar do WhatsApp + limpeza de código morto

## O problema (relatado pelo usuário)

Fluxo: abrir um lead, copiar uma sugestão de mensagem, sair pro WhatsApp, enviar, voltar pro Corretor Pro pra marcar atendimento. O app recarrega sozinho (o Android costuma descartar a aba/PWA da memória ao trocar de app) e volta pra Home — mas fica preso indefinidamente nos placeholders cinza (skeleton), sem carregar nada e sem nenhuma mensagem de erro.

## Causa raiz

Nenhum dos `fetch()` do boot inicial (`api/leads-recentes`, `api/restaurar-leads`) tinha timeout. Quando o app recarrega logo depois de voltar de outro app, a rede às vezes ainda está "reconectando" — o `fetch` fica pendurado, nunca resolve nem rejeita. Como esses `fetch` eram aguardados (`await`) em sequência antes de `carregarDashboard()`/`carregarAgendaTopo()` rodarem, a tela inteira ficava esperando pra sempre por uma promessa que nunca ia terminar — mesmo o código já tendo um bom fallback ("Reconectando… Tentar agora") para quando a busca *falha*, ele nunca chegava a ser usado porque a busca não estava falhando, só ficava pendurada.

## O que foi corrigido

- Novo helper `fetchComTimeout` (15s) usado nas buscas mais sensíveis do boot e da navegação: lista de leads, restauração de leads antigos, abrir detalhe do lead, marcar atendimento. Agora essas chamadas sempre resolvem ou rejeitam dentro de um tempo limite, nunca ficam penduradas pra sempre.
- `iniciarDireciona()` não trava mais `carregarDashboard()`/`carregarAgendaTopo()` atrás de um `await` sequencial da restauração de leads antigos — os três rodam em paralelo, cada um com seu próprio fallback.

## Limpeza (sem relação com o bug acima)

Removidas ~720 linhas de código morto em `api/_pipeline.js`: todo o sistema antigo de mensagens por template fixo (`mensagensFallbackCompromissoCorretor`, `mensagensFallbackPerguntasRespondidas`, `mensagensFallbackMudancaRetomada`, `mensagensFallbackMaterialJaEnviado`, `mensagensFallbackDirecionamentoCorretor` e ~50 funções auxiliares), desligado desde a v748 e sem nenhuma chamada de nenhum lugar do app hoje — confirmado function a function antes de apagar. Não mexe em comportamento nenhum, só tira peso do arquivo.

Obs.: encontrei mais código morto no mesmo arquivo além desse bloco (sistema antigo de "modelo comercial" com enums, catálogo de empreendimentos, conhecimento do corretor) — não mexi nisso agora porque é um escopo bem maior do que o combinado; fica pra uma limpeza separada se quiser.

## Testes

- `npm test` e `npm run build` passaram.
- Não dá pra simular aqui a condição exata de "voltar do background com rede lenta" sem o celular real — validar usando o app normalmente por alguns dias.
