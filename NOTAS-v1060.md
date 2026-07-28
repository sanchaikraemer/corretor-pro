# NOTAS v1060 — Regras comerciais e Sinais de objeção saem de baixo do Salvar

## O relato

"pq regras comerciais e sinais de objeção estao abaixo de onde salva e os demais botoes? esta ruim
esse leyaout da area de inteligencia comercial. me mande 4 modelos diferentes q vou ecolher outra"

## Causa

Acúmulo ao longo do tempo: quando "Regras comerciais" e "Sinais de objeção" foram criados como
campos próprios, entraram no fim da tela — depois dos números técnicos (Período dos áudios,
Atendimentos por dia, Descanso após atender) e dos botões Salvar/Restaurar/Zerar que já existiam —
sem reorganizar o restante. Não foi uma escolha de design, só ordem de chegada.

## Os 4 modelos apresentados

Publicados como protótipo interativo (celulares clicáveis) pro dono comparar: (1) abas por assunto,
(2) cartões que abrem/fecham, (3) mesma lista reordenada com botão fixo no rodapé, (4) passo a
passo. Escolhido: **Modelo 2 — cartões que abrem/fecham**.

## A mudança

Cada campo do Cérebro (Método, Tom de voz, Diferenciais, O que evitar, Regras comerciais, Sinais de
objeção) virou um bloco recolhível — reaproveitando `details.bloco-recolhe`, o MESMO componente
visual já usado em "Evolução do atendimento" (app.js), em vez de inventar um padrão novo. Agrupados
sob dois rótulos ("Estilo" e "Regras e objeções"), com "Método" já aberto por padrão e os demais
fechados. Os números técnicos ganharam sua própria seção ("Configurações técnicas"), e só depois
vêm os botões — Regras comerciais e Sinais de objeção nunca mais ficam depois do Salvar.

## Verificação

Testei a estrutura isolando o trecho `#icCerebro` num arquivo à parte com Playwright (Chromium
headless): os 6 campos em acordeão existem, abrir/fechar funciona (cliquei em "Regras comerciais" e
"Sinais de objeção" e os dois expandiram), zero erros de console. **Não** consegui uma captura de
tela limpa e confiável desse jeito — o app de verdade tem várias camadas de CSS acumuladas ao longo
das versões que só se resolvem certo com as classes/atributos que o JS do app real define no
carregamento (tema, layout desktop/mobile etc.); testar o fragmento isolado, fora desse
carregamento, mistura regras concorrentes de um jeito que não acontece no app rodando de verdade.
Reaproveitar `details.bloco-recolhe` (componente já validado em produção) foi a forma de reduzir
esse risco ao mínimo, mas o ideal é o dono conferir com os próprios olhos no app publicado.

## Testes

- `tests/v1060-cerebro-regras-objecoes-em-acordeao.test.mjs` (novo): confirma que todos os campos
  continuam com os mesmos ids (nada quebra o que app.js já lê/grava); que Regras comerciais e
  Sinais de objeção viraram `details.bloco-recolhe` (o componente já existente, não um novo); e —
  o achado original — que os dois aparecem no HTML **antes** do botão Salvar e antes das
  configurações técnicas, nunca mais depois.
- `npm test`: suíte inteira verde.

## Arquivos

`index.html` (`#icCerebro` reorganizado em acordeão), `styles.css` (`.cerebro-grupo-label`,
`.cerebro-campo`, `.cerebro-campo-body` — só o necessário pra encaixar no `bloco-recolhe` já
existente), `tests/v1060-cerebro-regras-objecoes-em-acordeao.test.mjs` (novo),
`package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1060.md`, versão
**1059 → 1060**.
