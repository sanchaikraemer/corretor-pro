import assert from 'node:assert/strict';

// v1185 — o bug do item 5 da auditoria de 08/2026, encontrado por simulação na mão e reproduzido
// aqui pra nunca mais voltar.
//
// A v1165 fechou o vazamento grave (Cérebro, ZIP, nomes de cliente) e, de propósito, PRESERVOU os
// contadores de uso do corretor ao sair da conta — sair e voltar na mesma conta não pode tomar de
// alguém o histórico de Desempenho, que só existe neste aparelho e nunca sobe pro servidor.
//
// Só que, junto, ela apagava o CARIMBO de quem era o dono do aparelho. Com isso, na sequência
//
//     conta A usa → A sai → conta B entra
//
// a conta B chegava num aparelho sem carimbo; o módulo concluía "primeiro carimbo, isto é seu" e
// não limpava nada. A conta B abria a tela Desempenho e via o tempo de app e a atividade da conta
// A como se fossem dela. Não vaza conversa nem dado de cliente (esses já iam embora na saída), mas
// os números que o corretor usa pra se avaliar ficavam errados.
//
// A correção é guardar o carimbo depois da saída. Aí os dois casos funcionam sem escolher entre
// eles: a MESMA conta que volta mantém o Desempenho; OUTRA conta que entra encontra o carimbo
// antigo, é reconhecida como troca de dono e recebe o aparelho limpo.

// ── aparelho de mentira (mesmo molde do teste da v1165) ──────────────────────────────────────
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

const comChavesEnumeraveis = (ls) => new Proxy(ls, {
  ownKeys: () => [...ls._dados.keys()],
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true })
});

const criarIndexedDB = (bancos) => ({
  open(nome) {
    const req = {};
    queueMicrotask(() => {
      const banco = bancos[nome] || (bancos[nome] = {});
      req.result = {
        objectStoreNames: { contains: (loja) => Object.prototype.hasOwnProperty.call(banco, loja) },
        transaction(lojas) {
          const tx = { objectStore: (loja) => ({ clear: () => { banco[loja] = []; } }) };
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
  keys: async () => [...nomes],
  delete: async (n) => { const i = nomes.indexOf(n); if (i >= 0) nomes.splice(i, 1); return i >= 0; }
});

function montarAparelho() {
  const ls = comChavesEnumeraveis(criarLocalStorage());
  globalThis.localStorage = ls;
  globalThis.indexedDB = criarIndexedDB({ 'direciona-share': { zips: [{ id: 'x' }] } });
  globalThis.caches = criarCaches(['direciona-static-v1']);
  return ls;
}

const { garantirDonoDosDadosLocais, aoSairDaConta, DONO_KEY } = await import('../js/dados-locais.js');

// O que a tela Desempenho lê: tempo de app por dia e a atividade de cada dia.
const semearDesempenho = (ls, quem) => {
  ls.setItem('cpTempoAppPorDia', JSON.stringify({ '2026-08-01': 600 }));
  ls.setItem('cpAtividade_analises', JSON.stringify([`atividade-de-${quem}`]));
  ls.setItem('direciona_onboarding_visto', '1');
};

// ── 1. O caso do bug: A usa, A sai, B entra ──────────────────────────────────────────────────
{
  const ls = montarAparelho();
  semearDesempenho(ls, 'A');
  await garantirDonoDosDadosLocais('usuario-A');

  await aoSairDaConta();
  assert.equal(ls.getItem(DONO_KEY), 'usuario-A',
    'o carimbo precisa sobreviver à saída — é ele que reconhece a próxima pessoa que entrar');

  const entradaDeB = await garantirDonoDosDadosLocais('usuario-B');
  assert.equal(entradaDeB.motivo, 'dono-mudou',
    'depois de A sair, a entrada de B tem que ser reconhecida como TROCA de dono (era "primeiro-carimbo", e por isso não limpava nada)');
  assert.equal(entradaDeB.limpou, true, 'a troca de dono precisa limpar o aparelho');

  assert.equal(ls.getItem('cpTempoAppPorDia'), null,
    'o tempo de app do corretor A não pode aparecer no Desempenho do corretor B');
  assert.equal(ls.getItem('cpAtividade_analises'), null,
    'a atividade do corretor A não pode aparecer no Desempenho do corretor B');
  assert.equal(ls.getItem('direciona_onboarding_visto'), null,
    'nem o estado de onboarding: o corretor B está entrando pela primeira vez');
  assert.equal(ls.getItem(DONO_KEY), 'usuario-B', 'o aparelho passa a ser carimbado com B');
}

// ── 2. E o motivo de o carimbo existir continua valendo: mesma conta volta e mantém tudo ─────
{
  const ls = montarAparelho();
  semearDesempenho(ls, 'A');
  await garantirDonoDosDadosLocais('usuario-A');

  await aoSairDaConta();
  const voltaDeA = await garantirDonoDosDadosLocais('usuario-A');

  assert.equal(voltaDeA.motivo, 'mesmo-dono', 'sair e voltar na mesma conta não é troca de dono');
  assert.equal(voltaDeA.limpou, false, 'e não pode limpar nada');
  assert.equal(ls.getItem('cpTempoAppPorDia'), JSON.stringify({ '2026-08-01': 600 }),
    'o Desempenho de quem já usava o aparelho continua depois de sair e voltar');
  assert.equal(ls.getItem('cpAtividade_analises'), JSON.stringify(['atividade-de-A']),
    'a atividade dele também');
}

// ── 3. Sair continua apagando o que é comercial (a correção não pode afrouxar a v1165) ───────
{
  const ls = montarAparelho();
  ls.setItem('direciona-cerebro-config', JSON.stringify({ metodo: 'MÉTODO SECRETO DO CORRETOR A' }));
  ls.setItem('cpImportPendente', '{"id":"import-a"}');
  ls.setItem('corretor_pro_api_key_v679', 'chave-antiga');
  await garantirDonoDosDadosLocais('usuario-A');

  await aoSairDaConta();

  assert.equal(ls.getItem('direciona-cerebro-config'), null, 'o Cérebro continua indo embora ao sair');
  assert.equal(ls.getItem('cpImportPendente'), null, 'a importação pendente continua indo embora');
  assert.equal(ls.getItem('corretor_pro_api_key_v679'), null, 'a chave antiga compartilhada continua indo embora');
}

// ── 4. O código não pode voltar a apagar o carimbo na saída ──────────────────────────────────
{
  const fs = await import('node:fs');
  const fonte = fs.readFileSync(new URL('../js/dados-locais.js', import.meta.url), 'utf8');
  const saida = fonte.slice(fonte.indexOf('export async function aoSairDaConta'));
  assert.ok(!/removeItem\s*\(\s*DONO_KEY\s*\)/.test(saida),
    'aoSairDaConta não pode apagar o carimbo de dono: sem ele, a próxima conta herda o Desempenho da anterior');
}

console.log('v1185-desempenho-nao-passa-de-uma-conta-pra-outra: ok');
