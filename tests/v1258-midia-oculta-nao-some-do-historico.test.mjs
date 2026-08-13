import assert from 'node:assert/strict';
import { parseWhatsappTxt } from '../api/_pipeline.js';

// v1258 — BUG REAL, achado pelo dono depois de duas análises erradas seguidas sobre a mesma
// conversa (lead Marina). A pergunta dele foi certeira: "e isso deve estar no histórico em texto
// tb, nao esta?"
//
// Não estava. Quando a conversa é exportada do WhatsApp SEM os arquivos (a opção leve, e a que
// quase todo mundo escolhe), cada foto, PDF, catálogo ou tabela vira a linha "<Mídia oculta>".
// O app DESCARTAVA essa linha — e, quando ela era o único conteúdo da mensagem, a mensagem INTEIRA
// sumia da linha do tempo (o filtro `if (!text) return false` logo adiante).
//
// Consequência: o corretor mandava as opções por imagem/PDF, a IA não via rastro nenhum e concluía
// que ele nunca tinha respondido o cliente. Foi o que gerou o diagnóstico errado ("ela pediu 3
// dormitórios e nunca recebeu uma opção") e, pior, a regra da v1253 mandaria ele REENVIAR como
// novidade algo já enviado.
//
// A v1058 já tinha resolvido isso pro OUTRO formato de exportação — "IMG-x.jpg (arquivo anexado)",
// que só aparece quando a exportação INCLUI os arquivos. Faltava o formato sem arquivos.

const linha = (data, hora, autor, texto) => `${data} ${hora} - ${autor}: ${texto}`;

// ── 1. Mensagem que era SÓ um arquivo não pode mais sumir ────────────────────────────────────
{
  const txt = [
    linha('09/07/2026', '18:28', 'Cliente', 'Preciso com 3 quartos'),
    linha('09/07/2026', '18:59', 'Corretor', 'Certo, temos algumas opções com 3 dormitórios'),
    linha('09/07/2026', '19:00', 'Corretor', '<Mídia oculta>'),
    linha('09/07/2026', '19:35', 'Cliente', 'Vou ver o valor correto'),
  ].join('\n');

  const msgs = parseWhatsappTxt(txt);
  assert.equal(msgs.length, 4,
    'a mensagem que só tinha o arquivo NÃO pode sumir da conversa — era o bug');
  assert.match(msgs[2].text, /\[Arquivo enviado nesta mensagem: .* conteúdo não analisado pela IA\]/,
    'no lugar da linha descartada precisa ficar o marcador de que houve envio');
}

// ── 2. O tipo do arquivo é reconhecido quando o WhatsApp informa ─────────────────────────────
{
  const casos = [
    ['<imagem oculta>', /imagem/],
    ['imagem omitida', /imagem/],          // formato do iPhone, sem <>
    ['<vídeo oculto>', /vídeo/],
    ['documento omitido', /documento\/PDF/],
    ['áudio ocultado', /áudio/],
    ['<Mídia oculta>', /arquivo/],          // Android pt-BR não diz o tipo
  ];
  for (const [linhaMidia, esperado] of casos) {
    const msgs = parseWhatsappTxt(linha('09/07/2026', '19:00', 'Corretor', linhaMidia));
    assert.equal(msgs.length, 1, `"${linhaMidia}" não pode fazer a mensagem sumir`);
    assert.match(msgs[0].text, esperado, `"${linhaMidia}" precisa virar marcador de ${esperado}`);
  }
}

// ── 3. Texto + arquivo na mesma linha: os dois sobrevivem ────────────────────────────────────
{
  const msgs = parseWhatsappTxt(linha('09/07/2026', '19:00', 'Corretor', 'Segue a tabela <Mídia oculta>'));
  assert.equal(msgs.length, 1);
  assert.match(msgs[0].text, /Segue a tabela/, 'o texto escrito pelo corretor precisa continuar');
  assert.match(msgs[0].text, /\[Arquivo enviado nesta mensagem:/,
    'e o fato do envio precisa ficar registrado do lado dele');
}

// ── 4. O formato COM arquivos (v1058) continua funcionando igual ─────────────────────────────
{
  const msgs = parseWhatsappTxt([
    linha('09/07/2026', '19:00', 'Corretor', 'IMG-20260709-WA0001.jpg (arquivo anexado)'),
    linha('09/07/2026', '19:01', 'Corretor', 'tabela-valores.pdf (arquivo anexado)'),
  ].join('\n'));
  assert.equal(msgs.length, 2, 'o formato antigo não pode ter quebrado');
  assert.match(msgs[0].text, /imagem/, 'imagem anexada continua virando marcador de imagem');
  assert.match(msgs[1].text, /documento\/PDF/, 'PDF anexado continua virando marcador de documento');
}

// ── 5. Frase normal do corretor não pode ser confundida com arquivo ──────────────────────────
// A lista de palavras é fechada de propósito: "omitido" no meio de uma frase de verdade não pode
// fazer a mensagem virar marcador nem sumir.
{
  const frases = [
    'Nenhum dado foi omitido na proposta',
    'o valor da oculta não muda',
    'te mando a planta hoje',
  ];
  for (const frase of frases) {
    const msgs = parseWhatsappTxt(linha('09/07/2026', '19:00', 'Corretor', frase));
    assert.equal(msgs.length, 1, `"${frase}" não pode sumir`);
    assert.equal(msgs[0].text, frase, `"${frase}" precisa chegar inteira, sem virar marcador`);
  }
}

console.log('v1258-midia-oculta-nao-some-do-historico: ok');
