import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1250 — LER O PRINT DA RESPOSTA DO CLIENTE.
//
// Pedido do dono: "quando vem poucas respostas do cliente, em vez de ter que reimportar tudo de
// novo e demorar, só dar um print na resposta, colocar em observação e ele transcrever e salvar".
//
// ISTO NÃO É A VOLTA DO QUE A v1069 REMOVEU. Lá existiam "extrair lead de um print" e "ler conversa
// por vários prints", que tentavam RECONSTRUIR sozinhas o cadastro e a conversa a partir de
// imagens — nunca funcionaram bem e o dono mandou tirar. Aqui a IA faz UMA coisa: passar pra texto
// o que está escrito na imagem. Ela não cria lead, não muda etapa e não grava nada: o texto cai no
// campo de observação e só entra no sistema quando o corretor confere e toca em "Salvar observação".
// Este teste tranca essa fronteira.

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const cerebro = fs.readFileSync(new URL('../api/cerebro-config.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const { lerPrintDaConversa, limitePrintDoDia, limitePrintDoDiaTeste, PRINT_MAX_BYTES } =
  await import('../api/_pipeline.js');

// ── 1. A leitura funciona de verdade (não é só código conferido por leitura) ─────────────────
const PNG_1PX = 'iVBORw0KGgoAAQAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function openaiFalso(resposta, capturar) {
  return {
    chat: { completions: { create: async (params) => {
      if (capturar) capturar(params);
      return { model: 'gpt-4o', usage: {}, choices: [{ message: { content: resposta } }] };
    } } }
  };
}

{
  let visto = null;
  const texto = await lerPrintDaConversa(PNG_1PX, 'image/png', openaiFalso(
    'Cliente: Consegui falar com meu marido, pode marcar sábado (14:02)\nEu: Perfeito, confirmo então (14:05)',
    (p) => { visto = p; }
  ), 'org-1');

  assert.equal(texto, 'Cliente: Consegui falar com meu marido, pode marcar sábado (14:02)\nEu: Perfeito, confirmo então (14:05)',
    'o texto lido volta inteiro, sem mexer');

  // A imagem viaja no formato que a API de visão espera, e o modelo é o de visão do projeto.
  const conteudo = visto.messages[0].content;
  const imagem = conteudo.find(c => c.type === 'image_url');
  assert.ok(imagem, 'a imagem precisa ir junto do pedido');
  assert.match(imagem.image_url.url, /^data:image\/png;base64,/, 'a imagem vai como data URL com o tipo certo');
  assert.equal(visto.model, 'gpt-4o');
  assert.ok(!('temperature' in visto), 'o projeto proíbe fixar temperature nas chamadas de IA (v855)');

  // A instrução tem que segurar a IA na transcrição — nada de resumir, completar ou inventar.
  const instrucao = conteudo.find(c => c.type === 'text').text;
  for (const exigido of ['Transcreva SOMENTE', 'sem corrigir, resumir, completar', 'não invente', 'Cliente:', 'Eu:']) {
    assert.ok(instrucao.includes(exigido), `a instrução precisa conter "${exigido}"`);
  }
}

// Print sem texto legível não vira invenção: volta vazio, e a rota transforma isso em aviso.
{
  const vazio = await lerPrintDaConversa(PNG_1PX, 'image/png', openaiFalso('SEM TEXTO'), 'org-1');
  assert.equal(vazio, '', 'sem texto legível, não pode devolver nada');
  assert.match(cerebro, /if \(!texto\) return json\(res, 200, \{ ok: false, error: "Não achei texto de mensagem nesse print/,
    'a rota precisa avisar em português quando o print não tem texto');
}

// ── 2. Recusas com aviso claro, antes de gastar IA ───────────────────────────────────────────
await assert.rejects(() => lerPrintDaConversa('', 'image/png', openaiFalso('x')), /Imagem não recebida/);
await assert.rejects(() => lerPrintDaConversa(PNG_1PX, 'application/pdf', openaiFalso('x')), /Formato de imagem não aceito/);
await assert.rejects(() => lerPrintDaConversa('A'.repeat(9 * 1024 * 1024), 'image/png', openaiFalso('x')), /grande demais/);
assert.equal(PRINT_MAX_BYTES, 5 * 1024 * 1024);

// ── 3. Teto diário por conta, como a transcrição de voz já tem ───────────────────────────────
assert.ok(limitePrintDoDia() > 0 && limitePrintDoDiaTeste() > 0, 'os dois tetos precisam existir');
assert.ok(limitePrintDoDiaTeste() < limitePrintDoDia(), 'conta em teste tem teto menor');
assert.match(cerebro, /verificarLimiteDiario\(organizationId, "cerebro-leitura-print", limitePrintDoDia\(\), limitePrintDoDiaTeste\(\)\)/,
  'a ação precisa passar pelo teto diário antes de chamar a IA');

// O custo entra no relatório de uso de IA, como toda chamada do projeto.
assert.match(pipeline, /registrarUsoIA\(\{ organizationId, kind: "chat", model: completion\?\.model \|\| modeloUsado, rota: "ler-print-conversa"/,
  'o custo desta leitura precisa ser registrado');

// ── 4. A FRONTEIRA: a IA lê, quem grava é o corretor ─────────────────────────────────────────
const acao = cerebro.slice(cerebro.indexOf('if (body.action === "ler-print")'));
const corpoAcao = acao.slice(0, acao.indexOf('\n    }\n') + 6);
for (const proibido of ['.update(', '.insert(', '.upsert(', '.delete(']) {
  assert.ok(!corpoAcao.includes(proibido), `a leitura de print não pode gravar nada no banco (achei "${proibido}")`);
}
assert.ok(!corpoAcao.includes('etapa'), 'a leitura de print não pode mexer na etapa do cliente');

// No app, o texto lido vai pro MESMO campo de observação do ditado por voz — e o aviso manda conferir.
assert.match(app, /ta\.value = \(ta\.value\.trim\(\) \? ta\.value\.trim\(\)\+"\\n" : ""\) \+ data\.texto;[\s\S]{0,200}Confira o texto acima/,
  'o texto lido entra no campo de observação com aviso pra conferir antes de salvar');
assert.match(app, /action:"ler-print", imagemBase64: base64, mime/, 'o app precisa chamar a ação nova');

// ── 5. A imagem é reduzida NO APARELHO antes de subir ────────────────────────────────────────
// Print de celular passa de 3 MB; subir cru numa rede de rua é o caminho certo pro pedido morrer.
assert.match(app, /const CP1250_LADO_MAX = 1600;/, 'a imagem precisa ser reduzida antes de subir');
assert.match(app, /cv\.toDataURL\("image\/jpeg", 0\.85\)/, 'reduz e recomprime como JPEG');

// ── 6. Os dois caminhos de entrada existem: escolher o arquivo e COLAR (Ctrl+V) ──────────────
assert.match(app, /id="cp1250PrintInput"[^>]*onchange="cp1250LerPrint\(this\)"/, 'o seletor de imagem precisa existir');
assert.match(app, /onclick="document\.getElementById\('cp1250PrintInput'\)\?\.click\(\)"/,
  'o botão usa document.getElementById — "qs" NÃO existe no escopo de um onclick do HTML (app.js é módulo)');
assert.match(app, /window\.cp1250LerPrint = cp1250LerPrint;/, 'a ponte pro onclick precisa existir');
assert.match(app, /document\.addEventListener\("paste"/, 'colar o print direto no campo precisa funcionar');

// O input zera o valor: sem isso, escolher o MESMO print de novo (depois de um erro) não faz nada.
assert.match(app, /if\(input\) input\.value = "";\s*\n\s*cp1250EnviarPrint\(file\);/,
  'o seletor precisa ser zerado pra aceitar o mesmo arquivo duas vezes');

console.log('v1250-ler-print-da-resposta: ok');
