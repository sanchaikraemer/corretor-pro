import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1174 — REGRESSÃO DO "CHEGA EM 92% E TRAVA" (prints do dono em 06/08/2026).
//
// Eram três defeitos empilhados, e este arquivo guarda os três:
//
// 1. O contador de análises do dia era somado ANTES da chamada à IA e nunca era devolvido quando
//    a análise falhava. Como o app repete a etapa sozinho, UMA importação que falhava queimava
//    várias unidades do teto sem entregar nada — foi assim que a conta original travou em "limite
//    de 50 análises atingido" num dia em que a OpenAI acusava 114 chamadas no MÊS INTEIRO.
// 2. Bater no teto era tratado como falha passageira: o app repetia a chamada, esperava a mesma
//    recusa de novo e só então mostrava o aviso — o dobro do tempo de tela parada.
// 3. E, o congelamento em si: quando a análise falhava, a tela cheia da importação NÃO era
//    fechada (só renderEtapas a fecha, e o ramo de erro não passa por lá). Ela ficava de pé, no
//    teto do anel daquela etapa — 92% —, escondendo o erro e os botões que já estavam prontos
//    atrás dela, até o vigia de inatividade derrubar tudo até 2 minutos depois.

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const rotaImport = fs.readFileSync(new URL('../api/processar-storage.js', import.meta.url), 'utf8');

// ─── 1. A reserva volta quando não sai análise ────────────────────────────────

assert.match(pipeline, /export async function devolverReservaAnalise\(/,
  'precisa existir a função que devolve a unidade reservada');

// verificarLimiteAnalises precisa dizer se REALMENTE somou — devolver sem ter somado (conta sem
// Supabase, fail-open) faria a contagem ficar negativa/errada.
assert.match(pipeline, /reservou: rpc\.permitido === true/,
  'o caminho atômico precisa informar se reservou de fato');
assert.match(pipeline, /const aberto = \{ permitido: true, reservou: false/,
  'o caminho fail-open (sem Supabase) nunca reservou nada');

// Os dois pontos de saída sem análise entregável devolvem a reserva.
const trechoTrio = pipeline.slice(pipeline.indexOf('const trioOk = validacaoMensagens.ok;'));
assert.match(trechoTrio.slice(0, 400), /if \(!trioOk\) await devolverReservaSeAberta\(\);/,
  'sem as três mensagens a análise é descartada pelo app — não pode gastar unidade do teto');
const trechoCatch = pipeline.slice(pipeline.indexOf('const detail = describeOpenAIError(error);'));
assert.match(trechoCatch.slice(0, 500), /await devolverReservaSeAberta\(\);/,
  'timeout/erro da OpenAI também precisa devolver a reserva');

// A devolução nunca pode deixar contagem negativa.
const migracao = fs.readFileSync(new URL('../supabase/migrations/0016_devolver_reserva_analise.sql', import.meta.url), 'utf8');
assert.match(migracao, /greatest\(0,/, 'a devolução no banco não pode deixar a contagem negativa');
assert.match(migracao, /pg_advisory_xact_lock/, 'precisa da mesma trava por empresa que a reserva usa');

// ─── 2. Teto atingido não é falha passageira: ninguém repete ──────────────────

assert.match(rotaImport, /limiteAtingido: true/,
  'a rota precisa marcar a recusa por teto do dia como tal');
assert.match(rotaImport, /mode === "limite_diario_excedido"[\s\S]{0,400}recoverable: false/,
  'recusa por teto do dia precisa vir como NÃO recuperável');
assert.match(app, /erro\.limiteAtingido = data\.limiteAtingido === true/,
  'o app precisa reconhecer a marca vinda do servidor');
assert.match(app, /if\(error\?\.limiteAtingido\) break;/,
  'com o teto atingido, o app para na primeira resposta em vez de repetir');

// ─── 3. A tela cheia sai da frente quando a análise falha ─────────────────────

const ramoErro = app.slice(app.indexOf('}catch(err){\n    // v1174 — A TELA CHEIA FICAVA POR CIMA DO ERRO'));
assert.ok(ramoErro.length > 0, 'o ramo de erro da importação precisa existir com o conserto anotado');
assert.match(ramoErro.slice(0, 1200), /cpImportOverlayVisivel\(false\)/,
  'a tela cheia precisa ser fechada ANTES de desenhar o erro, senão ela cobre a explicação');
const posFechar = ramoErro.indexOf('cpImportOverlayVisivel(false)');
const posTexto = ramoErro.indexOf('#processingText');
assert.ok(posFechar < posTexto, 'fechar a tela cheia vem antes de escrever o erro embaixo dela');

// ─── 4. Etapa longa mostra prova de vida (o 92% parado) ───────────────────────

assert.match(app, /function cpioIniciarRelogioEtapa\(/, 'precisa existir o relógio da etapa longa');
assert.match(app, /const CPIO_RELOGIO_ETAPAS = \[3, 4\];/,
  'as duas etapas demoradas são ouvir os áudios (3) e analisar (4)');
assert.match(app, /if\(CPIO_RELOGIO_ETAPAS\.includes\(idx\)\) cpioIniciarRelogioEtapa\(textoDetalhe\);/,
  'o relógio precisa começar junto com a etapa');
assert.match(app, /seg >= 5 \? `\$\{_cpioRelogioBase\} · \$\{seg\}s` : _cpioRelogioBase/,
  'os segundos aparecem no detalhe da etapa (só depois de 5s, pra não virar ruído)');
assert.match(app, /if\(seg <= CPIO_RELOGIO_LIMITE_S\) cpioRearmarVigia\(\);/,
  'enquanto a etapa está viva o vigia é rearmado — mas com um teto, pra ninguém ficar preso');

// O relógio não pode sobreviver à troca de etapa (senão reescreve o detalhe da etapa nova).
const trechoAtualizar = app.slice(app.indexOf('function cpImportOverlayAtualizar(idx, sub){'));
assert.match(trechoAtualizar.slice(0, 300), /cpioPararRelogioEtapa\(\);/,
  'trocar de etapa precisa parar o relógio da anterior');

// ─── 5. O dono consegue ver e destravar o contador pelo painel ────────────────

const admin = fs.readFileSync(new URL('../api/admin-contas.js', import.meta.url), 'utf8');
const painel = fs.readFileSync(new URL('../admin-plataforma.html', import.meta.url), 'utf8');
assert.match(admin, /relatorio.*=== "limites"/, 'o painel precisa poder consultar o consumo do dia');
assert.match(admin, /action === "zerar-limite-analises"/, 'e poder zerar a contagem de uma conta');
assert.match(painel, /zerarLimiteAnalises\(/, 'o botão de zerar precisa existir na tela do painel');
assert.match(painel, /celulaLimiteAnalises\(/, 'o painel mostra quantas análises a conta usou hoje');

console.log('v1174-tentativa-falha-nao-gasta-analise: ok');
