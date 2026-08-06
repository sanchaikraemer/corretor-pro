import fs from "node:fs";
import assert from "node:assert/strict";

// v1161 — dono, 06/08/2026, logo depois de uma importação que não terminou: "agora fica
// 'carregando os leads...' faz 5 min e nada". Auditoria pedida por ele ("analise antes de dar
// palpite furado") achou uma causa REAL no código:
//
// carregarDashboard tinha DOIS caminhos de falha com tratamentos diferentes. Resposta ok:false →
// aviso "Reconectando…" com botão + nova tentativa sozinha a cada 3s. Mas quando a busca FALHAVA
// DE VEZ (getLeadsData esgota as tentativas e estoura o erro — rede caindo, servidor no teto de
// tempo), o catch só fazia console.warn: a tela ficava com o "Carregando os leads…" congelado
// PRA SEMPRE, sem botão e sem nova tentativa. Spinner mudo por minutos é exatamente o que o dono
// vê como "travou".
//
// E se o código principal nem chegar a rodar (erro de JS no boot, arquivo que não carregou),
// nenhum vigia de dentro do app.js existe — por isso o segundo guarda vive no PRÓPRIO index.html.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

// ── 1. O catch de carregarDashboard não pode mais engolir a falha em silêncio ─────────────────
{
  const ini = app.indexOf("async function carregarDashboard(force){");
  const fim = app.indexOf("async function _processarDashboard(data){", ini);
  assert.ok(ini > -1 && fim > ini, "carregarDashboard não encontrada");
  const fn = app.slice(ini, fim);

  const posCatch = fn.indexOf("}catch(err){");
  assert.ok(posCatch > -1, "o catch existe");
  const bloco = fn.slice(posCatch);
  assert.match(bloco, /A busca da sua carteira falhou/,
    "a falha aparece NA TELA (não só no console) quando o carregamento estava visível");
  assert.match(bloco, /onclick="invalidarLeadsCache\(\);carregarDashboard\(\)"/,
    "com botão de tentar na hora");
  assert.match(bloco, /const t = setTimeout\(\(\) => \{ if\(state\.active === "home" && !state\.itemsAtivos\?\.length\) carregarDashboard\(\); \}, 6000\);/,
    "e nova tentativa sozinha em 6s — nunca mais spinner mudo pra sempre");
  assert.match(bloco, /if\(t && typeof t\.unref === "function"\) t\.unref\(\);/,
    "o timer não segura processo de teste vivo (foi o que travou a suíte na primeira rodada)");
  // Só troca a tela quando o carregamento ainda está nela — carteira já desenhada não é apagada
  // por uma sincronização de fundo que falhou.
  assert.match(bloco, /aindaCarregando && !state\.itemsAtivos\?\.length && !state\.grupoAtivo/,
    "a recuperação só mexe na tela se o 'Carregando…' ainda estiver nela");
}

// ── 2. O caminho irmão (ok:false) continua com a recuperação de sempre ────────────────────────
assert.match(app, /Reconectando… puxando seus leads\./, "o aviso do caminho ok:false continua");
assert.match(app, /setTimeout\(\(\) => \{ if\(state\.active === "home"\) carregarDashboard\(\); \}, 3000\);/,
  "com a nova tentativa a cada 3s");

// ── 3. O vigia de fora (index.html): mesmo com o app.js MORTO, ninguém fica em tela congelada ─
{
  assert.match(index, /VIGIA DO BOOT/, "o vigia existe no próprio HTML");
  assert.match(index, /window\.__cpErroBoot = ""/, "guarda o primeiro erro de JS do boot");
  assert.match(index, /addEventListener\("error"/, "escutando os erros da página");
  assert.match(index, /\}, 30000\);/, "dispara aos 30s");
  assert.match(index, /Carregando os leads/, "só age se a tela ainda estiver no carregamento original");
  assert.match(index, /cp694-espera/, "não atropela o relógio de espera vivo do app");
  assert.match(index, /a\.querySelector\("button"\)/, "nem uma recuperação que já esteja na tela");
  assert.match(index, /O app não conseguiu terminar de abrir\./, "o aviso diz o que houve");
  assert.match(index, /location\.reload\(\)/, "com botão de tentar de novo");
  assert.match(index, /Detalhe técnico/, "e mostra o erro de JS quando houve — diagnóstico por print");
  assert.match(index, /replace\(\/\[<>\]\/g, ""\)/, "o texto do erro entra sem virar HTML");
}

console.log("v1161-carregando-leads-nunca-congela: ok");
