# v916 — "Aguardando cliente" ordenado por atendimento mais recente primeiro

## Pedido do dono

Na tela de Condução, a lista "Aguardando cliente" (você já atendeu, a bola está com o cliente)
era ordenada por chance de conversão (etapa comercial, proposta enviada, visita feita etc.).
O dono quer uma regra mais simples e previsível: **quem você atendeu por último aparece
primeiro**. Se ele acabou de atender o Michael agora, o Michael tem que estar no topo da lista
— não importa se outro lead tem sinais mais fortes de fechar.

## O que mudou

`cp786OrdenarConducao` (`app.js`) ganhou um critério de desempate, aplicado só dentro da
categoria `aguardando`: antes de olhar o score de conversão, compara `ultimoAtendimentoTs(l)` —
o carimbo de hora do atendimento mais recente (marcar atendido, copiar mensagem, registrar
observação) — e coloca primeiro quem foi atendido mais recentemente. As demais categorias
("Fazer agora", "Agenda") continuam com a régua de antes (não foi pedido mexer nelas).

## O que NÃO mudou

- A classificação de quem ENTRA em "Aguardando cliente" continua a mesma da v906/v915 — só a
  ORDEM de apresentação mudou.
- O score de conversão (`scoreRankingHoje`) ainda é usado como desempate final, para o caso raro
  de dois leads terem o EXATO mesmo carimbo de atendimento.

## Sobre "Vendido"/"Perdido" no código

O dono perguntou por que a explicação da classificação ainda menciona "Vendido"/"Perdido" —
temia que esses conceitos tivessem voltado ao código depois de já terem sido banidos da
interface na v904. Não voltaram: **não existe mais nenhum botão, tela ou rótulo** para
Vendido/Perdido/Geladeira (v904 já removeu tudo isso). O que ainda existe são só os valores
internos de `etapa` que **leads antigos, já gravados no banco antes da v904**, podem carregar —
o código (`leadEhAtivo`, `prioridadeAtendimento`) precisa reconhecer essas três strings como
"não é mais um lead ativo" pra continuar tratando esses registros antigos como arquivados. Sem
esse reconhecimento interno, um lead marcado Vendido/Perdido há muito tempo voltaria a aparecer
em "Fazer agora"/"Aguardando cliente" como se fosse um lead ativo — seria pior, não melhor. Esse
comportamento já está documentado como intencional em `NOTAS-v904.md`.

## Verificação
- `tests/v916-aguardando-por-atendimento-recente.test.mjs` (novo): executa `cp786OrdenarConducao`
  de verdade (via `metaPronto`, que injeta a categoria sem precisar montar toda a cadeia de
  `cp786Categoria`) com 3 leads "aguardando" em ordem embaralhada e confirma que o mais
  recentemente atendido vem primeiro, mesmo quando outro lead tem `_score` de conversão maior.
- Suíte inteira verde; `node --check app.js` OK.

## Arquivos
- `app.js` (`cp786OrdenarConducao`), `tests/v916-aguardando-por-atendimento-recente.test.mjs`
  (novo), `NOTAS-v916.md`, versão **915 → 916**.
