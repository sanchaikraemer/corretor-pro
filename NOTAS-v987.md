# v987 — lembrete fantasma: "lembrei"/"lembrou" também não é comando

## Contexto

O dono mandou print da Agenda: o Valdir aparecia com "Lembrete de hoje" — só que ele nunca clicou
em Agendar pra esse cliente. O texto do "lembrete" era o de um atendimento que ele registrou,
contando o que disse ao cliente: "Sr. Valdir, boa tarde! Estava pensando aqui e lembrei do apto
502A do Quality q o Sr adquiriu em 2020 por R$ 165.000 Hoje temos uma unidade ainda, por
R$ 395.000".

## O que estava acontecendo

Mesma classe de bug já corrigida na v969 ("lembrete fantasma: radical lembr pegava
lembrando/não lembro"), só que numa forma verbal que aquele fix não cobria. `lembreteDoTexto`
(`api/reanalisar-lead.js`) só devia criar lembrete a partir de um COMANDO explícito
(agendar/marcar/lembrar + data). O radical `lembr\w*` usado nesse comando também casa com
**"lembrei"** (1ª pessoa do passado — "eu lembrei/recordei", puro relato) e **"lembrou"** (3ª
pessoa) — nenhuma das duas é um pedido de agendamento, mas o texto do Valdir tinha "lembrei" +,
mais adiante na frase, "Hoje temos uma unidade" (descrevendo disponibilidade, sem nenhuma relação
com agendar) — e a combinação virou "dias:0" = lembrete pra hoje, sem o dono ter pedido nada.

## Fix

- `api/reanalisar-lead.js` — `lembreteDoTexto`: a limpeza de ruído que já removia
  "não/nunca lembro", "lembrando" e "lembrança" antes de checar o comando agora remove também
  "lembrei" e "lembrou". Comandos de verdade ("lembra de mim sábado", "lembrete: ligar amanhã")
  não usam essas formas, então continuam funcionando igual.

## O que não faz

Não apaga o lembrete fantasma já criado pro Valdir (sem acesso a produção pra identificar o
registro certo, e uma limpeza automática por heurística arriscaria apagar lembrete legítimo). O
dono pode excluir pelo botão "Excluir" que já aparece no card da Agenda. Reanalisar esse lead de
novo também deve corrigir sozinho, já que a régua atual não vai mais recriar esse lembrete.

## Verificação

- `npm test`: suíte inteira verde, incluindo o novo
  `v987-lembrete-fantasma-lembrei-lembrou.test.mjs` (reproduz o texto real do Valdir, testa
  "lembrou" em 3ª pessoa, e confirma que comandos de verdade continuam funcionando).
- `tests/v969-lembrete-fantasma-radical-lembr.test.mjs` continua verde (não foi afetado).

## Arquivos

`api/reanalisar-lead.js` (`lembreteDoTexto`),
`tests/v987-lembrete-fantasma-lembrei-lembrou.test.mjs` (novo), `package.json`/
`package-lock.json`, `NOTAS-v987.md`, versão **986 → 987**.
