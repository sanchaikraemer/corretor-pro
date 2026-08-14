# v1273 — sábado e domingo saem do gráfico do mês

Print do dono (14/08/2026), com as barras do fim de semana circuladas em vermelho no gráfico
"Clientes atendidos por dia" do painel **Seu mês**:

> "Veja anexo, onde marquei em vermelho, quero q tire desse gráfico sábado e domingo, senão parece
> q não trabalhei, e realmente, pq é final de semana, mas então não considere final de semana."

## O problema

O gráfico desenhava **todo dia do mês**, do 1 ao dia de hoje. Como ele não atende no fim de semana,
o mês virava um serrote: cinco barras e dois zeros, cinco barras e dois zeros. Quem bate o olho não
lê "sábado e domingo" — lê **queda de produção**, várias vezes no mesmo mês. O gráfico estava
medindo o calendário, não o trabalho.

## O que mudou

**Sábado e domingo sem atendimento não aparecem mais no gráfico.** Sobram só os dias úteis, um do
lado do outro, e o mês passa a ser lido pelo que ele foi de verdade. O título virou **"Clientes
atendidos por dia útil"** — quem olhar precisa saber por que os dias não batem com o calendário.

Três cuidados que vieram junto:

**1. Fim de semana TRABALHADO continua no gráfico.** Se ele atendeu alguém num sábado, aquela barra
fica. O pedido era não parecer que ele não trabalhou; apagar um sábado de trabalho seria fazer
exatamente isso, ao contrário. A regra é: sai o fim de semana **vazio**.

**2. Os números do painel não mudaram.** "Clientes atendidos", "Mensagens trocadas", "Enviadas por
você" e "Recebidas dos clientes" continuam contando o mês inteiro, sábado e domingo incluídos. A
v1273 é sobre **como o gráfico é lido**, não sobre descartar dado — atendimento feito no domingo
continua valendo na conta.

**3. A legenda deixou de mentir.** Ela dizia "dia 1" → "hoje" fixo. Agora nomeia o **primeiro dia
desenhado** (num mês que começa no sábado, o gráfico abre no dia 3) e, na ponta direita, só escreve
"hoje" se hoje estiver ali. Quando hoje é sábado ou domingo sem atendimento, hoje sai do gráfico e
a legenda passa a nomear o último dia útil — antes a palavra "hoje" ia apontar pra sexta-feira.

Nos dois primeiros dias de um mês que começa no fim de semana e ainda não teve atendimento, o
gráfico simplesmente não é desenhado (em vez de aparecer uma caixa vazia). Os números do painel
continuam lá.

## Conferência antes de publicar

- Suíte completa verde: 23 arquivos + 428 testes.
- `tests/v1273-grafico-so-dia-util.test.mjs` (novo) — trava as duas pontas: fim de semana vazio sai,
  fim de semana com atendimento fica, a legenda não pode dizer "hoje" quando hoje não está no
  desenho, e a contagem dos números do painel não pode filtrar nada.
- `tests/v1251-seus-numeros-do-mes.test.mjs` — atualizado: cada dia virou um objeto (carrega a data
  pra saber o que é fim de semana), então a marca de "hoje" deixou de ser "o último do array".
- Verificação visual no Chromium sobre o app publicado em `public/`, com o CSS real, em **390×844**
  e **1280×900**, em quatro cenários: quinzena (14 dias → 10 barras, os quatro dias de fim de semana
  fora), mês cheio (31 dias → 21 barras, sem rolagem lateral em nenhuma das duas larguras), hoje
  domingo sem atendimento (some do gráfico, legenda vira "dia 7") e hoje domingo com atendimento
  (fica, legenda continua "hoje"). Zero erro de página nos dois tamanhos.
