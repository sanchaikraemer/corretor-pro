import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1175 — REGRESSÃO: "por que apareceu isso após o carregamento?" (print do dono, 07/08/2026,
// já na versão 1174). Depois da importação inteira, a tela ficou em
// "Salvando — salvando no banco de dados... (94%)" com a rodinha girando e nada acontecendo.
//
// Não era travamento: a gravação FALHOU, o aviso saiu num toast (que some sozinho em segundos) e
// NINGUÉM mais mexeu na linha de andamento. Ela ficava congelada no último estado bom — rodinha
// girando, 94%, e os botões "Nova análise"/"Diagnóstico" ainda travados, porque quem os libera é
// justamente o desenho de etapas que nunca foi chamado de novo.
//
// É a mesma lição do 92% da v1174: todo caminho de erro precisa MEXER na tela que ficou pra trás.

// v1195 — o processamento da conversa importada saiu do app.js para o pedaço js/importacao.js,
// baixado só na hora em que o corretor importa. Este teste confere esse código como texto, então
// lê os dois arquivos juntos: os asserts abaixo valem exatamente sobre o mesmo código de antes.
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8')
  + '\n' + fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');

// A função que fecha o assunto na tela precisa existir e chamar a etapa 7 ("Falha recuperável"),
// que é o único ponto que para a rodinha, destrava os botões e fecha a tela cheia.
assert.match(app, /function cpImportacaoFalhouNaGravacao\(titulo, err\)\{/,
  'precisa existir o fim de linha honesto da gravação que falhou');
const fn = app.slice(app.indexOf('function cpImportacaoFalhouNaGravacao(titulo, err){'));
assert.match(fn.slice(0, 900), /renderEtapas\(7, motivo\)/,
  'a etapa 7 é o que para a rodinha e destrava os botões');
assert.match(fn.slice(0, 900), /pendingBox\.innerHTML =/,
  'o motivo precisa FICAR escrito na tela, não só passar num toast');
assert.match(fn.slice(0, 900), /não foi perdida/,
  'o corretor precisa saber que a análise continua ali pra tentar de novo');

// Os dois caminhos de gravação (salvar novo e atualizar existente) precisam usar isso.
const salvar = app.slice(app.indexOf('async function salvarLeadPendente(){'));
const fimSalvar = salvar.slice(0, salvar.indexOf('\n}\n'));
assert.match(fimSalvar, /cpImportacaoFalhouNaGravacao\("Não foi possível salvar", err\)|renderEtapas\(7,/,
  'o salvar precisa encerrar a linha de andamento quando falha');
assert.match(fimSalvar, /renderEtapas\(7, "a gravação não terminou a tempo"\)/,
  'inclusive no caso de queda de conexão, que tem recado próprio desde a v1096');

const atualizar = app.slice(0, app.indexOf('async function salvarLeadPendente(){'));
assert.match(atualizar, /cpImportacaoFalhouNaGravacao\("Não foi possível atualizar", err\)/,
  'o atualizar cliente existente precisa do mesmo encerramento');

// A rodinha só existe nas etapas em andamento: a etapa 7 não pode desenhá-la (senão o conserto
// não conserta nada — continuaria "girando" na cara do corretor).
assert.match(app, /idxAtual === 7 \? "" : '<span class="spinner"><\/span>'/,
  'a etapa de falha não desenha a rodinha');
// E ela destrava os botões da importação (setBotoesImportacao só trava de 0 a 5).
assert.match(app, /setBotoesImportacao\(idxAtual >= 0 && idxAtual <= 5\);/,
  'a etapa 7 precisa liberar "Nova análise" e "Diagnóstico"');

console.log('v1175-gravacao-que-falha-nao-deixa-tela-girando: ok');
