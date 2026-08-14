import fs from 'node:fs';
import assert from 'node:assert/strict';
import { analyzeWithBrain } from '../api/_pipeline.js';

// v1279 — o print do dono de 14/08/2026 (lead Leila, Renaissance), comparado com o que outra IA
// sugeriu para a MESMA conversa.
//
// A conversa:
//   18/06 — cliente pede as plantas, se interessa pelos andares altos, recebe tudo.
//   16/07 — corretor retoma; a cliente responde: "pensamos que 2030 para a entrega para nós é
//           muito tempo. Queremos um lugar adequado para nossa idade (faixa dos 70 anos).
//           Queremos alguma coisa mais próxima, ou talvez pronta."
//   16/07 — corretor: "Vou buscar algumas opções de imóveis prontos ou com entrega mais próxima…
//           Existe alguma preferência de local ou tipo de apartamento que devo considerar?"
//           → a cliente NÃO respondeu essa pergunta.
//
// As três sugestões do app:
//   1. "…pensando na praticidade para SUA FAIXA DE IDADE…"  → devolveu a idade dela como etiqueta.
//   2. "…tem algum bairro ou detalhe indispensável…?"       → refez a pergunta que ela já ignorou.
//   3. (a única boa: anuncia os exemplos e propõe terça ou quinta de manhã.)
//
// Duas causas no texto de instruções: (a) o ângulo "maisSuave" mandava literalmente "faça a
// pergunta que falta", o que produz a nº 2; (b) não havia regra nenhuma proibindo devolver ao
// cliente o que ele contou de si, nem mandando o corretor ASSUMIR a busca quando o cliente já
// entregou o critério — e nenhuma sobre objeção que o produto não resolve (prazo de entrega).

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// ── 1. O ângulo "maisSuave" não é mais um cheque em branco pra perguntar ─────────────────────
{
  const ini = src.indexOf('- "maisSuave": ângulo consultivo');
  assert.ok(ini > -1, 'a definição do ângulo maisSuave precisa existir');
  const bloco = src.slice(ini, src.indexOf('- "maisDireta"', ini)).replace(/\s+/g, ' ');

  assert.ok(!bloco.includes('faça a pergunta que falta'),
    'era isto que autorizava a sugestão nº 2 do print: "faça a pergunta que falta" não pode voltar');
  assert.ok(bloco.includes('só uma que NUNCA foi feita'),
    'a pergunta que a maisSuave pode carregar precisa ser uma que ainda não foi feita');
  assert.ok(bloco.includes('EMENDADA no que a mensagem entrega'),
    'e ela vai emendada na entrega, nunca solta');
  assert.ok(bloco.includes('"baixa pressão" não é licença pra devolver o trabalho pro cliente'),
    'o ângulo suave não pode virar desculpa pra devolver o trabalho');
}

// ── 2. Cliente que já disse o que quer não recebe pedido de critério de volta ────────────────
{
  const ini = src.indexOf('O CLIENTE JÁ DISSE O QUE QUER — A BUSCA É TRABALHO DO CORRETOR');
  assert.ok(ini > -1, 'a regra precisa existir no pedido enviado à IA');
  const bloco = src.slice(ini, src.indexOf('OBJEÇÃO QUE O PRODUTO NÃO RESOLVE', ini)).replace(/\s+/g, ' ');

  assert.ok(bloco.includes('que tipo de apartamento devo considerar?'),
    'a pergunta real do print precisa estar citada como exemplo do que não fazer');
  assert.ok(bloco.includes('vira PAUTA DESSE ENCONTRO'),
    'o que falta saber é pauta do encontro, não questionário no WhatsApp');
  assert.ok(bloco.includes('DUAS OU\nTRÊS bem escolhidas') || bloco.includes('DUAS OU TRÊS bem escolhidas'),
    'apresentar opções é duas ou três escolhidas, não a carteira inteira');
  // A regra não pode abrir brecha pra mensagem afirmar trabalho que o corretor ainda não fez
  // (v1252 e anteriores: "separei três opções" quando nada foi separado é mentira na boca dele).
  assert.ok(bloco.includes('"vou separar", nunca "já separei"'),
    'a regra precisa manter o verbo no futuro — o corretor não pode dizer que já fez');
}

