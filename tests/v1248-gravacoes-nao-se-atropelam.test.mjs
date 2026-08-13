import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1248 — quatro defeitos do servidor, todos da mesma família: gravação que atropela gravação, e
// trabalho pesado no lugar errado.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const reanalisar = fs.readFileSync(new URL('../api/reanalisar-lead.js', import.meta.url), 'utf8');
const leadUpdate = fs.readFileSync(new URL('../api/lead-update.js', import.meta.url), 'utf8');
const recentes = fs.readFileSync(new URL('../api/leads-recentes.js', import.meta.url), 'utf8');
const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// ── 1. A trava da reanálise precisa usar a coluna que a própria gravação escreve ─────────────
//
// Ela comparava "updated_at" — coluna que esta rota NUNCA escreve (a gravação usa
// "atualizado_em"). Ou seja, a trava deixava as duas passarem: reanalisar o mesmo cliente no
// celular e no computador (ou tocar duas vezes achando que travou) fazia a segunda apagar a
// primeira em silêncio, com as duas respondendo "deu certo".
assert.match(reanalisar, /const freshMarca = freshRow\?\.atualizado_em;/,
  'a trava da reanálise tem que ler "atualizado_em"');
assert.match(reanalisar, /finalQuery = freshMarca \? updateQuery\.eq\("atualizado_em", freshMarca\)/,
  'a trava tem que comparar "atualizado_em" — a marca que TODA gravação de análise atualiza');
assert.doesNotMatch(reanalisar, /eq\("updated_at"/,
  'nenhuma trava pode voltar a comparar "updated_at": esta rota não escreve essa coluna');

// Toda gravação de análise do sistema mexe em "atualizado_em" — é o que faz a trava valer.
for (const [nome, fonte] of [['reanalisar-lead.js', reanalisar], ['lead-update.js', leadUpdate]]) {
  // Pega o corpo de cada .update(...) até o primeiro .eq( que o encadeia — assim funciona também
  // com objeto de várias linhas e com chave aninhada dentro (o match por chaves quebrava nos dois).
  for (const pedaco of fonte.split('.update(').slice(1)) {
    const corpo = pedaco.slice(0, Math.max(0, pedaco.indexOf('.eq(')) || 700);
    if (!/resultado_analise/.test(corpo)) continue;
    assert.match(corpo, /atualizado_em/, `${nome}: gravação de análise sem "atualizado_em" quebraria a trava -> ${corpo.slice(0, 120)}`);
  }
}

// ── 2. A releitura antes de salvar não pode ter o erro descartado ────────────────────────────
//
// Descartado, o código seguia com a cópia lida no INÍCIO da requisição. Como a reanálise leva
// dezenas de segundos (é a IA trabalhando), o nome do cliente corrigido ou a observação salva
// nesse meio-tempo voltavam ao valor antigo — em silêncio, respondendo "deu certo".
assert.match(reanalisar, /const \{ data: freshRow, error: freshErr \} = await supabase/,
  'a releitura antes de salvar precisa capturar o erro');
assert.match(reanalisar, /if \(freshErr\) \{[\s\S]{0,300}?Nada foi alterado/,
  'falhando a releitura, a rota tem que recusar e pedir pra tentar de novo — nunca gravar por cima com dado velho');

// ── 3. Copiar a mensagem: as duas gravações em SEQUÊNCIA, nunca em paralelo ──────────────────
//
// As duas escrevem no MESMO campo do cliente lendo antes de escrever. Em paralelo, uma apagava a
// outra: ora sumia o atendimento (o cliente voltava pra fila "Fazer agora" como se você nunca
// tivesse falado com ele), ora sumia o contador de "Mensagens copiadas" do Desempenho.
const inicioHero = app.indexOf('window.copiarMensagemLead = function');
assert.ok(inicioHero > 0, 'não achei copiarMensagemLead');
const hero = app.slice(inicioHero, app.indexOf('\n};', inicioHero));
const posAtendimento = hero.indexOf('await registrarMensagemEnviada');
const posContador = hero.indexOf('evento:"mensagem_copiada"');
assert.ok(posAtendimento > 0, 'o atendimento tem que ser aguardado (await)');
assert.ok(posContador > posAtendimento,
  'o ATENDIMENTO vai primeiro: se só uma gravação sobreviver (o app vai pro fundo ao ir pro WhatsApp), que seja a que importa');
assert.match(hero, /keepalive:true/,
  'a segunda gravação precisa de keepalive — copiar é exatamente quando o app sai da frente');

// ── 4. Apagar cliente não baixa mais a carteira inteira ──────────────────────────────────────
//
// Rodava uma reconstrução que lê a CONVERSA COMPLETA de até 3.000 clientes, DEPOIS do apagar já
// efetivado: numa carteira grande estourava o tempo da função e o corretor via erro — com o
// cliente já apagado. E o resultado dessa reconstrução não é lido em lugar nenhum do sistema.
const apagar = leadUpdate.slice(leadUpdate.indexOf('async function acaoApagar('));
assert.doesNotMatch(apagar.slice(0, apagar.indexOf('\n}\n')), /await aprenderRespostasDaCarteira\(/,
  'apagar cliente não pode disparar varredura da carteira inteira');
assert.doesNotMatch(pipeline.replace(/aprenderRespostasDaCarteira/g, ''), /corretor-respostas["'][\s\S]{0,40}select/,
  'a lista "corretor-respostas" continua sem nenhum leitor — não reintroduza trabalho pesado pra alimentá-la');
assert.match(leadUpdate, /\.not\("resultado_analise->oportunidadesVinculadas", "is", null\)/,
  'a limpeza de vínculos tem que pedir ao banco só quem tem vínculo, não a carteira toda');
assert.match(leadUpdate, /if \(error\) \(\{ data: rows, error \} = await base\(\)\.limit\(5000\)\);/,
  'se o banco não aceitar o filtro dentro do JSON, cai na varredura antiga — nunca deixa de limpar o vínculo');

// ── 5. O cache da listagem tem teto e faxina ─────────────────────────────────────────────────
assert.match(recentes, /function guardarNoCache\(chave, result\)/, 'o cache precisa de uma porta única de gravação');
assert.match(recentes, /if \(agora - v\.ts >= CACHE_TTL_MS\) responseCache\.delete\(k\)/, 'entrada vencida tem que sair da memória');
assert.match(recentes, /while \(responseCache\.size > CACHE_MAX_ENTRADAS\)/, 'o cache precisa de teto');
assert.doesNotMatch(recentes, /responseCache\.set\(cacheKey/, 'nenhuma gravação direta pode escapar da faxina');

// ── 6. Backup completo sem a segunda cópia inteira na memória ────────────────────────────────
assert.doesNotMatch(recentes, /JSON\.stringify\(payload, null, 2\)/,
  'o backup não pode ser indentado: a indentação monta uma segunda cópia inteira da carteira na memória');

console.log('v1248-gravacoes-nao-se-atropelam: ok');
