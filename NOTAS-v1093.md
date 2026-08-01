# NOTAS v1093 — As quatro coisas da lista, mais o "Carregando..." que ficava preso

## O que o dono mandou

Ele respondeu item por item a lista de detalhes de tela que estava parada, mandou fazer "já", e
ainda mandou um print circulado de vermelho: embaixo do botão **Salvar** do Cérebro aparecia
**"Carregando..."** com a tela pronta e nada acontecendo.

---

## 1. O "Carregando..." preso (o print circulado)

**O que estava acontecendo:** ao abrir o Cérebro, o app escrevia "Carregando..." embaixo do
Salvar. No fim do carregamento ele tentava trocar essa mensagem — mas só trocava **se a caixa
estivesse vazia**. Como o próprio "Carregando..." já tinha preenchido a caixa, a troca nunca
acontecia e a palavra ficava lá pra sempre.

**Agora:** carregou certo, a mensagem **some**. Não troquei por "Configuração carregada." de
propósito: os campos preenchidos logo acima já são a prova de que carregou, e você já reclamou
antes de o app repetir a mesma informação em vários lugares.

**E tem um ganho que não estava no pedido.** Se o servidor não responder, o app usa a cópia
guardada naquele aparelho — e antes fazia isso **calado**, com a tela idêntica. Você podia estar
olhando uma configuração velha, ou salvar por cima da boa, sem nenhum aviso. Agora aparece:
*"Sem conexão com o servidor — mostrando a última configuração salva neste aparelho."*

---

## 2. O `--` no lugar do empreendimento (o item que você não entendeu)

**O que era:** quando o app não identificava o empreendimento do cliente, o cartão mostrava dois
tracinhos — `--`. Não quer dizer nada pra quem lê.

**O que eu descobri olhando de perto:** era pior do que parecia. Em oito lugares o app **já
tinha o texto certo preparado** ("Produto não identificado", "Não identificado", "Atendimento").
Só que esses avisos só apareceriam se o campo viesse **vazio** — e `--` conta como preenchido.
Ou seja: o texto certo existia no código e **nunca chegava na tela**, em lugar nenhum.

**Agora:** cada tela mostra o aviso em português que ela mesma já tinha escolhido. E onde não há
aviso, não sobra lixo na tela.

---

## 3. Cliente arquivado na busca

Você aceitou que apareça, **com a condição** de dar pra diferenciar do cliente ativo.

**Agora:** procurando pelo nome, o arquivado aparece — mas **sempre depois** dos ativos, com o
cartão **mais apagado** e uma tarja escrita **ARQUIVADO** do lado do nome. Dá pra saber o que é
sem precisar abrir. Vale nas duas buscas do app (a de cima e a de dentro das telas).

Antes ele simplesmente não aparecia: você procurava pelo nome do cliente e não achava nada, como
se ele tivesse sumido do aplicativo.

---

## 4. Compromisso atrasado

Este era o mais sério dos quatro.

**O que estava acontecendo:** a tela **Agenda** já mostrava os atrasados numa seção vermelha no
topo (desde uma versão anterior). Mas o **quadro Agenda da tela inicial** foi feito antes disso e
continuou **descontando** o atrasado da conta. Resultado: o item mais urgente do app era
justamente o único que não aparecia na primeira tela.

E o **sininho** lá em cima só acendia por causa da agenda **de hoje**. Quem tinha um compromisso
atrasado e nada marcado pra hoje não via aviso nenhum — exatamente a sua reclamação de que
estava "muito discreto um compromisso que é importantíssimo".

**Agora:**
- O número do quadro Agenda **inclui** os atrasados (voltou a bater com a tela Agenda).
- O sininho **acende** quando existe atraso, mesmo sem nada marcado pra hoje.
- Com atraso, o sino fica **vermelho** e mostra o **número** de compromissos atrasados. Sem
  atraso, continua o pontinho discreto de sempre.
- Ninguém é contado duas vezes: um compromisso que já venceu conta como atrasado, e some da
  conta dos agendados.

---

## 5. O mesmo cliente aparecendo duas vezes

**O que estava acontecendo:** a lista "Oportunidades esquecidas" tirava de dentro dela os
clientes que já estavam no "Fazer agora" — mas só até a **meta** do dia. Quando você clicava em
**"Atender mais um"**, o cliente puxado a mais não era retirado, e aparecia **duas vezes na
mesma tela**.

**Agora** quem monta a tela informa exatamente quem já está aparecendo — então vale qualquer
quantidade de "Atender mais um", e vale também depois de usar o "Pular próximo".

---

## Uma armadilha do CSS que quase passou batido

Vale registrar porque é a lição que o CLAUDE.md manda seguir.

O número de atrasados no sino foi programado, o teste de código passou — e **na tela não
apareceria nada**. Um bloco antigo de estilo, escrito com `!important`, obriga aquele indicador a
ser uma bolinha de 9 px com letra de tamanho zero e cor transparente.

Só descobri porque abri o app num navegador de verdade e li o **resultado calculado**: `font-size:
0px`. Com a correção, `font-size: 11px` e cor branca. Se eu tivesse confiado só na suíte, teria
publicado um aviso invisível.

---

## Validação feita antes de publicar

| Verificação | Resultado |
|---|---|
| Suíte completa | 271 testes verdes |
| `npm run build` | 27 arquivos, versão 1093 |
| Verificação visual no navegador de verdade | 8 conferências, todas ok |

Na verificação visual foram medidos, no navegador: o tamanho e a cor reais do número no sino
(com e sem atraso), o tamanho da tarja "Arquivado", a ausência de rolagem lateral, a versão na
tela e a ausência de erro de JavaScript.

**Limitação dita abertamente:** esta sessão não tem acesso ao banco de produção. As telas foram
conferidas no navegador com o app publicado localmente.

---

## Três testes antigos precisaram mudar (e por quê)

Não foram "ajustados pra passar" — os três guardavam decisões que **você acabou de mudar**:

- Um garantia que o arquivado **não** aparecesse na busca. A ordem nova é o contrário.
- Um garantia que o compromisso vencido **não** contasse no quadro Agenda. Isso fazia sentido
  quando a tela Agenda não listava vencido; ela passou a listar, e o quadro tinha ficado para
  trás.
- Dois procuravam a lista de esquecidos pelo formato antigo, que mudou pra receber quem já está
  na tela.

Em todos, o motivo ficou escrito dentro do próprio teste.

---

## Arquivos alterados

**Código:** `app.js`, `styles.css`

**Versão:** `package.json`, `package-lock.json`

**Documentação:** `NOTAS-v1093.md` (novo)

**Testes (novo):** `tests/v1093-correcoes-de-tela.test.mjs`

**Testes (atualizados):** `tests/v882-parado-considera-atendimento.test.mjs`,
`tests/v903-arquivar-em-app-volta-home.test.mjs`,
`tests/v911-limpeza-lead-e-esquecidas.test.mjs`,
`tests/v931-agenda-tile-bate-com-agenda.test.mjs`
