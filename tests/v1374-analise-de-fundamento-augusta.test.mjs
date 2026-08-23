import assert from 'node:assert/strict';
import {
  parseWhatsappTxt,
  segmentarHistoricoComercial,
  fundamentosDeterministicosDaConversa,
  montarBlocoAnaliseDeFundamento,
  montarEstadoComercialDeterministico,
  topicosComerciaisConfirmadosDoCliente,
  fatosInventadosNaMensagem,
  analyzeWithBrain
} from '../api/_pipeline.js';

const C = 'Construtora Senger';
const lead = { clientName: 'Augusta Feldmann Sorteio' };
const agora = new Date('2026-08-23T18:54:00-03:00');
const historico = `[21/11/2025 11:17] Construtora Senger: *Parabéns Augusta! Sua inscrição está confirmada!*
Você agora está concorrendo à *Raqueteira da Construtora Senger!*
O sorteio acontece no *domingo, antes da grande final do torneio,* e você pode acompanhar tudo pelo Instagram: *@construtorasenger*
Aproveite os jogos, torça bastante e *boa sorte!*
Seu número da sorte é: *093*
[27/11/2025 16:58] Construtora Senger: Olá! Aqui é da Construtora Senger, tudo bem?
Por ter participado do sorteio no torneio de padel, você garantiu ofertas especiais de final de ano!
Além de imóveis prontos e na planta, quer uma informação PRIVILEGIADA antes de todos?
[22/08/2026 18:43] Construtora Senger: Anúncio do Instagram Mostrar detalhes Olá, temos um apartamento com 2 dormitórios e box de garagem por R$ 430.000. Quer agendar uma visita?
[22/08/2026 18:43] Augusta Feldmann Sorteio: Olá! Quero saber mais sobre o apartamento de R$ 430 mil.
[23/08/2026 12:00] Construtora Senger: [Arquivo enviado nesta mensagem: imagem — conteúdo não analisado pela IA]
Bom dia, Augusta! Tudo bem?
Claro Esse apartamento é novo, com 2 dormitórios, box de garagem e móveis planejados. Fica em região central e o condomínio conta com piscina, academia, lavanderia e 3 salões de festas. O valor é R$ 430 mil e pode ser financiado.
Me conta uma coisa: você está buscando um apartamento para morar ou pensando em investimento?
[23/08/2026 16:12] Augusta Feldmann Sorteio: Estou querendo morar
[23/08/2026 16:13] Augusta Feldmann Sorteio: Onde fica este imóvel?
[23/08/2026 17:18] Construtora Senger: Boa tarde, Augusta! Fica no Quality Residence, na Rua Carlos Barbosa, 375, bem no Centro.
Como você está procurando para morar, acho que vale a pena conhecer esse apartamento pessoalmente, principalmente porque ele já está pronto e com os móveis planejados.
[23/08/2026 17:19] Construtora Senger: https://maps.app.goo.gl/yVChD5XrVqpep13k7
[23/08/2026 17:19] Construtora Senger: [Arquivo enviado nesta mensagem: vídeo — conteúdo não analisado pela IA]
Área lazer
[23/08/2026 17:19] Construtora Senger: [Arquivo enviado nesta mensagem: vídeo — conteúdo não analisado pela IA]
802A`;

const timeline = parseWhatsappTxt(historico);
assert.equal(timeline.length, 11);

// 1) O histórico inteiro continua existindo, mas o episódio comercial atual começa no anúncio novo.
const episodio = segmentarHistoricoComercial(timeline, C, lead);
assert.equal(episodio.houveCorteForte, true);
assert.equal(episodio.gapDias, 268);
assert.equal(episodio.anterior.length, 2);
assert.equal(episodio.atual.length, 9);
assert.equal(episodio.inicioAtual.data, '22/08/2026');
assert.match(episodio.inicioAtual.texto, /apartamento com 2 dormitórios.*430\.000/i);
console.log('1374 fundamento 1/7 — separa contexto antigo do episódio atual sem apagar histórico: OK');

