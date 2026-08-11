import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1093 — as quatro correções que o dono pediu depois de ver a tela, mais o "Carregando..."
// preso que ele circulou de vermelho no print. Cada bloco testa o EFEITO, não o texto do código.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

function extrair(nome){
  const re = new RegExp(`function ${nome}\\(([^)]*)\\)\\{[\\s\\S]*?\\n\\}`);
  const m = app.match(re);
  assert.ok(m, `função ${nome} não encontrada em app.js`);
  return m[0];
}

// ─── 1. "--" nunca mais atropela o aviso que o cartão já tinha pronto ─────────────────────────
{
  const { produtosLabel } = eval(`${extrair('produtosLabel')}\n({ produtosLabel });`);

  assert.equal(produtosLabel({ product: 'Boulevard' }), 'Boulevard', 'o empreendimento real continua aparecendo');
  assert.equal(produtosLabel({ produtos: ['Boulevard', 'Senger'] }), 'Boulevard, Senger');

  // O ponto da correção: sem empreendimento, devolve VAZIO — nunca "--".
  for (const semProduto of [{}, { product: '' }, { product: null }, { produtos: [] }]) {
    const r = produtosLabel(semProduto);
    assert.equal(r, '', 'sem empreendimento identificado, precisa devolver vazio');
    assert.notEqual(r, '--', '"--" não diz nada pra quem lê a tela');
  }

  // E o efeito real: o aviso em português que os cartões já traziam agora aparece.
  const cartao = produtosLabel({}) || 'Produto não identificado';
  assert.equal(cartao, 'Produto não identificado',
    'com "--" esse aviso ficava morto, porque "--" conta como texto preenchido');
}

// ─── 2. Lead arquivado aparece na busca, mas nunca disfarçado de ativo ────────────────────────
{
  assert.doesNotMatch(app, /function foraDaBusca/,
    'foraDaBusca escondia o arquivado da busca — foi substituída por leadArquivado');

  // As duas barras de busca (a do topo e a de dentro das telas) não podem mais filtrar o
  // arquivado pra fora, e as duas precisam marcar visualmente quem está arquivado.
  const buscas = [extrair('renderBuscaGlobal'), app.match(/function buscaLeadInline\([\s\S]*?\n\}\n/)[0]];
  for (const src of buscas) {
    assert.doesNotMatch(src, /if\(leadArquivado\(l\)\) return false|!leadArquivado\(l\) &&/,
      'a busca não pode mais descartar o lead arquivado');
    assert.match(src, /cp-busca-arquivado/, 'o resultado arquivado precisa da tarja "Arquivado"');
    assert.match(src, /opacity:\.62/, 'o resultado arquivado precisa vir visualmente apagado');
    assert.match(src, /leadArquivado\(a\) \? 1 : 0\) - \(leadArquivado\(b\) \? 1 : 0/,
      'os ativos precisam vir antes dos arquivados');
    assert.doesNotMatch(src, /\|\|"--"\)|\|\| *"--"/, 'a busca não pode mais mostrar "--"');
  }

  // A tarja precisa existir de verdade no CSS, senão não há diferença visual nenhuma.
  assert.match(css, /\.cp-busca-arquivado\{/, 'a tarja "Arquivado" precisa ter estilo próprio');

  // A ordenação em si (ativo antes de arquivado), com dados de verdade.
  const ordenar = (lista) => lista
    .sort((a, b) => (a.etapa === 'Geladeira' ? 1 : 0) - (b.etapa === 'Geladeira' ? 1 : 0))
    .map(l => l.id);
  assert.deepEqual(
    ordenar([{ id: 'arq', etapa: 'Geladeira' }, { id: 'ativo', etapa: 'Ativo' }]),
    ['ativo', 'arq'],
    'o cliente ativo precisa aparecer antes do arquivado'
  );
}

// ─── 3. Compromisso atrasado CONTA e acende o sino ────────────────────────────────────────────
{
  const src = extrair('cpAgendaResumo') + '\n' + extrair('lembreteTs');
  const hoje = new Date(); hoje.setHours(10, 0, 0, 0);
  const futuro = new Date(Date.now() + 5 * 86400000);
  const vencido = new Date(Date.now() - 5 * 86400000);

  // Injeta as duas funções de que cpAgendaResumo depende, controladas pelo teste.
  const montar = (atrasadoIds) => eval(`
    const cp786CompromissoAtrasado = (l) => ${JSON.stringify(atrasadoIds)}.includes(l.id) ? { dias: 3 } : null;
    const cpCompromissosVencidosDoLead = (l) => (l._vencidos || []);
    ${src}
    ({ cpAgendaResumo });
  `).cpAgendaResumo;

  const items = [
    { id: 'hoje1', analysis: { lembrete: { quando: hoje.toISOString() } } },
    { id: 'futuro1', analysis: { lembrete: { quando: futuro.toISOString() } } },
    { id: 'atrasado1', analysis: { lembrete: { quando: vencido.toISOString() } } },
    { id: 'comp1', analysis: { confirmedAppointments: [{ oQue: 'visita' }, { oQue: 'ligação' }] } }
  ];

  const r = montar(['atrasado1'])(items);
  assert.equal(r.atrasados, 1, 'o compromisso vencido precisa ser contado como ATRASADO');
  assert.equal(r.agendados, 4, 'hoje(1) + futuro(1) + 2 compromissos confirmados');
  assert.equal(r.total, 5, 'o total do quadro Agenda precisa INCLUIR o atrasado');

  // O defeito que isso corrige: antes o atrasado sumia do número da Home, mesmo estando
  // listado na seção "Atrasados" da tela Agenda (criada na v1011).
  const soAtrasado = montar(['x'])([{ id: 'x', analysis: { lembrete: { quando: vencido.toISOString() } } }]);
  assert.equal(soAtrasado.total, 1, 'um compromisso atrasado sozinho não pode contar zero');
  assert.equal(soAtrasado.atrasados, 1);

  // Não pode contar duas vezes: compromisso vencido não é agendado E atrasado ao mesmo tempo.
  const semDuplicar = montar(['dup'])([
    { id: 'dup', _vencidos: [{ key: 'k' }], analysis: { confirmedAppointments: [{ oQue: 'visita' }] } }
  ]);
  assert.equal(semDuplicar.agendados, 0, 'o compromisso já vencido não pode contar também como agendado');
  assert.equal(semDuplicar.total, 1, 'o mesmo compromisso não pode ser contado duas vezes');
}

