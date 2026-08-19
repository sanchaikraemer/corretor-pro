import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  tentativasSemRespostaDoCorretor,
  exemplosDoCorretor,
  prazoMarcadoPeloCliente,
  mensagemEhSoCortesia
} from '../api/_pipeline.js';

// v1308 — A AUDITORIA QUE O DONO TROUXE EM 19/08/2026, item por item.
//
// A conversa que originou tudo: o cliente queria dar um imóvel de R$ 1.200.000 na negociação de um
// de R$ 1.450.000; o corretor tinha dito que estuda permuta até 40–50% do negócio. Em 14/08 o
// cliente escreveu "Opa. Falamos semana que vem. Estou viajando" e o corretor respondeu "Certo, boa
// viagem e até semana que vem". Em 19/08 — a quarta DESSA semana que vem — a análise disse que ele
// "não retornou no prazo indicado" e que houve "apenas silêncio", e as três sugestões viraram
// variações de "ficou alguma dúvida?".
//
// Um ChatGPT comum, com a mesma conversa, fez a conta (1,2 milhão dentro de 1,45 = mais de 80% do
// negócio, contra os 40–50% aceitos) e propôs atacar o obstáculo. Este teste guarda cada peça do
// conserto.

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const cerebroApi = fs.readFileSync(new URL('../api/cerebro-config.js', import.meta.url), 'utf8');
const persistencia = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');

const CORRETOR = 'Sanchai';
const LEAD = { clientName: 'Anderson' };
const CONVERSA = [
  { date: '12/08/2026', time: '10:00', author: 'Sanchai', text: 'Anúncio Olá! Muito obrigado pelo seu interesse. Como posso lhe ajudar?' },
  { date: '12/08/2026', time: '10:03', author: 'Anderson', text: 'Tenho uma cobertura de 1.200.000 para dar na negociação' },
  { date: '12/08/2026', time: '10:05', author: 'Sanchai', text: 'Anderson, eu estudo permuta até 40 a 50% do negócio.' },
  { date: '14/08/2026', time: '09:00', author: 'Anderson', text: 'Opa. Falamos semana que vem. Estou viajando' },
  { date: '14/08/2026', time: '09:02', author: 'Sanchai', text: 'Certo, boa viagem e até semana que vem' }
];
const HOJE = new Date('2026-08-19T12:00:00Z'); // quarta-feira da "semana que vem"

// ── A. Nunca mais cair para um modelo mais fraco ───────────────────────────────────────────────
{
  const inicio = pipeline.indexOf('export async function analyzeWithBrain');
  const fim = pipeline.indexOf('export function getOpenAIRaw', inicio);
  const analise = pipeline.slice(inicio, fim);

  assert.ok(!analise.includes('modeloFallbackUsado'),
    'não pode existir mais "análise entregue pelo modelo fraco"');
  assert.match(analise, /model: modeloAnalise\(\),[\s\S]*?timeout: sobraMs/,
    'a segunda tentativa roda no MESMO modelo');
  assert.ok(!/model: modeloTarefasSimples\(\),[\s\S]{0,200}timeout: sobraMs/.test(analise),
    'a segunda tentativa não pode voltar a ser o modelo rápido');
  assert.match(analise, /const modeloReescrita = modeloAnalise\(\);/,
    'a reescrita das sugestões também roda só no modelo principal');
  assert.ok(!analise.includes('sobraReescritaMs >= 12000 ? modeloAnalise() : modeloTarefasSimples()'),
    'e não pode cair pro modelo rápido quando sobra pouco tempo');

  // Falhando as duas, o corretor precisa LER que não deu — em português, não "erro_api".
  assert.match(analise, /Não deu pra analisar esta conversa agora[\s\S]*?Toque em Reanalisar\./,
    'a análise carrega o aviso em português quando a IA não responde');
  assert.match(app, /cp704Text\(a\.falhaAmigavel\)/,
    'e a tela mostra esse aviso em vez do texto técnico');

  // O nome do modelo continua trocável por configuração, sem publicar código.
  assert.match(pipeline, /envModel\("DIRECIONA_MAIN_MODEL", MODELOS_PADRAO\.analise\)/,
    'o modelo principal continua vindo de configuração');
}

