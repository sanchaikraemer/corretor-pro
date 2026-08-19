import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  MOTIVO_NAO_ABRE,
  MOTIVO_PROTEGIDO,
  MOTIVO_SEM_TEXTO,
  MOTIVO_TEXTO_VAZIO,
  MOTIVO_VAZIO,
  formatarTamanhoArquivo,
  problemaAoAbrirOZip,
  problemaDoArquivoRecebido,
  problemaDoConteudoDoZip,
  tituloCurtoDaFalha
} from '../js/conferir-conversa.js';

// v1309 — print do dono (19/08/2026, 14:48): "Conversa do WhatsApp com Christian Boulevard.zip
// (0.0 MB)" → "Não foi possível analisar." e nada mais na tela. Três defeitos num print só:
// o tamanho não dizia nada, o motivo da falha ficava abaixo da dobra, e um arquivo que o próprio
// aparelho já sabia estar errado era enviado inteiro antes de o servidor recusar.
// Este teste EXECUTA as regras (não confere por leitura).

const raiz = new URL('../', import.meta.url);
const importacao = fs.readFileSync(new URL('js/importacao.js', raiz), 'utf8');

// ── 1. O tamanho na tela para de mentir ──────────────────────────────────────────────────────
{
  assert.equal(formatarTamanhoArquivo(0), 'vazio', 'zero byte não pode aparecer como "0.0 MB"');
  assert.equal(formatarTamanhoArquivo(320), '320 bytes');
  assert.equal(formatarTamanhoArquivo(48 * 1024), '48 KB', 'conversa só de texto tem que sair em KB');
  assert.equal(formatarTamanhoArquivo(8.2 * 1024 * 1024), '8.2 MB', 'acima de 1 MB continua em MB');
  assert.match(
    importacao,
    /Arquivo selecionado: "\+file\.name\+" \("\+formatarTamanhoArquivo\(file\.size\)\+"\)"/,
    'a linha "Arquivo selecionado" precisa usar o tamanho legível'
  );
}

// ── 2. Arquivo vazio para ANTES do envio ─────────────────────────────────────────────────────
{
  assert.equal(problemaDoArquivoRecebido({ size: 42 }), null, 'arquivo com conteúdo passa direto');
  const p = problemaDoArquivoRecebido({ size: 0 });
  assert.equal(p?.motivo, MOTIVO_VAZIO);
  assert.match(p.titulo, /vazi/i, 'o título precisa dizer que o arquivo veio vazio');
  assert.match(p.mensagem, /Exportar conversa/i, 'e precisa ensinar o caminho que resolve');
  assert.equal(problemaDoArquivoRecebido({})?.motivo, MOTIVO_VAZIO, 'sem tamanho conhecido também não dá pra enviar');
}

// ── 3. Arquivo que não é ZIP (ou veio pela metade, ou tem senha) ─────────────────────────────
{
  const naoAbre = problemaAoAbrirOZip(new Error("Can't find end of central directory : is this a zip file ?"));
  assert.equal(naoAbre?.motivo, MOTIVO_NAO_ABRE);
  assert.match(naoAbre.mensagem, /WhatsApp/i, 'a explicação precisa dizer como exportar de novo');

  assert.equal(problemaAoAbrirOZip(new Error('End of data reached'))?.motivo, MOTIVO_NAO_ABRE,
    'ZIP truncado (cópia interrompida) é problema de arquivo, não do servidor');
  assert.equal(problemaAoAbrirOZip(new Error('Encrypted zip are not supported'))?.motivo, MOTIVO_PROTEGIDO);

  // Qualquer outra falha ao abrir continua caindo no plano B (enviar o original) — é o que faz
  // uma conversa gigante entrar mesmo quando o celular não dá conta de reabrir o ZIP na memória.
  assert.equal(problemaAoAbrirOZip(new RangeError('Array buffer allocation failed')), null,
    'falha desconhecida não pode barrar a importação: o plano B de enviar o original continua');
}

