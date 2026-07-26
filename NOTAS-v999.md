# v999 — o resto das ações do lead também separa por corretor

## Contexto

Continuação direta da v998 (que já tinha escopado listar a Carteira e criar/salvar um lead).
Faltava o resto das ações que mexem num lead já existente: mudar de etapa, anotar
memória/observação, marcar aprendizado, lembretes, editar dados e apagar.

## O que mudou

Em `api/lead-update.js`, todas essas ações passam a exigir e filtrar por `organization_id`,
tanto pra LER quanto pra GRAVAR/APAGAR:

- Mudar etapa do negócio (`etapa`)
- Ver e editar a memória/observações do cliente (`memoria-get`, `memoria-set`,
  `observacao-adicionar`)
- Marcar acontecimentos de aprendizado (`aprendizado`)
- Marcar venda ou perda (`desfecho`)
- Lembretes (`lembrete-set`, `lembrete-clear`)
- Editar nome/telefone/produto (`editar-dados`)
- Reanalisar a análise comercial já validada (`analise-comercial-set`)
- Atualizar um lead ao reimportar a conversa (`atualizar-com-evolucao`)
- Criar oportunidade vinculada a um parceiro (`nova-oportunidade-parceiro`)
- **Apagar lead** (`apagar`) — inclusive a parte que corrige vínculos de "oportunidade" em
  outros registros quando um lead é apagado, e o DELETE final, que agora só apaga o que é
  do mesmo corretor.

Com isso, praticamente toda a Carteira (`whatsapp_processamentos`) já está coberta.

**Sem login novo (o caminho de hoje), tudo continua caindo na mesma conta original — nenhuma
mudança de comportamento no uso diário.**

## O que ainda fica de fora, de propósito

- `aprenderRespostasDaCarteira()` (o banco de "exemplos de resposta" do Cérebro, reconstruído
  automaticamente depois de apagar um lead) ainda lê a carteira inteira sem filtro. Ela grava
  num "balde" só, compartilhado por todo mundo (`direciona_config`, chave única) — filtrar só a
  leitura sem também separar essa gravação por corretor pioraria a inconsistência, não
  resolveria. Essa parte (a configuração do Cérebro/memória/exemplos) precisa de uma mudança na
  estrutura do banco (permitir uma linha por corretor pra cada chave) e fica pra uma etapa
  própria, maior.
- `leads`/`direciona_leads` (tabelas antigas, sem coluna de corretor) e a limpeza de arquivos no
  armazenamento (`limpar-antigos`, `emptyBucket`) continuam fora do escopo, como já registrado
  desde a v997.

## Testes

Novo `tests/v999-organizacao-nas-acoes-do-lead.test.mjs`: bate no handler de verdade contra um
servidor HTTP falso e confirma que 7 ações diferentes (etapa, memória, observação, aprendizado,
lembretes, editar dados) mandam o filtro de corretor pra rede em toda leitura e gravação.
Reforçado `tests/v827-15-exclusao-oportunidade.test.mjs` (o teste de apagar lead já existente)
pra também confirmar que as leituras e o DELETE final filtram por `organization_id` — com uma
exceção documentada e testada (a reconstrução do banco de exemplos do Cérebro, que fica pra
depois pelo motivo acima).

`npm test`: suíte inteira verde. `node build.js`: build limpo.

## Arquivos

`api/lead-update.js`, `tests/v999-organizacao-nas-acoes-do-lead.test.mjs` (novo),
`tests/v827-15-exclusao-oportunidade.test.mjs` (reforçado), `package.json`/`package-lock.json`,
`NOTAS-v999.md`, versão **998 → 999**.
