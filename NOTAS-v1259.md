# v1259 — a análise passa a usar o que a conversa JÁ disse, em vez de perguntar de novo

Esta é a correção de verdade do caso da lead **Marina** — a que eu deveria ter feito desde o
começo, em vez de inventar explicação (ver o aviso no topo de `NOTAS-v1258.md`).

Cobrança do dono, repetida três vezes até eu ouvir:

> "vc tem o histórico inteiro, nao precisa ver print. so te mandei vc ver o quão errado esta a
> analise, nao analisa tudo como deveria"

## O que estava na conversa e a análise ignorou

As três sugestões pediam **a faixa de valor**. A conversa já respondia isso — e muito mais:

| O que a conversa diz | Onde |
|---|---|
| O apartamento de R$ 1.450.000 está **acima** do que ela pode | 09/07 18:22 — *"Tá muito além do meu poder"* |
| A faixa a partir de R$ 430.000 **não foi recusada** — ela seguiu a conversa | 09/07 18:23 → 18:24 |
| Ela tem **imóvel próprio**, é onde a família mora | 09/07 18:24 — *"Na verdade nós temos o que moramos"* |
| O motivo da mudança: o imóvel atual **está grande demais** | 09/07 18:24 — *"Mas tô achando muito grande"* |
| O requisito: **3 dormitórios** | 09/07 18:28 e 13/08 19:14 |
| A permuta **já está decidida** | 13/08 19:24 — *"Queremos encaixar o nosso"* |
| Quem decide: **esposo e filhos** | 28/07 17:51 |
| O corretor **já resumiu o perfil certo** e ela não corrigiu | 10/07 10:54 — *"Entendi que vocês procuram reduzir o tamanho, mas manter os 3 quartos"* |

Ou seja: teto, piso, requisito, motivo, forma de pagamento e quem decide — tudo dito. E as três
sugestões perguntavam de novo.

## Por que a IA fazia isso

O diagnóstico só tinha **cinco campos**, e nenhum deles guardava o que o cliente já tinha contado.
A IA lia a conversa, montava a mensagem a partir daqueles cinco campos e o resto evaporava. Sem
lugar pra guardar, não havia como usar.

## O que mudou

### 1. Cinco campos novos, que obrigam a extração

- **`jaSabemos`** — lista do que a conversa já respondeu (objetivo, tipologia, dormitórios, região,
  forma de pagamento, prazo, restrições).
- **`faixaDeValor`** — **deduzida da reação do cliente aos valores já citados**, sem esperar ele
  declarar um número. Valor que ele chamou de "muito além" vira **teto**; valor mais baixo que foi
  apresentado e ele não recusou vira **piso**. Só fica "Não identificado" se nenhum valor tiver
  sido citado na conversa.
- **`imovelDoCliente`** — quando há permuta, tudo que a conversa diz sobre o imóvel dele **e o que
  ainda falta saber pra avaliar**. Esse imóvel é o centro da negociação.
- **`motivoDaMudanca`** — por que ele quer mudar, nas palavras dele. É o que sustenta o argumento
  de venda; sem isso a conversa vira catálogo.
- **`quemDecide`** — todas as pessoas citadas, não só o cônjuge.

E a regra que fecha o cerco: **depois de preenchidos, nenhuma das três mensagens pode perguntar
algo que esses campos já respondem.**

### 2. O que o próprio corretor já disse também é fato

Duas coisas que estavam sendo desperdiçadas:

- **O resumo que o corretor fez e o cliente não corrigiu está confirmado.** Se ele escreveu
  "entendi que vocês procuram reduzir o tamanho mas manter os 3 quartos" e o cliente seguiu a
  conversa, isso está fechado — proibido reabrir.
- **Valores e faixas que o corretor apresentou são dados assentados.** Se ele já disse de que valor
  partem as opções da carteira dele, esse número existe e não precisa ser perguntado a ninguém.

### 3. Tudo isso aparece na tela do cliente

Cinco linhas novas no painel de detalhes comerciais, pro dono conferir o que a IA entendeu e
cobrar o que faltou:

- Faixa de valor que a conversa já indica
- Imóvel do cliente na negociação
- Por que ele quer mudar
- Quem decide junto
- O cliente já contou

Linha que voltar "Não identificado" **não aparece** — linha vazia ocupa espaço só pra dizer que não
sabe.

## Conferência antes de publicar

Além da suíte verde, abri o app publicado num navegador de verdade em **390×844** e **1280×900**,
com as cinco linhas preenchidas com texto longo: as seis linhas cabem, o texto quebra certo, nada
transborda e nenhuma delas cria rolagem lateral.

## Cuidados mantidos

- Nenhuma informação comercial cravada no código — o teste verifica que nenhum valor, nome de
  empreendimento ou nome de cliente entrou junto com as regras.
- Tudo no prompt de quem **TEM Cérebro**, nunca só no modo prévia (regra da v1247).
- Regras concretas (o que deduzir, de onde, o que fica proibido), não meta-instrução (erro da
  v1240).

## Teste

`tests/v1259-usar-o-que-a-conversa-ja-disse.test.mjs` — trava os cinco campos no pedido à IA e na
gravação, as regras de dedução da faixa, o resumo do corretor como fato assentado, e a presença das
cinco linhas na tela.
