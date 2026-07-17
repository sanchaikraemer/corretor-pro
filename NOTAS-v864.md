# v864 — chip de etapa vira barra de progresso em gradiente

## Contexto

O chip de etapa do lead (na tela do lead) era um pill fixo: bolinha cinza + texto
"Nome da etapa · passo X de 6". O dono pediu para trocar por uma **barra de progresso em
gradiente**, no mesmo pill (mesma altura e bordas).

## Como ficou

- **Preenchimento proporcional** da esquerda pra direita: passo X de 6 = **X/6** da largura.
- **Um único gradiente** de comprimento fixo — **frio → coral → verde** — serve de fundo pra
  todos os passos; cada card revela só a **fatia** correspondente ao seu progresso
  (`clip-path: inset(...)`). Por isso o passo 1 mostra só a ponta fria e o passo 6 revela o
  gradiente inteiro terminando em verde.
- **Pontinho branco** marca a borda do avanço: pulsa suavemente nos passos **1 a 5**
  (sensação de "em andamento") e fica **parado no passo 6** (venda concluída).
- **Texto** ("Nome da etapa · passo X de 6") continua por cima do preenchimento, **branco e
  em negrito**, com sombra leve atrás da letra pra ficar legível em qualquer parte da barra.
- **Cores reaproveitadas** (nada inventado):
  - frio = `var(--cyan)` (o mesmo ciano que o app já usa pra "frio"/dados);
  - coral = `var(--accent)` (o mesmo do botão "Anexar");
  - verde = `#68ff95` (o mesmo da etiqueta "Atendido há X min").
- Os **6 nomes das etapas** (passo 1 = "Conhecendo" … passo 6 = "Decidindo") vêm direto de
  `cp704Jornada`, sem cravar nada novo.

## Detalhes de implementação

- `app.js` — `cp704JornadaBadge` agora monta o pill com três camadas: `.cp704-etapa-fill`
  (gradiente + clip-path pela variável `--cp-etapa-pct`), `.cp704-etapa-edge` (pontinho) e
  `.cp704-etapa-label` (texto). Passo 0 (Perdido / Arquivado) **não** é passo de jornada:
  continua como pill simples, sem barra.
- `styles.css` — regras `.cp704-etapa-prog*` + keyframe `cp704EtapaPulse`. O trilho (parte
  não preenchida) é um escuro translúcido mantido nos dois temas pra o texto branco ficar
  sempre legível. Respeita `prefers-reduced-motion` (sem pulso).

## Verificação

- Novo teste-guarda `v864-barra-progresso-etapa`: roda `cp704JornadaBadge` contra stubs e
  confere o preenchimento no **passo 1** (16.67%, pulsando), num **passo do meio** (3 = 50%)
  e no **passo 6** (100%, `is-completo`, sem pulsar); confere que os 6 nomes de etapa batem
  com o que já existia; e que o CSS usa o gradiente com as cores reaproveitadas + `clip-path`.
- `npm test`: suíte completa verde.
