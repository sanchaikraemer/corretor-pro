# v1202 — corrigido: o botão "Confirmar" do reagendamento não fazia nada

## O que aconteceu

O dono clicou em "Confirmar" no painel de reagendamento (adicionado na v1201) e nada aconteceu.
Ele mandou um print do console do navegador mostrando o erro de verdade: **"Uncaught
ReferenceError: qs is not defined"**, disparado tanto ao trocar a data/hora quanto ao clicar em
Confirmar. E cobrou, com razão: a v1201 tinha sido publicada como testada e verificada, e não
estava.

## Causa raiz

`app.js` importa a função `qs` (busca elemento na tela) do arquivo `js/dom.js` como uma variável
do **módulo** (`import { qs, ... } from './js/dom.js'`). Mas os atributos `onclick='...'` e
`onchange='...'` escritos direto no HTML (como os do painel de reagendar) **rodam fora do escopo
do módulo** — só enxergam `window`, `document`, e o que o próprio código pendura explicitamente em
`window` (é por isso que toda função chamada num `onclick` neste projeto tem uma linha
`window.nomeDaFuncao = nomeDaFuncao` depois dela). `qs` nunca foi pendurada em `window`, então
qualquer atributo inline que a chamasse direto (`qs("#algumId")`) quebrava com esse erro — silenciosamente
pro usuário, sem toast, sem nada, porque o próprio clique morria antes de rodar qualquer coisa.

Esse bug **já estava presente desde a v1200** (quando o campo de hora foi adicionado, usando
`qs(...)` dentro do `onchange`) — o próprio salvamento automático "ao trocar o campo" que a v1200
prometia nunca funcionou de verdade. A v1201 só piorou a visibilidade do problema: reaproveitou o
mesmo `qs(...)` quebrado dentro do botão Confirmar novo, e ainda usou `toast(...)` (também
importado do módulo, também nunca disponível pra atributo inline) pro aviso de "escolha a data
primeiro".

## Por que os testes anteriores não pegaram isso

Os testes desta função (`v1199-horario-opcional-no-lembrete.test.mjs`) e a conferência visual da
v1200/v1201 conferiam o **texto** do código (regex) e a **aparência** (screenshot de um HTML
escrito à mão, reproduzindo a estrutura, mas sem executar o `onclick` de verdade). Nenhum dos dois
chegou a **clicar no botão e rodar o JavaScript** dentro dele — que é exatamente onde o erro
acontecia.

## Correção

- Trocado `qs("#id")` por `document.querySelector("#id")` nos três lugares do painel de reagendar
  (campo de data, campo de hora, botão Confirmar) — `document` é global de verdade, sempre
  disponível, diferente de `qs`. Já existia esse mesmo padrão em outro lugar do código
  (busca global do menu), então é a forma já usada no projeto pra esse caso.
- Adicionado `window.toast = toast;` logo depois do import, pra qualquer atributo inline (este ou
  futuro) poder chamar `toast(...)` sem quebrar.

## Como validei desta vez (de verdade, não só aparência)

1. **Teste novo e permanente**, `tests/v1202-atributo-inline-nao-usa-identificador-de-modulo.test.mjs`:
   extrai cada `onclick`/`onchange` que `reagendarControlHTML` gera e **executa o código de
   verdade**, num escopo global simulado sem `qs` disponível (exatamente como um atributo inline
   roda no navegador) — falha se qualquer um lançar erro. Rodei esse teste contra o código antigo
   (antes da correção) pra confirmar que ele pega o bug: pegou.
2. **Navegador real, de verdade**: publiquei o app (`node build.js`), subi um servidor local
   servindo os arquivos publicados, abri com o Chromium headless o `app.js` **de verdade** (o
   mesmo que vai pro ar), montei o painel de reagendar na tela, preenchi data e hora, e **cliquei**
   no botão Confirmar. Resultado: `reagendarLembrete` foi chamada com os valores certos
   (`"2026-08-11"`, `"14:00"`), sem nenhum erro de "qs is not defined" ou "toast is not defined" no
   console.
3. `node --check app.js` e `npm test` (24 arquivos, 370 testes) verdes.

Lição registrada pra próxima vez que este painel (ou qualquer `onclick`/`onchange` inline) for
mexido: testar com o **botão realmente clicado num navegador**, não só ler o código ou tirar
print de uma reprodução estática — é a única forma de pegar um `ReferenceError` que só acontece
na hora do clique.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
