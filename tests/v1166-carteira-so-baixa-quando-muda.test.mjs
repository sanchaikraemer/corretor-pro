import fs from 'node:fs';
import assert from 'node:assert/strict';
import { calcularAssinaturaDaCarteira } from '../api/leads-recentes.js';

// v1166 — o painel do Supabase acusou a cota de tráfego estourada (7,11 GB de 5 GB no plano
// grátis). A v1121 (atualização de fundo de 30s → 2min) e a v1136 (conversa fora da lista) já
// cortaram o grosso. O que sobrou: a cada 2 minutos com a tela aberta, o app baixava até 2000 leads
// COM a análise comercial de cada um — e na esmagadora maioria dos tiques nada tinha mudado.
//
// Agora a atualização de fundo pergunta primeiro, em poucos bytes: quantos leads existem e qual foi
// a última alteração. Iguais aos da carga anterior = não baixa nada.
//
// A regra que este teste protege: economizar NUNCA pode esconder novidade. Qualquer dúvida
// (consulta falhou, servidor não soube dizer, primeira carga) tem que resultar em busca completa.

// ── banco de mentira ──────────────────────────────────────────────────────────────────────────
function supabaseFalso({ contagem, linhasPorColuna = {}, erroContagem = false, colunasComErro = [] }) {
  const registro = { filtros: [], colunasPedidas: [], headCount: false };
  return {
    _registro: registro,
    from() {
      return {
        select(colunas, opcoes) {
          registro.colunasPedidas.push(colunas);
          if (opcoes?.head === true && opcoes?.count === 'exact') registro.headCount = true;
          const resposta = () => {
            if (opcoes?.head === true) {
              return erroContagem ? { error: { message: 'falhou' }, count: null } : { error: null, count: contagem };
            }
            if (colunasComErro.includes(colunas)) return { error: { message: `column ${colunas} does not exist` }, data: null };
            const linha = linhasPorColuna[colunas];
            return { error: null, data: linha === undefined ? [] : [linha] };
          };
          const consulta = {
            eq(coluna, valor) { registro.filtros.push(`${coluna}=${valor}`); return consulta; },
            order(coluna) { registro.ordens = [...(registro.ordens || []), coluna]; return consulta; },
            limit() { return consulta; },
            then(ok, falha) { return Promise.resolve(resposta()).then(ok, falha); }
          };
          return consulta;
        }
      };
    }
  };
}

// ── 1. Caminho normal: devolve total + marca da última alteração, filtrando pela empresa ───────
{
  const sb = supabaseFalso({ contagem: 137, linhasPorColuna: { atualizado_em: { atualizado_em: '2026-08-07T03:00:00Z' } } });
  const a = await calcularAssinaturaDaCarteira(sb, 'org-1');

  assert.equal(a.indefinida, false);
  assert.equal(a.total, 137);
  assert.equal(a.ultimaAlteracao, '2026-08-07T03:00:00Z');
  assert.ok(sb._registro.headCount,
    'a contagem precisa ser head+count (o banco devolve só o número, nenhuma linha) — é o que faz a pergunta custar bytes em vez de megabytes');
  assert.ok(sb._registro.filtros.every(f => f.startsWith('organization_id=org-1')),
    'toda consulta da assinatura precisa filtrar pela empresa');
  assert.ok(!sb._registro.colunasPedidas.some(c => String(c).includes('resultado_analise') || String(c).includes('timeline_json')),
    'a assinatura não pode pedir análise nem conversa — é justamente o que ela existe pra não baixar');
}

// ── 2. Base antiga: cai pras outras colunas de data em vez de desistir ─────────────────────────
{
  const sb = supabaseFalso({
    contagem: 5,
    colunasComErro: ['atualizado_em', 'updated_at'],
    linhasPorColuna: { criado_em: { criado_em: '2026-08-01T10:00:00Z' } }
  });
  const a = await calcularAssinaturaDaCarteira(sb, 'org-1');
  assert.equal(a.indefinida, false);
  assert.equal(a.ultimaAlteracao, '2026-08-01T10:00:00Z');
}

// ── 3. Carteira vazia é resposta VÁLIDA (não é "não sei") ──────────────────────────────────────
{
  const sb = supabaseFalso({ contagem: 0, linhasPorColuna: {} });
  const a = await calcularAssinaturaDaCarteira(sb, 'org-1');
  assert.equal(a.indefinida, false, 'carteira vazia tem assinatura válida — senão o app baixaria tudo a cada 2 min sem ter nada');
  assert.equal(a.total, 0);
}

// ── 4. Se a contagem falhar, a resposta é "não sei" — e quem chama busca tudo ──────────────────
{
  const sb = supabaseFalso({ contagem: null, erroContagem: true, linhasPorColuna: { atualizado_em: { atualizado_em: 'x' } } });
  const a = await calcularAssinaturaDaCarteira(sb, 'org-1');
  assert.equal(a.indefinida, true,
    'sem conseguir a contagem, a assinatura não vale — precisa dizer isso pra o app fazer a busca completa');
}

// ── 5. O app precisa usar isso no lugar certo, e do jeito certo ────────────────────────────────
{
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

  assert.match(app, /assinatura=1/, 'o app precisa consultar a assinatura da carteira');

  // Qualquer dúvida = busca completa. As três saídas de erro da função devolvem true.
  const fn = app.slice(app.indexOf('async function cpCarteiraMudouDesdeAUltimaCarga'));
  const corpo = fn.slice(0, fn.indexOf('\n}'));
  assert.match(corpo, /if\(!res\.ok\)\s*return true/, 'resposta ruim do servidor precisa resultar em busca completa');
  assert.match(corpo, /indefinida\)\s*return true/, 'servidor sem assinatura confiável precisa resultar em busca completa');
  assert.match(corpo, /anterior === null\) return true/, 'a primeira carga não tem com o que comparar: busca completa');
  assert.match(corpo, /catch[\s\S]{0,80}?return true/, 'qualquer tropeço precisa resultar em busca completa');

  // A economia vale só pra atualização automática — nunca no caminho de quem acabou de agir.
  const tique = app.slice(app.indexOf('CP_SYNC_FUNDO_MS);') - 1200, app.indexOf('CP_SYNC_FUNDO_MS);'));
  assert.ok(tique.indexOf('cpCarteiraMudouDesdeAUltimaCarga') < tique.indexOf('loadRecentLeads'),
    'no tique de fundo, a pergunta barata precisa vir ANTES da busca pesada');

  // Depois de uma mutação, o retrato guardado não vale mais.
  const inval = app.slice(app.indexOf('function invalidarLeadsCache'), app.indexOf('function invalidarLeadsCache') + 260);
  assert.match(inval, /cpEsquecerAssinaturaCarteira\(\)/,
    'invalidar o cache precisa esquecer a assinatura — senão o app compararia com um retrato já vencido e deixaria de mostrar o que mudou');
}

console.log('v1166-carteira-so-baixa-quando-muda: ok');
