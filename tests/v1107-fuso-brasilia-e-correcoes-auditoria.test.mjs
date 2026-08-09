import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parseDateTime } from '../api/_pipeline.js';
import { normalizarEtapaBanco } from '../api/_persistence.js';

// v1107 — auditoria completa (backend + tela + app instalado). Cada bloco abaixo protege uma
// correção desta versão; se algum quebrar, o bug correspondente voltou.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const leadUpdate = fs.readFileSync(new URL('../api/lead-update.js', import.meta.url), 'utf8');
const persistence = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');

const civilSP = (iso) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(iso));

// ── 1. parseDateTime: hora do TXT do WhatsApp é hora do BRASIL, não do servidor ───────────────
// O servidor (Vercel) roda em UTC; antes, "01/08/2026 01:30" virava um instante que, reconvertido
// pro fuso de Brasília, caía em 31/07 — mensagem da madrugada contava no dia anterior.
{
  assert.equal(civilSP(parseDateTime('01/08/2026', '01:30')), '2026-08-01',
    'mensagem de madrugada precisa continuar no MESMO dia civil de Brasília');
  assert.equal(parseDateTime('01/08/2026', '01:30'), '2026-08-01T04:30:00.000Z',
    'instante correto: 01:30 -03:00 = 04:30 UTC');
  assert.equal(civilSP(parseDateTime('31/12/25', '23:59')), '2025-12-31', 'virada de ano, ano com 2 dígitos');
  assert.equal(civilSP(parseDateTime('15/03/2026', '14:00')), '2026-03-15', 'horário comercial não muda de dia');
}

// ── 2. Carimbo de "criar lead manual" e "oportunidade de parceiro" no fuso de Brasília ────────
// Os dois montavam data/hora com now.getDate()/now.getHours() — na Vercel isso é UTC: lead criado
// às 21h30 saía carimbado no dia seguinte, 3 h adiantado. Agora usam dataHoraSaoPaulo().
{
  assert.ok(!/p2\(now\.getDate\(\)\)/.test(leadUpdate),
    'lead-update.js não pode voltar a montar data com now.getDate() (fuso do servidor)');
  assert.ok(!/p2\(now\.getHours\(\)\)/.test(leadUpdate) && !/p2\(now\.getMinutes\(\)\)/.test(leadUpdate),
    'lead-update.js não pode voltar a montar hora com now.getHours() (fuso do servidor)');
  assert.equal((leadUpdate.match(/dataHoraSaoPaulo\(/g) || []).length >= 3, true,
    'criar-manual e oportunidade-parceiro precisam usar dataHoraSaoPaulo (além da observação)');
}

// ── 3. Fallback de insert não semeia mais texto na coluna etapa ───────────────────────────────
// v1105 limpou 244 registros com texto na coluna etapa — mas o legacyPayload (usado quando o
// insert canônico falha) ainda gravava "Conversa processada pelo Motor Real..." — replantando
// exatamente a sujeira que a autolimpeza da v1105 corrige. (A LEITURA continua devolvendo o dado
// cru de propósito — decisão da v1105, o app normaliza pra tela com a mesma régua do banco.)
{
  assert.ok(!/etapa:\s*"Conversa processada/.test(persistence),
    'o fallback de insert não pode gravar texto descritivo na coluna etapa');
  assert.equal(normalizarEtapaBanco('Perdido'), 'Geladeira');
  assert.equal(normalizarEtapaBanco('Conversa processada pelo Motor Real do Corretor Pro.'), 'Ativo');
}

// ── 4. Reimportar pelo caminho "salvar-novo" não apaga mais o histórico de importações ────────
{
  const fonte = persistence.match(/function _mesclarAnaliseV681\(anterior = \{\}, nova = \{\}\) \{[\s\S]*?\n\}/)[0];
  const { _mesclarAnaliseV681 } = eval(`
    const _semScoreComercial = (v) => v;
    const mergeStorageRefs = () => null;
    const _nomeRuimIdentity = () => false;
    ${fonte}
    ({ _mesclarAnaliseV681 });
  `);
  const anterior = { _historicoImportacoes: [{ importId: 'a' }, { importId: 'b' }] };
  const nova = { _historicoImportacoes: [{ importId: 'c' }] };
  const merged = _mesclarAnaliseV681(anterior, nova);
  assert.deepEqual(merged._historicoImportacoes.map(e => e.importId), ['a', 'b', 'c'],
    'a mesclagem precisa ACUMULAR o histórico de importações, não substituir');
  const cheio = { _historicoImportacoes: Array.from({ length: 60 }, (_, i) => ({ importId: String(i) })) };
  assert.equal(_mesclarAnaliseV681(cheio, nova)._historicoImportacoes.length, 50, 'teto de 50 eventos');
}

// ── 5. Pacote offline do app instalado: tudo que o boot do index.html exige está no precache ──
// Sem js/tema.js e js/commercial-schema.js o módulo app.js inteiro não executa; sem
// vendor/supabase.js e contas-config.js o login não sobe. Faltando qualquer um, o app instalado
// abria offline mas travava pra sempre em "Carregando os leads...".
{
  const core = sw.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)[1];
  const importsEstaticos = [...app.matchAll(/^import [^\n]*?from '\.(\/js\/[\w-]+\.js)/gm)].map(m => m[1])
    .concat([...app.matchAll(/^import '\.(\/js\/[\w-]+\.js)/gm)].map(m => m[1]));
  assert.ok(importsEstaticos.length >= 5, 'sanidade: o app.js tem imports estáticos de js/');
  for (const arq of importsEstaticos) {
    assert.ok(core.includes(`'${arq}?v=__VERSION__'`), `import estático do app.js fora do precache: ${arq}`);
  }
  // v1186 — a lista era escrita à mão aqui ('/vendor/supabase.js', '/contas-config.js',
  // '/vendor/jszip.min.js'). Agora sai do próprio index.html: qualquer <script src> que o boot
  // carregar precisa estar no pacote offline, e nada além disso. Assim o teste acompanha sozinho
  // quando um script entra ou sai do boot — foi o caso do jszip, que saiu do carregamento fixo
  // (passou a ser baixado só na hora de importar um ZIP) e antes obrigava este teste a mentir.
  const scriptsDoBoot = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
    .map(m => m[1].replace(/\?v=__VERSION__$/, ''))
    .filter(src => src.startsWith('/'));
  assert.ok(scriptsDoBoot.length >= 2, 'sanidade: o index.html carrega scripts externos no boot');
  for (const arq of scriptsDoBoot) {
    assert.ok(core.includes(`'${arq}?v=__VERSION__'`), `script do index.html fora do precache: ${arq}`);
  }
  // E o jszip NÃO pode voltar pro boot: são 96 KB em toda abertura pra um uso que só acontece
  // na importação de ZIP e na planilha de exportação.
  assert.ok(!scriptsDoBoot.some(s => s.includes('jszip')),
    'o jszip não pode voltar a ser carregado em toda abertura do app — use ensureJSZip()');
  assert.match(app, /function ensureJSZip\(\)/, 'o carregador sob demanda do jszip precisa existir');
}

// ── 6. A limpeza de versão nova só apaga caches estáticas — nunca a do compartilhamento ───────
// A cache direciona-sharetarget-stable pode guardar um ZIP compartilhado ainda não processado
// (fallback quando o IndexedDB falha); apagar ela na troca de versão perdia a importação.
{
  const trecho = app.match(/if\(window\.caches\)\{[^}]*caches\.delete[^}]*\}/);
  assert.ok(trecho, 'sanidade: a limpeza de caches na troca de versão existe');
  assert.ok(/filter\(k => k\.startsWith\("corretor-pro-static"\)\)/.test(trecho[0]),
    'a limpeza precisa filtrar só as caches corretor-pro-static (preservando a do compartilhamento)');
}

// ── 7. "Mês passado" do Desempenho ancorado em Brasília, não no fuso do aparelho ──────────────
// Em Cuiabá/Manaus (UTC-4/-5), getMonth() na virada do mês lia o mês errado e o chip pulava
// DOIS meses pra trás (mostrava "Junho" no dia 1º de agosto). Roda a função extraída em
// subprocessos com fusos diferentes: o resultado tem que ser idêntico e ser o mês anterior em SP.
{
  const fonteMes = app.match(/function cpInicioMesMs\(\)\{[\s\S]*?\n\}/)[0];
  const fonte = app.match(/function cpInicioMesAnteriorMs\(\)\{[\s\S]*?\n\}/)[0];
  const script = `${fonteMes}\n${fonte}\nprocess.stdout.write(String(cpInicioMesAnteriorMs()));`;
  const roda = (tz) => {
    const r = spawnSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: tz }, encoding: 'utf8' });
    assert.equal(r.status, 0, `cpInicioMesAnteriorMs falhou com TZ=${tz}: ${r.stderr}`);
    return Number(r.stdout);
  };
  const emSP = roda('America/Sao_Paulo'), emCuiaba = roda('America/Cuiaba'), emUTC = roda('UTC');
  assert.equal(emCuiaba, emSP, 'mesmo instante em Cuiabá e em São Paulo');
  assert.equal(emUTC, emSP, 'mesmo instante em UTC e em São Paulo');
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const hoje = fmt.format(new Date());
  let y = Number(hoje.slice(0, 4)), m = Number(hoje.slice(5, 7)) - 1;
  if (m === 0) { m = 12; y -= 1; }
  assert.equal(fmt.format(new Date(emSP)), `${y}-${String(m).padStart(2, '0')}-01`,
    'o início do mês anterior é o dia 1º do mês anterior EM BRASÍLIA');
}

