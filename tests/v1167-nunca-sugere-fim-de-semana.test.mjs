import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1167 — print do dono: a faixa "Ficaram de te dar uma resposta" sugeriu retomar contato num
// DOMINGO ("Sugiro retomar dom, 09/08"). Reação dele: "nunca faça isso... nem no sábado". Com
// razão — é o app propondo, sozinho, um compromisso de trabalho pro fim de semana. Mandar
// mensagem de venda nessa hora não ajuda a vender, e ainda arrisca queimar o corretor com o
// cliente.
//
// Este teste roda a matemática de verdade (cpEhFimDeSemana/cpEmpurraPraDiaUtil, extraídas de
// app.js) e confere: sábado empurra pra segunda (+2), domingo empurra pra segunda (+1), dia útil
// não muda. E que a regra só vale pra SUGESTÃO automática — o corretor escolhendo a mão continua
// livre (tem quem atenda sábado de propósito).

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function extrairFuncao(nome) {
  const inicio = app.indexOf(`function ${nome}(`);
  assert.ok(inicio >= 0, `${nome} não encontrada em app.js`);
  let i = app.indexOf('{', inicio), prof = 0;
  for (; i < app.length; i++) {
    if (app[i] === '{') prof++;
    else if (app[i] === '}') { prof--; if (prof === 0) break; }
  }
  return app.slice(inicio, i + 1);
}

const corpo = [
  extrairFuncao('cp1160SomaDias'),
  extrairFuncao('cpDiaDaSemanaDoIso'),
  extrairFuncao('cpEhFimDeSemana'),
  extrairFuncao('cpEmpurraPraDiaUtil')
].join('\n');

const sandbox = new Function(`${corpo}\nreturn { cpEhFimDeSemana, cpEmpurraPraDiaUtil };`)();
const { cpEhFimDeSemana, cpEmpurraPraDiaUtil } = sandbox;

// 07/08/2026 é sexta; 08/08 sábado; 09/08 domingo; 10/08 segunda (confere com o print do dono:
// "sex, 09/08" no texto antigo era o bug — 09/08/2026 é domingo de verdade).
assert.equal(cpEhFimDeSemana('2026-08-08'), true, '08/08/2026 é sábado');
assert.equal(cpEhFimDeSemana('2026-08-09'), true, '09/08/2026 é domingo — exatamente a data do print do dono');
assert.equal(cpEhFimDeSemana('2026-08-07'), false, '07/08/2026 é sexta');
assert.equal(cpEhFimDeSemana('2026-08-10'), false, '10/08/2026 é segunda');

assert.equal(cpEmpurraPraDiaUtil('2026-08-08'), '2026-08-10', 'sábado precisa virar a segunda seguinte (+2)');
assert.equal(cpEmpurraPraDiaUtil('2026-08-09'), '2026-08-10', 'domingo precisa virar a segunda seguinte (+1) — o caso exato do print');
assert.equal(cpEmpurraPraDiaUtil('2026-08-07'), '2026-08-07', 'dia útil não pode mudar');
assert.equal(cpEmpurraPraDiaUtil('2026-08-10'), '2026-08-10', 'segunda não pode mudar');

// ---------------------------------------------------------------------------
// A sugestão automática (cp1160PromessaDoCliente) precisa usar o empurrão, não a soma bruta.
// ---------------------------------------------------------------------------
const promessa = extrairFuncao('cp1160PromessaDoCliente');
assert.match(promessa, /cpEmpurraPraDiaUtil\(retornoBruto\)/,
  'a data que a IA propõe automaticamente precisa passar pelo empurrão de fim de semana');
assert.match(promessa, /adiadoDoFimDeSemana/,
  'a promessa precisa carregar se foi adiada, pra o banner poder explicar o motivo ao corretor');

// O texto do banner do lead precisa explicar quando empurrou — senão parece que o app "errou a
// conta" ao pular um dia sem motivo aparente.
const banner = extrairFuncao('cp1160BannerLeadHTML');
assert.match(banner, /fim de semana/i, 'o banner precisa avisar quando a data foi adiada do fim de semana');

// ---------------------------------------------------------------------------
// Os botões de agendamento MANUAL (+7 dias, "Amanhã" etc.) não podem ser tocados por esta regra
// — é a agenda do próprio corretor, e tem quem atenda sábado de propósito (plantão de vendas).
// ---------------------------------------------------------------------------
const reagendarDias = extrairFuncao('reagendarDias');
assert.ok(!/cpEmpurraPraDiaUtil|cpEhFimDeSemana/.test(reagendarDias),
  'reagendarDias é escolha manual do corretor — a regra de fim de semana não pode entrar aqui');

console.log('v1167-nunca-sugere-fim-de-semana: ok');
