import fs from 'node:fs';
import assert from 'node:assert/strict';
import { erroDaIAEmPortugues } from '../api/_pipeline.js';

// v1310 — DUAS COISAS QUE O DONO PEDIU NA MESMA CONVERSA (19/08/2026).
//
// A) "se eu desligar tudo isso, vai analisar puramente o histórico como o ChatGPT?" — não ia: com
//    as três chaves da v1308 desligadas, o app ainda mandava o manual de condução que vem de
//    fábrica nele (INTELIGENCIA_CARTEIRA). Agora existe a quarta chave; com as quatro desligadas
//    vai só a conversa. O que NUNCA sai são as proteções de não inventar.
//
// B) Print das 15h44: a tela mostrou o motivo certo, mas em inglês e em código —
//    "[HTTP 429 · code=credit_balance_exhausted · type=insufficient_quota] You have no credits
//    remaining..." — e ele respondeu "isso não me resolve nada". Motivo certo, língua errada.

const raiz = new URL('../', import.meta.url);
const pipeline = fs.readFileSync(new URL('api/_pipeline.js', raiz), 'utf8');
const app = fs.readFileSync(new URL('app.js', raiz), 'utf8');
const index = fs.readFileSync(new URL('index.html', raiz), 'utf8');
const cerebroRota = fs.readFileSync(new URL('api/cerebro-config.js', raiz), 'utf8');

// ── 1. O erro da OpenAI vira português com o que fazer (executado) ───────────────────────────
{
  const semCredito = erroDaIAEmPortugues(
    '[HTTP 429 · code=credit_balance_exhausted · type=insufficient_quota] You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing'
  );
  assert.match(semCredito, /SEM CRÉDITOS/, 'precisa dizer, em português, que a conta está sem créditos');
  assert.match(semCredito, /platform\.openai\.com/, 'e onde se resolve');
  assert.match(semCredito, /nada se perdeu|já está guardada|reanalisar/i, 'e tranquilizar: a conversa não se perde');
  assert.doesNotMatch(semCredito, /credit_balance_exhausted|insufficient_quota|HTTP 429/,
    'o código técnico não pode continuar na frase que o corretor lê');

  assert.match(erroDaIAEmPortugues('Rate limit reached for gpt-5 in organization org-x'), /excesso de chamadas/i);
  assert.match(erroDaIAEmPortugues('401 Incorrect API key provided'), /chave de acesso/i);
  assert.match(erroDaIAEmPortugues('The operation was aborted due to timeout'), /não respondeu a tempo/i);
  assert.equal(erroDaIAEmPortugues('coisa nunca vista'), '', 'sem tradução conhecida, devolve vazio e quem chama decide');
  assert.equal(erroDaIAEmPortugues(''), '');
}

// ── 2. E chega na tela pelos dois caminhos ───────────────────────────────────────────────────
{
  assert.match(pipeline, /const traduzido = erroDaIAEmPortugues\(a\.error\) \|\| erroDaIAEmPortugues\(validacao\[0\]\);/,
    'o motivo da análise reaproveitada passa pela tradução');
  assert.match(pipeline, /const avisoParaOCorretor = erroDaIAEmPortugues\(detail\)/,
    'e o aviso da análise que falhou também');
  assert.match(app, /credit_balance_exhausted\|insufficient_quota\|no credits remaining\|quota\|billing/,
    'o app traduz o mesmo erro quando ele chega pela importação');
  // v1314 — o rótulo do botão encurtou (o aviso inteiro foi enxugado a pedido do dono), mas ele
  // continua existindo e apontando pra mesma página.
  assert.match(app, /Página de créditos da OpenAI/,
    'e oferece o botão que leva direto pra página que resolve');
  assert.match(app, /https:\/\/platform\.openai\.com\/settings\/organization\/billing/);
}

// ── 3. A quarta chave existe da tela ao pedido enviado à IA ──────────────────────────────────
{
  assert.match(index, /id="cerebroUsarPisoComercial"/, 'a chave precisa existir na tela do Cérebro');
  assert.match(index, /Usar o manual de vendas do app/, 'com nome que o corretor entende');
  assert.match(index, /igual ao que você cola no ChatGPT/, 'e dizendo pra que serve');
  assert.match(index, /nunca inventar<\/b> preço, prazo, condição ou promessa continua valendo sempre/,
    'e deixando claro o que NÃO é desligável');

  assert.match(cerebroRota, /usarPisoComercial: true,/, 'o padrão é LIGADO (quem nunca mexeu segue igual)');
  assert.match(cerebroRota, /usarPisoComercial: chaveLigada\(v\.usarPisoComercial\)/, 'e ela é normalizada ao ler');
  assert.match(cerebroRota, /usarPisoComercial: chaveLigada\(body\.usarPisoComercial\)/, 'e ao salvar');
  assert.match(app, /usarPisoComercial: cpChaveLigada\(c\.usarPisoComercial\)/, 'o app também normaliza');
  assert.match(app, /const chavePiso = qs\("#cerebroUsarPisoComercial"\)/, 'a tela mostra o estado salvo');

  assert.match(pipeline, /const chavePisoComercial = configCerebro\?\.usarPisoComercial !== false;/,
    'e a análise lê a chave');
  assert.match(pipeline, /\$\{chavePisoComercial\s*\n\s*\? `\$\{INTELIGENCIA_CARTEIRA\}/,
    'o manual de vendas só entra no pedido quando a chave está ligada');
  assert.match(pipeline, /A Inteligência Comercial Base foi DESLIGADA nesta análise pelo próprio corretor/,
    'desligada, o pedido diz isso à IA em vez de simplesmente sumir com o bloco');
  assert.match(pipeline, /pisoComercial: chavePisoComercial/, 'e o modo viaja com a análise');
  assert.match(app, /modo\.pisoComercial === false \? "o manual de vendas do app" : ""/,
    'a faixa de "análise de teste" na tela precisa citar a quarta chave');
}

// ── 4. O que NUNCA sai do pedido, nem com as quatro desligadas ───────────────────────────────
{
  const sistema = pipeline.slice(pipeline.indexOf('const systemPromptAnalise = `'), pipeline.indexOf('=== INÍCIO DO CÉREBRO COMERCIAL ==='));
  assert.match(sistema, /não invente fatos, datas, autoria, materiais, valores, condições, disponibilidade, promessas ou ações/,
    'a proteção de não inventar fica FORA de qualquer chave — é ela que impede preço inventado na tela do cliente');
  assert.match(sistema, /não transforme silêncio em confirmação, aceite, objeção ou diagnóstico psicológico/,
    'e a de não transformar silêncio em aceite também');
}

console.log('v1310-quarta-chave-e-erro-da-ia-em-portugues: ok');
