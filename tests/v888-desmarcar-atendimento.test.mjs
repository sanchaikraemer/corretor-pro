import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../api/reanalisar-lead.js', import.meta.url), 'utf8');

// v888 — "cliquei sem querer em Marcar atendimento": agora dá pra desmarcar.

// 1. API: ação desmarcar-atendido remove só os "botao_atendido" do DIA (não outros dias/tipos).
const bloco = api.slice(api.indexOf('body?.action === "desmarcar-atendido"'), api.indexOf('reagendar-lembrete'));
assert.ok(bloco.length > 0, 'a ação desmarcar-atendido precisa existir na API');
assert.match(bloco, /e\?\.detalhes\?\.de !== "botao_atendido"/, 'só mexe nos eventos do botão de atendimento');
assert.match(bloco, /agoraBR\(d\)\.dataBR !== br\.dataBR/, 'remove apenas os do dia de hoje');
assert.match(bloco, /removido: true/, 'confirma a remoção');

// 2. Front: botão "Desmarcar" só aparece quando o lead está atendido hoje (link discreto).
assert.match(app, /\$\{attended\?`<button type="button" class="cp704-desmarcar" onclick="ui667DesmarcarAtendido\(this\)"/,
  'o botão Desmarcar deve aparecer só quando attended');

// 3. Front: ui667DesmarcarAtendido chama a API e limpa o atendimento local.
assert.match(app, /window\.ui667DesmarcarAtendido=async function\(btn\)/, 'handler de desmarcar precisa existir');
assert.match(app, /action:"desmarcar-atendido"/, 'deve chamar a ação certa na API');
assert.match(app, /function ui667RemoverAtendidoLocal\(lead\)/, 'deve limpar o atendimento local');
assert.match(app, /e\?\.detalhes\?\.de!=='botao_atendido'/, 'remoção local só mexe no atendimento do botão');

console.log('v888-desmarcar-atendimento: ok');
