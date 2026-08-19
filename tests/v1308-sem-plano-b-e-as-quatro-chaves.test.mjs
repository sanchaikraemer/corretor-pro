import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1308 (o que sobreviveu à volta da análise na v1315) — DUAS ORDENS DO DONO QUE NÃO SE DESFAZEM:
//
//   A) "nunca mais cair para um modelo mais fraco". A análise não troca o modelo principal por um
//      barato quando aperta: repete no MESMO modelo (erro passageiro) ou falha avisando em
//      português. A única troca permitida é quando a conta não TEM o modelo — e aí a tela diz.
//   B) As chaves da análise, que ele usa pra comparar o resultado com e sem cada peça. A quarta
//      (o manual de vendas do app) entrou na v1310.
//
// O resto da v1308 (prazo do cliente, cortesia, exemplos de voz filtrados) saiu junto com a volta
// da análise ao estado de 17/08 — ver NOTAS-v1315.md.

const raiz = new URL('../', import.meta.url);
const pipeline = fs.readFileSync(new URL('api/_pipeline.js', raiz), 'utf8');
const index = fs.readFileSync(new URL('index.html', raiz), 'utf8');

// ── A. Nunca um modelo mais fraco em silêncio ────────────────────────────────────────────────
{
  const ini = pipeline.indexOf('const orcamentoAnaliseMs');
  const fim = pipeline.indexOf('const parsedRaw = r.parsed;', ini);
  const bloco = pipeline.slice(ini, fim);
  assert.ok(ini > -1 && fim > ini, 'o miolo das tentativas da análise não foi encontrado');

  assert.doesNotMatch(bloco, /modeloTarefasSimples\(\)/,
    'a queda pro modelo rápido não pode voltar — foi ordem direta do dono');
  assert.equal((bloco.match(/model: modeloAnalise\(\)/g) || []).length, 2,
    'as duas tentativas rodam no MESMO modelo principal');
  assert.match(bloco, /const morreuDeTempo = String\(erroPrincipal\?\.code \|\| ""\) === "ETIMEDOUT";/,
    'timeout não vira segunda tentativa: repetir chamada lenta falha igual');
  assert.match(bloco, /modeloIndisponivelParaAConta\(erroPrincipal\)/,
    'a única troca permitida é quando a conta não tem o modelo');
  assert.match(bloco, /model: modeloAnteriorConhecido\(\)/, 'e aí usa o anterior conhecido');
  assert.match(pipeline, /modeloIndisponivel: modeloTrocadoPorIndisponibilidade/,
    'com marca na análise pra a tela avisar em vermelho');

  assert.match(pipeline, /const avisoParaOCorretor = erroDaIAEmPortugues\(detail\)/,
    'falhando, a análise carrega o aviso em português pra tela');
}

// ── B. As chaves da análise ──────────────────────────────────────────────────────────────────
{
  assert.match(pipeline, /const chaveCerebro = configCerebro\?\.usarCerebro !== false;/);
  assert.match(pipeline, /const chaveAprendizado = configCerebro\?\.usarAprendizado !== false;/);
  assert.match(pipeline, /const chaveRegrasEscrita = configCerebro\?\.usarRegrasEscrita !== false;/);
  assert.match(pipeline, /const chavePisoComercial = configCerebro\?\.usarPisoComercial !== false;/);
  assert.match(pipeline, /const cerebroNoPedido = chaveCerebro && !modoPrevia;/,
    'Cérebro desligado significa não enviar o texto dele nesta análise');
  assert.match(pipeline, /const jeitoAprendido = chaveAprendizado \?/, 'aprendizado desligado não vai');
  assert.match(pipeline, /\$\{chaveRegrasEscrita \? `LINGUAGEM DE IA — PROIBIDO/,
    'regras de escrita desligadas tiram a lista de frases proibidas do pedido');
  assert.match(pipeline, /\$\{chavePisoComercial\s*\n?\s*\? `\$\{INTELIGENCIA_CARTEIRA\}/,
    'e o manual de vendas do app só entra com a chave ligada');
  assert.match(pipeline, /modoAnalise,/, 'o modo viaja com a análise pra a tela mostrar a faixa');

  for (const id of ['cerebroUsarCerebro', 'cerebroUsarAprendizado', 'cerebroUsarRegrasEscrita', 'cerebroUsarPisoComercial']) {
    assert.ok(index.includes(`id="${id}"`), `a chave ${id} precisa existir na tela`);
  }
}

console.log('v1308-sem-plano-b-e-as-quatro-chaves: ok');
