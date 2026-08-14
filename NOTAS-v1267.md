# v1267 — quando o material já foi enviado e a conversa parou, a próxima ação é ver pessoalmente

Pedido do dono (13/08/2026), depois de estudar o método do Joe Girard ("Como vender qualquer coisa a
qualquer um"). Das ideias levantadas, esta é a que ele mandou fazer: a do capítulo do *"selling the
smell"* — explicar não vende como experimentar vende. No carro era o cheiro e o test drive. Em
imóvel é entrar no apartamento, ir até a sacada, ver a posição solar, sentir o tamanho do living.

## O que mudou

Entrou o **item 8** da conferência final (a lista curta que a v1263 colocou DEPOIS da conversa, a
última coisa que a IA lê antes de escrever):

> **8. O CLIENTE JÁ RECEBEU MATERIAL E A CONVERSA PAROU?** Se a conversa mostra que ele já recebeu
> vídeo/foto/link/tabela/planta e depois disso esfriou (ou só respondeu por educação), **mais
> material não é o próximo passo** — quem já viu tudo pela tela decide indo ver. Pelo menos uma das
> três precisa oferecer o presencial (visita ao apartamento/obra/decorado, ou encontro pra ver as
> opções juntos), com **dois dias/horários concretos**, dizendo em uma frase por que vale mais ir do
> que continuar recebendo arquivo.

Com **três exceções**, pra isso não virar cobrança automática (nelas, as três mensagens ficam como
estavam):

- cliente de fora ou que já disse que não consegue ir agora → o presencial vira **vídeo-chamada ao
  vivo** ou visita marcada pra quando ele vier — nunca mais um PDF;
- já existe visita marcada, ou ele acabou de receber o material e ainda nem teve tempo de olhar;
- a conversa parou por um motivo declarado que uma visita não resolve (vender o imóvel dele, aprovar
  financiamento, esperar alguém decidir) — aí o próximo passo é aquele motivo.

## Por que como ITEM da conferência, e não como princípio novo

Essa é a parte importante da decisão. A leitura do Girard sugeria criar **sete novos princípios**
dentro do Cérebro (memória comercial, continuidade, roda-gigante, timing, inteligência de contexto,
experiência do produto, pós-venda). Fazer isso seria repetir exatamente o erro das v1253–v1262: o
prompt principal chegou a ~25 mil caracteres com 15 blocos de "É PROIBIDO", e a IA passou a honrar um
subconjunto diferente a cada rodada — o dono flagrou com prints, duas reanálises da mesma conversa
dando resultados opostos. A v1263 corrigiu concentrando o que decide a qualidade numa lista curta no
fim.

Então esta versão adiciona **uma regra concreta e conferível** ("já mandou material e parou? ofereça
o presencial com dois horários"), no lugar onde ela pesa, e nada mais. O teste da v1263 passou a
conferir o **número de itens** de propósito: se um dia a lista passar de uma dúzia, o problema voltou
a ser o paredão, não a regra que falta.

O resto do que o método sugere ou **já existe** (a estratégia antes das mensagens é a própria v1263;
a leitura de contexto é a v1259; a "roda-gigante" é o Fazer agora com resgates diários e a cadência
de quem nunca respondeu, v1113/v1139) ou **contraria ordem do dono** (classificar lead como
"perdido"/"momento errado" — ele mandou que só existisse Ativo e Arquivado, v1095). Pós-venda e
indicação seguem fora: é área nova, não ajuste, e depende de decisão dele.

## Testes

- `tests/v1267-material-parou-chama-pra-ver.test.mjs` (novo) — trava a regra, os dois horários
  concretos, a frase do porquê, as três exceções (com a vídeo-chamada como saída pra quem não pode
  ir) e a proibição de citar empreendimento/preço.
- `tests/v1263-conferencia-final.test.mjs` — atualizado pra 8 itens, com o comentário explicando por
  que o número é conferido.

Suíte completa verde: 24 arquivos + 424 testes. Sem mudança visual (só o texto que a IA lê).
