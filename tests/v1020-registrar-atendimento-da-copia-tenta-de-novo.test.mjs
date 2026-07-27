import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1020 — o dono confirmou que SEMPRE marca atendimento pelo Corretor Pro (copiando a sugestão,
// que já marca atendimento automaticamente) — não é um caso de "esqueceu de marcar no site".
// Investigando "assim como Adão, vários outros atendi e não marca corretamente as datas": a
// chamada que registra esse atendimento (registrarMensagemEnviada → POST /api/reanalisar-lead)
// era "melhor esforço" — se falhasse (timeout, instabilidade), o erro era engolido em silêncio.
// Como a tela já tinha mostrado "Mensagem copiada" e marcado atendido NA HORA (otimista, só na
// tela), o corretor nunca ficava sabendo que o atendimento não tinha sido gravado de verdade no
// banco — o lead voltava a aparecer depois como se nunca tivesse sido atendido.

const ini = app.indexOf('async function registrarMensagemEnviada(id, msg){');
assert.ok(ini > -1, 'registrarMensagemEnviada não encontrada em app.js');
const fim = app.indexOf('\n}', ini);
const bloco = app.slice(ini, fim);

// 1. Tenta de novo pelo menos uma vez antes de desistir (não é mais uma tentativa só).
const chamadas = bloco.match(/registrarAtendimentoDaCopia\(\)/g) || [];
assert.ok(chamadas.length >= 2, 'precisa tentar registrar o atendimento pelo menos DUAS vezes antes de desistir');

// 2. Se mesmo assim falhar, avisa o corretor (não engole o erro em silêncio).
assert.match(bloco, /toast\(["'`]Mensagem copiada, mas n[ãa]o consegui confirmar o atendimento/,
  'precisa avisar o corretor se não conseguir confirmar o atendimento, em vez de ficar quieto');

// 3. O aviso só dispara quando as duas tentativas falharam (não sempre).
const idxToast = bloco.search(/toast\(["'`]Mensagem copiada, mas/);
const idxIfsAntes = bloco.slice(0, idxToast).match(/if\(!resp/g) || [];
assert.ok(idxIfsAntes.length >= 1, 'o aviso precisa estar dentro de uma checagem de falha, não disparar sempre');

console.log('v1020-registrar-atendimento-da-copia-tenta-de-novo: ok');
