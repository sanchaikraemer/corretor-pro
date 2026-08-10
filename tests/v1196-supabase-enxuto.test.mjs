import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1196 — GUARDA DA BIBLIOTECA DO SUPABASE ENXUTA.
//
// A biblioteca que vai pro navegador deixou de ser o pacote pronto (200 KB) e passa a ser montada
// no build a partir da MESMA biblioteca oficial, trocando por peças vazias três módulos que este
// app nunca usa: tempo real (websocket), Storage no navegador e Edge Functions.
//
// O risco desta troca é um só, e é o que este teste vigia: alguém começar a usar, no navegador,
// alguma coisa desses três módulos. Nesse dia a peça vazia lança um erro — e o teste abaixo
// quebra ANTES, dizendo exatamente onde e o que fazer.
//
// (O servidor, em `api/`, continua usando a biblioteca COMPLETA. Nada aqui muda esse lado: é lá
// que o Storage é usado de verdade, pra guardar o ZIP da conversa.)

const raiz = new URL('../', import.meta.url);
const ler = (arq) => { try { return fs.readFileSync(new URL(arq, raiz), 'utf8'); } catch { return ''; } };

// ── 1. o navegador não pode usar o que foi trocado por peça vazia ───────────────────────────
const arquivosDoNavegador = [
  'app.js', 'index.html', 'entrar.html', 'cadastro.html', 'admin-plataforma.html',
  'recuperar-senha.html', 'redefinir-senha.html', 'privacidade.html', 'termos.html',
  'share.html', 'contas-config.js',
  ...fs.readdirSync(new URL('js/', raiz)).filter(f => f.endsWith('.js')).map(f => 'js/' + f)
];

const PROIBIDOS = [
  { padrao: /\.channel\s*\(/, nome: 'tempo real (.channel)', arquivo: 'vendor-enxuto/sem-tempo-real.js' },
  { padrao: /\.removeChannel\s*\(|\.removeAllChannels\s*\(|\.getChannels\s*\(/, nome: 'tempo real (canais)', arquivo: 'vendor-enxuto/sem-tempo-real.js' },
  { padrao: /\.storage\s*\.\s*from\s*\(|\.storage\s*\.\s*listBuckets\s*\(/, nome: 'Storage no navegador', arquivo: 'vendor-enxuto/sem-storage.js' },
  { padrao: /\.functions\s*\.\s*invoke\s*\(/, nome: 'Edge Functions', arquivo: 'vendor-enxuto/sem-functions.js' },
];

const achados = [];
for (const arq of arquivosDoNavegador) {
  // comentário não conta: o projeto documenta muito, e citar o nome numa explicação não é uso.
  const src = ler(arq).split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  if (!src) continue;
  for (const p of PROIBIDOS) if (p.padrao.test(src)) achados.push(`${arq}: usa ${p.nome}`);
}
assert.deepEqual(achados, [],
  'Estes usos não funcionam com a biblioteca enxuta que o build publica — a peça correspondente é ' +
  'vazia e lança erro em produção. Ou troque a abordagem, ou devolva o módulo original removendo o ' +
  '`alias` correspondente em build.js:\n  - ' + achados.join('\n  - '));

// ── 2. o build precisa continuar montando a versão enxuta, com rede de segurança ────────────
const build = ler('build.js');
assert.match(build, /alias:\s*\{/, 'build.js precisa continuar trocando os módulos não usados do Supabase');
for (const mod of ['@supabase/realtime-js', '@supabase/storage-js', '@supabase/functions-js']) {
  assert.ok(build.includes(mod), `build.js precisa trocar o módulo ${mod} pela peça vazia`);
}
assert.match(build, /globalName:\s*["']supabase["']/,
  'a montagem precisa continuar publicando o objeto global `supabase` — é assim que as telas ' +
  'chamam supabase.createClient(...)');
assert.match(build, /fs\.copyFileSync\(supabaseJsSrc, supabaseDest\)/,
  'precisa continuar existindo a volta atrás: se a montagem falhar, publica o pacote completo. ' +
  'Login não pode depender de a montagem dar certo.');
assert.match(build, /codigo\.length < 60000/,
  'a rede de segurança que recusa uma montagem pequena demais precisa continuar');

// ── 3. as peças vazias precisam existir e ser silenciosas onde a biblioteca depende delas ───
const semTempoReal = ler('vendor-enxuto/sem-tempo-real.js');
assert.ok(semTempoReal, 'vendor-enxuto/sem-tempo-real.js precisa existir');
// O SupabaseClient cria o cliente de tempo real no construtor e chama setAuth a cada troca de
// login. Se qualquer um dos dois lançar erro, NINGUÉM consegue entrar no app.
assert.match(semTempoReal, /class RealtimeClient/, 'a peça vazia precisa oferecer a classe RealtimeClient');
assert.match(semTempoReal, /setAuth\s*\([^)]*\)\s*\{[^}]*\}/, 'setAuth precisa existir e não lançar erro — ela roda a cada login/logout');
assert.doesNotMatch(semTempoReal.slice(semTempoReal.indexOf('setAuth'), semTempoReal.indexOf('setAuth') + 160), /throw/,
  'setAuth NÃO pode lançar erro: ela é chamada pelo próprio login. Se lançar, ninguém entra no app.');
assert.ok(ler('vendor-enxuto/sem-storage.js'), 'vendor-enxuto/sem-storage.js precisa existir');
assert.ok(ler('vendor-enxuto/sem-functions.js'), 'vendor-enxuto/sem-functions.js precisa existir');
assert.match(ler('vendor-enxuto/supabase-entrada.js'), /export \{ createClient \} from '@supabase\/supabase-js'/,
  'a porta de entrada precisa continuar sendo o createClient oficial — nada reescrito à mão');

// ── 4. o servidor continua com a biblioteca completa ────────────────────────────────────────
const persistencia = ler('api/_persistence.js');
assert.match(persistencia, /@supabase\/supabase-js/,
  'o servidor precisa continuar usando a biblioteca completa (é lá que o Storage é usado de verdade)');

console.log('v1196-supabase-enxuto: navegador não usa os módulos trocados, build monta a versão enxuta com volta atrás');
