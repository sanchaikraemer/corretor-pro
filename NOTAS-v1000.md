# v1000 — a reanálise e as ações rápidas do lead também separam por corretor

## Contexto

Continuação da v999. `api/reanalisar-lead.js` é o outro arquivo grande que mexe num lead já
existente: excluir um item da conversa, marcar/desmarcar atendimento, reagendar ou remover um
lembrete, corrigir uma observação e a reanálise completa (que chama a IA). Toda essa lógica vive
numa função só (`reanalisarLeadHandler702`), com uma leitura inicial e várias gravações — todas
usando o mesmo `id`, sem checar de qual corretor era.

## O que mudou

`api/reanalisar-lead.js` inteiro passa a exigir e filtrar por `organization_id`: a leitura
inicial do lead, toda gravação rápida (remover item, marcar/desmarcar atendido, lembretes), a
reanálise completa (incluindo as relidas de segurança que ela faz antes/depois de gravar, pra
confirmar que não houve conflito com outra atualização ao mesmo tempo).

Com isso, os dois arquivos que respondem por praticamente toda a interação do dia a dia com um
lead (`lead-update.js` e `reanalisar-lead.js`) já separam os dados por corretor.

**Sem login novo (caminho de hoje), tudo continua caindo na mesma conta original — nenhuma
mudança de comportamento no uso diário.**

## O que ainda falta (registrado desde a v997)

A configuração do Cérebro/memória/exemplos (`direciona_config`, um "balde" só, compartilhado por
todo mundo) segue precisando de uma mudança na estrutura do banco antes de poder ser separada por
corretor. As tabelas antigas `leads`/`direciona_leads` seguem fora do escopo.

## Testes

Novo `tests/v1000-organizacao-no-reanalisar-lead.test.mjs`: bate no handler de verdade contra um
servidor HTTP falso, exercitando 5 ações rápidas (remover item, marcar/desmarcar atendido,
reagendar/remover lembrete) e confirma que toda leitura e gravação saem filtradas por corretor.

`npm test`: suíte inteira verde. `node build.js`: build limpo.

## Arquivos

`api/reanalisar-lead.js`, `tests/v1000-organizacao-no-reanalisar-lead.test.mjs` (novo),
`package.json`/`package-lock.json`, `NOTAS-v1000.md`, versão **999 → 1000**.
