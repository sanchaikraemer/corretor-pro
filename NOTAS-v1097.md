# NOTAS v1097 — Copiar a mensagem volta a marcar o atendimento

## O que o dono mandou

Dois prints: ele copiou a sugestão número 2 (o botão ficou com a borda coral, mostrando que foi a
escolhida), mas **o atendimento não foi marcado** — o lead continuou com o botão "Marcar" e seguiu
na fila. E a frase que resolveu o caso:

> *"isso está sendo corriqueiro, só marca às vezes na segunda vez que copia."*

---

## Por que acontecia

Quando você copia uma sugestão, o app grava **duas coisas** no servidor, uma depois da outra:

1. o contador de "mensagens copiadas" (aquele número do Desempenho);
2. **o atendimento** — o que realmente importa.

O atendimento era o **segundo**.

E copiar é exatamente o momento em que você sai do app pra colar no WhatsApp. Quando o app vai pro
segundo plano, **o celular corta os envios que ainda estão em andamento**. O primeiro envio (o
contador, o detalhe menos importante) consumia a janela segura, e o do atendimento saía tarde
demais e morria no caminho.

Quando você copiava de novo, já olhando pra tela do app, dava tempo — **por isso "só marca na
segunda vez"**.

E tinha um agravante: a tela já marcava como atendido **na hora**, antes de o servidor confirmar.
Então parecia certo, e o lead voltava depois como se nunca tivesse sido atendido.

## O que foi corrigido

**1. O atendimento passou a ser o primeiro.** Se só um dos dois envios sobreviver, que seja o que
importa.

**2. Os dois envios agora são marcados como "termine mesmo com o app no fundo".** O navegador tem
um jeito próprio de garantir isso, feito exatamente pra esse caso — e não estava sendo usado.

**3. O contador do Desempenho não ficou pra trás.** Como ele agora é gravado depois, a lista é
atualizada mais uma vez em seguida — o número continua certo na hora.

---

## Sobre o "Fazer agora: 0" no sábado

Você perguntou se era por ser sábado. **É isso mesmo, e é uma configuração sua**: no Cérebro estão
marcados segunda a sexta. Hoje, 01/08/2026, é sábado — então a fila fica pausada e volta na
segunda. O resto do app funciona normal (tanto que aparece "1 atendido hoje mesmo assim").

**Mas a mensagem estava incompleta, e isso é falha do app.** Existem duas versões dessa frase: uma
pra quando você ainda não atendeu ninguém no dia, e outra pra quando já atendeu. Só a primeira
dizia *"Dá pra mudar seus dias no Cérebro"* — e você viu justamente a segunda. Por isso pareceu
defeito em vez de ajuste.

**Agora as duas explicam de onde vem a regra e onde mudar.** Se quiser trabalhar sábado, é só
marcar "Sáb" no Cérebro.

---

## Validação feita antes de publicar

| Verificação | Resultado |
|---|---|
| Suíte completa | 273 testes verdes |
| `npm run build` | 27 arquivos, versão 1097 |
| App aberto no navegador de verdade | versão 1097, sem rolagem lateral, zero erro |

O teste novo trava as duas coisas: que o atendimento é gravado **antes** do contador, e que os dois
envios sobrevivem ao app ir pro segundo plano. E confere que **toda** versão da frase de dia sem
fila ensina onde mudar os dias.

**Limitação dita abertamente:** esta sessão não acessa produção. O comportamento foi verificado
aqui, no código e no navegador.

---

## Arquivos alterados

**Código:** `app.js`

**Versão:** `package.json`, `package-lock.json`

**Documentação:** `NOTAS-v1097.md` (novo)

**Testes (novo):** `tests/v1097-copiar-marca-atendimento.test.mjs`

**Testes (atualizado):** `tests/v985-copiar-fazer-agora-registra-copia.test.mjs`
