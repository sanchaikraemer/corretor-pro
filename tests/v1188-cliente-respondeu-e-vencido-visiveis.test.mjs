import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1188 — auditoria comercial de 09/08/2026 rodando o app DE VERDADE num navegador. Ela apontou
// dois "defeitos"; um sobreviveu, o outro não:
//
// DEFEITO A ("Cliente respondeu" nunca acontecia) — REVOGADO PELO DONO NA v1189. A premissa
// estava errada: o app não é integrado ao WhatsApp, então "o cliente falou por último" no
// retrato importado nunca significa "cliente sem resposta" — o corretor SEMPRE responde no
// WhatsApp, e a mensagem só entra no app quando ele importa (momento em que o app já analisa e
// gera resposta). A categoria, o detector e o furo no descanso saíram DE VEZ — a guarda disso é
// tests/v1189-cliente-respondeu-nao-existe.test.mjs.
//
// DEFEITO B — compromisso VENCIDO se apresentava como "Hoje". Um retorno combinado que venceu
// anteontem aparecia no box "Próximos compromissos" com rótulo "Hoje" (valor padrão da variável,
// não data real) e chip azul "Agenda". O esquecimento se vestia de coisa em dia — o contrário do
// que a regra do produto pede ("vencido fica em Programados COM DESTAQUE DE ATRASADO"). Esse
// conserto FICOU, e é o que este teste guarda.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// ── B. Compromisso vencido: rótulo verdadeiro e chip de alerta ───────────────────────────────
const apSrc = app.match(/function cpAppointmentData\(lead\)\{[\s\S]*?\n\}/)[0];
assert.match(apSrc, /Venceu há \$\{venc\.dias\} dias/, 'vencido precisa dizer "Venceu há N dias" — nunca "Hoje"');
assert.match(apSrc, /atrasado/, 'cpAppointmentData precisa devolver a marca de atrasado');
assert.match(app, /ap\.atrasado\?'hot':meta\.cls/, 'o chip do compromisso vencido precisa ficar vermelho (hot), não azul "Agenda"');
assert.match(app, /ap\.atrasado\?'Vencido':meta\.label/, 'o texto do chip precisa dizer "Vencido"');

// E o comportamento: sem compromisso futuro e com lembrete vencido, o rótulo é de vencimento.
{
  const fn = new Function('cp786CompromissoAtrasado','ui671HojeIso','ui671DiasAte','cp786DataTs','produtosLabel','Date',
    `${apSrc}\nreturn cpAppointmentData;`);
  const agora = Date;
  const r = fn(()=>({ dias:2, dataLabel:'08/08' }), ()=> '2026-08-10', ()=>null, ()=>0, ()=> 'Green Park', agora)({ analysis:{ lembrete:{ quando:'2026-08-08', motivo:'retornar sobre proposta' } } });
  assert.equal(r.atrasado, true, 'lembrete vencido precisa sair marcado como atrasado');
  assert.match(r.time, /^Venceu há 2 dias$/, `o rótulo precisa ser o vencimento real (veio: ${r.time})`);
  assert.ok(r.sortTs < Date.now(), 'vencido ordena antes de qualquer compromisso futuro');
}

console.log('v1188-cliente-respondeu-e-vencido-visiveis: ok (só o Defeito B — o A foi revogado na v1189)');
