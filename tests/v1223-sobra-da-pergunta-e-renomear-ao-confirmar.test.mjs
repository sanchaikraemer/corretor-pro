import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const importacao = fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
const leadUpdate = fs.readFileSync(new URL('../api/lead-update.js', import.meta.url), 'utf8');

// v1223 — mais dois relatos do mesmo minuto (dono, 11/08/2026, 19h33).

// ══ 1. "tá aparecendo uma tela nada a ver antes de começar a importação (e antes não tinha)" ══
//
// Era a caixa de decisão do topo, criada na v1220, SOBRANDO na tela: ela nasce quando a
// importação precisa de resposta, mas ninguém a fechava depois que o assunto acabava. Resultado:
// o corretor voltava pra tela de importação e encontrava a pergunta do cliente ANTERIOR — já
// respondida — de pé, antes mesmo de escolher o arquivo novo.
{
  assert.match(importacao, /function cpFecharPerguntaTopo\(\)\{[\s\S]{0,200}caixa\.hidden = true;/,
    'precisa existir um único jeito de fechar a caixa de decisão');

  // Fecha quando o cliente abre (resposta dada, assunto encerrado)...
  const aoAbrir = importacao.slice(importacao.indexOf('async function cpioFecharQuandoLeadAbrir(id){'));
  assert.ok(aoAbrir.slice(0, 700).includes('cpFecharPerguntaTopo()'),
    'ao abrir o cliente, a pergunta respondida some da tela de importação');
  // ...e quando ele descarta a importação.
  const aoDescartar = importacao.slice(importacao.indexOf('async function descartarLeadPendente(){'));
  assert.ok(aoDescartar.slice(0, 900).includes('cpFecharPerguntaTopo()'),
    'descartar a importação também fecha a pergunta');
  // Começar uma importação nova já limpava (clearAnalysis, v1220) — segue valendo.
  const limpar = app.slice(app.indexOf('export function clearAnalysis(){'), app.indexOf('// Limpa nomes longos'));
  assert.match(limpar, /cpPerguntaTopo\.hidden=true;/, 'importação nova continua limpando a caixa');
}

// ══ 2. "quando clicar q é o mesmo e atualizar, já altere o nome no sistema" ══════════════════
//
// A pergunta "é o mesmo cliente?" voltava a cada importação do MESMO cliente: o cadastro ficava
// com o nome curto e o arquivo exportado trazia o longo, então eles seguiam "parecidos mas não
// idênticos" pra sempre. A caixa até PROMETIA o renomear — e ele não acontecia, porque a regra
// geral (correta) protege o nome curado na carteira contra o nome bagunçado do WhatsApp.
{
  // O app só pede o renomear quando houve RESPOSTA do corretor (nome só parecido).
  assert.match(importacao, /state\.pendingNomeSoParecido = nomeSoParecido;/, 'o app marca que a decisão foi respondida por ele');
  assert.match(importacao, /\.\.\.\(state\.pendingNomeSoParecido && state\.pendingNomeImportado \? \{ renomearPara: state\.pendingNomeImportado \} : \{\}\)/,
    'o renomear só viaja no caso em que ele respondeu "é o mesmo"');

  // E o servidor só renomeia nesse caso — a proteção do nome curado continua valendo no resto.
  const trecho = leadUpdate.slice(leadUpdate.indexOf('const renomearPara = String(body?.renomearPara'), leadUpdate.indexOf('const updatePayload = {'));
  assert.match(trecho, /if \(renomearPara && !nomeRuim\(renomearPara\)\) \{/, 'nome ruim (vazio, "cliente importado", telefone) nunca vira nome de cadastro');
  assert.match(trecho, /merged\.clientName = renomearPara;/, 'renomeia o cadastro');
  assert.match(trecho, /nomeParaColuna = renomearPara;/, 'e marca pra atualizar também a coluna de busca');
  assert.match(trecho, /\} else if \(nomeCorrigido\) \{/, 'sem pedido explícito, a correção automática de nome (v1179) segue mandando');
  assert.match(trecho, /\} else if \(!nomeRuim\(nomeAnterior\)\) \{/, 'e o nome curado na carteira continua protegido');

  // Os dois lugares onde o nome vive precisam andar juntos, senão a busca mostra um e a tela outro.
  assert.match(leadUpdate, /if \(nomeParaColuna\) updatePayload\.nome_cliente = nomeParaColuna;/, 'a coluna de nome também é atualizada');
  // Banco antigo sem a coluna não pode derrubar a atualização inteira.
  assert.match(leadUpdate, /if \(putErr && nomeParaColuna && \/column \.\* does not exist\|nome_cliente\/i\.test\(putErr\.message \|\| ""\)\) \{/,
    'banco sem a coluna refaz a gravação sem ela em vez de falhar');
  assert.match(leadUpdate, /const \{ nome_cliente, \.\.\.semNome \} = updatePayload;/, 'na segunda tentativa, sem o campo que não existe');
}

console.log('v1223-sobra-da-pergunta-e-renomear-ao-confirmar: ok');
