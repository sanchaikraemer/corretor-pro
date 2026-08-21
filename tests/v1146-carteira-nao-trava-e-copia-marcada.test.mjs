import fs from "node:fs";
import assert from "node:assert/strict";
import { persistStatsCacheWriteBacks } from "../api/_persistence.js";

// v1146 — dois prints do dono em 05/08/2026:
//
//  (19:04 e 19:06) "carregou por cerca de 30 segundos, porém travou nessa tela" → depois
//  "Carregando os leads… Buscando sua carteira atualizada" por mais de dois minutos. O app não
//  estava travado: estava esperando. A v1140 (do mesmo dia) tinha dado 65s à busca e a repetia
//  SEMPRE — 130s de spinner mudo. E o motivo de a carteira demorar tanto estava no servidor: o
//  cache de números de cada lead vence por DIA, ou seja, à meia-noite vence pra carteira INTEIRA,
//  e a listagem buscava a conversa de TODOS os leads numa única carga (sem teto), gravando de
//  volta com um orçamento tão curto (1500ms) que quase nada grudava — a carga seguinte repetia o
//  mesmo trabalho condenado, para sempre.
//
//  (19:12) "por que não ficou vermelho o 'copiar' quando clico, como era antes?" — culpa da v1142:
//  ela passou a redesenhar o cliente na hora (pra mostrar "Atendido") e isso trocava o botão por
//  um novo, apagando o destaque do toque.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const persistencia = fs.readFileSync(new URL("../api/_persistence.js", import.meta.url), "utf8");

// ── 1. Servidor: teto de leituras por carga, com prioridade ────────────────────────────────────
{
  assert.match(persistencia, /const STATS_TIMELINES_POR_CARGA = Number\(process\.env\.CORRETOR_PRO_STATS_TIMELINES_POR_CARGA\)/,
    "o teto de leituras por carga existe e é configurável");
  assert.match(persistencia, /\.slice\(0, STATS_TIMELINES_POR_CARGA\)/, "o teto é aplicado de verdade");
  // Prioridade: quem apareceria zerado vem primeiro; quem só está com números de ontem vem por último.
  const ordem = persistencia.indexOf("const precisamTimeline = [...semCacheNenhum, ...cacheDeOutraVersao, ...cacheDeOutroDia]");
  assert.ok(ordem > -1, "a ordem de prioridade das leituras está explícita");
  assert.ok(persistencia.indexOf("semCacheNenhum.push(id)") > -1
    && persistencia.indexOf("cacheDeOutraVersao.push(id)") > -1
    && persistencia.indexOf("cacheDeOutroDia.push(id)") > -1, "as três filas de prioridade existem");
  // O que sobrou fica visível na resposta (dá pra ver se a carteira está esquentando).
  assert.match(persistencia, /statsPendentes,\s*\n\s*statsRecalculados: statsCacheWriteBacks\.length/,
    "a resposta informa quanto ficou pendente e quanto foi recalculado");
}

// ── 2. Servidor: o que foi calculado agora tem tempo de ser gravado ───────────────────────────
{
  // v1345 — 6000ms voltou pra 2500ms. O raciocínio da v1146 continua certo (o volume por carga é
  // conhecido e pequeno), só que o teto de leituras caiu de 150 pra 60 na mesma versão: são no
  // máximo ~3 rodadas de 20 gravações, que cabem em 2,5s. E o corretor não pode esperar 6 segundos
  // por gravação de CACHE — a resposta dele já está pronta antes disso (reclamação de 21/08/2026:
  // "está demorando demais pra carregar"). O que este teste guarda é o que importa: existe um teto
  // de tempo, e ele é aplicado.
  assert.match(persistencia, /const STATS_CACHE_WRITE_BUDGET_MS = \d+;/,
    "o orçamento de gravação existe");
  assert.ok(Number(/const STATS_CACHE_WRITE_BUDGET_MS = (\d+);/.exec(persistencia)[1]) <= 3000,
    "e não pode fazer o corretor esperar mais que uns poucos segundos por gravação de cache");
  // E continua sendo um TETO: banco lento não segura a resposta pra sempre.
  const contador = { n: 0 };
  const lento = () => new Promise(r => setTimeout(() => { contador.n++; r({ error: null }); }, 400));
  const banco = { from(){ return { update(){ return { eq(){ return { eq(){ return { eq: lento, then:(res,rej)=>lento().then(res,rej) }; } }; } }; } }; } };
  const pendentes = Array.from({ length: 500 }, (_, i) => ({ id: `l-${i}`, atualizado_em: "x", resultado_analise: {} }));
  const t0 = Date.now();
  await persistStatsCacheWriteBacks(banco, pendentes, "org-1");
  const levou = Date.now() - t0;
  assert.ok(levou < 7000, `o orçamento continua limitando (levou ${levou}ms)`);
  assert.ok(contador.n > 0 && contador.n < 500, `grava o que couber e deixa o resto pra próxima (gravou ${contador.n})`);
}