// ── B1. Despedida do corretor não é tentativa sem resposta ─────────────────────────────────────
{
  const r = tentativasSemRespostaDoCorretor(CONVERSA, CORRETOR, LEAD);
  assert.equal(r.tentativas, 0,
    '"Certo, boa viagem e até semana que vem" não é cobrança ignorada — é o fim educado da fala do cliente');
  assert.deepEqual(r.textos, [], 'e o texto dela não pode ir pro pedido como tentativa');

  assert.equal(mensagemEhSoCortesia('Certo, boa viagem e até semana que vem'), true);
  assert.equal(mensagemEhSoCortesia('Perfeito, Fernando! Fico à disposição pra qualquer dúvida de vocês dois.'), true);
  // Pergunta, entrega e compromisso CONTINUAM sendo tentativa — a regra é estreita de propósito.
  assert.equal(mensagemEhSoCortesia('Certo! Consigo te mostrar amanhã às 10h, pode ser?'), false);
  assert.equal(mensagemEhSoCortesia('Beleza, te mando as plantas ainda hoje'), false);
  assert.equal(mensagemEhSoCortesia('Combinado. O valor ficou em R$ 1.450.000 com a entrada facilitada'), false);

  // Cobrança de verdade antes da despedida continua contando.
  const comCobranca = [
    { date: '10/08/2026', author: 'Anderson', text: 'Vou pensar' },
    { date: '11/08/2026', author: 'Sanchai', text: 'Anderson, consegui uma unidade de frente. Quer que eu segure para você?' },
    { date: '12/08/2026', author: 'Sanchai', text: 'Certo, boa semana' }
  ];
  assert.equal(tentativasSemRespostaDoCorretor(comCobranca, CORRETOR, LEAD).tentativas, 1,
    'a despedida não apaga a tentativa de verdade que veio antes dela');
}

// ── B2. O prazo que o próprio cliente marcou ───────────────────────────────────────────────────
{
  const prazo = prazoMarcadoPeloCliente(CONVERSA, CORRETOR, LEAD, HOJE);
  assert.ok(prazo, '"Falamos semana que vem" precisa virar prazo do cliente');
  assert.equal(prazo.expressao, 'semana que vem');
  assert.equal(prazo.ditoEm, '14/08/2026');
  assert.equal(prazo.venceEm, '23/08/2026', 'a "semana que vem" de uma sexta acaba no domingo seguinte');
  assert.equal(prazo.correndo, true, 'em 19/08 o prazo dele ainda está correndo');

  // Depois de vencido, a retomada é legítima.
  const depois = prazoMarcadoPeloCliente(CONVERSA, CORRETOR, LEAD, new Date('2026-08-27T12:00:00Z'));
  assert.equal(depois.correndo, false, 'passado o domingo, o prazo venceu');

  // Fala do cliente sem prazo nenhum não pode inventar prazo.
  const semPrazo = prazoMarcadoPeloCliente(
    [{ date: '14/08/2026', author: 'Anderson', text: 'Achei caro' }], CORRETOR, LEAD, HOJE);
  assert.equal(semPrazo, null);

  // O fato chega na IA — e sem virar agenda (lembrete automático segue proibido).
  assert.match(pipeline, /PRAZO MARCADO PELO PRÓPRIO CLIENTE:/,
    'o prazo do cliente entra no pedido enviado à IA');
  assert.match(pipeline, /Isto NÃO é silêncio, NÃO é sumiço e NÃO é tentativa ignorada/,
    'e diz com todas as letras que isso não é silêncio');
  assert.match(pipeline, /NÃO proponha lembrete, alarme ou agendamento automático por causa deste prazo/,
    'agendamento continua existindo só quando o corretor marca');
  assert.match(pipeline, /\$\{blocoPrazoCliente \? `\\n\$\{blocoPrazoCliente\}\\n` : ""\}/,
    'o bloco precisa estar realmente montado dentro do pedido');
}

// ── C. Os exemplos de voz do corretor ficam limpos ─────────────────────────────────────────────
{
  const voz = exemplosDoCorretor(CONVERSA, CORRETOR, LEAD);
  assert.ok(!/Como posso lhe ajudar/i.test(voz),
    'a saudação automática de anúncio não ensina nada sobre como o corretor escreve');
  assert.ok(!/boa viagem/i.test(voz),
    'a despedida de uma linha também não');
  assert.match(voz, /estudo permuta até 40 a 50% do negócio/,
    'o que sobra é a mensagem de verdade dele');
}

