import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1077 (pacote) — mais dois pedidos do dono:
// 1. VOLTAR pra uma lista aberta por card da Home precisa RECONSTRUIR a lista. As listas
//    "montadas na hora" (Fazer agora, Aguardando cliente, Carteira ativa, Sem atender 30d+,
//    Propostas) não vivem em state.gruposHome — o voltar do Android mostrava o nome cru
//    ("__fazeragora") com 0 leads (print do dono).
// 2. Enquanto baixa/analisa uma conversa importada, o card de instruções ("Importar conversa",
//    texto do passo a passo, "Arquivo selecionado", botões Nova análise/Diagnóstico) sai da
//    tela — fica só o andamento (print do dono).

// v1195 — o processamento da conversa importada saiu do app.js para o pedaço js/importacao.js,
// baixado só na hora em que o corretor importa. Este teste confere esse código como texto, então
// lê os dois arquivos juntos: os asserts abaixo valem exatamente sobre o mesmo código de antes.
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8')
  + '\n' + fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// ===== 1. Voltar reconstrói as listas especiais =====
const ini = app.indexOf('function cpReabrirGrupoEspecial(');
assert.ok(ini > -1, 'cpReabrirGrupoEspecial precisa existir');
const fn = app.slice(ini, ini + 900);
for (const [grupo, dono] of [
  ['__fazeragora', 'abrirFazerAgora'],
  ['__aguardando', 'abrirAguardandoCliente'],
  ['__carteiraAtiva', 'abrirCarteiraAtiva'],
  ['__propostas', 'cpAbrirHistoricoPropostas'],
]) {
  assert.match(fn, new RegExp(`"${grupo}": \\(\\) => ${dono}\\(\\)`),
    `a lista ${grupo} precisa saber se reconstruir via ${dono}`);
}
// Os dois caminhos de "voltar" usam a reconstrução antes do abrirGrupoHome cru.
assert.match(app, /if\(!cpReabrirGrupoEspecial\(r\.grupoAtivo\)\) abrirGrupoHome\(r\.grupoAtivo,\{fromHistory:true\}\)/,
  'o voltar do navegador (popstate) reconstrói a lista especial');
assert.match(app, /if\(!cpReabrirGrupoEspecial\(state\.grupoAtivo\)\) abrirGrupoHome\(state\.grupoAtivo,\{fromHistory:true\}\)/,
  'o voltar de dentro do lead reconstrói a lista especial');
// v1078 — o pintor do "carregando"/erro da Home não pode cobrir uma lista de grupo aberta
// (flagrado em verificação de navegador real: o voltar reconstruía a lista e o loader
// pintava por cima quando os dados ainda não estavam em memória).
assert.match(app, /if\(!state\.itemsAtivos\?\.length && !state\.grupoAtivo\)\{\s*\n\s*const focoSkel/,
  'o loader da Home respeita uma lista de grupo aberta');
assert.match(app, /if\(foco && !state\.itemsAtivos\?\.length && !state\.grupoAtivo\)/,
  'o erro de carga da Home respeita uma lista de grupo aberta');
// E se algum grupo desconhecido escapar, o título nunca mostra o nome interno cru.
assert.match(app, /String\(grupo\|\|"Leads"\)\.replace\(\/\^__\+\/, ""\)/,
  'o título de grupo sem meta não pode mostrar o prefixo interno "__"');

// ===== 2. Importação limpa durante o processamento =====
assert.match(app, /show\("zip"\);\s*\n\s*qs\("#importCard"\)\?\.classList\.add\("cp-import-rodando"\)/,
  'começar a processar liga o modo limpo do card de importação');
const liga = (app.match(/classList\.add\("cp-import-rodando"\)/g) || []).length;
const desliga = (app.match(/classList\.remove\("cp-import-rodando"\)/g) || []).length;
assert.equal(liga, 1, 'só o início do processamento liga o modo limpo');
assert.ok(desliga >= 3, 'o modo limpo desliga no fim (finally), no arquivo inválido e na Nova análise');
assert.match(css, /#importCard\.cp-import-rodando>\.label,\s*\n#importCard\.cp-import-rodando>\.small,\s*\n#importCard\.cp-import-rodando>#fileName,\s*\n#importCard\.cp-import-rodando>\.btns\{display:none!important\}/,
  'o CSS esconde título, instruções, arquivo selecionado e botões durante o processamento');

console.log('v1077-voltar-lista-e-import-limpo: ok');
