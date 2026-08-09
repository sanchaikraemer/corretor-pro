import assert from 'node:assert/strict';

// v1165 — a auditoria de 07/08/2026 (itens 6, 8 e 9): sair da conta só encerrava a sessão. Tudo o
// que o app guarda no aparelho ficava lá — inclusive o Cérebro Comercial, numa chave global sem
// dono. No mesmo celular, a conta seguinte podia ver (e sobrescrever) o Cérebro da anterior, ficar
// com o ZIP de um cliente que não é dela e receber notificação com nome de cliente alheio.
//
// Este teste roda o módulo de verdade (js/dados-locais.js) com um aparelho de mentira:
// localStorage, IndexedDB e caches simulados.

// ── aparelho de mentira ───────────────────────────────────────────────────────────────────────
const criarLocalStorage = () => {
  const dados = new Map();
  return {
    _dados: dados,
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => { dados.set(String(k), String(v)); },
    removeItem: (k) => { dados.delete(String(k)); },
    get length() { return dados.size; },
    key: (i) => [...dados.keys()][i] ?? null
  };
};

// Object.keys(localStorage) é o que o módulo usa pra achar as chaves com prefixo — num navegador
// de verdade elas aparecem como propriedades do objeto. O Proxy reproduz isso.
const comChavesEnumeraveis = (ls) => new Proxy(ls, {
  ownKeys: () => [...ls._dados.keys()],
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true })
});

const criarIndexedDB = (bancos) => ({
  _bancos: bancos,
  open(nome) {
    const req = {};
    queueMicrotask(() => {
      const banco = bancos[nome] || (bancos[nome] = {});
      req.result = {
        objectStoreNames: { contains: (loja) => Object.prototype.hasOwnProperty.call(banco, loja) },
        transaction(lojas) {
          const tx = {
            objectStore: (loja) => ({ clear: () => { banco[loja] = []; } })
          };
          queueMicrotask(() => tx.oncomplete && tx.oncomplete());
          return tx;
        },
        close() {}
      };
      req.onsuccess && req.onsuccess();
    });
    return req;
  },
  deleteDatabase(nome) {
    const req = {};
    queueMicrotask(() => { delete bancos[nome]; req.onsuccess && req.onsuccess(); });
    return req;
  }
});

const criarCaches = (nomes) => ({
  _nomes: nomes,
  keys: async () => [...nomes],
  delete: async (n) => { const i = nomes.indexOf(n); if (i >= 0) nomes.splice(i, 1); return i >= 0; }
});

function montarAparelho() {
  const ls = comChavesEnumeraveis(criarLocalStorage());
  const bancos = {
    'direciona-share': { zips: [{ id: 'x', blob: 'ZIP DA CONVERSA DO CLIENTE' }] },
    'corretor-pro-notif': { kv: [{ retrato: { nomes: ['João', 'Maria'] } }] }
  };
  const nomesDeCache = ['direciona-static-v1', 'direciona-sharetarget-stable', 'direciona-sharetarget-abc'];
  globalThis.localStorage = ls;
  globalThis.indexedDB = criarIndexedDB(bancos);
  globalThis.caches = criarCaches(nomesDeCache);
  return { ls, bancos, nomesDeCache };
}

const { garantirDonoDosDadosLocais, aoSairDaConta, DONO_KEY, CHAVES_COMERCIAIS } =
  await import('../js/dados-locais.js');

const semearContaA = (ls) => {
  ls.setItem('direciona-cerebro-config', JSON.stringify({ metodo: 'MÉTODO SECRETO DO CORRETOR A' }));
  ls.setItem('cpImportPendente', '{"id":"import-a"}');
  ls.setItem('compromissosDispensados', '["c1"]');
  ls.setItem('corretor_pro_api_key_v679', 'chave-antiga');
  ls.setItem('cpAtividade_analises', '["2026-08-01T10:00:00Z"]');
  ls.setItem('cpTempoAppPorDia', '{"2026-08-01":600}');
  ls.setItem('cp-tema', 'escuro'); // preferência NEUTRA do aparelho: não pode sumir nunca
};

// ── 1. Trocou de dono: o que era da conta A não sobrevive ─────────────────────────────────────
{
  const { ls, bancos, nomesDeCache } = montarAparelho();
  semearContaA(ls);
  ls.setItem(DONO_KEY, 'usuario-A');

  const r = await garantirDonoDosDadosLocais('usuario-B');
  assert.equal(r.limpou, true, 'trocar de conta no mesmo aparelho precisa limpar o que era da anterior');

  for (const chave of CHAVES_COMERCIAIS) {
    assert.equal(ls.getItem(chave), null, `${chave} é dado comercial e não pode passar de uma conta pra outra`);
  }
  assert.equal(ls.getItem('cpAtividade_analises'), null, 'contador de atividade da conta anterior não pode ficar');
  assert.equal(ls.getItem('cpTempoAppPorDia'), null, 'tempo no app da conta anterior não pode ficar');
  assert.deepEqual(bancos['direciona-share'], undefined, 'o ZIP compartilhado da conta anterior precisa sumir');
  assert.deepEqual(bancos['corretor-pro-notif'], undefined, 'os nomes de cliente do lembrete precisam sumir');
  assert.deepEqual(nomesDeCache, ['direciona-static-v1'],
    'os caches de compartilhamento somem; o cache do app (static) continua, senão o app deixaria de abrir sem internet');
  assert.equal(ls.getItem('cp-tema'), 'escuro', 'preferência neutra do aparelho (tema) não pode ser apagada');
  assert.equal(ls.getItem(DONO_KEY), 'usuario-B', 'o aparelho precisa ficar carimbado com o dono novo');
}