// ── 4. ZIP sem o texto da conversa: mesma exigência do servidor, conferida no aparelho ───────
{
  const rota = fs.readFileSync(new URL('api/_pipeline.js', raiz), 'utf8');
  assert.match(rota, /Não encontrei o arquivo \.txt da conversa dentro do ZIP/,
    'o servidor continua exigindo o .txt — é essa exigência que o aparelho antecipa');

  const semTexto = problemaDoConteudoDoZip({ nomes: ['IMG-001.jpg', '0001-AUDIO.opus'], texto: '' });
  assert.equal(semTexto?.motivo, MOTIVO_SEM_TEXTO);
  assert.match(semTexto.mensagem, /2 arquivos/, 'dizer o que veio dentro ajuda o corretor a entender');

  const zipVazio = problemaDoConteudoDoZip({ nomes: [], texto: '' });
  assert.equal(zipVazio?.motivo, MOTIVO_SEM_TEXTO);
  assert.match(zipVazio.mensagem, /vazio por dentro/i);

  const textoEmBranco = problemaDoConteudoDoZip({ nomes: ['_chat.txt'], texto: '   \n  ' });
  assert.equal(textoEmBranco?.motivo, MOTIVO_TEXTO_VAZIO);

  assert.equal(
    problemaDoConteudoDoZip({ nomes: ['Conversa do WhatsApp com Christian.txt'], texto: '19/08/2026 14:48 - Christian: bom dia' }),
    null,
    'conversa de verdade (mesmo pequena, só texto) não pode ser barrada'
  );
}

// ── 5. O motivo aparece EM CIMA, onde o olho está ────────────────────────────────────────────
{
  assert.equal(
    tituloCurtoDaFalha('Não encontrei o arquivo .txt da conversa dentro do ZIP.'),
    'O arquivo veio sem o texto da conversa.'
  );
  assert.match(tituloCurtoDaFalha('Limite diário de 5 análises atingido.'), /Limite de an[áa]lises/);
  assert.match(
    tituloCurtoDaFalha('A conversa foi lida, mas a análise comercial não foi concluída.'),
    /a IA parou no meio/i
  );
  assert.equal(tituloCurtoDaFalha('signal is aborted without reason', true), 'Demorou demais — servidor não respondeu.');
  assert.equal(tituloCurtoDaFalha('erro estranho qualquer'), 'Não foi possível analisar.',
    'sem motivo reconhecido, a frase genérica continua sendo a saída');

  assert.match(importacao, /: tituloCurtoDaFalha\(err\?\.message, ehTimeout\);/,
    'o título da falha de análise precisa vir do motivo real');
  assert.match(importacao, /qs\("#resultCard"\)\?\.scrollIntoView/,
    'a tela precisa ir até a explicação — ela nasce abaixo da dobra no celular');
}

// ── 6. O que o aparelho já sabe não é jogado fora nem vira "tentar de novo" eterno ───────────
{
  assert.match(importacao, /if\(err\?\.conversaInvalida\) throw err;/,
    'o preparo do ZIP não pode engolir um problema conhecido e enviar assim mesmo');
  assert.match(importacao, /const problemaArquivo = problemaDoArquivoRecebido\(file\);/,
    'o arquivo vazio precisa ser barrado antes de qualquer envio');
  assert.match(importacao, /if\(problemaConteudo\) throw erroDaConversa\(problemaConteudo\);/,
    'ZIP sem o texto da conversa precisa parar no aparelho');
  assert.match(importacao, /btnEscolherOutroArquivo/,
    'com arquivo errado, a saída é escolher OUTRO arquivo — repetir o mesmo dá sempre o mesmo erro');
  const trecho = importacao.slice(importacao.indexOf('const arquivoInvalido'), importacao.indexOf('btnDescartarTentativa'));
  assert.ok(
    trecho.indexOf('btnEscolherOutroArquivo') < trecho.indexOf('btnTentarNovamente'),
    'com arquivo inválido o botão principal é "Escolher outro arquivo"; "Tentar novamente" fica só no outro ramo'
  );
  assert.match(trecho, /arquivoInvalido\s*\n\s*\? `<button[^`]*btnEscolherOutroArquivo/,
    'a escolha entre os dois botões precisa depender de o arquivo ser inválido');
}

// ── 7. O módulo novo é publicado junto com o app ─────────────────────────────────────────────
{
  const build = fs.readFileSync(new URL('build.js', raiz), 'utf8');
  assert.equal((build.match(/js\/conferir-conversa\.js/g) || []).length, 2,
    'o arquivo novo precisa entrar na lista de publicação E na de arquivos de texto do build');
}

console.log('v1309-arquivo-da-conversa-conferido-no-aparelho: ok');
