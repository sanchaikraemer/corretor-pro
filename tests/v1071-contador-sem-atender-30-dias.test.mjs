import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1071 — a RÉGUA de "quem falta atender": nunca atendido, ou sem atendimento há N dias ou mais.
// Não é o "descanso" configurável do Cérebro (essa é outra, usada pra decidir quando um lead JÁ
// atendido volta a ser candidato em "Fazer agora").
//
// v1246 — o quadradinho "Sem atender 30d+" da Home foi APAGADO a pedido do dono ("nao sera mais
// necessario"), e com ele o contador cpContarSemAtender, que não tinha mais quem chamasse. A régua
// em si CONTINUA de pé e continua testada aqui, porque quem usa ela é a fila "Fazer agora" — se ela
// quebrar, quebra a ordem dos leads do dia, que é o coração do app.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const f1 = app.match(/function cpSemAtenderHaDias\(l, dias\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(f1, 'cpSemAtenderHaDias não encontrada em app.js');

const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();

// v1102 — a régua passou a ser o ÚLTIMO CONTATO REAL do corretor: atendimento marcado OU a
// última mensagem que ELE mandou na conversa (caso Jamil: atendido pelo WhatsApp inteiro, mas
// nunca "marcado" — aparecia como "nunca atendido"). O sandbox injeta a régua nova.
function montar(ultimoContatoIso) {
  const sandbox = new Function('cpUltimoContatoCorretorTs', 'diasCalendarioBR', 'leadEhAtivo', `
    ${f1}
    return { cpSemAtenderHaDias };
  `);
  const ts = ultimoContatoIso ? Date.parse(ultimoContatoIso) : 0;
  const cpUltimoContatoCorretorTs = () => ts;
  const diasCalendarioBR = (t) => t ? Math.floor((Date.now() - t) / 86400000) : null;
  const leadEhAtivo = () => true;
  return sandbox(cpUltimoContatoCorretorTs, diasCalendarioBR, leadEhAtivo);
}

// Nunca atendido → sempre conta como "falta atender", não importa o prazo.
assert.equal(montar(null).cpSemAtenderHaDias({}, 30), true, 'nunca atendido conta como falta atender');

// Atendido há 10 dias, prazo de 30 → ainda não conta.
assert.equal(montar(diasAtras(10)).cpSemAtenderHaDias({}, 30), false, 'atendido há 10 dias não conta pro prazo de 30');

// Atendido há exatamente 30 dias → já conta (>=, não só >).
assert.equal(montar(diasAtras(30)).cpSemAtenderHaDias({}, 30), true, 'atendido há exatamente 30 dias já conta');

// Atendido há 45 dias → conta.
assert.equal(montar(diasAtras(45)).cpSemAtenderHaDias({}, 30), true, 'atendido há 45 dias conta como falta atender');

// v1246 — o que foi embora precisa ficar embora: contador e tela não existem mais.
assert.ok(!app.includes('cpContarSemAtender'), 'o contador não tinha mais quem o chamasse e foi embora');
assert.ok(!app.includes('<span>Sem atender 30d+</span>'), 'o quadradinho da Home foi apagado e não pode voltar');

console.log('v1071-contador-sem-atender-30-dias: ok');