// ── 8. Pontes de onclick que faltavam ─────────────────────────────────────────────────────────
{
  assert.ok(/window\.carregarAgenda = carregarAgenda/.test(app),
    'o × de descartar compromisso atrasado chama carregarAgenda() no onclick — precisa da ponte window');
  const buscaHandler = app.match(/onclick='abrirLead\(\$\{idJs\}\);[^']*'/);
  assert.ok(buscaHandler, 'sanidade: o resultado da busca global tem onclick');
  assert.ok(!/[^.\w]qs\(/.test(buscaHandler[0]),
    'onclick inline não enxerga o import qs() do módulo — usar document.querySelector');
}

// ── 9. Concordância e data local nos textos e arquivos ────────────────────────────────────────
{
  // A frase do "Mandou bem!" especificamente (a revisão adversarial provou que um assert
  // genérico casava com OUTRA frase correta e deixava o bug voltar despercebido).
  const mandouBem = app.match(/Mandou bem![^\n]*/)?.[0] || '';
  assert.ok(mandouBem.includes('atendido${tratadosHoje>1?"s":""} hoje'),
    '"1 lead atendidos hoje" — o particípio do "Mandou bem!" precisa concordar');
  assert.ok(/lead\$\{items\.length===1\?"":"s"\}/.test(app), 'pill do topo: "1 leads" não pode');
  assert.ok(!/toISOString\(\)\.slice\(0,10\)\}\.csv/.test(app) && !/toISOString\(\)\.slice\(0,10\)\}\.json/.test(app),
    'nome dos arquivos de planilha/backup usa a data de Brasília, não a UTC (depois das 21h saía "amanhã")');
}

console.log('v1107-fuso-brasilia-e-correcoes-auditoria: ok');
