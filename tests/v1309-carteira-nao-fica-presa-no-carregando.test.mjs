import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1309 — CARTEIRA PRESA EM "CARREGANDO OS LEADS…" (prints do dono, 19/08/2026, 15:00).
//
// A tela ficava no aviso de carregamento pra sempre — com os números do topo JÁ preenchidos
// (128 arquivados, 10 na agenda, 3 no sino), ou seja: a carteira TINHA chegado do servidor. O que
// não acontecia era o desenho dela:
//
//   1. a importação termina abrindo o cliente sozinho → fica a marca "tem lead aberto";
//   2. a busca da carteira, com a memória vazia, escreve "Carregando os leads…" NA MESMA ÁREA
//      onde o cliente aberto mora (#leadFocoArea);
//   3. os dados chegam e as duas funções que desenhariam a carteira (renderListasHome e o modo de
//      segurança renderHomeFallbackSeguro) desistem na primeira linha por causa da marca de lead
//      aberto — proteção certa pra não apagar um cliente na cara do corretor, mas ali não havia
//      cliente nenhum na tela: havia o aviso de carregamento por cima dele.
//
// Resultado: nem carteira, nem cliente, e nenhum vigia dispara (a busca terminou BEM, então o
// relógio de espera foi desligado — por isso o print não tem nem os segundos nem os botões).

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// ── 1. A regra nova roda de verdade: esperar a carteira ≠ ter cliente aberto ──────────────────
{
  const fonte = app.match(/function homeEsperandoCarteira\(\)\{[\s\S]*?\n\}/);
  assert.ok(fonte, 'homeEsperandoCarteira não encontrada em app.js');
  const criar = (html) => {
    const area = {
      innerHTML: html,
      textContent: html.replace(/<[^>]*>/g, ' '),
      querySelector: (sel) => sel.split(',').some(c => html.includes(c.trim().replace('.', 'class="')) || html.includes(c.trim().slice(1))) ? {} : null
    };
    return new Function('qs', `${fonte[0]}; return homeEsperandoCarteira;`)(() => area);
  };

  assert.equal(
    criar('<div class="cp-loading-leads"><b>Carregando os leads…</b></div>')(), true,
    'o aviso de carregamento da carteira precisa ser reconhecido como espera'
  );
  assert.equal(
    criar('<div class="cp694-loading"><b>Sua carteira está demorando pra chegar.</b></div>')(), true,
    'o aviso do vigia também é espera da carteira'
  );
  assert.equal(
    criar('<div class="skel-loading"><div class="skel-row"></div></div>')(), false,
    'o esqueleto de um CLIENTE abrindo não pode ser confundido com espera da carteira — ali existe cliente a proteger'
  );
  assert.equal(
    criar('<section class="cp704-card"><h2>Fazer agora</h2></section>')(), false,
    'com o cliente desenhado na área, a proteção continua valendo'
  );
}

// ── 2. As duas funções que desenham a Home deixam de desistir quando o que está lá é o aviso ──
{
  assert.match(app, /if\(state\.grupoAtivo \|\| \(\(state\.focoLeadId \|\| state\.lead\?\.id\) && !homeEsperandoCarteira\(\)\)\) return;/,
    'renderListasHome só pode desistir quando existe MESMO um cliente na tela');
  assert.match(app, /if\(\(state\.focoLeadId \|\| state\.lead\?\.id\) && !homeEsperandoCarteira\(\)\) return;/,
    'o modo de segurança da Home segue a mesma regra');
  const iniFb = app.indexOf('function renderHomeFallbackSeguro(items){');
  const trechoFb = app.slice(iniFb, iniFb + 900);
  assert.match(trechoFb, /cpClearLeadState\(\);/,
    'ao desenhar por cima do aviso, a marca de "lead aberto" precisa ser limpa — senão o próximo desenho desiste de novo');
}

// ── 3. E o aviso nunca mais é escrito por cima de um cliente aberto ───────────────────────────
{
  const ini = app.indexOf('async function carregarDashboard(force){');
  const fim = app.indexOf('async function _processarDashboard(data){', ini);
  const fn = app.slice(ini, fim);
  assert.match(fn, /if\(!state\.itemsAtivos\?\.length && !state\.grupoAtivo && !state\.focoLeadId && !state\.lead\?\.id\)\{/,
    'a busca da carteira não pode cobrir o cliente aberto com "Carregando os leads…"');
}

// ── 4. O histórico do cliente tenta sozinho uma segunda vez ──────────────────────────────────
// Print do dono, 19/08/2026, 15:00: "O lead abriu, mas o histórico completo não carregou. Tente
// novamente." Um tropeço de rede deixava o cliente aberto sem histórico e sem análise, e a única
// saída era ele perceber o aviso e repetir na mão. A carteira tem essa rede desde a v1140.
{
  const ini = app.indexOf('export async function getLeadDetail(id, force){');
  const fim = app.indexOf('\n}', app.indexOf('_leadDetailCache.set(key, { ts:cached?.ts || 0', ini));
  const fn = app.slice(ini, fim);
  assert.match(fn, /const buscar = async \(\) => \{/, 'a busca do histórico precisa ser repetível');
  assert.match(fn, /await new Promise\(r => setTimeout\(r, 1200\)\);/, 'com um respiro curto antes da segunda tentativa');
  assert.match(fn, /if\(gastou > 20000\) throw err1;/,
    'e só quando falhou RÁPIDO: falha lenta é servidor no limite, repetir só dobra a espera');
}

console.log('v1309-carteira-nao-fica-presa-no-carregando: ok');