// 2) “Quero saber mais sobre o apartamento de R$ 430 mil” é interesse no anúncio, NÃO orçamento.
const topicos = topicosComerciaisConfirmadosDoCliente(timeline, C, lead, agora);
assert.ok(topicos.some(x => x.id === 'finalidade' && /morar/i.test(x.fala)));
assert.ok(!topicos.some(x => x.id === 'faixa_valor'), 'preço do anúncio não pode virar orçamento declarado do cliente');
console.log('1374 fundamento 2/7 — preço do anúncio não vira orçamento do cliente: OK');

// 3) A resposta de localização precisa fechar “Onde fica este imóvel?” por sentido, não por palavra repetida.
const estadoAtual = montarEstadoComercialDeterministico(episodio.atual, C, lead, agora);
assert.equal(estadoAtual.perguntasDoClienteAbertas.length, 0, 'localização já foi respondida com prédio + rua + centro');
const fundamentos = fundamentosDeterministicosDaConversa(timeline, C, lead, agora, estadoAtual);
assert.ok(fundamentos.perguntasDoClienteJaRespondidas.some(x => x.topico === 'localizacao' && /Carlos Barbosa, 375/i.test(x.resposta)));
assert.equal(fundamentos.pendenciasFatuaisAbertas.length, 0);
console.log('1374 fundamento 3/7 — pergunta respondida não continua aberta: OK');

// 4) O fundamento precisa lembrar o que já foi informado e o que já foi enviado.
const bloco = montarBlocoAnaliseDeFundamento(fundamentos);
assert.match(bloco, /CONTEXTO HISTÓRICO/i);
assert.match(bloco, /JÁ DEFINIDO PELO CLIENTE/i);
assert.match(bloco, /Estou querendo morar/i);
assert.match(bloco, /Rua Carlos Barbosa, 375/i);
assert.match(bloco, /maps\.app\.goo\.gl/i);
assert.match(bloco, /Área lazer/i);
assert.match(bloco, /802A/i);
assert.match(bloco, /nenhuma pendência factual explícita identificada/i);
console.log('1374 fundamento 4/7 — consolida fatos, respostas e materiais já enviados: OK');

// 5) Endereço que está literalmente na conversa não pode receber tarja de “endereço inventado”.
const sugestaoComEndereco = 'Boa noite, Augusta! O apartamento fica no Quality Residence, na Rua Carlos Barbosa, 375, bem no Centro.';
assert.deepEqual(fatosInventadosNaMensagem(sugestaoComEndereco, { conversa: historico, cerebro: '' }), []);
console.log('1374 fundamento 5/7 — endereço presente no histórico não gera falso aviso: OK');

