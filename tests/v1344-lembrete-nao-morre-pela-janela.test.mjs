import fs from "node:fs";
import assert from "node:assert/strict";

// v1344 — A JANELA DE HORÁRIO DA v1336 QUASE MATOU O LEMBRETE DIÁRIO. ERRO MEU, ACHADO NA REVISÃO.
//
// A v1336 fez o certo pela metade: passou a só deixar o aviso sair dentro da janela que o corretor
// escolhe (padrão 8h, valendo 4 horas), resolvendo "recebi isso em horário que não é de trabalho".
// O que eu não vi foram DUAS coisas, e juntas elas fariam o lembrete parar de chegar sem ninguém
// entender por quê:
//
//   1. QUEM JÁ TINHA O LEMBRETE LIGADO nunca refazia o pedido de "acorde o app" — ele só era feito
//      no clique de ativar. O service worker, esse sim, atualiza sozinho. Resultado: janela nova
//      valendo + pedido velho (uma vez a cada 20 horas) = celular acordando uma vez por dia, num
//      horário qualquer, quase sempre FORA da janela.
//
//   2. A TRAVA ANTIGA ERA "no máximo um aviso a cada 20 horas". Um aviso às 11h de segunda
//      bloqueava qualquer aviso antes das 7h de terça — e como a janela vai das 8h às 12h, o
//      despertar de terça de manhã podia cair na trava e o dia inteiro se perdia.
//
// Numa simulação de 30 dias com um despertar diário em horário variado (o comportamento real do
// Chrome), a regra da v1336 dava 8 avisos. A regra desta versão dá 15, sem nenhum fora de hora.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const sw = fs.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");

// ── 1. O app refaz o pedido a cada abertura, sem o corretor clicar em nada ───────────────────
assert.match(app, /async function cpLembreteDiarioReconciliar\(\)\{/,
  "precisa existir a reconciliação que roda na abertura do app");
assert.match(app, /try\{ cpLembreteDiarioReconciliar\(\); \}catch\(_\)\{ \}/,
  "e ela precisa ser chamada de fato no carregamento");
{
  const corpo = app.match(/async function cpLembreteDiarioReconciliar\(\)\{[\s\S]*?\n\}/)[0];
  assert.match(corpo, /if\(!cpLembreteDiarioLigado\(\) \|\| Notification\.permission !== "granted"\) return;/,
    "quem não ligou o lembrete não pode ter nada registrado por baixo do pano");
  assert.match(corpo, /await cpLembreteDiarioGravarHoraNoWorker\(\);/,
    "a hora escolhida precisa ser regravada — o worker não enxerga o localStorage");
  assert.match(corpo, /await cpLembreteDiarioRegistrarSync\(\);/,
    "e o pedido de acordar precisa ser refeito, senão o intervalo antigo de 20h continua valendo");
  assert.match(corpo, /catch\(_\)\{/, "nada disso pode derrubar a abertura do app");
}

// ── 2. A trava passou a ser POR DIA DE CALENDÁRIO ───────────────────────────────────────────
assert.match(sw, /if \(diaDoUltimoAviso === hoje\) return;/,
  "no máximo um aviso por dia de calendário");
assert.ok(!/Date\.now\(\) - ultimo < 20 \* 60 \* 60 \* 1000/.test(sw),
  "a trava antiga de 20 horas não pode voltar: era ela que comia o despertar do dia seguinte");
assert.match(sw, /swNotifGravar\('ultimoAvisoDia'/, "o dia do último aviso precisa ficar gravado");
// Instalação antiga só tem o carimbo em milissegundos — o dia tem que sair dele, senão todo mundo
// que já usava o lembrete leva um aviso extra no dia da atualização.
assert.match(sw, /Number\.isFinite\(diaUltimo\) \? diaUltimo : \(ultimoMs \? diaDe\(new Date\(ultimoMs\)\) : -1\)/,
  "quem já tinha lembrete precisa continuar contando a partir do carimbo antigo");

// ── 3. A repescagem existe, e só em horário de gente ────────────────────────────────────────
assert.match(sw, /const repescagem = diasEmBranco >= 2 && agoraH >= 7 && agoraH <= 21;/,
  "depois de 2 dias em branco, avisa no primeiro despertar em horário de gente");
assert.match(sw, /if \(!naJanela && !repescagem\) return;/);

// ── 4. A REGRA RODANDO: 30 dias, um despertar por dia, horário variado ──────────────────────
// É a prova de que a mudança serve pra alguma coisa. Reproduz a decisão do worker exatamente como
// ela está escrita lá, e compara com a regra que estava no ar na v1336.
const HORAS_DE_DESPERTAR = [9, 14, 3, 19, 11, 22, 6, 16, 8, 13]; // o Chrome acorda quando quer
const naJanela = (h, inicio = 8, janela = 4) => ((h - inicio + 24) % 24) < janela;

function simular(regra) {
  let diaUltimo = -1, msUltimo = 0;
  const avisos = [];
  for (let dia = 0; dia < 30; dia++) {
    const h = HORAS_DE_DESPERTAR[dia % HORAS_DE_DESPERTAR.length];
    const ms = dia * 86400000 + h * 3600000;
    if (regra({ h, dia, ms, diaUltimo, msUltimo })) { avisos.push({ dia, h }); diaUltimo = dia; msUltimo = ms; }
  }
  return avisos;
}

const regraV1336 = ({ h, ms, msUltimo }) => naJanela(h) && (ms - msUltimo) >= 20 * 3600000;
const regraV1344 = ({ h, dia, diaUltimo }) => {
  if (dia === diaUltimo) return false;
  if (naJanela(h)) return true;
  const diasEmBranco = diaUltimo < 0 ? 99 : dia - diaUltimo;
  return diasEmBranco >= 2 && h >= 7 && h <= 21;
};

const antes = simular(regraV1336);
const depois = simular(regraV1344);

assert.ok(depois.length > antes.length,
  `a regra nova precisa entregar MAIS lembretes que a da v1336 (antes ${antes.length}, depois ${depois.length})`);
assert.ok(depois.length >= 12,
  `com um despertar por dia, o corretor precisa receber pelo menos 12 lembretes em 30 dias — vieram ${depois.length}`);

// Nenhum aviso de madrugada, em nenhum caso. Esta é a reclamação original e não pode voltar.
for (const { h } of depois) {
  assert.ok(h >= 7 && h <= 21, `nenhum aviso pode sair às ${h}h — madrugada foi o que gerou a reclamação`);
}
// E nunca dois no mesmo dia.
assert.equal(new Set(depois.map(a => a.dia)).size, depois.length, "nunca dois avisos no mesmo dia");
// A maioria continua caindo dentro da janela escolhida: a repescagem é exceção, não o novo normal.
const dentroDaJanela = depois.filter(a => naJanela(a.h)).length;
assert.ok(dentroDaJanela >= depois.length / 2,
  `a janela escolhida tem que continuar sendo o caminho normal (${dentroDaJanela} de ${depois.length})`);

console.log(`v1344-lembrete-nao-morre-pela-janela: ok (30 dias simulados: ${antes.length} avisos na regra antiga, ${depois.length} na nova, ${dentroDaJanela} deles na janela escolhida)`);