// ── 3. Objeção que o produto não resolve: troca de produto, não insistência ──────────────────
{
  const ini = src.indexOf('OBJEÇÃO QUE O PRODUTO NÃO RESOLVE = TROCAR DE PRODUTO, NÃO INSISTIR');
  assert.ok(ini > -1, 'a regra da objeção estrutural precisa existir');
  const bloco = src.slice(ini, src.indexOf('O QUE O CLIENTE CONTOU DE SI GUIA A ESCOLHA', ini)).replace(/\s+/g, ' ');

  assert.ok(/prazo de entrega longe demais/.test(bloco),
    'prazo de entrega é justamente o motivo do print — precisa estar na lista');
  assert.ok(bloco.includes('o lead NÃO está perdido'),
    'o lead segue vivo: o que ficou inadequado é o produto, não o interesse');
  assert.ok(bloco.includes('Sem alternativa escrita nas fontes, a mensagem não inventa nenhuma'),
    'sem imóvel nas fontes, é proibido inventar alternativa (regra fundadora do projeto)');
}

// ── 4. O que o cliente contou de si não volta como etiqueta ──────────────────────────────────
{
  const ini = src.indexOf('O QUE O CLIENTE CONTOU DE SI GUIA A ESCOLHA, MAS NÃO VOLTA COMO ETIQUETA');
  assert.ok(ini > -1, 'a regra do dado pessoal precisa existir');
  const bloco = src.slice(ini, ini + 1400).replace(/\s+/g, ' ');

  assert.ok(bloco.includes('"pensando na sua faixa de idade"'),
    'a frase exata do print precisa estar proibida');
  assert.ok(bloco.includes('"pela idade de vocês"') && bloco.includes('"já que estão aposentados"'),
    'as variações mais prováveis também ficam proibidas');
  assert.ok(bloco.includes('BENEFÍCIO concreto'),
    'no lugar da etiqueta vai o benefício concreto ou a palavra do próprio cliente');
}

// ── 5. Item 12 da conferência final (a lista curta que a IA relê antes de escrever) ──────────
{
  const i = src.indexOf('CONFERÊNCIA FINAL — FAÇA ISTO ANTES DE DEVOLVER O JSON');
  const lista = src.slice(i, src.indexOf('`;', i)).replace(/\s+/g, ' ');

  assert.ok(lista.includes('ALGUMA DAS TRÊS DEVOLVE O TRABALHO PRO CLIENTE?'), 'item 12');
  assert.ok(lista.includes('nenhuma das três insiste nele nem tenta reverter a objeção'),
    'item 12 precisa cobrir o imóvel recusado por motivo que ele não muda');
  assert.ok(lista.includes('nunca a etiqueta'),
    'item 12 precisa cobrir o dado pessoal devolvido ao cliente');
  assert.ok(lista.includes('Não devolva nada que não passe nos doze'),
    'a contagem do fecho precisa acompanhar os doze itens');
  // Nenhuma informação comercial cravada nas regras novas.
  assert.doesNotMatch(lista, /R\$|Renaissance|Leila|Senger/,
    'nenhuma regra pode carregar nome de empreendimento, de cliente ou valor');
}

