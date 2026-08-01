import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1099 — print do dono: apertava apagar e voltava "Erro: Lead não encontrado", repetidamente,
// sem o cliente nunca sair da tela. "pq nao ta deletando esse lead?"
//
// "Não encontrado" significa que o cadastro JÁ NÃO ESTÁ no banco (apagado antes, ou fundido com
// outro numa reimportação) — mas a lista carregada no aparelho ainda tinha a cópia. O app pedia
// pra apagar algo que não existe e o servidor recusava, com razão.
//
// O resultado que o corretor quer (o cliente fora da lista) JÁ É VERDADE no banco. Então o app
// precisa tirar o fantasma da tela, não repetir erro pra sempre.

function extrair(re, oQue) {
  const m = app.match(re);
  assert.ok(m, `não localizei ${oQue}`);
  return m[0];
}

// ── 1. As DUAS formas de apagar tratam "não existe mais" ──────────────────────────────────────
{
  for (const [nome, re] of [
    ['apagarLead', /async function apagarLead\(id, nome\)\{[\s\S]*?\n\}/],
    ['excluirLeadDefinitivo', /async function excluirLeadDefinitivo\(id, nome\)\{[\s\S]*?\n\}/]
  ]) {
    const fn = extrair(re, nome);
    assert.match(fn, /cpLeadJaNaoExiste\(res, data\)/,
      `${nome} precisa reconhecer quando o cliente já não existe no banco`);
    assert.match(fn, /cpSumirComLeadFantasma\(id\)/,
      `${nome} precisa tirar o fantasma da tela em vez de só mostrar erro`);
  }
}

// ── 2. O reconhecimento funciona de verdade (404 e a mensagem do servidor) ────────────────────
{
  const { cpLeadJaNaoExiste } = eval(`${extrair(/function cpLeadJaNaoExiste\(res, data\)\{[\s\S]*?\n\}/, 'cpLeadJaNaoExiste')}\n({ cpLeadJaNaoExiste });`);

  assert.equal(cpLeadJaNaoExiste({ status: 404 }, {}), true, '404 quer dizer que não existe mais');
  assert.equal(cpLeadJaNaoExiste({ status: 200 }, { error: 'Lead não encontrado.' }), true,
    'a mensagem exata do servidor precisa ser reconhecida — foi a do print');
  assert.equal(cpLeadJaNaoExiste({ status: 200 }, { error: 'Lead nao encontrado' }), true,
    'sem acento também (nunca depender de acentuação)');

  // E o que NÃO pode ser confundido com "já não existe": erro de verdade, que precisa aparecer.
  for (const erro of ['Supabase não configurado.', 'connection reset by peer', 'Etapa inválida', '']) {
    assert.equal(cpLeadJaNaoExiste({ status: 500 }, { error: erro }), false,
      `"${erro}" é falha de verdade — não pode fazer o cliente sumir da tela como se tivesse sido apagado`);
  }
}

// ── 3. Sumir com o fantasma = limpar as listas E sair da tela dele ────────────────────────────
{
  const fn = extrair(/function cpSumirComLeadFantasma\(id\)\{[\s\S]*?\n\}/, 'cpSumirComLeadFantasma');

  assert.match(fn, /removerLeadDosCaches\(id\)/, 'precisa tirar das listas guardadas no aparelho');
  assert.match(fn, /invalidarLeadsCache\(\)/, 'e forçar a próxima leitura a vir do servidor');
  assert.match(fn, /loadRecentLeads\(true\)/, 'e recarregar a lista pra a tela ficar coerente');
  assert.match(fn, /state\.lead = null/, 'se o cliente estiver aberto, precisa fechar');
  assert.match(fn, /show\("home"\)/, 'e voltar pra Home — não dá pra ficar num cliente que não existe');
  assert.match(fn, /j[áa] n[ãa]o existia/i,
    'e precisa DIZER o que houve, em português — não sumir calado nem repetir "erro"');

  // Só fecha a tela se for o cliente que está aberto.
  assert.match(fn, /state\.focoLeadId\|\|""\) === String\(id\)|String\(id\)/,
    'a tela só pode ser fechada se for justamente esse cliente que está aberto');
}

console.log('v1099-lead-fantasma-some-da-lista: ok');
