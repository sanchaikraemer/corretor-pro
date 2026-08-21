# v1341 — o nome que o cliente escolheu não vira código na sua tela

## O que foi corrigido

Cada cliente aparece no app com um círculo colorido e as iniciais dele. Essas iniciais eram
montadas pegando a primeira letra de cada palavra do nome — e o nome vem do WhatsApp do **cliente**,
que é ele quem escolhe.

Se alguém pusesse como nome de WhatsApp algo começando com o sinal `<`, esse sinal ia direto pra
dentro da página. Não é o fim do mundo, mas é o tipo de brecha por onde código estranho entra numa
página. Agora só letra e número viram inicial; qualquer outra coisa vira o "C" de cliente.

Foi uma varredura completa: procurei em todo o app onde texto vindo da conversa ou do cadastro do
cliente entra na tela sem tratamento. Esse foi o **único** ponto real encontrado — o resto já
passava pelo tratamento certo.

## O que ficou registrado como decisão (e não como pendência)

A auditoria apontou também que a página ainda permite comportamento escrito dentro do próprio HTML
(no jargão: `unsafe-inline`). Eu decidi **não mexer nisso agora**, e escrevi o motivo no documento
de estado do projeto pra ninguém reabrir isso todo mês:

- o app inteiro é feito de botões que carregam a ação no próprio botão — são 145 deles;
- pra tirar essa permissão seria preciso converter os 145 de uma vez. E um botão esquecido no meio
  do caminho vira um botão que simplesmente **não faz nada**, calado, na sua tela;
- numa base do tamanho desta, isso é reescrever a interface inteira de uma vez só. O risco de te
  entregar um app com botão morto é grande demais perto do ganho;
- o risco real dessa permissão é justamente texto de fora entrar na página sem tratamento — que é o
  que foi atacado de verdade nesta versão.

Se um dia isso for feito, o caminho certo está escrito no documento: tela por tela, com teste de
clique em cada uma, e só no fim tirar a permissão.
