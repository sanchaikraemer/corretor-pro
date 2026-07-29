import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1074 — duas remoções pedidas pelo dono:
// 1. FOTO de avatar salva (colada de print em versões antigas): o fluxo de EDITAR já tinha saído
//    na v1073; agora sai também a exibição e todo o suporte no servidor (aceitar no criar/editar,
//    preservar em reimportação, herdar na deduplicação da listagem). O dono autorizou perder as
//    fotos já gravadas ("pode deletar fotos salvas até pq não aparecem"). O avatar por INICIAIS
//    continua — é o que aparece nas listas hoje.
// 2. Porta "Condução" nos menus (item da gaveta lateral e card da tela Mais): era a mesma coisa
//    que o painel da Home ("Condução da carteira" → "Abrir Condução"), que continua sendo a
//    porta oficial da tela.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const leadUpdate = fs.readFileSync(new URL('../api/lead-update.js', import.meta.url), 'utf8');
const persistence = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');
const pipelineApi = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// ===== 1. Foto de avatar: nenhum resquício em front, CSS ou servidor. =====
for (const [nome, src] of [
  ['app.js', app], ['index.html', html], ['styles.css', css],
  ['api/lead-update.js', leadUpdate], ['api/_persistence.js', persistence], ['api/_pipeline.js', pipelineApi],
]) {
  assert.ok(!src.includes('avatarFoto'), `${nome} não pode mais citar o campo da foto de avatar`);
  assert.ok(!src.includes('has-foto'), `${nome} não pode mais ter a classe/estilo da foto no avatar`);
}
// O avatar por iniciais continua vivo e sem parâmetro de foto.
assert.match(app, /function avatarInicial\(name, pctClass\)\{/, 'avatarInicial fica, sem parâmetro de foto');
assert.match(app, /function avatarLead\(l, pctClass\)\{ return avatarInicial\(l\?\.name, pctClass\); \}/,
  'avatarLead agora só desenha as iniciais');
assert.match(css, /\.lead-avatar\{/, 'o círculo de iniciais continua estilizado');
// O servidor valida a edição sem oferecer "foto" como opção.
assert.match(leadUpdate, /Informe nome, telefone ou produto pra editar\./,
  'a mensagem de validação do editar não fala mais em foto');

// ===== 2. Menus sem "Condução": as duas portas saíram; a da Home continua. =====
assert.ok(!html.includes('data-target="pipeline"'),
  'nenhum item de menu (gaveta lateral ou tela Mais) pode abrir a Condução');
assert.ok(!html.includes('Condução do atendimento'), 'o card "Condução do atendimento" saiu da tela Mais');
assert.match(html, /Abrir Condução/, 'a porta da Home ("Abrir Condução") continua');
assert.match(html, /<section id="pipeline" class="screen">/, 'a tela Condução em si continua existindo');
assert.ok(!app.includes('destacarMenuPipeline'), 'o destaque da porta de menu saiu junto com a porta');
assert.match(app, /function setPipelineTab\(/, 'as abas internas da tela Condução continuam');

console.log('v1074-sem-foto-avatar-e-sem-conducao-no-menu: ok');
