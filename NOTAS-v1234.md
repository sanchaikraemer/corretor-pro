# NOTAS v1234 — Limpeza geral de cores fora da paleta, bloco do topo em destaque e quebra de linha na proposta

Data: 12/08/2026. Três pedidos do dono no mesmo dia.

## 1. "O que falamos ontem sobre as cores aleatórias que não são da paleta?"

Print da tela Agenda. Ele estava certo — a auditoria no navegador (lendo a cor COMPUTADA de
cada texto e fundo da tela, não só o código) mostrou o botão **"Excluir" em rosa**
(`#FFD7DE` sobre `rgba(244,118,138,.10)`), cor que não existe na paleta. E não era só ele:
a varredura no app inteiro achou **6 famílias de cor soltas**, herdadas de versões antigas.
Todas foram trocadas pelas cores oficiais:

| Cor solta (saiu) | O que era | Virou |
|---|---|---|
| `#FFD7DE`, `#FFDBE2`, `rgba(244,118,138,…)` | rosa do "Excluir" e do botão de perigo | `--risco` (#E35454) |
| `#FF8A8A`, `#FF8A80`, `#FF7F74`, `rgba(255,80,80,…)`, `rgba(255,120,120,…)` | vermelhos variados (× de descartar, ícones, avisos) | `--risco` |
| `rgba(255,45,155,…)` | magenta (lembrete/timing) | `--acao`/`--timing` (#56C7F2) |
| `rgba(55,232,255,…)`, `rgba(0,212,255,…)`, `#BDF8FF` | ciano-neon antigo (21 usos) | `--dados` (#56C7F2) |
| `rgba(196,92,255,…)` | roxo diferente do oficial | `--cerebro` (#9B8CFF) |
| `#FFC4F4`, `#EFFFB0` | rosa claro de aviso e verde-limão | `--soft` / `--accent` |

**Uma cor foi mantida de propósito:** o verde do botão **"Abrir WhatsApp"** (`#25D366`) — é a
cor da marca do WhatsApp, como um logotipo, e ajuda o corretor a reconhecer o botão de
relance. Se o dono preferir, ela vira coral num toque.

As cores do **papel da proposta** (branco, cinzas, preto) também continuam: é um documento
impresso para o cliente, não a interface do app.

O teste `tests/v1234-…` agora **falha de propósito** se qualquer uma dessas cores voltar a
aparecer em `app.js`, `styles.css`, `index.html` ou `js/*.js`.

## 2. "Isso aqui precisa chamar mais a atenção também"

Print do bloco da agenda no topo (calendário + sino). Ele sumia no fundo escuro: números em
cinza e contorno quase invisível. Agora:

- Cápsula maior (36px), contorno visível e sombra leve — o bloco se descola do fundo.
- Números em branco e maiores (14px), ícones mais nítidos.
- **Metade de HOJE preenchida**, não mais só levemente tingida: **ciano cheio** quando há
  compromisso no dia e **vermelho cheio, pulsando de leve**, quando há atraso (o pulso
  desliga sozinho para quem pediu menos movimento no sistema).
- No tema claro o texto sobre o ciano é branco — o azul-petróleo dava contraste baixo demais
  (conferido no navegador, não no chute).

## 3. "Quero poder quebrar a linha nas observações e descrição da permuta"

Print da proposta com a descrição da permuta toda socada numa tira só.

- A **descrição da permuta** deixou de ser um campo de uma linha e virou caixa de várias
  linhas (dá Enter e escreve na linha de baixo, como no WhatsApp).
- A **proposta impressa passa a respeitar as quebras**: sem isso o navegador junta tudo
  numa tira — era exatamente o que aparecia no print. Vale para a descrição da permuta e
  para as observações.
- O texto continua **escapado** (entra como texto, nunca como código): permitir quebra de
  linha não pode abrir essa porta.

## Verificação

- Suíte completa verde (400 testes), com o novo `v1234-paleta-destaque-topo-e-quebra-linha`.
- Conferência visual em Chromium headless: auditoria de TODAS as cores computadas da tela
  Agenda (só paleta), bloco do topo nos três estados (sem agenda / com hoje / com atraso) e
  nos dois temas, e a proposta com permuta em 4 linhas e observações em 3 linhas.
