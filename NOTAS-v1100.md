# NOTAS v1100 — Texto mal escrito chegando na sua tela

## O que o dono mandou

Dois prints e uma pergunta: **"o q vc ve de errado ai?"**

Achei três coisas. Duas eram erro de escrita — e a primeira foi minha, de ontem.

---

## 1. "atendido há hoje"

Na coluna nova que eu criei ontem, embaixo do número, saía **"atendido há hoje"**. Não se fala
assim. Foi descuido meu ao montar a frase.

**Agora:** "atendido hoje", "atendido ontem", "atendido há 3 dias".

---

## 2. "vencido há 43 dia(s)"

Aquele **"(s)"** é atalho de programador pra não decidir entre *dia* e *dias*. Na sua tela é lixo.

E não era só ali: **varri o app inteiro e achei 15 frases** com esse vício — *"3 lead(s)"*,
*"áudio(s) novo(s) transcrito(s)"*, *"2 erro(s) até agora"*, *"conversa(s) nova(s)"*, e por aí.

**Agora todas escolhem certo:** "1 dia" ou "43 dias", "1 lead" ou "3 leads", "1 áudio novo
transcrito" ou "5 áudios novos transcritos".

Criei uma trava automática: se alguém escrever "(s)" numa frase de tela de novo, a publicação
falha.

---

## 3. Uma coisa que NÃO é erro, mas confunde

No primeiro print, o primeiro cliente mostra **"volta em 15 dias"** enquanto os outros mostram 14 —
com o descanso configurado em 14.

Não é conta errada. É porque **o dia em que você atende não conta como espera** — foi você mesmo
que pediu isso, quando um cliente voltou "um dia mais cedo do que o esperado". Então quem foi
atendido hoje espera os 14 dias inteiros a partir de amanhã, ou seja, volta no 15º.

**Se você preferir que "14" signifique voltar exatamente no 14º dia, me fala que eu mudo.** Não
mexi porque a regra atual foi decisão sua.

---

## Validação feita antes de publicar

| Verificação | Resultado |
|---|---|
| Suíte completa | 276 testes verdes |
| `npm run build` | 27 arquivos, versão 1100 |
| Verificação no navegador de verdade | frases conferidas na tela |

No navegador foi montada a lista com clientes atendidos hoje, ontem e há 3 dias, e conferido o
texto que aparece: **"atendido hoje"**, **"atendido ontem"**, **"atendido há 3 dias"** — e nenhum
"(s)" em lugar nenhum da tela.

---

## Arquivos alterados

**Código:** `app.js`

**Versão:** `package.json`, `package-lock.json`

**Documentação:** `NOTAS-v1100.md` (novo)

**Testes (novo):** `tests/v1100-textos-em-portugues-de-gente.test.mjs`

**Testes (atualizado):** `tests/v1098-listas-mostram-o-numero-que-as-define.test.mjs`
