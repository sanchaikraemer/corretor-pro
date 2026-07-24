# v981 — lead atendido volta a respeitar os dias de espera; cartão de dose batida mostra o total real

## Contexto

Dois problemas que o dono relatou ao vivo, usando o sistema com clientes reais, logo depois da
v980 ir ao ar.

## 1. Lead atendido reaparecia nas prioridades antes do prazo (3 ou 5 dias)

Relato do dono: "mariana planta p/morar lançamento" foi atendida (botão "Marcar atendimento") há
2 dias e voltou a aparecer nas prioridades/"Fazer agora" — "novamente não está respeitando os 5
dias de tempo do cliente".

**Causa raiz:** "Marcar atendimento" (botão) e "copiar mensagem" (quando usada sozinha, sem
escrever uma observação) só gravam o evento interno `contato_manual` — nunca tocam a timeline da
conversa (`timeline_json`) salva no banco. Só a **Observação** e o atendimento **ditado** escrevem
na timeline. Só que `emJanelaDeEspera()` — a função que decide "esse lead ainda está dentro do
prazo de espera, não oferece de novo" — só enxergava `daysSinceLastTouch`, um campo calculado no
servidor **em cima da timeline**. Resultado: para quem foi atendido só pelo botão (sem observação),
esse campo continuava com a idade da ÚLTIMA MENSAGEM REAL do WhatsApp — que pode ser bem mais
velha — e o lead "escapava" da proteção antes da hora.

É a mesma causa raiz de um bug já corrigido antes (v882, função `diasParado` — usada em
"Oportunidades esquecidas"/Raio-X): medir só a idade da última MENSAGEM e ignorar o último
ATENDIMENTO manual do corretor. A v882 corrigiu isso ali; `emJanelaDeEspera` — usada pela fila
"Fazer agora" (`cpFilaFazerAgora`) e pela lista de prioridades (`filaPorFatos`) — tinha o mesmo
problema e nunca tinha recebido a mesma correção.

**Fix:**
- `emJanelaDeEspera(l)` agora considera também `ultimoAtendimentoTs(l)` (a mesma função que a
  v882 já usa) — usa sempre o toque mais recente entre a última mensagem real e o último
  atendimento manual (botão, observação ou mensagem copiada), nunca o mais antigo. Atendimento
  manual velho (de anos atrás) não "protege" artificialmente um lead cuja conversa real é mais
  recente — só conta quando é de fato o toque mais novo.
- Como `cpFilaFazerAgora`, `filaPorFatos` (via o campo `emJanela`) e `entraEmRetomada`
  ("Oportunidades esquecidas") já chamam `emJanelaDeEspera`, os três ficam corrigidos de uma vez
  só, sem duplicar lógica.

## 2. Cartão "Você já atendeu os 10 de hoje" travado em 10

Relato do dono: atendeu mais de 10 leads no dia e a Home continuava mostrando "Você já atendeu os
10 de hoje" — parecia travado, mesmo tendo atendido 11, 12...

**Causa raiz:** o texto usava sempre `CP_DOSE_DIA`, a META fixa do dia (10) — não o total real de
atendidos. Uma vez batida a meta, o número no cartão nunca mais mudava pelo resto do dia,
independente de quantos o corretor atendesse depois.

**Fix:** o cartão agora mostra `cpAtendidosHojeTotal(items)` — a mesma contagem em tempo real que
já alimenta o banner da Home desde a v980. Passa de 10, o cartão acompanha.

## Verificação

- `npm test`: suíte inteira verde (164 checks), incluindo os dois testes novos
  (`v981-janela-espera-considera-atendimento`, `v981-dose-batida-mostra-total-real`).
- `npm run build`: build limpo, versão 981.
- Não testado em produção — depende de dado real de lead atendido só pelo botão, com conversa de
  WhatsApp mais antiga que o atendimento; a suíte cobre o cenário via dados sintéticos que
  reproduzem exatamente os números do relato (atendido há 2 dias, mensagem real há 20 dias).

## Arquivos

- `app.js` (`emJanelaDeEspera`, `renderBotoesHome`),
  `tests/v981-janela-espera-considera-atendimento.test.mjs` (novo),
  `tests/v981-dose-batida-mostra-total-real.test.mjs` (novo),
  `package.json`/`package-lock.json`, `NOTAS-v981.md`, versão **980 → 981**.
