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

// 1. Tenta de novo antes de desistir (não é mais uma tentativa só).
// v1142 — as duas tentativas escritas na mão viraram um laço de 3 (mesma teimosia do botão
// "Marcar atendimento"), com 30s de prazo em vez de 15s. A intenção deste teste continua: nunca
// desistir na primeira instabilidade de rede.
assert.match(bloco, /tentativa<=3 && !atendimentoConfirmado/, 'precisa tentar registrar o atendimento 3 vezes antes de desistir');
assert.match(bloco, /\}, 30000\);/, 'e esperar 30s por tentativa (era 15s, curto demais pra rede engasgada)');

// 2. Se mesmo assim falhar, avisa o corretor (não engole o erro em silêncio).
assert.match(bloco, /toast\(["'`]Mensagem copiada, mas NÃO consegui registrar o atendimento/,
  'precisa avisar o corretor se não conseguir registrar o atendimento, em vez de ficar quieto');

// 3. O aviso só dispara quando as tentativas falharam (não sempre) — e nesse caso a marca local
// é DESFEITA, pra tela não mostrar "Atendido" sem estar gravado (v1142).
const idxToast = bloco.search(/toast\(["'`]Mensagem copiada, mas/);
const antesDoToast = bloco.slice(0, idxToast);
assert.match(antesDoToast, /if\(atendimentoConfirmado\)\{[\s\S]*\}else\{/, 'o aviso está no caminho de falha, não dispara sempre');
assert.match(antesDoToast.slice(antesDoToast.lastIndexOf('}else{')), /evs\.filter\(e => !\(e\?\.quando === quando/, 'a falha desfaz a marca local desta cópia');

console.log('v1020-registrar-atendimento-da-copia-tenta-de-novo: ok');