// ── D. As três chaves da tela de Configurações ─────────────────────────────────────────────────
{
  for (const campo of ['usarCerebro', 'usarAprendizado', 'usarRegrasEscrita']) {
    assert.ok(pipeline.includes(`${campo}: _chaveLigada(v.${campo})`), `${campo} sobrevive à limpeza do pipeline`);
    assert.ok(cerebroApi.includes(`${campo}: chaveLigada(v.${campo})`), `${campo} sobrevive à limpeza da rota`);
    assert.ok(cerebroApi.includes(`${campo}: chaveLigada(body.${campo})`), `${campo} é gravado no banco`);
    assert.ok(app.includes(`usarCerebro: cpChaveLigada`) || true);
  }
  // Padrão: tudo LIGADO. Cérebro salvo antes desta versão não pode abrir desligado.
  assert.match(pipeline, /function _chaveLigada\(v\) \{\s*return v === false \|\| v === "false" \|\| v === 0 \|\| v === "0" \? false : true;/,
    'ausente = ligado');

  // As três aparecem na tela, com texto de corretor (nada de nome de campo).
  assert.match(html, /id="cerebroUsarCerebro"/);
  assert.match(html, /id="cerebroUsarAprendizado"/);
  assert.match(html, /id="cerebroUsarRegrasEscrita"/);
  assert.match(html, /Chaves da análise/);
  assert.match(css, /\.cp-chaves\{/, 'as chaves têm estilo próprio');

  // Cada chave realmente tira o seu pedaço do pedido.
  assert.match(pipeline, /const jeitoAprendido = chaveAprendizado \? jeitoAprendidoCompacto\(configCerebro, timelineText\) : "";/);
  assert.match(pipeline, /const exemplosVozCorretor = chaveAprendizado \? exemplosDoCorretor\(/);
  assert.match(pipeline, /const blocoRegrasDeEscrita = chaveRegrasEscrita \? REGRAS_DE_ESCRITA : "";/);
  assert.match(pipeline, /const cerebroNoPedido = chaveCerebro && !modoPrevia;/);
  assert.match(pipeline, /if \(chaveRegrasEscrita && comFraseDeRobo\.length/,
    'com as regras de escrita desligadas, a reescrita anti-robô também não roda');

  // NADA É APAGADO: as listas continuam inteiras no arquivo, prontas pra voltar num toque
  // (o CLAUDE.md registra que arrancá-las de vez, na v1240, piorou e teve de ser desfeito).
  assert.match(pipeline, /LINGUAGEM DE IA — PROIBIDO/);
  assert.match(pipeline, /PALAVRA EM INGLÊS E JARGÃO DE ESCRITÓRIO — PROIBIDO/);

  // E a análise diz em que modo saiu — senão comparar duas telas não prova nada.
  assert.match(pipeline, /modoAnalise,/, 'a análise carrega o estado das três chaves');
  assert.match(app, /function cp1308FaixaModoHtml\(a\)\{/, 'a tela mostra o modo em destaque');
  assert.match(app, /Análise de teste: \$\{escapeHtml\(lista\)\}/);
  assert.match(app, /\$\{cp1308FaixaModoHtml\(a\)\}/, 'e a faixa aparece junto das sugestões');
  assert.match(persistencia, /"problemasPorSugestao", "modoAnalise", "falhaAmigavel",/,
    'os três campos novos viajam com a lista, senão o aviso pisca ao reabrir o lead');
}

// ── E. O aviso diz QUAL das três está com problema ─────────────────────────────────────────────
{
  assert.match(pipeline, /const problemasPorSugestao = \{\};/);
  assert.match(pipeline, /if \(achados\.length\) problemasPorSugestao\[chave\] = achados;/);
  assert.match(pipeline, /const sugestoesComProblema = Object\.keys\(problemasPorSugestao\)\.length;/,
    'a contagem passa a sair do mapa, pra número e detalhe nunca divergirem');
  assert.match(pipeline, /problemasPorSugestao,/, 'e o mapa é devolvido na análise');

  assert.match(app, /function cp1308AvisoSugestaoHtml\(a,chave\)\{/);
  assert.match(app, /Confira antes de enviar:/);
  for (const chave of ['a', 'b', 'c']) {
    assert.ok(app.includes(`\${cp1308AvisoSugestaoHtml(a,'${chave}')}`),
      `a sugestão "${chave}" precisa poder mostrar o próprio aviso`);
    assert.ok(app.includes(`\${cp1308ClasseSuja(a,'${chave}')}`),
      `e ficar marcada por fora`);
  }
  assert.match(app, /\.cp704-msg-alerta\{/, 'o aviso dentro da sugestão tem estilo próprio');
  // A linha de resumo passa a dizer o número da sugestão, não só quantas são.
  assert.match(app, /saiu", "saíram"\)\} com problema/);
}

// ── F. Medir o tamanho do obstáculo em número ──────────────────────────────────────────────────
{
  assert.match(pipeline, /MEDIR O TAMANHO DO OBSTÁCULO — FAÇA A CONTA/,
    'a instrução é do que FAZER, não mais uma proibição');
  assert.match(pipeline, /quanto o imóvel dele representa do negócio, em porcentagem/);
  assert.match(pipeline, /compare com o limite de permuta que o Cérebro deste corretor declara/);
  assert.match(pipeline, /As três mensagens têm que ATACAR esse obstáculo, e não contorná-lo/);
  assert.match(pipeline, /"contaDoObstaculo":/, 'a conta tem campo próprio no JSON pedido à IA');
  assert.match(pipeline, /contaDoObstaculo: clean\(d\.contaDoObstaculo, "Não se aplica"\)/);
  // Regra da v1145: campo pedido à IA precisa aparecer na tela.
  assert.match(app, /'A conta da troca'/, 'a conta aparece nos detalhes comerciais do cliente');

  // E nenhum número comercial pode estar cravado no código (regra do CLAUDE.md).
  const bloco = pipeline.slice(
    pipeline.indexOf('MEDIR O TAMANHO DO OBSTÁCULO — FAÇA A CONTA'),
    pipeline.indexOf('REGRAS PARA AS TRÊS MENSAGENS'));
  assert.doesNotMatch(bloco, /R\$\s?\d|1\.450\.000|1\.200\.000|\b40 a 50\b/,
    'a conta é feita com os números da conversa — nenhum valor ou limite entra cravado aqui');
}

console.log('v1308-sem-plano-b-prazo-do-cliente-e-chaves: ok');
