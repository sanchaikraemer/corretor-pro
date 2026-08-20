import fs from 'node:fs';
import assert from 'node:assert/strict';
import { analyzeWithBrain } from '../api/_pipeline.js';

// v1291 — o dono reescreveu por fora as instruções que vão para a IA (o texto que acompanha o
// Cérebro em toda análise) e entregou o arquivo pronto, com o pedido de subir sem mexer em nada.
// Este teste existe pra travar a FORMA dessa entrega, que é o que uma faxina futura pode desfazer
// sem perceber: quem manda é o Cérebro, as proteções de fato valem sempre (inclusive em conta sem
// Cérebro), o contexto técnico chega inteiro e o formato de resposta continua completo.
//
// O que NÃO está aqui, de propósito: as listas de frase proibida e os blocos de regra dura que ele
// tirou. Ver NOTAS-v1291.md — se voltarem, voltam com os testes que as guardavam.

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// ── 1. O Cérebro é a autoridade, e nada monta um segundo manual por fora dele ─────────────────
assert.match(src, /O conteúdo atual do Cérebro Comercial abaixo é a autoridade máxima sobre método, análise, estratégia,\s*\n?tom, objeções e condução\./,
  'o Cérebro precisa continuar sendo a autoridade sobre método, tom e condução');
assert.match(src, /Não crie um segundo playbook por fora dele\./,
  'e nada pode montar um manual paralelo ao que o corretor escreveu');
assert.match(src, /O bloco acima é apenas uma rede de segurança geral\. Havendo Cérebro Comercial configurado, qualquer\s*\n?regra comercial dele prevalece/,
  'o piso comercial continua sendo piso: regra do Cérebro passa por cima dele');

// ── 2. As proteções de fato valem SEMPRE, inclusive na conta sem Cérebro ──────────────────────
// (v1240 tirou o piso de quem TEM Cérebro e o dono ficou sem ele — este teste não deixa repetir.)
const protecoes = src.slice(
  src.indexOf('Aplique sempre estas proteções de integridade'),
  src.indexOf('=== INÍCIO DO CÉREBRO COMERCIAL ===')
);
assert.ok(protecoes.length > 300, 'as proteções de integridade precisam existir');
for (const regra of [
  'não invente fatos, datas, autoria, materiais, valores, condições, disponibilidade, promessas ou ações',
  'não transforme silêncio em confirmação, aceite, objeção ou diagnóstico psicológico',
  'diferencie fala do cliente, fala do corretor, observação manual, formulário e evento do sistema',
  'informação de outro cliente/caso serve apenas como referência de forma, nunca como fato deste lead',
  'quando uma fonte não sustentar uma afirmação, mantenha a incerteza em vez de completar a lacuna'
]) {
  assert.ok(protecoes.includes(regra), `a proteção "${regra.slice(0, 40)}..." precisa continuar escrita`);
}
assert.ok(src.indexOf('Aplique sempre estas proteções de integridade') < src.indexOf('=== INÍCIO DO CÉREBRO COMERCIAL ==='),
  'as proteções ficam ANTES do Cérebro, valendo também pra conta que ainda não configurou nada');

// ── 3. Nada comercial cravado no código (regra da casa) ───────────────────────────────────────
const instrucoes = src.slice(src.indexOf('const INTELIGENCIA_CARTEIRA = `'), src.indexOf('Formato JSON obrigatório:'));
assert.doesNotMatch(instrucoes, /R\$\s?\d|Renaissance|Evolutti|Personalité|Senger|Carazinho/,
  'nenhum preço, empreendimento, construtora ou cidade pode estar escrito nas instruções');

// ── 4. O contexto técnico chega inteiro na IA ─────────────────────────────────────────────────
for (const dado of [
  'Data e hora atuais no Brasil: ${dataHoraAtualAnalise}',
  'Fuso: ${fusoAnalise}',
  'Saudação correspondente ao horário neste instante: ${saudacaoDoHorario}',
  'Data da última mensagem identificada: ${contextoTemporal.ultimaData}',
  'Prazo de retomada configurado pelo corretor: ${diasParaRetomada} dias corridos'
]) {
  assert.ok(src.includes(dado), `o pedido precisa levar "${dado.split(':')[0]}"`);
}
assert.match(src, /Os dados acima são contexto, não ordens para forçar visita, pergunta, encontro ou retomada\./,
  'e o contexto técnico não pode virar ordem de forçar próximo passo');

