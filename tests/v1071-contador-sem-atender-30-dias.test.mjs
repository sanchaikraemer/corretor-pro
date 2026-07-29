import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1071 — pedido do dono: um contador de quem falta atender, com prazo FIXO de 30 dias — não o
// "descanso" configurável do Cérebro (que é outra régua, usada só pra decidir quando um lead JÁ
// atendido volta a ser candidato em "Fazer agora"). Aqui é uma leitura direta e simples: nunca
// atendido, ou sem atendimento há 30 dias ou mais.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const f1 = app.match(/function cpSemAtenderHaDias\(l, dias\)\{[\s\S]*?\n\}/)[0];
const f2 = app.match(/function cpContarSemAtender\(items, dias\)\{[\s\S]*?\n\}/)[0];
assert.ok(f1 && f2, 'cpSemAtenderHaDias/cpContarSemAtender não encontradas em app.js');

const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();

function montar(ultimoAtendimentoIso) {
  const sandbox = new Function('ultimoAtendimentoTs', 'diasCalendarioBR', 'leadEhAtivo', `
    ${f1}
    ${f2}
    return { cpSemAtenderHaDias, cpContarSemAtender };
  `);
  const ts = ultimoAtendimentoIso ? Date.parse(ultimoAtendimentoIso) : 0;
  const ultimoAtendimentoTs = () => ts;
  const diasCalendarioBR = (t) => t ? Math.floor((Date.now() - t) / 86400000) : null;
  const leadEhAtivo = () => true;
  return sandbox(ultimoAtendimentoTs, diasCalendarioBR, leadEhAtivo);
}

// Nunca atendido → sempre conta como "falta atender", não importa o prazo.
assert.equal(montar(null).cpSemAtenderHaDias({}, 30), true, 'nunca atendido conta como falta atender');

// Atendido há 10 dias, prazo de 30 → ainda não conta.
assert.equal(montar(diasAtras(10)).cpSemAtenderHaDias({}, 30), false, 'atendido há 10 dias não conta pro prazo de 30');

// Atendido há exatamente 30 dias → já conta (>=, não só >).
assert.equal(montar(diasAtras(30)).cpSemAtenderHaDias({}, 30), true, 'atendido há exatamente 30 dias já conta');

// Atendido há 45 dias → conta.
assert.equal(montar(diasAtras(45)).cpSemAtenderHaDias({}, 30), true, 'atendido há 45 dias conta como falta atender');

// cpContarSemAtender soma corretamente sobre uma lista de leads ativos.
const { cpContarSemAtender } = new Function('ultimoAtendimentoTs', 'diasCalendarioBR', 'leadEhAtivo', `
  ${f1}
  ${f2}
  return { cpContarSemAtender };
`)(
  (l) => l.__at || 0,
  (t) => t ? Math.floor((Date.now() - t) / 86400000) : null,
  () => true
);
const itens = [
  { id: 'a', __at: 0 },                          // nunca atendido → conta
  { id: 'b', __at: Date.parse(diasAtras(10)) },   // dentro do prazo → não conta
  { id: 'c', __at: Date.parse(diasAtras(40)) },   // fora do prazo → conta
];
assert.equal(cpContarSemAtender(itens, 30), 2, 'conta exatamente os leads nunca atendidos ou fora do prazo de 30 dias');

// A tela Home (renderResumoDia) precisa usar esse contador com o prazo fixo de 30.
assert.match(app, /cpContarSemAtender\(ativos, 30\)/, 'renderResumoDia precisa chamar cpContarSemAtender(ativos, 30)');
assert.match(app, /<span>Sem atender 30d\+<\/span>/, 'a Home precisa mostrar o tile "Sem atender 30d+"');

console.log('v1071-contador-sem-atender-30-dias: ok');