// 6) E2E do pedido: a IA recebe a conversa COMPLETA e, antes das mensagens, recebe o fundamento.
// O modo padrão continua com UMA chamada; não voltamos à lentidão das duas chamadas sequenciais.
let chamadas = 0;
let promptRecebido = '';
const respostaModelo = {
  quemEhOCliente: 'Augusta Feldmann Sorteio',
  fundamentos: {
    negociacaoAtual: 'Atendimento atual iniciado pelo anúncio do apartamento de R$ 430 mil em 22/08/2026.',
    contextoAnterior: 'Sorteio e oferta promocional de 2025 são contexto anterior e não definem a negociação atual.',
    fatosJaDefinidos: ['Busca para morar.'],
    oCorretorJaInformou: ['Quality Residence, Rua Carlos Barbosa, 375, Centro.', 'Imóvel pronto, com móveis planejados e financiável.'],
    materiaisJaEnviados: ['Localização no Maps', 'Vídeo da área de lazer', 'Vídeo do 802A'],
    assuntosJaResolvidos: ['Finalidade: moradia', 'Localização do imóvel'],
    oQueSegueAberto: ['Reação da cliente ao material e avanço comercial a partir disso.'],
    leituraCronologica: 'Ela voltou pelo anúncio do Quality. Confirmou moradia. Perguntou localização e recebeu endereço, mapa e vídeos. A condução seguinte deve partir disso, sem refazer a qualificação já concluída.'
  },
  summary: 'Augusta voltou pelo anúncio do apartamento de R$ 430 mil, busca para morar e já recebeu localização e vídeos.',
  leituraDaConversa: { comoConduzir: 'Partir do material já enviado e avançar sem repetir localização, finalidade ou características já informadas.' },
  diagnostico: { ultimaPessoaFalar: 'Corretor', produtoPrincipal: 'Quality Residence 802A', etapaFunil: 'Interesse', proximoPasso: 'Avançar a partir da reação aos vídeos', quemDeveAgirAgora: 'Corretor' },
  mensagens: {
    aLabel: 'Parte dos vídeos', bLabel: 'Confere interesse', cLabel: 'Avança visita', ordemDeEnvio: 'Use a recomendada como primeira opção.',
    recomendada: 'Boa noite, Augusta! Conseguiu dar uma olhada nos vídeos do 802A? Pelo que você viu, faz sentido conhecer o apartamento pessoalmente?',
    maisSuave: 'Boa noite, Augusta! Deu para olhar os vídeos do 802A? Me diz o que achou e eu sigo a partir disso.',
    maisDireta: 'Boa noite, Augusta! Depois de ver o 802A, quero te mostrar o apartamento pessoalmente. Qual período costuma ser melhor para você?'
  },
  produtoInteresse: 'Quality Residence 802A', produtosInteresse: ['Quality Residence 802A'], etapaSugerida: 'Interesse', clientProfile: 'Moradia', nextAction: 'Avançar a partir da reação aos vídeos',
  recomendacaoContato: { aguardar: false, motivo: '' }
};
const openai = { chat: { completions: { create: async (req) => {
  chamadas++;
  promptRecebido = req?.messages?.find(m => m.role === 'user')?.content || '';
  return { model: 'mock', usage: { prompt_tokens: 1, completion_tokens: 1 }, choices: [{ message: { content: JSON.stringify(respostaModelo) } }] };
} } } };

const resultado = await analyzeWithBrain({
  lead, timeline, openai, organizationId: 'org-v1374',
  cerebroConfig: { corretorNome: C, metodo: 'Analise a negociação inteira antes de sugerir mensagem.', diasDescansoPosAtendimento: 5 },
  etapas: 1
});
assert.equal(chamadas, 1, 'fundamento não pode obrigar uma segunda chamada lenta');
assert.match(promptRecebido, /ANÁLISE DE FUNDAMENTO — LEIA ISTO ANTES DE PENSAR EM PRÓXIMA MENSAGEM/);
assert.match(promptRecebido, /CORTE DE CONTEXTO FORTE: houve 268 dias/i);
assert.match(promptRecebido, /EPISÓDIO ATUAL começa em: \[22\/08\/2026 18:43\]/i);
assert.match(promptRecebido, /PERGUNTAS DO CLIENTE JÁ RESPONDIDAS PELO CORRETOR: localizacao/i);
assert.match(promptRecebido, /Rua Carlos Barbosa, 375/i);
assert.match(promptRecebido, /802A/i);
assert.match(promptRecebido, /CONVERSA COMPLETA:/i);
assert.match(promptRecebido, /21\/11\/2025 11:17/i, 'o histórico antigo continua presente na conversa completa');
assert.doesNotMatch(promptRecebido, /PERGUNTAS DO CORRETOR QUE O CLIENTE NUNCA RESPONDEU[\s\S]{0,600}informação PRIVILEGIADA/i,
  'a pergunta promocional de 2025 não pode comandar o fichário do episódio atual');
assert.equal(resultado.fundamentosDaAnalise.negociacaoAtual, respostaModelo.fundamentos.negociacaoAtual);
console.log('1374 fundamento 6/7 — mesmo histórico, fundamento primeiro e uma chamada por padrão: OK');

// 7) O resultado preserva a análise de fundamento para auditoria/depuração sem expor outro caso.
assert.ok(resultado.fundamentosDaAnalise.fatosJaDefinidos.some(x => /morar/i.test(x)));
assert.ok(resultado.fundamentosDaAnalise.assuntosJaResolvidos.some(x => /localiza/i.test(x)));
assert.ok(resultado.fundamentosDaAnalise.materiaisJaEnviados.some(x => /802A/i.test(x)));
console.log('1374 fundamento 7/7 — fundamento fica disponível no resultado da análise: OK');

console.log('v1374-analise-de-fundamento-augusta: 7/7 OK');