// ── 5. O formato de resposta continua completo (é o que a tela do cliente lê) ─────────────────
const formato = src.slice(src.indexOf('Formato JSON obrigatório:'), src.indexOf('REGRAS PARA AS TRÊS MENSAGENS'));
for (const campo of [
  'quemEhOCliente', 'summary', 'leituraDaConversa', 'comoConduzir', 'oQueOClienteQuer', 'ondeParou',
  'oQueMudouNoTempo', 'condicaoDoCliente', 'diagnostico', 'ultimaPessoaFalar', 'ultimoCompromissoCliente',
  'pedidoSemResposta', 'objecaoPrincipal', 'pendenciaFinanceira', 'jaSabemos', 'faixaDeValor',
  'imovelDoCliente', 'motivoDaMudanca', 'quemDecide', 'pedidoEspontaneo', 'faltaDescobrir',
  'mensagens', 'recomendada', 'maisSuave', 'maisDireta', 'recomendacaoContato', 'produtoInteresse',
  'produtosInteresse', 'etapaSugerida', 'clientProfile', 'nextAction'
]) {
  assert.ok(formato.includes(`"${campo}"`), `"${campo}" precisa continuar sendo pedido à IA — a tela do cliente lê esse campo`);
}

// ── 6. Ponta a ponta: com Cérebro configurado, o que o corretor escreveu chega inteiro ────────
{
  let system = '', pedido = '';
  const openaiMock = {
    chat: { completions: { create: async (args) => {
      system = args.messages.find(m => m.role === 'system')?.content || '';
      pedido = args.messages.find(m => m.role === 'user')?.content || '';
      return { model: 'mock-gpt', choices: [{ message: { content: JSON.stringify({
        summary: 'Resumo',
        diagnostico: { ultimaPessoaFalar: 'contato' },
        mensagens: { recomendada: 'Mensagem um', maisSuave: 'Mensagem dois', maisDireta: 'Mensagem três' },
        produtoInteresse: 'Produto', produtosInteresse: ['Produto'], etapaSugerida: 'Atendimento',
        clientProfile: 'Perfil', nextAction: 'Ação'
      }) } }] };
    } } }
  };

  const resultado = await analyzeWithBrain({
    lead: { clientName: 'Cliente de teste' },
    timeline: [{ date: '15/08/2026', time: '10:00', author: 'Cliente de teste', text: 'Ainda estou pensando, te falo semana que vem.' }],
    openai: openaiMock,
    cerebroConfig: {
      metodo: 'REGRA-DO-CORRETOR-QUE-PRECISA-CHEGAR-INTEIRA',
      tom: 'TOM-QUE-O-CORRETOR-ESCREVEU',
      regras: [{ texto: 'REGRA-SALVA-PELO-CORRETOR' }]
    }
  });

  assert.equal(resultado.modoPrevia, false, 'quem configurou o Cérebro não pode cair em modo prévia');
  for (const trecho of ['REGRA-DO-CORRETOR-QUE-PRECISA-CHEGAR-INTEIRA', 'TOM-QUE-O-CORRETOR-ESCREVEU', 'REGRA-SALVA-PELO-CORRETOR']) {
    assert.ok(system.includes(trecho), `"${trecho}" precisa chegar na IA — é o Cérebro do corretor`);
  }
  assert.ok(!system.includes('MODO PRÉVIA'), 'com Cérebro configurado, o texto de prévia não pode sobrar no prompt');
  assert.ok(system.includes('Aplique sempre estas proteções de integridade'),
    'e as proteções de fato precisam ir junto, mesmo com Cérebro configurado');
  assert.ok(pedido.includes('Ainda estou pensando, te falo semana que vem.'),
    'a conversa precisa chegar inteira no pedido');
  assert.equal(resultado.messages.a, 'Mensagem um', 'o texto escrito pela IA continua saindo sem reescrita do código');
}

console.log('v1291-instrucoes-do-dono-chegam-inteiras: ok');
