# v978 — barra bem mais comprida + produto vira só o nome do empreendimento

## O pedido do dono

Print com 2 círculos vermelhos apontando os problemas: "quero as barras MAIS COMPRIDAS, MAIORES
HORIZONTALMENTE, DEU PRA ENTENDER AGORA?" (a v976, que tinha ido de 64px pra 92px, não foi
suficiente) e "diminua um pouco o texto do imóvel — ele precisa ser sucinto e objetivo no tipo do
empreendimento, sem detalhes, para detalhes temos q abrir o lead, ali tem que aparecer só o nome
do empreendimento" (com exemplos de nomes reais dele, omitidos aqui — a regra do projeto proíbe
nome de empreendimento cravado até em nota de versão).

## O que mudou

### 1. Produto vira só o nome do empreendimento

Nova função `cpNomeEmpreendimentoCurto(texto)`: remove palavras GENÉRICAS de tipo/condição de um
texto de produto — nunca um nome próprio (isso vem do Cérebro/da conversa analisada, nunca
cravado no código, conforme regra do projeto). Remove: parênteses (desembrulha, não apaga o
conteúdo — pode ter um nome dentro), "lote NN"/"quadra NN", "N dormitórios/suítes/vagas", "até R$
X mil", "pronto para morar", "na planta", "em construção", "financiável", "futuros lançamentos",
o tipo do imóvel (apartamento/casa/terreno/loteamento/sala comercial/etc.), preposições soltas
(no/na/de/do/da/para...) e um "pronto(s)/pronta(s)" solto que sobra depois de tirar o tipo.

Nova função `produtosLabelCurto(l)`: aplica isso em cada item de `l.produtos` (ou `l.product`),
remove duplicatas (2 itens que viram o mesmo nome depois de limpar) e junta com `" - "`. Um item
que fica 100% vazio depois de limpar (ex.: "Terrenos prontos para construir") é OMITIDO da lista
— só aparece quando pelo menos um item tem nome de verdade. Se **nenhum** item sobrar nome nenhum,
mostra o texto original completo (nunca "--" nesse caso — apagaria a única informação real que
existe pra aquele lead).

`produtosLabel` (a versão completa, usada em todo o resto do app — dentro do lead, timelines,
lembretes etc.) **não foi tocada**. Só `cpHomeLeadRow` (a linha da Home) passou a usar
`produtosLabelCurto` no lugar dela.

### 2. Barra bem mais comprida (2ª rodada)

A v976 tinha ido de 64px pra 92px — não foi o bastante. Agora: **180px** no desktop, **190px** no
mobile. A coluna do grid que reserva espaço pra barra cresceu de 144px pra **240px**; a coluna do
produto encolheu de `1.3fr` pra `.7fr` (o texto agora é bem mais curto, sobra espaço pra dar pra
barra). O número ao lado da barra continua exatamente do mesmo tamanho de sempre (11px/900) — não
mexe nisso, só no comprimento da barra.

## Verificação

- `tests/v978-produto-curto-barra-maior.test.mjs` (novo): testa `produtosLabel` intocada,
  `cpHomeLeadRow` usando a versão curta, os novos tamanhos da barra/colunas, e o comportamento
  real do encurtador com exemplos no mesmo padrão do print (nomes fictícios no lugar dos
  empreendimentos reais — nunca em teste também), cobrindo múltiplos nomes juntados com " - ",
  nome dentro de parênteses preservado, lote/quadra removidos, item genérico omitido, fallback
  pro texto original quando nada sobra, `"--"` quando não há produto algum).
- `tests/v976-barra-mais-comprida.test.mjs` (atualizado): valores de largura atualizados pra
  180px/190px/240px (a v976 testava 92px/130px/144px, superados nesta versão).
- Suíte inteira verde (`npm test`).

## Arquivos

- `app.js` (`cpNomeEmpreendimentoCurto`/`produtosLabelCurto` novas; `cpHomeLeadRow` — usa a versão
  curta; CSS `.chr-track`/coluna `bar`/coluna `pr`), `tests/v976-barra-mais-comprida.test.mjs`
  (atualizado), `tests/v946-ranking-explicavel.test.mjs`/`tests/v972-clareza-fila-hoje.test.mjs`/
  `tests/v975-motivo-so-no-lead.test.mjs` (stub `produtosLabelCurto` adicionado aos sandboxes),
  `tests/v978-produto-curto-barra-maior.test.mjs` (novo), `package.json`/`package-lock.json`,
  `NOTAS-v978.md`, versão **977 → 978**.
