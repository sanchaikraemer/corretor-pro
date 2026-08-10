import fs from "node:fs";
import assert from "node:assert/strict";

// v1162 — dono, sobre o quadro verde "Atualização incremental" do FIM da importação: "essa
// informação aparece tão rápido quando termina os 100% e muda tão rápido para o lead que não dá
// nem pra perceber. Por que não vai informando isso no decorrer da análise, de 0% até 100%?"
//
// Agora cada etapa do progresso conta o reaproveitamento NA HORA em que ele acontece:
//   etapa 2 (extração)  → "cliente já conhecido — N mensagens já salvas serão comparadas"
//   etapa 3 (áudios)    → "X novos · Y reaproveitados" (já existia desde a v1027)
//   etapa 4 (análise)   → "comparando com a conversa já salva — só a novidade paga análise"
//   etapa 5 (salvando)  → "nada novo: análise salva mantida, nada pago" OU "N mensagens novas"
//   etapa 6 (concluído) → o mesmo resumo, persistindo na tela ("lead atualizado · …")
// O quadro verde do resultado continua existindo — mas ninguém mais depende de ler algo que some.

// v1195 — o processamento da conversa importada saiu do app.js para o pedaço js/importacao.js,
// baixado só na hora em que o corretor importa. Este teste confere esse código como texto, então
// lê os dois arquivos juntos: os asserts abaixo valem exatamente sobre o mesmo código de antes.
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8")
  + '\n' + fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');

// ── Etapa 2: o cliente reconhecido aparece assim que a preparação volta ───────────────────────
assert.match(app, /const infoClienteConhecido = prep\?\.leadAnterior\n\s*\? `cliente já conhecido — \$\{Number\(prep\.leadAnterior\.mensagensSalvas\) \|\| 0\} mensagens já salvas serão comparadas`\n\s*: "cliente novo nesta carteira";/,
  "assim que a preparação volta, a tela diz se o cliente já é conhecido (e quantas mensagens serão comparadas)");
assert.match(app, /renderEtapas\(2, infoClienteConhecido\);/, "e isso vai pra etapa 2 do progresso");

// ── Etapa 3: contagem de áudio reaproveitado continua (regressão da v1027) ────────────────────
assert.match(app, /renderEtapas\(3, `\$\{Math\.min\(i\+LOTE,audios\.length\)\}\/\$\{audios\.length\} novos · \$\{audiosReaproveitados\} reaproveitados`\);/,
  "os lotes de transcrição seguem mostrando novos × reaproveitados");

// ── Etapa 4: cliente conhecido = a análise avisa que só a novidade paga ───────────────────────
assert.match(app, /renderEtapas\(4, prep\?\.leadAnterior \? "comparando com a conversa já salva — só a novidade paga análise" : "validando as três mensagens pelo Cérebro"\);/,
  "a etapa de análise diz o que está sendo comparado");

// ── Etapa 5: o veredito da comparação aparece assim que a análise volta ───────────────────────
{
  const ini = app.indexOf("const incEtapa = result?.incrementalMeta || {};");
  assert.ok(ini > -1, "o resumo da etapa 5 lê o incrementalMeta da resposta");
  const trecho = app.slice(ini, ini + 700);
  assert.match(trecho, /"nada novo: análise salva mantida, nada pago"/,
    "reimportação sem novidade diz na hora que nada foi pago");
  assert.match(trecho, /análise refeita/, "com novidade, diz que a análise foi refeita (e quantas mensagens)");
  assert.match(trecho, /renderEtapas\(5, resumoEtapa \? `preparando pra salvar · \$\{resumoEtapa\}` : "preparando pra salvar"\);/,
    "e o texto entra na etapa 5, visível enquanto salva");
}

// ── Etapa 6: o resumo persiste no "Concluído" ─────────────────────────────────────────────────
{
  const ini = app.indexOf("const resumoFim = incrementalMeta?.reimportacao");
  assert.ok(ini > -1, "o resumo final existe");
  const trecho = app.slice(ini, ini + 700);
  assert.match(trecho, /"nada novo: análise mantida, nada pago"/, "sem novidade: dito no Concluído");
  assert.match(trecho, /sem mensagem nova; análise refeita \(a salva estava incompleta\)/,
    "o caso raro (zero novas mas análise salva incompleta) é dito com honestidade — refez e explica por quê");
  // v1178 — a linha do Concluído passou a somar também o aviso de áudio que não virou texto
  // (teto de áudios do dia / falha de transcrição), que antes não aparecia em lugar nenhum.
  assert.match(trecho, /renderEtapas\(6, linhaFim \? `lead atualizado · \$\{linhaFim\}` : "lead atualizado e importação confirmada"\);/,
    "e fica na etapa Concluído, que persiste na tela");
  assert.match(trecho, /const linhaFim = \[resumoFim, audioFim\]\.filter\(Boolean\)\.join\(" · "\);/,
    "o resumo do reaproveitamento continua sendo a base da linha, agora somado ao aviso de áudio");
}

// ── O quadro verde do resultado continua existindo (ninguém removeu a prova por print) ────────
assert.match(app, /Atualização incremental:/, "o quadro verde do resultado continua");

console.log("v1162-reaproveitamento-aparece-no-progresso: ok");
