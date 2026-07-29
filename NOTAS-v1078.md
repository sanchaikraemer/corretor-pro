# NOTAS v1078 — correção da v1077 flagrada pelo dono + auditoria em navegador real

## Contexto

O dono publicou a v1077 e mandou print na sequência: os contadores da Home **continuavam em
4 por linha no computador** — "vc nao fez o q mandei". E emendou a pergunta certa: *"se vc
não fez essa simples tarefa, o que me garante que fez as demais?"*. Esta versão corrige a
falha e responde a pergunta com verificação de navegador real em TODOS os itens do pacote.

## 1. A causa real dos contadores não mudarem

A regra nova de 5 colunas da v1077 estava certa e publicada — mas era atropelada pelo bloco
de tema do desktop (atualização #664), que crava `#home .resumo-dia{...repeat(4,...)!important}`
e o tamanho dos cards, tudo com `!important`. A suíte estática não enxerga briga de
prioridade de CSS. Correção: o modelo 1 agora mora DENTRO do bloco que manda —
`repeat(5,minmax(0,1fr))!important`, cards compactos (`min-height:0`/`padding:12px 14px`),
número 24px e rótulo sem quebra. O bloco fraco da v1077 saiu. Tablet (4 de rolagem) e
celular (2 colunas) intactos.

**Verificado em Chromium headless com o publicado**: 1366px → 5 colunas; 1100px → 5;
800px → 4 (rolagem); 400px → 2. Teste atualizado pra ancorar a regra que manda de verdade
(`tests/v1077-contadores-uma-linha.test.mjs`).

## 2. Auditoria dos outros itens do pacote (navegador real, publicado)

- **Rodinha coral**: presente na abertura, cor computada `rgb(255,98,88)` (coral da paleta),
  texto "Carregando os leads…". ✔
- **Contadores**: 5 colunas, iconezinhos escondidos. ✔
- **Tabela das listas (v1076)**: render real com leads de exemplo — linhas no modelo, sem
  WhatsApp, cabeçalho "# Cliente Próximo passo Parado há". ✔
- **Importação limpa**: com a classe ligada, instruções/arquivo/botões/título somem; ao
  desligar, voltam. ✔
- **Voltar reconstrói a lista**: o fluxo real (popstate com rota salva) reconstrói o
  "Fazer agora" com o título certo... e a auditoria FLAGROU um segundo problema:

## 3. Bug extra encontrado e corrigido: o loader cobria a lista reconstruída

O pintor do "Carregando os leads…" (e o de erro de carga) da Home não checava se uma lista
de grupo estava aberta — quando o voltar reconstruía a lista antes dos dados chegarem, o
loader pintava por cima. Guarda adicionada (`!state.grupoAtivo`) nos dois pintores.
Reverificado no navegador: título certo, sem nome cru, sem loader por cima.
Asserts novos em `tests/v1077-voltar-lista-e-import-limpo.test.mjs`.

## 4. Regra permanente pra isso não se repetir

`CLAUDE.md` ganhou a seção **"Verificação visual obrigatória antes de publicar"**: mudança
visual só publica depois de conferir o resultado computado no Chromium headless servindo
`public/`, nos tamanhos de tela relevantes — porque regra nova de CSS pode perder pra bloco
antigo com `!important` sem nenhum teste estático acusar.

## Verificação

- Suíte inteira (`npm test`) verde.
- `npm run build` limpo; publicado conferido no navegador (4 larguras de tela).

## Arquivos

`app.js` (guardas do loader/erro), `styles.css` (bloco #664 com o modelo 1; bloco fraco
removido), `CLAUDE.md` (regra nova), `tests/v1077-contadores-uma-linha.test.mjs` e
`tests/v1077-voltar-lista-e-import-limpo.test.mjs` (reforçados),
`package.json`/`package-lock.json` (versão **1077 → 1078**), `NOTAS-v1078.md` (este arquivo).
