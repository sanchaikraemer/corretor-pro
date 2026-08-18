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
// v1293 — avatarInicial/avatarLead e o CSS .lead-avatar SAÍRAM. A v869 tirou o avatar da fila,
// a v1076 trocou os cartões da Home por linhas de tabela, e o único caminho que ainda desenhava
// esse círculo (o card do "top 3") já estava sem chamador. Ou seja: as funções continuavam no
// arquivo desenhando para ninguém. O avatar que APARECE hoje é o do Desempenho (cp-lead-avatar,
// com cpInitials/cpAvatarStyle), e é ele que este teste passa a proteger.
assert.ok(!/function avatarInicial\(/.test(app), 'avatarInicial saiu na v1293 (nenhuma tela a desenhava)');
assert.ok(!/function avatarLead\(/.test(app), 'avatarLead saiu na v1293 (era só o embrulho de avatarInicial)');
assert.ok(!/^\.lead-avatar\{/m.test(css), 'o CSS do círculo antigo saiu junto');
assert.match(css, /\.cp-lead-avatar\{/, 'o avatar que o Desempenho desenha de verdade continua estilizado');
assert.match(app, /cpInitials\(l\.name\)/, 'e continua sendo desenhado com as iniciais do cliente');
// O servidor valida a edição sem oferecer "foto" como opção.
assert.match(leadUpdate, /Informe nome, telefone ou produto pra editar\./,
  'a mensagem de validação do editar não fala mais em foto');

// ===== 2. Menus sem "Condução" (v1074) — e na v1075 a tela inteira saiu do sistema. =====
assert.ok(!html.includes('data-target="pipeline"'),
  'nenhum item de menu (gaveta lateral ou tela Mais) pode abrir a Condução');
assert.ok(!html.includes('Condução do atendimento'), 'o card "Condução do atendimento" saiu da tela Mais');
assert.ok(!app.includes('destacarMenuPipeline'), 'o destaque da porta de menu saiu junto com a porta');

console.log('v1074-sem-foto-avatar-e-sem-conducao-no-menu: ok');