// ── 6. As regras novas chegam de verdade no pedido — com e sem Cérebro configurado ───────────
{
  const timelineDoPrint = [
    { date: '18/06/2026', time: '17:17', author: 'Leila Regina Kohmann', text: 'Gostaria de receber as plantas dos apartamentos' },
    { date: '16/07/2026', time: '20:23', author: 'Leila Regina Kohmann', text: 'Obrigada, não ficaram dúvidas. Mas pensamos que 2030 para a entrega para nós é muito tempo. Queremos um lugar adequado para nossa idade (faixa dos 70 anos). Queremos alguma coisa mais próxima, ou talvez pronta.' },
    { date: '16/07/2026', time: '20:43', author: 'Construtora Senger', text: 'Boa noite, Leila! Vou buscar algumas opções de imóveis prontos ou com entrega mais próxima. Existe alguma preferência de local ou tipo de apartamento que devo considerar?' }
  ];

  const rodar = async (cerebroConfig) => {
    let pedidoEnviado = '';
    const openaiMock = {
      chat: { completions: { create: async (args) => {
        pedidoEnviado = args.messages.map(m => m.content).join('\n\n');
        return { model: 'mock-gpt', choices: [{ message: { content: JSON.stringify({
          summary: 'Resumo',
          diagnostico: {},
          mensagens: {
            recomendada: 'Boa tarde Leila, tudo bem? Vou separar opções prontas e te apresento: terça ou quinta de manhã?',
            maisSuave: 'Boa tarde Leila, tudo bem? Já estou olhando o que está pronto para entrega.',
            maisDireta: 'Boa tarde Leila, tudo bem? Terça ou quinta de manhã eu te mostro as opções?'
          },
          quemEhOCliente: 'Leila Regina Kohmann',
          produtoInteresse: 'Não identificado',
          etapaSugerida: 'Atendimento',
          clientProfile: 'Perfil',
          nextAction: 'Ação'
        }) } }] };
      } } }
    };
    await analyzeWithBrain({
      lead: { clientName: 'Leila Regina Kohmann', corretorNome: 'Sanchai' },
      timeline: timelineDoPrint,
      openai: openaiMock,
      cerebroConfig
    });
    return pedidoEnviado;
  };

  const comCerebro = await rodar({ corretorNome: 'Sanchai', metodo: 'Método do corretor.', tom: 'Tom do corretor.', regras: [{ texto: 'Regra de teste.' }] });
  const semCerebro = await rodar(null);

  for (const [nome, pedido] of [['com Cérebro', comCerebro], ['modo prévia', semCerebro]]) {
    assert.ok(pedido.includes('O CLIENTE JÁ DISSE O QUE QUER — A BUSCA É TRABALHO DO CORRETOR'),
      `a regra da busca precisa chegar à IA (${nome})`);
    assert.ok(pedido.includes('OBJEÇÃO QUE O PRODUTO NÃO RESOLVE = TROCAR DE PRODUTO'),
      `a regra da objeção estrutural precisa chegar à IA (${nome})`);
    assert.ok(pedido.includes('NÃO VOLTA COMO ETIQUETA'),
      `a regra do dado pessoal precisa chegar à IA (${nome})`);
    assert.ok(pedido.includes('ALGUMA DAS TRÊS DEVOLVE O TRABALHO PRO CLIENTE?'),
      `o item 12 da conferência precisa chegar à IA (${nome})`);
    // A pergunta que ficou sem resposta continua chegando como fato (v1277), agora com a regra
    // nova por cima dela.
    assert.ok(pedido.includes('TENTATIVAS DO CORRETOR AINDA SEM RESPOSTA: 1'),
      `a tentativa sem resposta da cliente precisa ser contada (${nome})`);
    assert.ok(pedido.includes('preferência de local ou tipo de apartamento'),
      `o texto da pergunta ignorada precisa ir junto, senão a IA a repete (${nome})`);
  }
}

// ── 7. O código continua só instruindo: nada de cortar ou reescrever o texto da IA ───────────
// (v1247: o corte determinístico de frase foi removido a pedido do dono e não pode voltar.)
assert.ok(!/limparFrasesProibidas|melhorLimpa|construirMensagensDeterministicasCerebro/.test(src),
  'nenhuma cirurgia no texto da IA pode ter voltado junto com estas regras');

console.log('v1279-cliente-ja-disse-o-que-quer: ok');
