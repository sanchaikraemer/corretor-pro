import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../api/reanalisar-lead.js', import.meta.url), 'utf8');

// v888 — "cliquei sem querer em Marcar atendimento": agora dá pra desmarcar.

// 1. API: ação desmarcar-atendido remove só os "botao_atendido" do DIA (não outros dias/tipos).
const bloco = api.slice(api.indexOf('body?.action === "desmarcar-atendido"'), api.indexOf('reagendar-lembrete'));
assert.ok(bloco.length > 0, 'a ação desmarcar-atendido precisa existir na API');
// v893: remove TODO contato_manual de hoje (não só o do botão), senão "Atendido hoje" não sai.
assert.match(bloco, /e\?\.evento !== "contato_manual" \|\| !e\?\.quando/, 'considera todos os contato_manual do dia');
assert.match(bloco, /agoraBR\(d\)\.dataBR !== br\.dataBR/, 'remove apenas os do dia de hoje');
assert.match(bloco, /removido: true/, 'confirma a remoção');

// 2. Front (v894): desmarcar é o interruptor do ícone "Atendido" (toca de novo = desmarca).
assert.match(app, /\$\{attended\?`<button type="button" class="cp704-ico done" onclick="ui667DesmarcarAtendido\(this\)"/,
  'quando atendido, o ícone "Atendido" chama ui667DesmarcarAtendido (interruptor)');

// 3. Front: ui667DesmarcarAtendido chama a API e limpa o atendimento local.
assert.match(app, /window\.ui667DesmarcarAtendido=async function\(btn\)/, 'handler de desmarcar precisa existir');
assert.match(app, /action:"desmarcar-atendido"/, 'deve chamar a ação certa na API');
assert.match(app, /function ui667RemoverAtendidoLocal\(lead\)/, 'deve limpar o atendimento local');
assert.match(app, /if\(e\?\.evento!=='contato_manual'\|\|!e\?\.quando\) return true/, 'remoção local considera todo contato_manual do dia');

console.log('v888-desmarcar-atendimento: ok');