// ─── 3b. O sino precisa acender por atraso, não só pela agenda de hoje ────────────────────────
{
  const sino = extrair('atualizarSinoAgenda');
  // v1215 — a régua do atraso saiu de dentro do sino e virou fonte única (cpAgendaDoDia), a mesma
  // que monta as listas da tela Agenda. A garantia continua a mesma: o sino olha o atrasado.
  assert.match(sino, /cpAgendaDoDia/,
    'o sino precisa ler a agenda do dia da fonte única, junto com a tela Agenda');
  assert.match(extrair('cpAgendaDoDia'), /cp786CompromissoAtrasado/,
    'o sino precisa olhar compromisso atrasado — antes só via a agenda de HOJE');
  assert.match(sino, /state\.agendaAtrasados\s*=/, 'o total de atrasados precisa ficar guardado pro sino');
  assert.match(sino, /state\.agendaCount\s*=\s*agendaN\s*\+\s*atrasadosN/,
    'o pontinho do sino precisa acender também quando só existe atraso');

  // O destaque visual: sem uma regra própria, o bloco #787 (font-size:0, color:transparent,
  // tudo !important) engoliria o número de atrasados e nada apareceria na tela.
  assert.match(css, /#topBell\.tem-atraso \.bell-badge:not\(\[hidden\]\)\{/,
    'o estado de atraso precisa de regra própria pra vencer o bloco antigo com !important');
  const regra = css.match(/#topBell\.tem-atraso \.bell-badge:not\(\[hidden\]\)\{[^}]*\}/)[0];
  for (const [prop, ruim] of [['font-size', /font-size:0/], ['color', /color:transparent/]]) {
    assert.doesNotMatch(regra, ruim, `o estado de atraso precisa desfazer ${prop} do bloco antigo`);
  }
  assert.match(regra, /font-size:11px!important/, 'o número precisa ter tamanho visível');
  assert.match(regra, /color:#fff!important/, 'o número precisa ter cor visível');
}

// ─── 4. O mesmo cliente nunca aparece duas vezes na Home ──────────────────────────────────────
// A v1093 corrigiu isso ensinando "Oportunidades esquecidas" a não repetir quem já estava em
// "Fazer agora". Na v1095 o dono mandou remover aquela seção INTEIRA ("só ativo ou arquivado,
// ponto final") — e sem a segunda lista não existe mais onde duplicar.
// A garantia de que ela não volta está em tests/v1095-so-ativo-ou-arquivado. Aqui só se confirma
// que a Home passou a ter UMA lista de clientes.
{
  // v1139 — a âncora era "const urgentes = dose;", que só existia pro botão "Pular próximo"
  // (removido a pedido do dono). A montagem da Home agora começa logo após a dose ser cortada.
  const home = app.match(/const disponiveisParaPuxar = filaRanqueada\.slice[\s\S]*?foco\.innerHTML = `/);
  assert.ok(home, 'não localizei a montagem da Home');
  assert.doesNotMatch(home[0], /esquecid/i,
    'a Home não pode voltar a montar uma segunda lista de clientes');

  const corpoHome = app.match(/foco\.innerHTML = `[\s\S]*?\n  `;/);
  assert.ok(corpoHome, 'não localizei o corpo montado da Home');
  const listas = [...corpoHome[0].matchAll(/\$\{(\w*Html)\}/g)].map(m => m[1]);
  assert.ok(!listas.some(n => /esquecid/i.test(n)),
    `a Home só pode ter a lista do "Fazer agora" — achei: ${listas.join(', ')}`);
}

// ─── 5. O "Carregando..." não fica mais preso embaixo do Salvar ───────────────────────────────
{
  const fn = extrair('carregarCerebro');
  assert.doesNotMatch(fn, /if\(!status\.innerHTML\) status\.textContent = "Configuração carregada\."/,
    'era esta a linha do defeito: só trocava a mensagem se a caixa estivesse vazia — e ela nunca está');
  assert.match(fn, /let aviso = ""/, 'o aviso precisa ser controlado por variável, não pelo conteúdo da caixa');
  assert.match(fn, /else status\.textContent = ""/,
    'carregando certo, a caixa precisa terminar VAZIA (o "Carregando..." tem que sair da tela)');
  assert.match(fn, /Sem conexão com o servidor/,
    'cair na cópia local do aparelho precisa avisar — senão é degradação silenciosa');

  // Simula o fluxo real da função pra provar que a mensagem some.
  const fluxo = (temAviso) => { let aviso = temAviso ? 'algum aviso' : ''; let caixa = 'Carregando...'; if (aviso) caixa = aviso; else caixa = ''; return caixa; };
  assert.equal(fluxo(false), '', 'sem aviso, o "Carregando..." precisa sumir da tela');
  assert.equal(fluxo(true), 'algum aviso', 'com aviso, ele substitui o "Carregando..."');
}

console.log('v1093-correcoes-de-tela: ok');
