# NOTAS v1095 — Só existe Ativo ou Arquivado. Ponto final.

## O que o dono mandou

> *"eu quero cliente ativo ou arquivado. Ponto final. Não quero geladeira, não quero oportunidade
> esquecida, não quero vendido, não quero merda nenhuma de nome de nada. Só tem que ter duas
> opções, ativo ou arquivado, e ponto final."*

Ele já tinha mandado antes. Na versão passada eu mantive as "Oportunidades esquecidas" achando que
era outra coisa (não era etapa de funil) e avisei que só tirava se ele mandasse. Ele mandou. Está
tirado.

---

## O que saiu

**A seção "Oportunidades esquecidas" da tela inicial.** Ela pegava clientes ATIVOS, parados há 7
dias ou mais, e mostrava numa lista separada com esse rótulo. Ou seja: dava um terceiro nome pro
cliente — exatamente o que foi banido.

Saiu tudo: a seção, a lista, a regra que decidia quem entrava nela, o cartão de cada linha, a
barrinha colorida de atraso e o estilo — 14 regras de aparência que só existiam pra ela.

**A tela inicial agora tem uma lista só de cliente: o "Fazer agora".**

---

## O que continua (e por que não é "mais um nome")

O **"Fazer agora"**, a **Agenda** e o **"Aguardando cliente"** continuam.

A diferença é essa: eles não dizem *o que o cliente é*, dizem *o que você faz hoje*. É a sua rotina
de trabalho — inclusive com a meta por dia e o descanso que você mesmo configura no Cérebro. Se
tirasse isso, não sobrava app.

O que foi banido é **rótulo de cliente**. Disso, agora só existem dois: **Ativo** e **Arquivado**.

---

## Uma trava pra isso não voltar

Criei uma verificação automática que **impede** qualquer versão futura de reintroduzir um terceiro
nome. Ela confere três coisas:

1. A seção removida não voltou (nem o título, nem as funções, nem o estilo).
2. Só existem dois estados possíveis pra um cliente — e testa de verdade: joga todos os nomes
   antigos (Novo, Atendimento, Visita/Proposta, Negociação, Standby, Vendido, Perdido, Geladeira) e
   confirma que **todos** caem em Ativo ou Arquivado.
3. Varre o texto que aparece na tela procurando as palavras banidas. Se alguma voltar a ser exibida,
   a verificação falha e a versão não sobe.

Ou seja: daqui pra frente isso não depende de eu lembrar.

---

## Um teste antigo foi apagado

O `v982` inteiro testava a barrinha de atraso daquela seção. Sem a seção, ele ficou sem assunto —
apagado. Não é perda de proteção: a trava nova garante que a seção não volta.

Outros quatro testes foram atualizados porque citavam as funções removidas. O motivo ficou escrito
dentro de cada um.

---

## Validação feita antes de publicar

| Verificação | Resultado |
|---|---|
| Suíte completa | 271 testes verdes |
| `npm run build` | 27 arquivos, versão 1095 |
| Verificação no navegador de verdade | 16 conferências, todas ok |

No navegador, no celular e no computador, foi conferido: a seção não aparece mais, o bloco não é
nem montado, **nenhuma palavra banida aparece na tela**, não há rolagem lateral, a tela de
Arquivados continua abrindo normal e voltar pra Home funciona, sem nenhum erro.

**Limitação dita abertamente:** esta sessão não tem acesso ao banco de produção. As telas foram
conferidas no navegador com o app publicado localmente.

---

## O que continua pendente (e depende de você)

Continua gravado na ficha de cada cliente arquivado, **dentro do banco**, a palavra antiga. Isso
nunca aparece na tela — é só o registro interno. Trocar exige reescrever a ficha de todos os
clientes que você já arquivou, e eu não mexo nos seus dados sem você mandar.

Se quiser que eu troque também no banco, é só falar: hoje isso é **uma linha** de mudança no app
mais uma atualização no banco — na v1094 essa palavra foi concentrada num único lugar justamente
pra isso.

---

## Arquivos alterados

**Código:** `app.js`, `styles.css`

**Versão:** `package.json`, `package-lock.json`

**Documentação:** `NOTAS-v1095.md` (novo)

**Testes (novo):** `tests/v1095-so-ativo-ou-arquivado.test.mjs`

**Testes (apagado):** `tests/v982-radar-barra-urgencia.test.mjs`

**Testes (atualizados):** `tests/v882-parado-considera-atendimento.test.mjs`,
`tests/v911-limpeza-lead-e-esquecidas.test.mjs`, `tests/v1093-correcoes-de-tela.test.mjs`
