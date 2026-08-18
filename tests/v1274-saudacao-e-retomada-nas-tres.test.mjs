import fs from 'node:fs';
import assert from 'node:assert/strict';
import { analyzeWithBrain } from '../api/_pipeline.js';

// v1274 — "cadê a saudação? a retomada?" (dono, 14/08/2026, com print das três sugestões).
//
// O caso: lead do Evolutti parado desde 06/08 (o corretor mandou os valores e o link com três
// opções selecionadas, e o assunto morreu ali). As três sugestões saíram assim:
//   1. "Das opções e valores que você conferiu no material, ficou alguma dúvida…"
//   2. "Recebeu tempo de analisar as opções que te passei?…"
//   3. "Consigo agendar uma visita ao apartamento do Evolutti…"
// Nenhuma cumprimenta o cliente, nenhuma chama ele pelo nome — e as mensagens REAIS do corretor
// nessa mesma conversa abrem todas com "Bom dia Gabriel, tudo bem?".
//
// A causa estava numa contradição dentro do próprio pedido enviado à IA:
//   • a regra da retomada (v1225) mandava RECONHECER o tempo parado;
//   • a regra do tempo parado (v1255, ordem do dono) proibia falar do intervalo em qualquer forma.
// Com as duas no mesmo texto, a IA largava a retomada inteira e escrevia como se a conversa nunca
// tivesse parado — sem cumprimento nenhum, porque a regra da espinha ("abre por um fato concreto")
// virava, na prática, "não cumprimente".

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// ── 1 e 2. ATENÇÃO, ISTO MUDOU DE FORMA NA v1291 ─────────────────────────────────────────────
// O dono entregou pronta uma reescrita das instruções. Nela saíram do produto: o bloco "RETOMADA
// DEPOIS DE DIAS SEM CONVERSA — REGRA DURA", a ordem de as três abrirem com saudação + primeiro
// nome, e o bloco "TEMPO PARADO NÃO ENTRA NA MENSAGEM". Quem decide saudação e retomada passou a
// ser o Cérebro do corretor, e o sistema passou a entregar só o insumo. É isso que se confere
// aqui — se as sugestões voltarem a chegar sem cumprimentar, é no Cérebro que a regra entra.
{
  assert.match(src, /Saudação correspondente ao horário neste instante: \$\{saudacaoDoHorario\}/,
    'a saudação certa do horário continua indo pronta pra IA');
  assert.match(src, /Dias corridos desde a última mensagem identificada/,
    'e o tempo parado continua indo como informação');
  assert.match(src, /A saudação, o reconhecimento ou não do intervalo e o tipo de próximo passo devem seguir o Cérebro\./,
    'quem manda na saudação e na retomada agora é o Cérebro do corretor');
}

// ── 3. A REDE DE SEGURANÇA FOI REMOVIDA NA v1293 ─────────────────────────────────────────────
//
// Ordem do dono na revisão de 18/08/2026: *"foda-se saudação, se isso consome algo elimine, eu
// quero otimização"*. A função `garantirSaudacaoAbertura` (e o `primeiroNomeDoCliente`, que só
// existia pra ela) já estava DESLIGADA desde a v1291 — a reescrita das instruções entregue pelo
// dono passou a deixar saudação e retomada por conta do Cérebro. Ou seja: era código correto,
// testado e sem nenhum chamador, viajando pro celular a cada atualização. Saiu.
//
// Quem cuida da saudação hoje:
//   • o CÉREBRO do corretor decide se cumprimenta e como (conferido no bloco 1 acima);
//   • a FAIXA do dia (não escrever "boa noite" às 17h) continua sendo corrigida na hora de
//     mostrar a mensagem, por corrigirSaudacaoAbertura — conferido no teste da v1218.
{
  const saudacaoJs = fs.readFileSync(new URL('../js/saudacao.js', import.meta.url), 'utf8');
  assert.ok(!/garantirSaudacaoAbertura/.test(saudacaoJs),
    'a rede de segurança da saudação saiu na v1293; se voltar, precisa voltar com alguém chamando');
  assert.ok(!/primeiroNomeDoCliente/.test(saudacaoJs),
    'primeiroNomeDoCliente existia só pra rede de segurança — saiu junto');
  assert.match(saudacaoJs, /export function corrigirSaudacaoAbertura/,
    'a correção da FAIXA do dia continua — é ela que impede "boa noite" às 17h');
}

// ── 4. ATENÇÃO, ISTO MUDOU DE COMPORTAMENTO NA v1291 ─────────────────────────────────────────
// Até a v1290, quando a IA devolvia uma sugestão SEM cumprimento e a conversa estava parada havia
// dias, o próprio sistema colocava "Bom dia, Gabriel! " na frente antes de mostrar na tela. Na
// reescrita entregue pelo dono, essa rede saiu: a análise não chama mais a função que acrescentava
// a saudação. Agora o texto que a IA escreveu é exibido exatamente como veio — quem garante o
// cumprimento é o Cérebro do corretor. (A correção da FAIXA do dia, quando a IA escreve "boa
// noite" às 17h, continua valendo: ela mora no app e é conferida pelo teste v1218.)
{
  assert.ok(!/garantirSaudacaoAbertura/.test(src),
    'a análise não acrescenta mais saudação nenhuma; se voltar a acrescentar, este teste volta a cobrar as três cumprimentando');
}

// ── 5. Conversa que continua HOJE: o código não encosta na saudação ──────────────────────────
{
  const hoje = new Date();
  const hojeBR = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
  const timeline = [
    { date: hojeBR, time: '09:00', author: 'Gabriel Quality', text: 'Bom dia! Recebi o material, obrigado.' },
    { date: hojeBR, time: '09:05', author: 'Construtora Senger', text: 'Bom dia Gabriel! Qualquer dúvida da planta me diz.' }
  ];
  const semSaudacao = 'Gabriel, das duas plantas que te mandei, qual chegou mais perto do que vocês querem?';
  const openaiMock = {
    chat: { completions: { create: async () => ({
      model: 'mock-gpt',
      choices: [{ message: { content: JSON.stringify({
        summary: 'Resumo',
        diagnostico: { produtoPrincipal: 'Evolutti', etapaFunil: 'Atendimento' },
        mensagens: { recomendada: semSaudacao, maisSuave: semSaudacao, maisDireta: semSaudacao },
        quemEhOCliente: 'Gabriel Quality',
        produtoInteresse: 'Evolutti',
        etapaSugerida: 'Atendimento',
        clientProfile: 'Perfil',
        nextAction: 'Ação'
      }) } }]
    }) } }
  };
  const resultado = await analyzeWithBrain({
    lead: { clientName: 'Gabriel Quality' },
    timeline,
    openai: openaiMock,
    cerebroConfig: { metodo: 'Método do corretor.', tom: 'Tom do corretor.', regras: [{ texto: 'Regra de teste.' }] }
  });
  assert.equal(resultado.messages.a, semSaudacao,
    'conversa que continua hoje: quem decide a saudação é a regra do prompt, o código não acrescenta nada');
}

console.log('v1274-saudacao-e-retomada-nas-tres: ok');
