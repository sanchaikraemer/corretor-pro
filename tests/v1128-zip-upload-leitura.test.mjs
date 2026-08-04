import assert from 'node:assert/strict';
import { readRawBody, parseMultipart, decodeBase64Zip, lerZipDaRequisicao } from '../api/_zipUpload.js';

// v1128 — a auditoria completa encontrou api/_zipUpload.js SEM teste próprio: ele só era exercitado
// de raspão, por dentro do teste da rota do Atalho do iPhone. É o pedaço que lê o arquivo do
// WhatsApp que chega no corpo da requisição — se ele quebrar, o envio pelo Atalho para de funcionar
// inteiro (e é justamente o caminho de quem tem iPhone). Agora tem teste direto.
//
// O que fica provado aqui:
//   1. o teto de tamanho corta ANTES de carregar o arquivo inteiro na memória (413);
//   2. a leitura de formulário (multipart) acha o ZIP e os campos junto;
//   3. base64 é aceito com ou sem o prefixo "data:";
//   4. as três formas de envio (formulário, arquivo cru, JSON com base64) chegam no mesmo lugar;
//   5. corpo JSON estragado vira erro claro (400), não uma exceção solta.

function reqDeBytes(headers, ...pedacos) {
  return {
    headers,
    async *[Symbol.asyncIterator]() { for (const p of pedacos) yield Buffer.isBuffer(p) ? p : Buffer.from(p); }
  };
}

// ---------- 1. teto de tamanho ----------
{
  const req = reqDeBytes({}, Buffer.alloc(50), Buffer.alloc(50));
  await assert.rejects(
    () => readRawBody(req, 60),
    (e) => e.statusCode === 413 && /limite/i.test(e.message),
    'arquivo acima do teto precisa parar com 413'
  );
}
{
  const req = reqDeBytes({}, Buffer.alloc(30), Buffer.alloc(30));
  const lido = await readRawBody(req, 100);
  assert.equal(lido.length, 60, 'dentro do teto, o conteúdo precisa vir inteiro e emendado');
}

// ---------- 2. formulário (multipart) ----------
{
  const limite = 'meu-limite-123';
  const corpo = Buffer.concat([
    Buffer.from(`--${limite}\r\nContent-Disposition: form-data; name="audioWindowDays"\r\n\r\n30\r\n`),
    Buffer.from(`--${limite}\r\nContent-Disposition: form-data; name="arquivo"; filename="conversa.zip"\r\nContent-Type: application/zip\r\n\r\n`),
    Buffer.from('PKconteudo-do-zip'),
    Buffer.from(`\r\n--${limite}--\r\n`)
  ]);
  const { fields, files } = parseMultipart(corpo, limite);
  assert.equal(fields.audioWindowDays, '30', 'o campo de janela de áudio precisa ser lido junto');
  assert.equal(files.length, 1, 'precisa achar exatamente um arquivo');
  assert.equal(files[0].name, 'conversa.zip');
  assert.equal(files[0].buffer.toString(), 'PKconteudo-do-zip', 'o conteúdo do ZIP não pode ser cortado nem sujo');

  const viaRequisicao = await lerZipDaRequisicao(
    reqDeBytes({ 'content-type': `multipart/form-data; boundary=${limite}` }, corpo)
  );
  assert.equal(viaRequisicao.zipBuffer.toString(), 'PKconteudo-do-zip');
  assert.equal(viaRequisicao.audioWindowDays, '30');
}
{
  // Formulário sem "boundary" no cabeçalho é erro de quem enviou — precisa ser 400, não travar.
  await assert.rejects(
    () => lerZipDaRequisicao(reqDeBytes({ 'content-type': 'multipart/form-data' }, 'qualquer coisa')),
    (e) => e.statusCode === 400,
    'formulário sem boundary precisa dar 400'
  );
}

// ---------- 3. base64 com e sem prefixo ----------
{
  const original = Buffer.from('PKzip-de-teste');
  const b64 = original.toString('base64');
  assert.equal(decodeBase64Zip({ zipBase64: b64 })?.toString(), original.toString());
  assert.equal(decodeBase64Zip({ fileBase64: b64 })?.toString(), original.toString());
  assert.equal(decodeBase64Zip({ base64: `data:application/zip;base64,${b64}` })?.toString(), original.toString(),
    'o prefixo "data:" que alguns aparelhos mandam precisa ser ignorado');
  assert.equal(decodeBase64Zip({}), null, 'sem nenhum campo de arquivo, devolve nulo em vez de quebrar');
  assert.equal(decodeBase64Zip({ zipBase64: '   ' }), null, 'campo vazio devolve nulo');
}

// ---------- 4. arquivo cru e JSON chegam no mesmo lugar ----------
{
  const cru = await lerZipDaRequisicao(reqDeBytes({ 'content-type': 'application/zip' }, 'PKcru'));
  assert.equal(cru.zipBuffer.toString(), 'PKcru');
  assert.equal(cru.audioWindowDays, '90', 'sem informar a janela, o padrão de 90 dias vale');

  const octeto = await lerZipDaRequisicao(reqDeBytes({ 'content-type': 'application/octet-stream' }, 'PKocteto'));
  assert.equal(octeto.zipBuffer.toString(), 'PKocteto');

  const json = await lerZipDaRequisicao(reqDeBytes(
    { 'content-type': 'application/json' },
    JSON.stringify({ zipBase64: Buffer.from('PKjson').toString('base64'), audioWindowDays: '7' })
  ));
  assert.equal(json.zipBuffer.toString(), 'PKjson');
  assert.equal(json.audioWindowDays, '7');
}

// ---------- 5. JSON estragado vira erro claro ----------
{
  await assert.rejects(
    () => lerZipDaRequisicao(reqDeBytes({ 'content-type': 'application/json' }, '{isso nao e json')),
    (e) => e.statusCode === 400 && /JSON/i.test(e.message),
    'corpo estragado precisa virar 400 com mensagem clara'
  );
}
{
  const vazio = await lerZipDaRequisicao(reqDeBytes({ 'content-type': 'application/json' }));
  assert.equal(vazio.zipBuffer, null, 'corpo vazio devolve zip nulo, sem quebrar');
}

console.log('v1128-zip-upload-leitura: ok');
