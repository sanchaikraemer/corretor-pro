import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1131 — o dono criou uma conta de teste do zero (pra conferir o cadastro depois da v1129),
// importou uma conversa de 8,2 MB e recebeu, no fim de tudo: **"Não foi possível analisar."**
// Recebendo ✓, Enviando ✓, Extraindo ✓, Transcrevendo ✓ — e morria em "Analisando".
//
// CAUSA: conta recém-criada não tem a Inteligência Comercial (o Cérebro) configurada. O servidor
// devolve a análise com `sugestoesPendentes: true` e o motivo escrito em `validacaoSugestoes`
// ("Cérebro Comercial sem instruções carregadas."). O app olhava só o `sugestoesPendentes`, jogava
// a análise INTEIRA fora e escrevia uma frase genérica — o motivo, que o servidor tinha mandado
// junto, nunca chegava na tela. Ou seja: TODO cliente novo batia nisso na primeira coisa que tenta
// fazer no app, sem nenhuma pista de que bastava configurar o Cérebro uma vez.
//
// Isso também contrariava a regra registrada em CLAUDE.md desde a v827-12: "A análise de uma
// conversa NUNCA pode ser descartada inteira só porque as 3 sugestões de mensagem não passaram nas
// regras do Cérebro."

// v1195 — o processamento da conversa importada saiu do app.js para o pedaço js/importacao.js,
// baixado só na hora em que o corretor importa. Este teste confere esse código como texto, então
// lê os dois arquivos juntos: os asserts abaixo valem exatamente sobre o mesmo código de antes.
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8')
  + '\n' + fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');

// 1. O tradutor de motivo existe e cobre os três casos que o servidor sabe informar.
const fnSrc = app.match(/function cpMotivoAnalisePendente\(analysis\)\{[\s\S]*?\n\}/);
assert.ok(fnSrc, 'cpMotivoAnalisePendente não encontrada em app.js');
const motivo = new Function(`${fnSrc[0]}; return cpMotivoAnalisePendente;`)();

const semCerebro = motivo({ validacaoSugestoes: ['Cérebro Comercial sem instruções carregadas.'] });
assert.match(semCerebro, /Intelig[êe]ncia Comercial/i,
  'o motivo precisa dizer, em português, que falta configurar a Inteligência Comercial');
assert.doesNotMatch(semCerebro, /Cérebro Comercial sem instruções carregadas/,
  'não pode ser a frase crua do servidor — quem lê é corretor, não programador');
assert.match(semCerebro, /n[ãa]o precisa exportar outra|j[áa] est[áa] guardada/i,
  'precisa tranquilizar: a conversa importada não se perde, não é preciso exportar de novo');

const limite = motivo({ validacaoSugestoes: ['Limite diário de 5 análises atingido.'] });
assert.match(limite, /Limite diário de 5/, 'no caso do limite, o número real precisa aparecer');
assert.match(limite, /amanh[ãa]/i, 'e precisa dizer quando volta a funcionar');

const semIA = motivo({ validacaoSugestoes: ['OpenAI não configurada'] });
assert.match(semIA, /n[ãa]o [ée] configura[çc][ãa]o da sua conta|servidor/i,
  'falta de chave da OpenAI é problema do sistema — não pode parecer culpa do corretor');

assert.ok(motivo({}).length > 0, 'sem motivo nenhum vindo do servidor, ainda precisa sair uma frase');

// 2. A tela oferece o caminho que resolve — botão que leva pra Inteligência Comercial.
const acaoSrc = app.match(/function cpAcaoAnalisePendente\(analysis\)\{[\s\S]*?\n\}/);
assert.ok(acaoSrc, 'cpAcaoAnalisePendente não encontrada');
const acao = new Function(`${acaoSrc[0]}; return cpAcaoAnalisePendente;`)();
const acaoCerebro = acao({ validacaoSugestoes: ['Cérebro Comercial sem instruções carregadas.'] });
assert.equal(acaoCerebro?.alvo, 'cerebro', 'o botão precisa levar pra tela da Inteligência Comercial');
assert.match(acaoCerebro?.rotulo || '', /Configurar/i, 'e dizer que é pra configurar');
assert.equal(acao({ validacaoSugestoes: ['Limite diário de 5 análises atingido.'] }), null,
  'no caso do limite não existe botão que resolva — não inventar um que não leva a lugar nenhum');

// 3. O motivo precisa CHEGAR na tela: o erro carrega a análise, e o tratamento usa isso.
assert.match(app, /erro\.analisePendente = result/,
  'o erro precisa carregar a análise recebida, senão o motivo se perde no caminho');
assert.match(app, /const pendente = err\?\.analisePendente\?\.analysis \|\| null/,
  'o tratamento da falha precisa ler a análise que veio junto do erro');
assert.match(app, /pendente\s*\n?\s*\?\s*"Falta um passo/,
  'com motivo conhecido, o título não pode ser mais "Não foi possível analisar"');
assert.match(app, /btnIrConfigurarCerebro/, 'o botão de configurar precisa existir no aviso');

// 4. A importação NÃO pode ser descartada nesse caminho — ele precisa poder voltar e reanalisar
//    sem exportar a conversa de novo (é a regra registrada em CLAUDE.md desde a v827-12).
const trechoAviso = app.slice(app.indexOf('const pendente = err?.analisePendente'), app.indexOf('toast(ehTimeout'));
assert.match(trechoAviso, /btnRetomarAnalise/,
  'mesmo no caso explicado, "Tentar analisar novamente" precisa continuar disponível');
assert.doesNotMatch(trechoAviso, /finalizarImportacaoStorage\(stored\)[\s\S]{0,80}btnIrConfigurarCerebro/,
  'ir configurar o Cérebro não pode apagar a importação que já está guardada');

console.log('v1131-conta-nova-sem-cerebro-explica-o-que-fazer: ok');