// ── 3. App: espera longa mostra o tempo e oferece saída, sem cancelar a busca ──────────────────
{
  const ini = app.indexOf("async function getLeadsData(");
  const src = app.slice(ini, app.indexOf("\nasync function restaurarLeadsAntigos", ini));
  assert.match(src, /if\(gastou > 20000\) throw _e1;/,
    "a 2ª tentativa só vale quando a 1ª falhou rápido — nunca dobrar uma espera longa");
  const vigia = app.slice(app.indexOf("const areaCarregando = () => {"));
  assert.doesNotMatch(vigia.slice(0, 3200), /state\?\.active === 'home'/,
    "a mensagem de espera não pode depender da tela ativa (era o congelamento do print)");
  assert.match(vigia.slice(0, 3200), /Buscando sua carteira… \$\{seg\}s/, "mostra os segundos na tela");
}

// ── 4. App: a opção copiada fica marcada, e a marca sobrevive ao redesenho ─────────────────────
{
  const copiar = app.slice(app.indexOf("window.cp704CopyMsg=async function(k){"));
  const bloco = copiar.slice(0, copiar.indexOf("\n  };"));
  assert.match(bloco, /window\.cp704Copiada = \{ leadId: String\(state\.lead\?\.id \|\| ''\), key: k \|\| window\.cp704SelectedMsg \|\| 'a', texto: msg \}/,
    "a cópia guarda cliente, opção e TEXTO copiado");
  assert.match(bloco, /item\.classList\.add\('cp704-msg-copiada'\)/, "marca na hora, sem esperar redesenho");
  // O redesenho reaplica a marca (é o que a v1142 apagava).
  assert.match(app, /function cp704MarcaCopiada\(lead,k,texto\)\{ return cp704FoiCopiada\(lead,k,texto\) \? ' cp704-msg-copiada' : ''; \}/,
    "o desenho das sugestões reaplica a marca");
  assert.match(app, /function cp704RotuloCopiar\(lead,k,texto\)\{ return cp704FoiCopiada\(lead,k,texto\) \? 'Copiado' : 'Copiar'; \}/,
    "e o botão da opção copiada diz 'Copiado'");
  assert.match(app, /cp704MarcaCopiada\(lead,'a',msgs\.a\)[\s\S]*cp704MarcaCopiada\(lead,'b',msgs\.b\)[\s\S]*cp704MarcaCopiada\(lead,'c',msgs\.c\)/,
    "as três opções passam pela marca");
  // Só vale pro mesmo cliente E pro mesmo texto: análise nova não herda a marca.
  const foi = app.slice(app.indexOf("function cp704FoiCopiada(lead,k,texto){"));
  const blocoFoi = foi.slice(0, foi.indexOf("\n  }"));
  assert.match(blocoFoi, /String\(c\.leadId\|\|''\) !== String\(lead\?\.id\|\|''\)/, "marca é por cliente");
  assert.match(blocoFoi, /norm\(c\.texto\) === norm\(texto\)/, "e só enquanto o texto daquela opção for o mesmo");
  // O destaque coral existe no estilo.
  assert.match(app, /\.cp704-msg-item\.cp704-msg-copiada\{border-color:rgba\(255,98,88,\.75\);background:rgba\(255,98,88,\.12\)\}/,
    "a opção copiada fica destacada em coral");
  assert.match(app, /\.cp704-msg-item\.cp704-msg-copiada \.cp704-copy\{border-color:transparent;background:var\(--lime\);color:#fff\}/,
    "e o botão dela fica coral cheio");
  // v1268 — as duas linhas que existiam aqui cuidavam do TEMA CLARO (a lição da v1078: lá havia
  // blocos antigos com !important forçando branco nesses mesmos elementos). O tema claro foi
  // removido do sistema por ordem do dono, então elas saíram junto com as regras que verificavam.
  // O que sobra é o que vale hoje: a marca coral do tema único, conferida logo acima.
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /data-theme="light"/, "o tema claro não pode voltar ao CSS (v1268)");
}

console.log("v1146-carteira-nao-trava-e-copia-marcada: ok");