// ── 2. Mesma conta entrando de novo: não apaga nada ───────────────────────────────────────────
{
  const { ls, bancos } = montarAparelho();
  semearContaA(ls);
  ls.setItem(DONO_KEY, 'usuario-A');

  const r = await garantirDonoDosDadosLocais('usuario-A');
  assert.equal(r.limpou, false, 'entrar de novo na MESMA conta não pode limpar nada');
  assert.match(String(ls.getItem('direciona-cerebro-config')), /MÉTODO SECRETO/, 'o Cérebro do próprio dono continua');
  assert.ok(bancos['direciona-share'], 'a importação em andamento do próprio dono continua');
}

// ── 3. Primeira vez depois da atualização (sem carimbo): adota o dono, não apaga ───────────────
{
  const { ls } = montarAparelho();
  semearContaA(ls); // dado legítimo de quem JÁ usava o aparelho

  const r = await garantirDonoDosDadosLocais('usuario-A');
  assert.equal(r.limpou, false,
    'sem carimbo anterior o dado é do próprio corretor que já usava o aparelho — apagar tomaria dele o histórico de Desempenho e uma importação em andamento');
  assert.equal(r.motivo, 'primeiro-carimbo');
  assert.equal(ls.getItem(DONO_KEY), 'usuario-A');
  assert.match(String(ls.getItem('direciona-cerebro-config')), /MÉTODO SECRETO/);
  assert.equal(ls.getItem('cpAtividade_analises'), '["2026-08-01T10:00:00Z"]', 'o histórico de uso dele continua');
}

// ── 4. Sair da conta: dado comercial vai embora, uso do aparelho fica ──────────────────────────
{
  const { ls, bancos, nomesDeCache } = montarAparelho();
  semearContaA(ls);
  ls.setItem(DONO_KEY, 'usuario-A');

  await aoSairDaConta();

  assert.equal(ls.getItem('direciona-cerebro-config'), null, 'o Cérebro não pode ficar no aparelho depois de sair');
  assert.equal(ls.getItem('cpImportPendente'), null, 'importação pendente não pode ficar');
  assert.equal(ls.getItem('corretor_pro_api_key_v679'), null,
    'a chave antiga compartilhada abre a conta original — sair da conta precisa apagá-la');
  assert.deepEqual(bancos['direciona-share'], undefined, 'o ZIP compartilhado não pode ficar');
  assert.deepEqual(bancos['corretor-pro-notif'], undefined, 'os nomes de cliente do lembrete não podem ficar');
  assert.deepEqual(nomesDeCache, ['direciona-static-v1'], 'o cache do app continua; os de compartilhamento não');
  // v1185 — o carimbo FICA. Ele é o que permite reconhecer, no próximo login, se quem entrou é a
  // mesma pessoa (mantém o Desempenho) ou outra (apaga os contadores da anterior). Apagá-lo aqui
  // era o bug do item 5 da auditoria de 08/2026 — ver o teste v1185.
  assert.equal(ls.getItem(DONO_KEY), 'usuario-A', 'o carimbo precisa sobreviver à saída da conta');

  // Sair e voltar na MESMA conta não pode tomar do corretor o histórico que só existe aqui.
  assert.equal(ls.getItem('cpAtividade_analises'), '["2026-08-01T10:00:00Z"]',
    'contador de atividade é do próprio corretor e não sobe pro servidor — sair e voltar não pode apagar');
  assert.equal(ls.getItem('cp-tema'), 'escuro', 'preferência neutra do aparelho continua');
}

// ── 5. Sem sessão (caminho antigo por chave compartilhada): não mexe em nada ───────────────────
{
  const { ls } = montarAparelho();
  semearContaA(ls);
  const r = await garantirDonoDosDadosLocais('');
  assert.equal(r.limpou, false);
  assert.equal(r.motivo, 'sem-sessao');
  assert.match(String(ls.getItem('direciona-cerebro-config')), /MÉTODO SECRETO/);
}

// ── 6. As telas de entrada e a saída precisam mesmo chamar isto ────────────────────────────────
{
  const fs = await import('node:fs');
  const ler = (arq) => fs.readFileSync(new URL('../' + arq, import.meta.url), 'utf8');

  for (const arq of ['entrar.html', 'cadastro.html']) {
    const html = ler(arq);
    assert.match(html, /dados-locais\.js/, `${arq} precisa carregar o módulo de limpeza`);
    assert.match(html, /garantirDonoDosDadosLocais/,
      `${arq} precisa carimbar/limpar o aparelho no momento em que a conta entra`);
  }

  const app = ler('app.js');
  assert.match(app, /import\s*\{[^}]*aoSairDaConta[^}]*\}\s*from\s*'\.\/js\/dados-locais\.js/,
    'app.js precisa importar a limpeza');
  const sair = app.slice(app.indexOf('window.cpSairDaConta'), app.indexOf('window.cpSairDaConta') + 1400);
  assert.match(sair, /aoSairDaConta\(\)/, 'o botão "Sair da conta" precisa apagar o que ficou no aparelho');
  assert.match(app, /garantirDonoDosDadosLocais\(data\.session\.user\?\.id\)/,
    'a abertura do app precisa da rede de segurança pra sessão que trocou por fora das telas de entrada');
}

console.log('v1165-dados-locais-nao-passam-de-uma-conta-pra-outra: ok');
