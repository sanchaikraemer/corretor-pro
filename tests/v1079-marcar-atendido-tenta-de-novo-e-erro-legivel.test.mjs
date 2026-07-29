import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1079 — o dono reportou que o botão "Marcar" (atendimento) mostrou erro técnico cru na tela
// ("signal is aborted without reason") e não marcou o atendimento — exatamente o mesmo cenário
// do v1034/v1036 (rede "pendurada" reconectando depois de voltar de outro app, ex.: WhatsApp),
// só que dessa vez em ui667MarcarAtendido, que ainda só tentava uma vez e jogava err.message cru
// no toast.

const ini = app.indexOf('window.ui667MarcarAtendido=async function(btn){');
assert.ok(ini > -1, 'ui667MarcarAtendido não encontrada em app.js');
const fim = app.indexOf('\nwindow.ui667DesmarcarAtendido', ini);
assert.ok(fim > ini, 'fim de ui667MarcarAtendido não encontrado');
const bloco = app.slice(ini, fim);

// 1. Tenta de novo antes de desistir — mesmo padrão do v1036 (3 tentativas, pausa entre elas).
assert.match(bloco, /const TENTATIVAS=3;/, 'precisa tentar marcar o atendimento 3 vezes antes de desistir');
assert.match(bloco, /for\(let tentativa=1;\s*tentativa<=TENTATIVAS\s*&&\s*!d;\s*tentativa\+\+\)/,
  'o laço de tentativas precisa ir até TENTATIVAS (3), parando cedo se já deu certo');
assert.match(bloco, /if\(tentativa<TENTATIVAS\)\{[\s\S]*?await new Promise\(r=>setTimeout\(r,\s*1500\)\)/,
  'precisa esperar um pouco entre as tentativas, não repetir instantaneamente');

// 2. Só desiste (lança erro) depois que TODAS as tentativas falharam.
assert.match(bloco, /if\(!d\) throw ultimoErro\|\|new Error\("Não foi possível marcar o atendimento\.\"\);/,
  'só pode mostrar erro depois que nenhuma das 3 tentativas deu certo');

// 3. O erro final mostrado ao corretor passa pela tradução amigável (não mais err.message cru).
assert.match(bloco, /toast\("Não consegui marcar: "\+userFriendlyError\(err\)\)/,
  'o erro final de marcar atendimento precisa usar userFriendlyError, não err.message cru');
assert.ok(!/toast\("Não consegui marcar: "\+\(err\?\.message\|\|err\)\)/.test(bloco),
  'não pode mais mostrar err.message cru ("signal is aborted...", "Failed to fetch") no toast');

console.log('v1079-marcar-atendido-tenta-de-novo-e-erro-legivel: ok');
