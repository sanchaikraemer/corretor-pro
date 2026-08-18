import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1071 — a RÉGUA de "quem falta atender": nunca atendido, ou sem atendimento há N dias ou mais.
//
// v1246 — o quadradinho "Sem atender 30d+" da Home foi APAGADO a pedido do dono ("nao sera mais
// necessario"), e com ele o contador cpContarSemAtender. A régua em si (cpSemAtenderHaDias) foi
// MANTIDA na época, com a justificativa escrita no código de que "a fila Fazer agora usa ela".
//
// v1293 — ESSA JUSTIFICATIVA ERA FALSA, e a revisão de 18/08/2026 provou lendo a fila inteira:
// cpFilaFazerAgora decide por cpCadenciaSemResposta, ultimoAtendimentoTs e emJanelaDeEspera —
// cpSemAtenderHaDias não era chamada por NINGUÉM no app, só por três testes (este entre eles).
// Uma régua que nenhuma tela consulta não protege nada: protege a impressão de que protege.
// O dono mandou tirar o que não é usado, então ela saiu.
//
// O que este arquivo guarda agora: que ela não volte pela porta dos fundos. Se um dia a conta de
// "sem atender há N dias" for necessária de novo, ela nasce JUNTO com a tela ou a fila que a usa —
// e este teste volta a medir comportamento, não presença.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

assert.ok(!/function cpSemAtenderHaDias\b/.test(app),
  'cpSemAtenderHaDias voltou ao app.js. Se voltou porque alguma tela ou fila passou a usá-la, ' +
  'ótimo — mas então este teste precisa voltar a testar o COMPORTAMENTO dela, não só a ausência.');
assert.ok(!/window\.cpSemAtenderHaDias/.test(app),
  'a ponte pro console também não pode voltar sozinha, sem alguém chamando');

// E o que ficou no lugar dela continua de pé: quem diz "quando foi o último contato REAL do
// corretor" é cpUltimoContatoCorretorTs, essa sim usada pelas colunas das listas (v1098).
assert.match(app, /function cpUltimoContatoCorretorTs\(l\)\{/,
  'a régua do último contato real do corretor continua — é ela que alimenta as listas');

console.log('v1071-contador-sem-atender-30-dias: ok (régua removida na v1293, guarda ativa)');
