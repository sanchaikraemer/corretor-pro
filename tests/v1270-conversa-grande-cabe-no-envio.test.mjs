import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  LIMITE_ENVIO_BYTES,
  MARGEM_ENVIO_BYTES,
  datarAudios,
  fraseDoCorte,
  lerMensagensDoTxt,
  planejarConteudoDoZip
} from '../js/enxugar-zip.js';

// v1270 — print do dono (14/08/2026): "Conversa do WhatsApp com Patricia Frasson
// Renaissance.zip (183.5 MB)" → "ZIP maior que o limite permitido de 150 MB." e um "Tentar
// novamente" que dava exatamente o mesmo erro pra sempre. Este teste EXECUTA a regra que decide
// o que entra no envio (não confere por leitura).

const MB = 1024 * 1024;
const DIA = 86400000;

function dataBr(deslocamentoDias){
  const d = new Date(Date.UTC(2026, 7, 14, 15, 0, 0) - deslocamentoDias * DIA);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

// Conversa de dois anos: um áudio por dia, do mais antigo pro mais novo (é assim que o export
// do WhatsApp escreve).
function conversaDeAnos(dias){
  const linhas = [];
  const audios = [];
  for(let i = dias - 1; i >= 0; i--){
    const nome = `00000${1000 - i}-AUDIO-2026-${String(i)}-WA0001.opus`;
    linhas.push(`${dataBr(i)} 09:${String(i % 60).padStart(2, '0')} - Patricia: bom dia!`);
    linhas.push(`${dataBr(i)} 09:${String(i % 60).padStart(2, '0')} - Patricia: ${nome} (arquivo anexado)`);
    audios.push({ caminho: nome, bytes: 1 * MB });
  }
  return { txt: linhas.join('\n'), audios };
}

// ── 1. O limite daqui é o MESMO que a rota de envio aplica ───────────────────────────────────
{
  const rota = fs.readFileSync(new URL('../api/processar-storage.js', import.meta.url), 'utf8');
  const achado = rota.match(/DEFAULT_MAX_ZIP_BYTES\s*=\s*(\d+)\s*\*\s*1024\s*\*\s*1024/);
  assert.ok(achado, 'api/processar-storage.js precisa continuar declarando o limite em MB');
  assert.equal(
    LIMITE_ENVIO_BYTES, Number(achado[1]) * MB,
    'se os dois números se separarem, o aparelho volta a mandar arquivo que o servidor recusa'
  );
}

// ── 2. Áudio fora do período não é enviado: o servidor não ia transcrever mesmo ───────────────
{
  const { txt, audios } = conversaDeAnos(730); // 730 MB de áudio, 2 anos
  const plano = planejarConteudoDoZip({ txt, audios, diasJanela: 90, bytesTexto: 200 * 1024 });

  assert.equal(plano.resumo.totalAudios, 730);
  assert.ok(plano.resumo.foraDaJanela > 600, 'áudio de mais de 90 dias atrás tem que ficar de fora');
  assert.ok(plano.resumo.mantidos <= 91, 'só o áudio dentro do período pode ser enviado');
  assert.ok(
    plano.resumo.bytesEstimados < LIMITE_ENVIO_BYTES - MARGEM_ENVIO_BYTES,
    'o resultado precisa caber no envio — era isso que não acontecia'
  );
  // O que ficou é o mais RECENTE, que é o que importa pra próxima conversa.
  assert.ok(plano.manter.includes(audios[audios.length - 1].caminho), 'o áudio de hoje não pode sair');
  assert.ok(!plano.manter.includes(audios[0].caminho), 'o áudio de 2 anos atrás não pode ir junto');
}

// ── 3. Mesmo sem período (todo o período), a conversa PRECISA caber ──────────────────────────
{
  const { txt, audios } = conversaDeAnos(400); // 400 MB só de áudio, sem recorte por data
  const plano = planejarConteudoDoZip({ txt, audios, diasJanela: 'all', bytesTexto: 200 * 1024 });

  assert.equal(plano.resumo.foraDaJanela, 0, 'sem período escolhido, nada sai por data');
  assert.ok(plano.resumo.cortouPorTamanho, 'precisa cortar por tamanho pra caber');
  assert.ok(
    plano.resumo.bytesEstimados <= LIMITE_ENVIO_BYTES - MARGEM_ENVIO_BYTES,
    'depois do corte, o envio tem que caber no limite'
  );
  assert.ok(plano.manter.includes(audios[audios.length - 1].caminho), 'quem fica é sempre o mais recente');
  assert.ok(!plano.manter.includes(audios[0].caminho), 'quem sai é sempre o mais antigo');
  assert.match(fraseDoCorte(plano.resumo), /mais recentes/, 'a tela precisa dizer que áudios ficaram de fora');
}

// ── 4. O TEXTO da conversa nunca é sacrificado ───────────────────────────────────────────────
{
  // Um único áudio gigante, maior que o limite inteiro: ele sai, o texto fica.
  const txt = `${dataBr(0)} 10:00 - Patricia: bom dia\n${dataBr(0)} 10:01 - Patricia: gigante.opus (arquivo anexado)`;
  const plano = planejarConteudoDoZip({
    txt,
    audios: [{ caminho: 'gigante.opus', bytes: 400 * MB }],
    diasJanela: 90,
    bytesTexto: 3 * MB
  });
  assert.deepEqual(plano.manter, [], 'áudio que não cabe de jeito nenhum tem que sair');
  assert.equal(plano.resumo.naoCabeNemSoTexto, false, 'com o áudio fora, o texto cabe sozinho e a importação vai');
}

// ── 5. Conversa normal (pequena) continua indo inteira ───────────────────────────────────────
{
  const { txt, audios } = conversaDeAnos(20);
  const plano = planejarConteudoDoZip({ txt, audios, diasJanela: 90, bytesTexto: 50 * 1024 });
  assert.equal(plano.resumo.mantidos, 20, 'conversa que já cabia não pode perder nada');
  assert.equal(plano.resumo.cortouPorTamanho, false);
  assert.equal(fraseDoCorte(plano.resumo), '', 'sem corte, sem aviso na tela');
}

// ── 6. Áudio que o app não consegue datar não é jogado fora à toa ─────────────────────────────
{
  const txt = `${dataBr(0)} 10:00 - Patricia: bom dia\n${dataBr(500)} 09:00 - Patricia: oi`;
  const plano = planejarConteudoDoZip({
    txt,
    audios: [{ caminho: 'solto-sem-mencao.opus', bytes: 2 * MB }],
    diasJanela: 90,
    bytesTexto: 20 * 1024
  });
  assert.deepEqual(plano.manter, ['solto-sem-mencao.opus'],
    'sem saber a data, o áudio fica: só sai se faltar espaço de verdade');
  assert.equal(plano.resumo.foraDaJanela, 0);
}

// ── 7. Formatos de export que o app precisa entender (iOS com colchete, ano de 2 dígitos) ─────
{
  const mensagens = lerMensagensDoTxt(
    '[13/08/26, 09:12:44] Patricia: <anexado: 00000042-AUDIO-2026-08-13-WA0007.opus>\n' +
    'linha de continuação da mesma mensagem\n' +
    '14/08/2026, 10:00 - Corretor: bom dia'
  );
  assert.equal(mensagens.length, 2, 'linha solta pertence à mensagem anterior, não é mensagem nova');
  assert.ok(mensagens[0].ts && mensagens[1].ts, 'as duas datas precisam ser lidas');
  assert.ok(mensagens[1].ts > mensagens[0].ts, 'ano de 2 dígitos tem que virar 2026, não 26');

  const datas = datarAudios(mensagens, ['media/00000042-AUDIO-2026-08-13-WA0007.opus']);
  assert.equal(datas.size, 1, 'o formato "<anexado: ...>" do iPhone precisa casar com o arquivo');
}

// ── 8. Casamento pelo nome SEM extensão (o mesmo que o servidor aceita) ───────────────────────
{
  const mensagens = lerMensagensDoTxt(`${dataBr(1)} 08:00 - Patricia: PTT-20260813-WA0009 (arquivo anexado)`);
  const datas = datarAudios(mensagens, ['PTT-20260813-WA0009.opus']);
  assert.equal(datas.size, 1, 'sem a extensão escrita na linha, ainda assim é o mesmo áudio');
}

// ── 9. A recusa do servidor precisa dizer o que fazer, não só que deu errado ──────────────────
{
  const rota = fs.readFileSync(new URL('../api/processar-storage.js', import.meta.url), 'utf8');
  assert.match(rota, /Sem mídia/, 'a recusa por tamanho precisa ensinar a saída (reexportar sem mídia)');
  assert.ok(
    !/error: `ZIP maior que o limite permitido/.test(rota),
    'a frase antiga era um beco sem saída: não pode voltar'
  );
}

// ── 10. A importação não pode enviar um arquivo que o servidor vai recusar ────────────────────
{
  const imp = fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
  assert.match(imp, /planejarConteudoDoZip/, 'o preparo do ZIP precisa usar a regra de escolha');
  assert.match(imp, /working\.size > LIMITE_ENVIO_BYTES/,
    'precisa da rede de segurança que barra o envio antes do servidor recusar');
  assert.match(imp, /diasJanela: audioWindowDays/,
    'a escolha do áudio tem que usar o MESMO período que o servidor vai aplicar');
}

console.log('v1270 OK — conversa grande cabe no envio, texto nunca sai e o corte aparece na tela');
